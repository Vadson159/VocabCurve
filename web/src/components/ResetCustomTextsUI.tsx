import { useState } from 'react';
import { Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { type Language } from '../i18n/translations';

import { apiFsRead, apiFsWrite, apiFsExists, apiFsCopy, apiExec } from '../apiClient';

interface ResetCustomTextsUIProps {
  currentUiLanguage: Language;
  onResetSuccess: () => void;
}

export function ResetCustomTextsUI({ currentUiLanguage, onResetSuccess }: ResetCustomTextsUIProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleReset = async () => {
    if (!confirm(currentUiLanguage === 'ru' ? 'Вы уверены, что хотите удалить все добавленные тексты?' : 'Are you sure you want to remove all custom texts?')) return;

    setStatus('loading');
    
    try {
      const userDataPath = 'user-data.json';
      
      const defaultRegistry: any[] = [];

      let userData: any = { knownWords: [], ignoredWords: [], trackedWords: [], registry: [] };
      if (await apiFsExists(userDataPath)) {
        try {
          const raw = await apiFsRead(userDataPath);
          if (raw) {
            const parsed = JSON.parse(raw);
            userData = { ...userData, ...parsed, trackedWords: parsed.trackedWords || [] };
          }
        } catch (e) { }
      }
      userData.registry = defaultRegistry;
      
      await apiFsWrite(userDataPath, JSON.stringify(userData, null, 2));
      
      const compareCmd = `npx tsx src/compare.ts`;
      const { error } = await apiExec(compareCmd);
      
      if (!error) {
        try {
          const compSrc = 'web/public/comparison.json';
          const compDst = 'web/dist/comparison.json';
          if (await apiFsExists(compSrc)) {
            await apiFsCopy(compSrc, compDst);
          }
        } catch (e) { }
        
        setStatus('success');
        setTimeout(() => {
          onResetSuccess();
          setStatus('idle');
        }, 1000);
      } else {
        console.error("Comparison regeneration failed:", error);
        setStatus('idle');
      }
    } catch (e) {
      console.error("Registry reset failed:", e);
      setStatus('idle');
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={status === 'loading'}
      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-medium transition-colors disabled:opacity-50 h-full"
      title={currentUiLanguage === 'ru' ? 'Удалить кастомные тексты' : 'Clear custom texts'}
    >
      {status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : status === 'success' ? <CheckCircle2 size={18} /> : <Trash2 size={18} />}
      <span className="hidden md:inline">{currentUiLanguage === 'ru' ? 'Сбросить' : 'Reset'}</span>
    </button>
  );
}
