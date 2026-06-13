import { useState, useCallback, useEffect } from 'react';
import { apiFsRead, apiFsWrite, apiFsExists, apiFsDelete, apiFsCopy, apiExec } from '../apiClient';

export function getUserDataPath(): string {
  return 'user-data.json';
}

export async function triggerGlobalCompare(onDone?: () => void) {
  const compareCmd = `npx tsx src/compare.ts`;
  const { error } = await apiExec(compareCmd);
  if (!error) {
    const compSrc = 'web/public/comparison.json';
    const compDst = 'web/dist/comparison.json';
    if (await apiFsExists(compSrc)) {
      await apiFsCopy(compSrc, compDst);
    }
  }
  if (onDone) onDone();
}

export interface RegistryItem {
  id: string;
  label: string;
  file: string;
  hidden?: boolean;
}

export type TargetLanguage = 'german' | 'spanish' | 'polish' | 'english' | 'russian';

export interface VocabularyData {
  knownWords: string[];
  ignoredWords: string[];
  trackedWords: string[];
  importedWords: string[];
  wordDates: Record<string, string>;
  wordMetadata?: Record<string, WordMetadata>;
  lexicometerChain?: any[];
}

const defaultVocabulary: VocabularyData = {
  knownWords: [],
  ignoredWords: [],
  trackedWords: [],
  importedWords: [],
  wordDates: {},
  wordMetadata: {},
};

export interface UserData {
  targetLanguage: TargetLanguage;
  vocabularies: Record<string, VocabularyData>;
  registries: Record<string, RegistryItem[]>;
  // Top-level fields are a "view" of the active language vocabulary
  knownWords: string[];
  ignoredWords: string[];
  trackedWords: string[];
  importedWords: string[];
  registry: Array<RegistryItem>;
  wordDates: Record<string, string>;
  wordMetadata: Record<string, WordMetadata>;
  lexicometerChain: any[];
  yandexApiKey?: string;
  ttsVoices?: Record<string, string>;
}

export const defaultRegistries: Record<TargetLanguage, RegistryItem[]> = {
  german: [],
  spanish: [],
  polish: [],
  english: [],
  russian: [],
};

export const defaultUserData: UserData = {
  targetLanguage: 'german',
  vocabularies: { german: { ...defaultVocabulary } },
  registries: { ...defaultRegistries },
  knownWords: [],
  ignoredWords: [],
  trackedWords: [],
  importedWords: [],
  registry: defaultRegistries.german,
  wordDates: {},
  wordMetadata: {},
  lexicometerChain: [],
  yandexApiKey: '',
  ttsVoices: {
    en: 'en-US-GuyNeural',
    ru: 'ru-RU-DmitryNeural',
    de: 'de-DE-KillianNeural',
    es: 'es-ES-AlvaroNeural',
    pl: 'pl-PL-MarekNeural'
  }
};

/** Apply the active language's vocabulary and registry to the top-level fields */
function applyActiveVocab(data: UserData): UserData {
  const lang = data.targetLanguage || 'german';
  const vocab = data.vocabularies?.[lang] || { ...defaultVocabulary };
  const registry = data.registries?.[lang] || defaultRegistries[lang] || [];
  return {
    ...data,
    targetLanguage: lang,
    knownWords: vocab.knownWords || [],
    ignoredWords: vocab.ignoredWords || [],
    trackedWords: vocab.trackedWords || [],
    importedWords: vocab.importedWords || [],
    wordDates: vocab.wordDates || {},
    wordMetadata: vocab.wordMetadata || {},
    lexicometerChain: vocab.lexicometerChain || (registry && registry.length > 0 ? [{ type: 'file', id: registry[0].id, label: registry[0].label, file: registry[0].file, uniqueStems: 0 }] : []),
    registry,
    yandexApiKey: data.yandexApiKey || '',
  };
}

/** When saving, sync top-level fields back into the vocabularies and registries maps */
function syncVocabBeforeSave(data: UserData): UserData {
  const lang = data.targetLanguage || 'german';
  const vocabs = { ...(data.vocabularies || {}) };
  vocabs[lang] = {
    knownWords: data.knownWords,
    ignoredWords: data.ignoredWords,
    trackedWords: data.trackedWords,
    importedWords: data.importedWords,
    wordDates: data.wordDates,
    wordMetadata: data.wordMetadata,
    lexicometerChain: data.lexicometerChain,
  };
  const regs = { ...(data.registries || { ...defaultRegistries }) };
  regs[lang] = data.registry;
  return { ...data, vocabularies: vocabs, registries: regs };
}

export async function loadUserDataAsync(): Promise<UserData> {
  const p = getUserDataPath();
  try {
    const exists = await apiFsExists(p);
    
    // Migration: if user-data.json does not exist, but old files do, we migrate them.
    if (!exists) {
      const data = { ...defaultUserData };
      
      const kwContent = await apiFsRead('known-words.json');
      if (kwContent) data.knownWords = JSON.parse(kwContent);

      const iwContent = await apiFsRead('ignored-words.json');
      if (iwContent) data.ignoredWords = Object.keys(JSON.parse(iwContent));
      
      const rContent = await apiFsRead('text-registry.json');
      if (rContent) data.registry = JSON.parse(rContent);
      
      // Save migrated data immediately
      const toSave = syncVocabBeforeSave(data);
      await apiFsWrite(p, JSON.stringify(toSave, null, 2));
      
      // Try to remove old files
      await apiFsDelete('known-words.json');
      await apiFsDelete('ignored-words.json');
      await apiFsDelete('text-registry.json');
      
      return toSave;
    }

    const jsonStr = await apiFsRead(p);
    if (!jsonStr) return defaultUserData;
    const raw = JSON.parse(jsonStr);
    
    // Migration: old format without vocabularies map
    if (!raw.vocabularies) {
      const tl: TargetLanguage = raw.targetLanguage || 'german';
      const vocab: VocabularyData = {
        knownWords: raw.knownWords || [],
        ignoredWords: raw.ignoredWords || [],
        trackedWords: raw.trackedWords || [],
        importedWords: raw.importedWords || [],
        wordDates: raw.wordDates || {},
      };
      raw.targetLanguage = tl;
      raw.vocabularies = { [tl]: vocab };
    }

    // Migration: old format without per-language registries
    if (!raw.registries) {
      const tl: TargetLanguage = raw.targetLanguage || 'german';
      raw.registries = { ...defaultRegistries };
      // Preserve existing registry under the active language
      if (raw.registry && raw.registry.length > 0) {
        raw.registries[tl] = raw.registry;
      }
    }

    const finalData = applyActiveVocab({
      ...defaultUserData,
      yandexApiKey: raw.yandexApiKey || '',
      ...raw,
      vocabularies: raw.vocabularies || {},
      registries: raw.registries || { ...defaultRegistries },
    });
    
    // Migration: populate missing dates
    let changed = false;
    const now = new Date().toISOString();
    [...finalData.knownWords, ...finalData.ignoredWords, ...finalData.trackedWords, ...finalData.importedWords].forEach(w => {
      if (!finalData.wordDates[w]) {
        finalData.wordDates[w] = now;
        changed = true;
      }
    });
    
    if (changed) {
      const toSave = syncVocabBeforeSave(finalData);
      await apiFsWrite(p, JSON.stringify(toSave, null, 2));
    }
    
    return finalData;
  } catch (e) {
    return defaultUserData;
  }
}

export async function saveUserDataAsync(data: UserData) {
  const p = getUserDataPath();
  try {
    const toSave = syncVocabBeforeSave(data);
    await apiFsWrite(p, JSON.stringify(toSave, null, 2));
  } catch (e) {
    console.warn('Failed to save user data:', e);
  }
}

export type WordMetadata = { tags?: string[]; notes?: string; favoriteContext?: string; image?: string; audioWord?: string; audioContext?: string };

export function useUserData() {
  const [data, setData] = useState<UserData>(defaultUserData);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const reloadData = useCallback(async () => {
    const newData = await loadUserDataAsync();
    setData(newData);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const setTargetLanguage = useCallback((lang: TargetLanguage) => {
    setData(prev => {
      // Save current language vocabulary + registry
      const saved = syncVocabBeforeSave(prev);
      // Switch language
      const vocabs = saved.vocabularies || {};
      const vocab = vocabs[lang] || { ...defaultVocabulary };
      const regs = saved.registries || { ...defaultRegistries };
      const registry = regs[lang] || defaultRegistries[lang] || [];
      const next: UserData = {
        ...saved,
        targetLanguage: lang,
        knownWords: vocab.knownWords || [],
        ignoredWords: vocab.ignoredWords || [],
        trackedWords: vocab.trackedWords || [],
        importedWords: vocab.importedWords || [],
        wordDates: vocab.wordDates || {},
        wordMetadata: vocab.wordMetadata || {},
        lexicometerChain: vocab.lexicometerChain || (registry && registry.length > 0 ? [{ type: 'file', id: registry[0].id, label: registry[0].label, file: registry[0].file, uniqueStems: 0 }] : []),
        registry,
        yandexApiKey: saved.yandexApiKey,
      };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const updateRegistry = useCallback(async (newRegistry: RegistryItem[]) => {
    const currentOnDisk = await loadUserDataAsync();
    await saveUserDataAsync({ ...currentOnDisk, registry: newRegistry });
    setData(prev => ({ ...prev, registry: newRegistry }));
  }, []);

  const toggleKnownWord = useCallback((stem: string) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.knownWords);
      if (set.has(stem)) {
        set.delete(stem);
      } else {
        set.add(stem);
        next.wordDates[stem] = new Date().toISOString();
      }
      next.knownWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const toggleIgnoredWord = useCallback((stem: string) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.ignoredWords);
      if (set.has(stem)) {
        set.delete(stem);
      } else {
        set.add(stem);
        next.wordDates[stem] = new Date().toISOString();
      }
      next.ignoredWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const toggleTrackedWord = useCallback((stem: string) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.trackedWords);
      if (set.has(stem)) {
        set.delete(stem);
      } else {
        set.add(stem);
        next.wordDates[stem] = new Date().toISOString();
      }
      next.trackedWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const toggleImportedWord = useCallback((stem: string) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.importedWords);
      if (set.has(stem)) {
        set.delete(stem);
      } else {
        set.add(stem);
        next.wordDates[stem] = new Date().toISOString();
      }
      next.importedWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const addImportedWords = useCallback((stems: string[]) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.importedWords);
      const now = new Date().toISOString();
      for (const stem of stems) {
        if (!set.has(stem)) {
          set.add(stem);
          next.wordDates[stem] = now;
        }
      }
      next.importedWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const addTrackedWords = useCallback((stems: string[]) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.trackedWords);
      const now = new Date().toISOString();
      for (const stem of stems) {
        if (!set.has(stem)) {
          set.add(stem);
          next.wordDates[stem] = now;
        }
      }
      next.trackedWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const addKnownWords = useCallback((stems: string[]) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates } };
      const set = new Set(next.knownWords);
      const now = new Date().toISOString();
      for (const stem of stems) {
        if (!set.has(stem)) {
          set.add(stem);
          next.wordDates[stem] = now;
        }
      }
      next.knownWords = [...set];
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const clearIgnoredWords = useCallback(() => {
    setData(prev => {
      const next = { ...prev, ignoredWords: [] };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const clearKnownWords = useCallback(() => {
    setData(prev => {
      const next = { ...prev, knownWords: [] };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const clearTrackedWords = useCallback(() => {
    setData(prev => {
      const next = { ...prev, trackedWords: [] };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const clearImportedWords = useCallback(() => {
    setData(prev => {
      const next = { ...prev, importedWords: [] };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const resetAllVocabulary = useCallback(() => {
    setData(prev => {
      const next = { ...prev, knownWords: [], trackedWords: [], ignoredWords: [], importedWords: [], wordDates: {}, wordMetadata: {} };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const updateWordMetadata = useCallback((stem: string, metadata: WordMetadata) => {
    setData(prev => {
      const next = { ...prev, wordMetadata: { ...prev.wordMetadata } };
      next.wordMetadata[stem] = {
        ...(next.wordMetadata[stem] || {}),
        ...metadata
      };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const deleteWord = useCallback((stem: string) => {
    setData(prev => {
      const next = { ...prev, wordDates: { ...prev.wordDates }, wordMetadata: { ...prev.wordMetadata } };
      
      const known = new Set(next.knownWords);
      const tracked = new Set(next.trackedWords);
      const ignored = new Set(next.ignoredWords);
      const imported = new Set(next.importedWords);
      
      known.delete(stem);
      tracked.delete(stem);
      ignored.delete(stem);
      imported.delete(stem);
      
      next.knownWords = [...known];
      next.trackedWords = [...tracked];
      next.ignoredWords = [...ignored];
      next.importedWords = [...imported];
      
      delete next.wordDates[stem];
      delete next.wordMetadata[stem];
      
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const addTagsToWords = useCallback((stems: string[], tags: string[]) => {
    setData(prev => {
      const next = { ...prev, wordMetadata: { ...prev.wordMetadata } };
      stems.forEach(stem => {
        const existing = next.wordMetadata[stem] || {};
        const oldTags = existing.tags || [];
        const combined = Array.from(new Set([...oldTags, ...tags]));
        next.wordMetadata[stem] = { ...existing, tags: combined };
      });
      saveUserDataAsync(next);
      return next;
    });
  }, []);
  
  const updateLexicometerChain = useCallback((newChain: any[]) => {
    setData(prev => {
      const next = { ...prev, lexicometerChain: newChain };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const setYandexApiKey = useCallback((key: string) => {
    setData(prev => {
      const next = { ...prev, yandexApiKey: key };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  const setTtsVoices = useCallback((voices: Record<string, string>) => {
    setData(prev => {
      const next = { ...prev, ttsVoices: voices };
      saveUserDataAsync(next);
      return next;
    });
  }, []);

  return {
    isLoaded,
    userData: data,
    toggleKnownWord,
    toggleIgnoredWord,
    toggleTrackedWord,
    toggleImportedWord,
    addImportedWords,
    addTrackedWords,
    addKnownWords,
    clearIgnoredWords,
    clearKnownWords,
    clearTrackedWords,
    clearImportedWords,
    resetAllVocabulary,
    deleteWord,
    updateRegistry,
    setTargetLanguage,
    updateWordMetadata,
    addTagsToWords,
    updateLexicometerChain,
    setYandexApiKey,
    setTtsVoices,
    reloadData
  };
}
