from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import shutil
import json
from datetime import datetime
import image_search
from spacy_analyzer import SpacyAnalyzer
from local_translator import LocalTranslator
from tts_service import TTSService

app = FastAPI(title="VocabCurve NLP Backend")

# Allow all origins - this is a local-only backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USERIMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "userimages"))
os.makedirs(USERIMAGES_DIR, exist_ok=True)
app.mount("/userimages", StaticFiles(directory=USERIMAGES_DIR), name="userimages")

# Initialize singletons
print("\n--- VOCABCURVE BACKEND STARTUP ---")
try:
    print("[1/3] Loading SpaCy Analyzer...")
    analyzer = SpacyAnalyzer()
    print("[2/3] Loading Local Translator...")
    translator = LocalTranslator()
    print("[3/3] Initializing TTS Service (Edge-TTS Mode)...")
    tts_service = TTSService(USERIMAGES_DIR)
    print("--- BACKEND READY ---\n")
except Exception as e:
    print(f"!!! CRITICAL STARTUP ERROR: {e}")
    # We continue so the server doesn't crash, but endpoints will report errors


class AnalyzeRequest(BaseModel):
    text: str
    lang: str

class TranslateRequest(BaseModel):
    sentence: str
    src_lang: str
    tgt_lang: str
    is_word: bool = False

class LookupRequest(BaseModel):
    words: list[str]
    lang: str

class SynonymsRequest(BaseModel):
    word: str
    lang: str
    top_n: int = 5
    target_lang: str = None

class ImageSearchRequest(BaseModel):
    word: str
    lang: str

class ImageSaveRequest(BaseModel):
    url: str
    word: str
    lang: str

class TTSRequest(BaseModel):
    text: str
    stem: str
    lang: str
    context: bool = False
    voice: str = None

class AddWordRequest(BaseModel):
    text: str
    lang: str

def get_dict_lang(lang_code: str) -> str:
    mapping = {
        "spa_Latn": "spanish", "es": "spanish",
        "eng_Latn": "english", "en": "english",
        "deu_Latn": "german",  "de": "german",
        "rus_Cyrl": "russian", "ru": "russian",
        "pol_Latn": "polish",  "pl": "polish"
    }
    return mapping.get(lang_code, "english")

USER_DATA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "user-data.json"))


@app.get("/api/status")
def api_status():
    return {"status": "online", "version": "1.1.0"}

@app.post("/api/lookup")
def api_lookup(req: LookupRequest):
    try:
        result = analyzer.lookup_words(req.words, req.lang)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": f"Internal server error: {e}"}

@app.post("/api/analyze")
def api_analyze(req: AnalyzeRequest):
    try:
        result = analyzer.analyze(req.text, req.lang)
        return {"status": "success", "data": result}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Internal server error: {e}"}

@app.post("/api/translate")
def api_translate(req: TranslateRequest):
    try:
        print(f"DEBUG: Translate '{req.sentence[:100]}...' from {req.src_lang} to {req.tgt_lang}")
        result = translator.translate(req.sentence, req.src_lang, req.tgt_lang)
        if result.startswith("Error:"):
            return {"status": "error", "message": result}
        return {"status": "success", "translation": result}
    except Exception as e:
        return {"status": "error", "message": f"Internal server error: {e}"}

@app.post("/api/synonyms")
def api_synonyms(req: SynonymsRequest):
    try:
        result = analyzer.find_synonyms(req.word, req.lang, req.top_n, req.target_lang)
        return {"status": "success", "synonyms": result}
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        return {"status": "error", "message": f"Internal server error: {e}"}

@app.post("/api/images/search")
def api_images_search(req: ImageSearchRequest):
    try:
        query = f"{req.word} {req.lang}"
        return image_search.search_bing_images(query, max_results=15)
    except Exception as e:
        return {"error": str(e), "images": []}

@app.post("/api/images/save")
def api_images_save(req: ImageSaveRequest):
    try:
        res = image_search.save_image_from_url(req.url, req.word, req.lang, USERIMAGES_DIR)
        return res
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/tts")
def api_tts(req: TTSRequest):
    try:
        from hashlib import md5
        # Generate filename carefully based on stem and type
        # We now include a short hash of the voice to ensure cache uniqueness if the voice name changes
        voice_hash = md5(req.voice.encode('utf-8')).hexdigest()[:4] if req.voice else ""
        
        # Replace forbidden chars
        safe_stem = "".join([c for c in req.stem if c.isalnum() or c in ('-', '_')])
        if req.context:
            text_hash = md5(req.text.encode('utf-8')).hexdigest()[:8]
            filename = f"{safe_stem}_ctx_{text_hash}_{voice_hash}.wav"
        else:
            filename = f"{safe_stem}_{voice_hash}.wav" if voice_hash else f"{safe_stem}.wav"
            
        print(f"DEBUG: Generating TTS for '{req.text}' -> {filename} (voice={req.voice})")
        saved_filename = tts_service.generate_audio(req.text, req.lang, filename, voice_override=req.voice)
        
        return {"status": "success", "filename": saved_filename}
    except ImportError as e:
        return {"status": "error", "message": "TTS package not installed. Run 'pip install TTS'"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cache"))

@app.post("/api/cache/clear-texts")
def api_clear_text_cache():
    """Clear analyzed text cache (JSON/MD files, comparison, morphology, uploads, temp configs)."""
    try:
        removed = 0
        # 1. Clear cache directory (analyzed texts, comparison, morphology, logs)
        if os.path.exists(CACHE_DIR):
            for f in os.listdir(CACHE_DIR):
                fp = os.path.join(CACHE_DIR, f)
                if os.path.isfile(fp):
                    os.remove(fp)
                    removed += 1
                elif os.path.isdir(fp) and f == 'uploads':
                    shutil.rmtree(fp, ignore_errors=True)
                    os.makedirs(fp, exist_ok=True)
                    removed += 1
        
        # 2. Clear comparison.json from web/public
        pub_comp = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public", "comparison.json"))
        if os.path.exists(pub_comp):
            os.remove(pub_comp)
            removed += 1
        
        # 3. Clean temp config files from project root
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        for f in os.listdir(root_dir):
            if f.startswith("temp-config-") and f.endswith(".yaml"):
                os.remove(os.path.join(root_dir, f))
                removed += 1
        
        return {"status": "success", "removed": removed}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/cache/clear-media")
def api_clear_media_cache():
    """Clear all downloaded images and generated audio from userimages/."""
    try:
        removed = 0
        if os.path.exists(USERIMAGES_DIR):
            for lang_dir in os.listdir(USERIMAGES_DIR):
                lang_path = os.path.join(USERIMAGES_DIR, lang_dir)
                if os.path.isdir(lang_path):
                    count = len(os.listdir(lang_path))
                    shutil.rmtree(lang_path, ignore_errors=True)
                    os.makedirs(lang_path, exist_ok=True)
                    removed += count
        return {"status": "success", "removed": removed}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/user-data/words")
def api_get_words(lang: str):
    """Get tracked and known words from user-data.json for a language."""
    try:
        dict_lang = get_dict_lang(lang)
        if not os.path.exists(USER_DATA_PATH):
            return {"status": "success", "trackedWords": [], "knownWords": []}
            
        with open(USER_DATA_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        vocab = data.get("vocabularies", {}).get(dict_lang, {})
        return {
            "status": "success",
            "trackedWords": vocab.get("trackedWords", []),
            "knownWords": vocab.get("knownWords", [])
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/user-data/add")
def api_add_word(req: AddWordRequest):
    """Add a word (or phrase broken into words) to trackedWords in user-data.json."""
    try:
        dict_lang = get_dict_lang(req.lang)
        
        # Split phrase into individual words
        import re
        words = re.findall(r"[\w'-]+", req.text)
        if not words:
            return {"status": "success", "message": "No valid words found"}
            
        words = [w.lower() for w in words]
        
        data = {}
        if os.path.exists(USER_DATA_PATH):
            with open(USER_DATA_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
        # Ensure structure exists
        if "vocabularies" not in data:
            data["vocabularies"] = {}
        if dict_lang not in data["vocabularies"]:
            data["vocabularies"][dict_lang] = {
                "knownWords": [], "ignoredWords": [], "trackedWords": [],
                "importedWords": [], "wordDates": {}, "wordMetadata": {}
            }
            
        vocab = data["vocabularies"][dict_lang]
        tracked = vocab.get("trackedWords", [])
        dates = vocab.get("wordDates", {})
        
        now = datetime.utcnow().isoformat() + "Z"
        added_count = 0
        
        for w in words:
            if w not in tracked:
                tracked.append(w)
                dates[w] = now
                added_count += 1
                
                # Also update root fields if targetLanguage matches
                if data.get("targetLanguage") == dict_lang:
                    if "trackedWords" not in data: data["trackedWords"] = []
                    if "wordDates" not in data: data["wordDates"] = {}
                    if w not in data["trackedWords"]:
                        data["trackedWords"].append(w)
                        data["wordDates"][w] = now
        
        vocab["trackedWords"] = tracked
        vocab["wordDates"] = dates
        
        with open(USER_DATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
        return {"status": "success", "added": added_count, "words": words}
    except Exception as e:
        return {"status": "error", "message": str(e)}

