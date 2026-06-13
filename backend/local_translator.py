"""
Local translation using Meta's NLLB-200-distilled-600M.
One universal model for all 200 languages — no need for separate per-pair models.
"""
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

MODEL_NAME = "facebook/nllb-200-distilled-600M"

# Map our internal codes → NLLB BCP-47 codes
NLLB_LANG_CODES = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "de": "deu_Latn",
    "ru": "rus_Cyrl",
    "pl": "pol_Latn",
}

# Also accept verbose names
VERBOSE_TO_ISO = {
    "german": "de",
    "spanish": "es",
    "polish": "pl",
    "english": "en",
    "russian": "ru",
}


class LocalTranslator:
    def __init__(self):
        self._model = None
        self._tokenizer = None

    def _get_iso(self, lang: str) -> str:
        if len(lang) == 2:
            return lang.lower()
        return VERBOSE_TO_ISO.get(lang.lower(), lang.lower())

    def _load_model(self):
        if self._model is None:
            print(f"Loading NLLB-200 translation model ({MODEL_NAME})...")
            self._tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
            self._model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
            print("  [OK] NLLB-200 loaded.")

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = text.strip()
        if text.startswith("--"):
            text = text[2:].strip()
        if text.startswith("\u2014"):
            text = text[1:].strip()
        return text

    def translate(self, text: str, src_lang: str, tgt_lang: str) -> str:
        src_iso = self._get_iso(src_lang)
        tgt_iso = self._get_iso(tgt_lang)

        if src_iso == tgt_iso:
            return text

        src_nllb = NLLB_LANG_CODES.get(src_iso)
        tgt_nllb = NLLB_LANG_CODES.get(tgt_iso)

        if not src_nllb or not tgt_nllb:
            return f"Error: Unsupported language pair {src_iso}->{tgt_iso}"

        cleaned_text = self._clean_text(text)
        if not cleaned_text:
            return ""

        is_single_word = len(cleaned_text.split()) == 1
        
        # For single words, translate the lemma for much cleaner results
        if is_single_word:
            try:
                # We can't easily import SpacyAnalyzer here due to circular imports
                # so we just use a small local helper or stick to basic cleaning
                pass # Will implement a cleaner direct approach
            except: pass

        try:
            self._load_model()
            self._tokenizer.src_lang = src_nllb
            
            # For single words, append a period to force NLLB to decode meaning instead of echoing
            text_for_model = f"{cleaned_text}." if is_single_word else cleaned_text
            inputs = self._tokenizer(text_for_model, return_tensors="pt")
            tgt_token_id = self._tokenizer.convert_tokens_to_ids(tgt_nllb)

            with torch.no_grad():
                outputs = self._model.generate(
                    **inputs,
                    forced_bos_token_id=tgt_token_id,
                    num_beams=2,
                    max_length=15 if is_single_word else 512,
                    repetition_penalty=1.5 if is_single_word else 1.0,
                    early_stopping=True,
                )

            result = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            if is_single_word:
                # Cleanup: take the last word if it hallucinated a phrase (common in NLLB)
                # or just the first word if it started explaining.
                # Usually, for a lemma, NLLB gives a single word or a short verb "to x"
                parts = result.strip().strip(".").split()
                if len(parts) > 1:
                    # If it's "to follow", keep it. If it's "The escort is...", take "escort"
                    if parts[0].lower() in ["to", "a", "an", "the"]:
                        result = " ".join(parts[:2])
                    else:
                        # Extract the most similar word to the input if possible? 
                        # No, just take the first meaningful word.
                        result = parts[0]
            
            return result.strip(".").strip(",").strip()

        except Exception as e:
            return f"Error: {e}"
