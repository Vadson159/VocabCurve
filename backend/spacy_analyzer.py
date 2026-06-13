import spacy

class SpacyAnalyzer:
    def __init__(self):
        self.models = {}

        # Only _sm models — lightweight, for POS/morphology only
        self.lang_map = {
            "en": "en_core_web_sm",
            "es": "es_core_news_sm",
            "de": "de_core_news_sm",
            "ru": "ru_core_news_sm",
            "pl": "pl_core_news_sm"
        }

    def _get_model(self, lang_code: str):
        if lang_code not in self.lang_map:
            raise ValueError(f"Language {lang_code} is not supported.")

        if lang_code not in self.models:
            sm_name = self.lang_map[lang_code]
            try:
                print(f"Loading spaCy model: {sm_name}...")
                self.models[lang_code] = spacy.load(sm_name, disable=["parser"])
                print(f"  [OK] Loaded {sm_name}")
            except OSError:
                print(f"  Downloading {sm_name}...")
                spacy.cli.download(sm_name)
                self.models[lang_code] = spacy.load(sm_name, disable=["parser"])

        return self.models[lang_code]


    def lookup_words(self, words: list, lang: str) -> dict:
        nlp = self._get_model(lang)
        results = {}
        
        for word in words:
            doc = nlp(word)
            if len(doc) > 0:
                token = doc[0]
                morph_dict = token.morph.to_dict()
                results[word.lower()] = {
                    "pos": token.pos_,
                    "gender": morph_dict.get("Gender", ""),
                    "number": morph_dict.get("Number", "")
                }
        return results

    def find_synonyms(self, word: str, lang: str, top_n: int = 5, translate_to: str = None) -> list:
        """
        [DEPRECATED] Synonyms are now handled by Yandex Dictionary API on the frontend.
        """
        return []

    def analyze(self, text: str, lang: str) -> dict:
        nlp = self._get_model(lang)
        doc = nlp(text)

        # Build a set of tokens that belong to Named Entities of specific types
        excluded_entity_types = {"PERSON", "LOC", "ORG"}
        excluded_tokens = set()

        if doc.ents:
            for ent in doc.ents:
                if ent.label_ in excluded_entity_types:
                    for token in ent:
                        excluded_tokens.add(token.i)

        lemma_freqs = {}

        for token in doc:
            if token.is_punct or token.is_space or token.i in excluded_tokens:
                continue
                
            if not token.is_alpha:
                continue

            lemma = token.lemma_.lower()
            original_word = token.text

            if lemma not in lemma_freqs:
                morph_dict = token.morph.to_dict()
                morphology = {
                    "Gender": morph_dict.get("Gender", ""),
                    "Tense": morph_dict.get("Tense", ""),
                    "Person": morph_dict.get("Person", ""),
                    "Number": morph_dict.get("Number", "")
                }
                
                morphology = {k: v for k, v in morphology.items() if v}

                lemma_freqs[lemma] = {
                    "lemma": lemma,
                    "pos": token.pos_,
                    "morphology": morphology,
                    "frequency": 0,
                    "forms": set()
                }
            
            lemma_freqs[lemma]["frequency"] += 1
            lemma_freqs[lemma]["forms"].add(original_word)

        # Convert sets to list for JSON serialization
        for data in lemma_freqs.values():
            data["forms"] = list(data["forms"])

        return {
            "total_extracted": len(lemma_freqs),
            "lemmas": list(lemma_freqs.values())
        }
