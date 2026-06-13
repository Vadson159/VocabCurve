import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useUserData } from '../hooks/useUserData';
import type { UserData, TargetLanguage, RegistryItem } from '../hooks/useUserData';

interface UserDataContextValue {
  userData: UserData;
  toggleKnownWord: (stem: string) => void;
  toggleIgnoredWord: (stem: string) => void;
  toggleTrackedWord: (stem: string) => void;
  toggleImportedWord: (stem: string) => void;
  addImportedWords: (stems: string[]) => void;
  addTrackedWords: (stems: string[]) => void;
  addKnownWords: (stems: string[]) => void;
  clearIgnoredWords: () => void;
  clearKnownWords: () => void;
  clearTrackedWords: () => void;
  clearImportedWords: () => void;
  resetAllVocabulary: () => void;
  deleteWord: (stem: string) => void;
  updateRegistry: (newRegistry: RegistryItem[]) => void;
  setTargetLanguage: (lang: TargetLanguage) => void;
  updateWordMetadata: (stem: string, metadata: import('../hooks/useUserData').WordMetadata) => void;
  addTagsToWords: (stems: string[], tags: string[]) => void;
  updateLexicometerChain: (newChain: any[]) => void;
  setYandexApiKey: (key: string) => void;
  setTtsVoices: (voices: Record<string, string>) => void;
  reloadData: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const value = useUserData();

  // Expose reloadData globally so AnalyzerUI etc. can trigger a refresh
  useEffect(() => {
    (window as any).reloadUserData = value.reloadData;
    return () => {
      delete (window as any).reloadUserData;
    };
  }, [value.reloadData]);

  // Expose userData globally so top-level translation functions can access geminiApiKey
  useEffect(() => {
    (window as any).__vocabcurve_userData = value.userData;
  }, [value.userData]);

  if (!value.isLoaded) {
    return (
      <div className="flex bg-slate-900 items-center justify-center w-screen h-screen">
        <div className="text-white text-xl animate-pulse">Loading Vocabulary Data...</div>
      </div>
    );
  }

  return (
    <UserDataContext.Provider value={value as any}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useSharedUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useSharedUserData must be used within UserDataProvider');
  return ctx;
}
