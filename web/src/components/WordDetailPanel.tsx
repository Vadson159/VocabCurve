import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Check, Target, Ban, Tag as TagIcon, Plus, MessageSquare, Star, BookOpen, ChevronLeft, ChevronRight, Image as ImageIcon, Trash, Loader2, Volume2 } from 'lucide-react';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';
import { getArticle, formatNounCapitalization } from '../utils/languageRules';

interface VocabularyWord {
  stem: string;
  displayForm: string;
  article?: string;
  totalCount: number;
  pos?: string;
  forms: Record<string, number>;
  examples?: { text: string; source: string }[];
  sections?: number[];
  origin?: string;
}

interface WordDetailPanelProps {
  word: VocabularyWord | null;
  onClose: () => void;
  autoTranslate?: boolean;
  onShowInText?: (sentence: string, source: string) => void;
}

const CONTEXTS_PER_PAGE = 3;

function ContextSentence({
  text,
  source,
  patterns,
  srcLang,
  tgtLang,
  getSourceLabel,
  isFavorite,
  onToggleFavorite,
  onShowInText,
  onPlayAudio,
  isGeneratingAudio,
  isPlayingAudio,
}: {
  text: string;
  source: string | null;
  patterns: string[];
  srcLang: string;
  tgtLang: string;
  getSourceLabel: (s: string) => string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShowInText?: () => void;
  onPlayAudio?: () => void;
  isGeneratingAudio?: boolean;
  isPlayingAudio?: boolean;
}) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const translate = async () => {
    if (translation || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await fetch('http://localhost:8000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: text,
          src_lang: srcLang,
          tgt_lang: tgtLang,
          is_word: false
        })
      });
      const json = await res.json();
      if (res.ok && json.status !== 'error') setTranslation(json.translation);
    } catch (e) { } finally { setIsTranslating(false); }
  };

  const pattern = patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(\\b(?:${pattern})\\b)`, 'gi');
  const parts = text.split(regex);

  return (
    <div
      className="text-sm bg-muted/40 p-4 rounded-2xl border border-border/50 text-foreground/80 leading-relaxed font-serif shadow-inner group relative overflow-hidden transition-all hover:bg-muted/60"
      onMouseEnter={() => { setIsHovered(true); translate(); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative z-10 transition-all duration-300">
        {parts.map((part, j) =>
          regex.test(part) ? <strong key={j} className="text-primary font-bold bg-primary/10 px-1 rounded">{part}</strong> : part
        )}
      </div>

      {(isTranslating || (isHovered && translation)) && (
        <div className="mt-3 pt-3 border-t border-border/30 text-primary/80 font-sans text-[13px] leading-snug animate-in fade-in slide-in-from-top-1 duration-300">
          {isTranslating ? (
            <span className="flex items-center gap-2 opacity-60">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              {tgtLang === 'ru' ? 'Перевод...' : 'Translating...'}
            </span>
          ) : translation}
        </div>
      )}

      {/* Footer: star + show in text + source label */}
      <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="transition-all hover:scale-110"
            title={isFavorite ? 'Remove from favorites' : 'Set as favorite context'}
          >
            <Star
              size={16}
              className={isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400/60'}
            />
          </button>
          {onPlayAudio && (
            <button
              onClick={(e) => { e.stopPropagation(); onPlayAudio(); }}
              className="text-muted-foreground/40 hover:text-primary transition-colors flex items-center justify-center p-0.5 relative"
              title="Play TTS"
              disabled={isGeneratingAudio}
            >
              {isGeneratingAudio ? <Loader2 size={16} className="animate-spin text-primary/60" /> : <Volume2 size={16} className={isPlayingAudio ? 'text-emerald-500' : ''} />}
            </button>
          )}
          {onShowInText && (
            <button
              onClick={(e) => { e.stopPropagation(); onShowInText(); }}
              className="flex items-center gap-1 text-[10px] font-sans text-primary/60 hover:text-primary transition-colors"
            >
              <BookOpen size={12} />
              Show in text
            </button>
          )}
        </div>
        {source && (
          <div className="text-[9px] text-muted-foreground/40 font-mono uppercase tracking-[0.15em] transition-colors group-hover:text-muted-foreground/70">
            — {getSourceLabel(source)}
          </div>
        )}
      </div>
    </div>
  );
}

export function WordDetailPanel({ word, onClose, autoTranslate, onShowInText }: WordDetailPanelProps) {
  const { language } = useLanguage();
  const {
    userData,
    toggleKnownWord,
    toggleIgnoredWord,
    toggleTrackedWord,
    updateWordMetadata,
    deleteWord
  } = useSharedUserData();

  const [newTag, setNewTag] = useState('');
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const localAutoTranslate = true;
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [stemTranslation, setStemTranslation] = useState<string | null>(null);
  const [contextPage, setContextPage] = useState(0);
  const [synonyms, setSynonyms] = useState<{ word: string, translation?: string }[]>([]);
  const [synonymsLoading, setSynonymsLoading] = useState(false);

  const stem = word?.stem || '';
  const metadata = (userData.wordMetadata?.[stem] || { tags: [], notes: '' }) as import('../hooks/useUserData').WordMetadata;
  const tags = metadata.tags || [];
  const notes = metadata.notes || '';
  const favoriteContext = metadata.favoriteContext;

  const knownWords = useMemo(() => new Set(userData.knownWords), [userData.knownWords]);
  const trackedWords = useMemo(() => new Set(userData.trackedWords || []), [userData.trackedWords]);
  const ignoredWords = useMemo(() => new Set(userData.ignoredWords || []), [userData.ignoredWords]);

  const isWordInDictionary = useMemo(() => {
    return knownWords.has(stem) || trackedWords.has(stem) || ignoredWords.has(stem) || (userData.importedWords && userData.importedWords.includes(stem));
  }, [stem, knownWords, trackedWords, ignoredWords, userData.importedWords]);

  // Handle Reset context page when word changes
  useEffect(() => {
    setContextPage(0);
    setSynonyms([]);
    setImageResults([]);
    setIsSearchingImage(false);
    setStemTranslation(null);
  }, [stem]);

  const [imageResults, setImageResults] = useState<string[]>([]);
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [savingImageUrl, setSavingImageUrl] = useState<string | null>(null);
  const [imageModifier, setImageModifier] = useState(() => localStorage.getItem('vocabcurve-imageModifier') || '');

  const [generatingAudio, setGeneratingAudio] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const handleSearchImages = async (ignoreTerm = false) => {
    if (!word) return;

    const modifier = imageModifier.trim();
    if (ignoreTerm && !modifier) return;

    setIsSearchingImage(true);
    setImageResults([]);
    try {
      localStorage.setItem('vocabcurve-imageModifier', modifier);
      const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
      const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';

      const queryWord = ignoreTerm ? modifier : (modifier ? `${word.stem} ${modifier}` : word.stem);

      const res = await fetch('http://localhost:8000/api/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: queryWord, lang: srcLangCode })
      });
      const data = await res.json();
      if (data.images && data.images.length > 0) {
        setImageResults(data.images);
      } else {
        setImageResults([]);
      }
    } catch (e) {
      console.error("Failed to search images", e);
    } finally {
      setIsSearchingImage(false);
    }
  };

  const handleSaveImage = async (url: string) => {
    if (!word) return;
    setSavingImageUrl(url);
    try {
      const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
      const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';

      const res = await fetch('http://localhost:8000/api/images/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, word: word.stem, lang: srcLangCode })
      });
      const data = await res.json();
      if (data.status === 'success' && data.filename) {
        updateWordMetadata(stem, { ...metadata, image: data.filename });
        setImageResults([]);
      }
    } catch (e) {
      console.error("Failed to save image", e);
    } finally {
      setSavingImageUrl(null);
    }
  };

  const handlePlayAudio = async (textToSpeak: string, isContext: boolean) => {
    const audioField = isContext ? 'audioContext' : 'audioWord';
    let audioFile = isContext ? metadata.audioContext : metadata.audioWord;

    if (!audioFile) {
      setGeneratingAudio(textToSpeak);
      try {
        const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
        const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';
        const selectedVoice = userData.ttsVoices?.[srcLangCode];

        const res = await fetch('http://localhost:8000/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSpeak, stem: stem, lang: srcLangCode, context: isContext, voice: selectedVoice || null })
        });
        const data = await res.json();
        if (data.status === 'success' && data.filename) {
          audioFile = data.filename;
          updateWordMetadata(stem, { ...metadata, [audioField]: data.filename });
        } else {
          console.error("Failed to generate TTS:", data.message);
        }
      } catch (e) { console.error(e); }
      finally { setGeneratingAudio(null); }
    }

    if (audioFile) {
      const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
      const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';
      const audio = new Audio(`http://localhost:8000/userimages/${srcLangCode}/${audioFile}`);
      setPlayingAudio(textToSpeak);
      audio.onended = () => setPlayingAudio(null);
      audio.play().catch(e => {
        console.error("Audio play failed, clearing metadata so it can be regenerated:", e);
        setPlayingAudio(null);
        // Clear broken metadata link
        const currentData = { ...metadata };
        if (isContext) currentData.audioContext = undefined;
        else currentData.audioWord = undefined;
        updateWordMetadata(stem, currentData);
      });
    }
  };

  const fetchYandexData = useCallback(async (wordToTranslate: VocabularyWord) => {
    setIsTranslating(true);
    setSynonymsLoading(true);
    setTranslationError(null);
    setStemTranslation(null);

    try {
      const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
      const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';
      const tgtLangCode = language;

      if (!userData.yandexApiKey) {
        setTranslationError('Yandex API Key is missing in settings.');
        return;
      }

      // 1. Fetch Main Word Translation and Synonyms
      const trText = wordToTranslate.displayForm || wordToTranslate.stem;
      const url = `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${userData.yandexApiKey}&lang=${srcLangCode}-${tgtLangCode}&text=${encodeURIComponent(trText)}`;

      const res = await fetch(url);
      const json = await res.json();

      let newSynonyms: { word: string, translation: string }[] = [];
      let mainTr: string | null = null;

      if (json.def && json.def.length > 0) {
        // Collect translations and their source-synonyms
        json.def.forEach((def: any) => {
          if (def.tr && def.tr.length > 0) {
            if (!mainTr) mainTr = def.tr[0].text; // The very first translation

            def.tr.forEach((trItem: any) => {
              if (trItem.mean && Array.isArray(trItem.mean)) {
                trItem.mean.forEach((mItem: any) => {
                  if (!newSynonyms.find(s => s.word === mItem.text)) {
                    newSynonyms.push({ word: mItem.text, translation: trItem.text });
                  }
                });
              }
            });
          }
        });
      }

      if (localAutoTranslate) setTranslation(mainTr);
      setSynonyms(newSynonyms.slice(0, 10)); // keep up to 10 synonyms

      // 2. Fetch Stem (only if we need a translation and stem is different)
      if (localAutoTranslate && wordToTranslate.stem && wordToTranslate.stem.toLowerCase() !== trText.toLowerCase()) {
        const stemUrl = `https://dictionary.yandex.net/api/v1/dicservice.json/lookup?key=${userData.yandexApiKey}&lang=${srcLangCode}-${tgtLangCode}&text=${encodeURIComponent(wordToTranslate.stem)}`;
        const sRes = await fetch(stemUrl);
        const sJson = await sRes.json();
        if (sJson.def && sJson.def.length > 0 && sJson.def[0].tr && sJson.def[0].tr.length > 0) {
          setStemTranslation(sJson.def[0].tr[0].text);
        }
      }

    } catch (err: any) {
      setTranslationError('Network error connecting to Yandex API');
    } finally {
      setIsTranslating(false);
      setSynonymsLoading(false);
    }
  }, [userData.targetLanguage, language, userData.yandexApiKey, localAutoTranslate]);

  useEffect(() => {
    if (word) {
      fetchYandexData(word);
    } else {
      setTranslation(null);
      setTranslationError(null);
      setStemTranslation(null);
      setSynonyms([]);
    }
  }, [word, fetchYandexData]);

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const cleanTag = newTag.trim().toLowerCase();
    if (!tags.includes(cleanTag)) {
      updateWordMetadata(stem, { tags: [...tags, cleanTag], notes });
    }
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    updateWordMetadata(stem, { tags: tags.filter(t => t !== tagToRemove), notes });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateWordMetadata(stem, { tags, notes: e.target.value });
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const toggleFavoriteContext = (contextText: string) => {
    const newFav = favoriteContext === contextText ? undefined : contextText;
    updateWordMetadata(stem, { ...metadata, favoriteContext: newFav });
  };

  const getSourceLabel = (sourceId: string) => {
    const regItem = userData.registry.find(r => r.id === sourceId);
    if (regItem) return regItem.label;
    return sourceId
      .replace(/\.(docx|pdf|md|txt|json)$/i, '')
      .replace(/^youtube-/, '');
  };

  if (!word) return null;

  const examples = word.examples || [];
  const totalContextPages = Math.max(1, Math.ceil(examples.length / CONTEXTS_PER_PAGE));
  const currentContexts = examples.slice(contextPage * CONTEXTS_PER_PAGE, (contextPage + 1) * CONTEXTS_PER_PAGE);

  // If no favoriteContext is set, default to first example
  const effectiveFavorite = favoriteContext || (examples.length > 0 ? ((examples[0] as any).text || (typeof examples[0] === 'string' ? examples[0] : '')) : '');

  return (
    <div className="w-full h-full bg-card flex flex-col relative animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
      <div className="p-7">
        <div className="mb-6">
          <div className="flex justify-between items-start gap-6">
            <div className="min-w-0 flex-1">
              <h3 className="text-4xl sm:text-5xl font-serif text-foreground tracking-tight break-words leading-tight flex flex-wrap items-center gap-4">
                {(() => {
                  const rawWord = Object.entries(word.forms).sort((a, b) => b[1] - a[1])[0]?.[0] || word.displayForm || word.stem;
                  const langStr = userData.targetLanguage || '';
                  const displayWord = word.pos === 'Noun' ? formatNounCapitalization(rawWord, langStr) : rawWord;
                  return (
                    <>
                      {displayWord}
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePlayAudio(rawWord, false); }}
                        className="text-muted-foreground/30 hover:text-primary transition-colors p-1 translate-y-1"
                        disabled={generatingAudio === rawWord}
                        title="Play TTS"
                      >
                        {generatingAudio === rawWord ? <Loader2 size={24} className="animate-spin text-primary/60" /> : <Volume2 size={24} className={playingAudio === rawWord ? 'text-emerald-500' : ''} />}
                      </button>
                    </>
                  );
                })()}
              </h3>

              {/* Main word translation (Serif, matching the main word & synonyms) */}
              {(translation || isTranslating || translationError) && (
                <div className="text-[22px] font-serif text-foreground/90 -mt-1 font-medium tracking-wide leading-relaxed">
                  {isTranslating ? (
                    <span className="opacity-40">translating...</span>
                  ) : translationError ? (
                    <span className="text-red-500/60">{translationError}</span>
                  ) : (
                    <span>{translation}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-3 shrink-0">
              {isWordInDictionary && (
                <button
                  onClick={() => {
                    if (window.confirm(language === 'ru' ? 'Вы уверены, что хотите удалить это слово из словаря?' : 'Are you sure you want to delete this word from the dictionary?')) {
                      deleteWord(stem);
                      onClose();
                    }
                  }}
                  className="p-2 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/5 rounded-full transition-all"
                  title={language === 'ru' ? 'Удалить слово из словаря' : 'Delete word from dictionary'}
                >
                  <Trash size={20} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground/30 hover:text-foreground hover:bg-muted rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          <p className="text-foreground/70 font-mono text-base tracking-wider uppercase flex items-center gap-2">
            <span>STEM: {(() => {
              const langStr = userData.targetLanguage || '';
              const capStem = word.pos === 'Noun' ? formatNounCapitalization(word.stem, langStr) : word.stem;
              const art = word.article || getArticle(word.stem, word.pos || '', langStr);
              return art ? `${art} ${capStem}` : capStem;
            })()}</span>
            {stemTranslation && (
              <span className="text-xs text-muted-foreground/60 not-italic font-sans lowercase">
                ({stemTranslation})
              </span>
            )}
          </p>


          {/* Synonyms */}
          <div className="mt-4 flex flex-wrap items-center gap-3 min-h-[2rem]">

            {synonymsLoading ? (
              <span className="text-sm text-muted-foreground/40 animate-pulse">{language === 'ru' ? 'загрузка...' : 'loading...'}</span>
            ) : synonyms.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {synonyms.map((s, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-lg text-foreground/90 font-serif tracking-wide group relative cursor-help">
                      {s.word}
                      {s.translation && autoTranslate && (
                        <span className="block text-[11px] font-sans text-muted-foreground/60 -mt-1">
                          {s.translation}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/30">{language === 'ru' ? 'синонимов не найдено' : 'no synonyms found'}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => toggleKnownWord(stem)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[10px] font-bold transition-all border tracking-[0.1em] uppercase ${knownWords.has(stem)
              ? 'bg-emerald-500 text-primary-foreground border-emerald-500 shadow-lg shadow-emerald-500/10'
              : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'
              }`}
          >
            <Check size={14} /> {knownWords.has(stem) ? (language === 'ru' ? 'Изучено' : 'Known') : (language === 'ru' ? 'Знаю' : 'Known')}
          </button>
          <button
            onClick={() => toggleTrackedWord(stem)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[10px] font-bold transition-all border tracking-[0.1em] uppercase ${trackedWords.has(stem)
              ? 'bg-blue-500 text-primary-foreground border-blue-500 shadow-lg shadow-blue-500/10'
              : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'
              }`}
          >
            <Target size={14} /> {trackedWords.has(stem) ? (language === 'ru' ? 'Слежу' : 'Tracked') : (language === 'ru' ? 'Отслеживать' : 'Track')}
          </button>
          <button
            onClick={() => toggleIgnoredWord(stem)}
            className={`px-3 py-3 rounded-xl text-[10px] font-bold transition-all border tracking-[0.1em] uppercase ${ignoredWords.has(stem)
              ? 'bg-rose-500 text-primary-foreground border-rose-500 shadow-lg shadow-rose-500/10'
              : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'
              }`}
          >
            <Ban size={14} />
          </button>
        </div>

        {/* IMAGE SECTION */}
        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon size={12} /> {language === 'ru' ? 'Картинка' : 'Image'}
              {imageResults.length > 0 && !metadata.image && (
                <button
                  onClick={() => setImageResults([])}
                  className="p-0.5 bg-muted rounded-md border border-border/50 text-muted-foreground hover:text-foreground transition-colors ml-2"
                  title="Back to search"
                >
                  <ChevronLeft size={12} />
                </button>
              )}
            </span>
            {metadata.image && (
              <button
                onClick={() => updateWordMetadata(stem, { ...metadata, image: undefined })}
                className="text-muted-foreground/40 hover:text-red-500 transition-colors p-1"
                title={language === 'ru' ? 'Удалить картинку' : 'Remove Image'}
              >
                <Trash size={12} />
              </button>
            )}
          </h4>

          <div className="bg-muted/30 border border-border/50 rounded-xl p-3 flex flex-col gap-3">
            {metadata.image ? (
              <div className="rounded-lg overflow-hidden border border-border/50 relative bg-muted/50 flex items-center justify-center min-h-[120px]">
                <img
                  src={`http://localhost:8000/userimages/${(() => {
                    const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
                    return srcLangMap[userData.targetLanguage] || 'de';
                  })()}/${metadata.image}`}
                  className="max-w-full max-h-48 object-contain"
                  alt={stem}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {!imageResults.length && !isSearchingImage && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleSearchImages(false)}
                      className="w-full flex justify-center items-center gap-2 py-3 border border-dashed border-border text-muted-foreground/60 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all rounded-lg text-sm font-medium"
                    >
                      <ImageIcon size={16} />
                      {language === 'ru' ? 'Найти картинку (Bing)' : 'Find Image (Bing)'}
                    </button>
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        placeholder={language === 'ru' ? 'Модификатор (напр. meme, fail, cartoon)' : 'Modifier (e.g. meme, fail, cartoon)'}
                        value={imageModifier}
                        onChange={e => setImageModifier(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchImages(false)}
                        className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/40"
                      />
                      <button
                        type="button"
                        onClick={() => handleSearchImages(true)}
                        title={language === 'ru' ? 'Искать только введенный текст (без слова)' : 'Search only entered text (without word)'}
                        className="px-3 bg-muted/50 border border-border/50 rounded-lg text-muted-foreground/60 hover:text-primary hover:border-primary/50 transition-all flex justify-center items-center shrink-0"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                      </button>
                    </div>
                  </div>
                )}

                {isSearchingImage && (
                  <div className="flex items-center justify-center gap-2 text-primary/60 text-sm py-4">
                    <Loader2 className="animate-spin" size={16} />
                    {language === 'ru' ? 'Поиск картинок...' : 'Searching images...'}
                  </div>
                )}

                {imageResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                    {imageResults.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSaveImage(url)}
                        disabled={savingImageUrl !== null}
                        className="relative group overflow-hidden rounded-lg border border-border/50 hover:border-primary transition-all aspect-square bg-muted/30"
                      >
                        {savingImageUrl === url ? (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                            <Loader2 className="animate-spin text-primary" size={20} />
                          </div>
                        ) : null}
                        <img
                          src={url}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <TagIcon size={12} /> Tags
          </h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map(tag => (
              <span
                key={tag}
                className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 group hover:bg-primary/20 transition-all"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={handleAddTag} className="relative">
            <input
              type="text"
              placeholder={language === 'ru' ? 'Добавить тег...' : "Add tag..."}
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              className="w-full bg-muted/50 border border-border/50 rounded-xl px-4 py-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-all pr-12"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/40 hover:text-primary transition-colors">
              <Plus size={16} />
            </button>
          </form>
        </div>

        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-4">Forms</h4>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(word.forms)
              .sort(([, a], [, b]) => b - a)
              .map(([form, count]) => (
                <div key={form} className="flex justify-between items-center bg-muted/30 px-4 py-2.5 rounded-xl border border-border/50 group hover:bg-muted/50 transition-all">
                  <span className="text-sm text-muted-foreground font-serif">{form}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60 lowercase">{count} occ.</span>
                </div>
              ))}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <MessageSquare size={12} /> Notes
          </h4>
          <textarea
            id="word-notes-area"
            value={notes}
            onChange={handleNoteChange}
            rows={1}
            placeholder={language === 'ru' ? 'Ваши заметки о слове...' : "Add personal notes..."}
            className="w-full bg-muted/50 border border-border/50 rounded-xl p-4 text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-all resize-none leading-relaxed font-serif shadow-inner overflow-hidden"
          />
        </div>

        {examples.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Context</h4>
              {totalContextPages > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button
                    onClick={() => setContextPage(p => Math.max(0, p - 1))}
                    disabled={contextPage === 0}
                    className="p-0.5 hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono text-[11px] min-w-[3ch] text-center">{contextPage + 1} / {totalContextPages}</span>
                  <button
                    onClick={() => setContextPage(p => Math.min(totalContextPages - 1, p + 1))}
                    disabled={contextPage === totalContextPages - 1}
                    className="p-0.5 hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 pb-12">
              {currentContexts.map((ex, i) => {
                const text = (ex as any).text || (typeof ex === 'string' ? ex : '');
                const source = (ex as any).source || null;
                const allForms = Object.keys(word.forms || {});
                const isFav = text === effectiveFavorite;
                return (
                  <ContextSentence
                    key={contextPage * CONTEXTS_PER_PAGE + i}
                    text={text}
                    source={source}
                    patterns={[word.displayForm, word.stem, ...allForms].filter(Boolean)}
                    srcLang={userData.targetLanguage}
                    tgtLang={language}
                    getSourceLabel={getSourceLabel}
                    isFavorite={isFav}
                    onToggleFavorite={() => toggleFavoriteContext(text)}
                    onPlayAudio={() => handlePlayAudio(text, true)}
                    isGeneratingAudio={generatingAudio === text}
                    isPlayingAudio={playingAudio === text}
                    onShowInText={onShowInText ? () => onShowInText(text, source || '') : () => {
                      window.dispatchEvent(new CustomEvent('vocabcurve:show-in-text', { detail: { sentence: text, source: source || '' } }));
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
