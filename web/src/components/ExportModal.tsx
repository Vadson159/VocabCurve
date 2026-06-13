import { useState } from 'react';
import { X, Download, CheckCircle2 } from 'lucide-react';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';
import { useComparisonData } from '../hooks/useComparisonData';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which word list to export: 'tracked', 'known', 'imported', or 'all' */
  wordListType: 'tracked' | 'known' | 'imported' | 'ignored' | 'all';
}

export function ExportModal({ isOpen, onClose, wordListType }: ExportModalProps) {
  const { language } = useLanguage();
  const { userData } = useSharedUserData();
  const { data: comparisonData } = useComparisonData();

  const [includeWord, setIncludeWord] = useState(true);
  const [includeStem, setIncludeStem] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);
  const [includeTag, setIncludeTag] = useState(true);
  const [exported, setExported] = useState(false);

  if (!isOpen) return null;

  const getWordList = (): string[] => {
    switch (wordListType) {
      case 'tracked': return userData.trackedWords || [];
      case 'known': return userData.knownWords || [];
      case 'imported': return userData.importedWords || [];
      case 'ignored': return userData.ignoredWords || [];
      case 'all': return [
        ...(userData.knownWords || []),
        ...(userData.trackedWords || []),
        ...(userData.importedWords || []),
      ];
    }
  };

  const handleExport = () => {
    const wordList = getWordList();
    const dict = comparisonData?.globalDictionary || {};

    const exportData = wordList.map(stem => {
      const wordInfo = dict[stem];
      const metadata = userData.wordMetadata?.[stem];
      const displayForm = wordInfo
        ? Object.entries(wordInfo.forms).sort(([,a],[,b]) => b - a)[0]?.[0] || wordInfo.displayForm || stem
        : stem;

      const entry: Record<string, any> = {};

      if (includeWord) {
        entry.word = displayForm;
      }
      if (includeStem) {
        entry.stem = stem;
      }
      if (includeContext) {
        // Use favorite context if it exists, otherwise first example
        const favCtx = metadata?.favoriteContext;
        if (favCtx) {
          entry.context = favCtx;
        } else if (wordInfo?.examples && wordInfo.examples.length > 0) {
          const firstEx = wordInfo.examples[0];
          entry.context = typeof firstEx === 'string' ? firstEx : (firstEx as any).text || '';
        } else {
          entry.context = '';
        }
      }
      if (includeTag) {
        entry.tags = metadata?.tags || [];
      }

      return entry;
    });

    // Download as JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-${wordListType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setExported(true);
    setTimeout(() => {
      setExported(false);
      onClose();
    }, 1500);
  };

  const tabLabel = {
    tracked: language === 'ru' ? 'Отслеживаемые' : 'Tracked',
    known: language === 'ru' ? 'Изученные' : 'Known',
    imported: language === 'ru' ? 'Импортированные' : 'Imported',
    ignored: language === 'ru' ? 'Скрытые' : 'Ignored',
    all: language === 'ru' ? 'Все слова' : 'All words',
  }[wordListType];

  const wordCount = getWordList().length;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-serif text-foreground">
                {language === 'ru' ? 'Экспорт словаря' : 'Export Vocabulary'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {tabLabel} • {wordCount} {language === 'ru' ? 'слов' : 'words'}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3 mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
              {language === 'ru' ? 'Включить в экспорт:' : 'Include in export:'}
            </p>
            
            <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <input type="checkbox" checked={includeWord} onChange={e => setIncludeWord(e.target.checked)} className="rounded border-border text-primary focus:ring-primary/50 w-4 h-4" />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {language === 'ru' ? 'Слово из текста' : 'Word from text'}
                </span>
                <p className="text-[11px] text-muted-foreground">{language === 'ru' ? 'Самая частая словоформа' : 'Most common word form'}</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <input type="checkbox" checked={includeStem} onChange={e => setIncludeStem(e.target.checked)} className="rounded border-border text-primary focus:ring-primary/50 w-4 h-4" />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {language === 'ru' ? 'Stem слова' : 'Word stem'}
                </span>
                <p className="text-[11px] text-muted-foreground">{language === 'ru' ? 'Лемматизированная форма' : 'Lemmatized form'}</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} className="rounded border-border text-primary focus:ring-primary/50 w-4 h-4" />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {language === 'ru' ? 'Избранный контекст' : 'Favorite context'}
                </span>
                <p className="text-[11px] text-muted-foreground">{language === 'ru' ? 'Предложение со звёздочкой' : 'Starred sentence example'}</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer">
              <input type="checkbox" checked={includeTag} onChange={e => setIncludeTag(e.target.checked)} className="rounded border-border text-primary focus:ring-primary/50 w-4 h-4" />
              <div>
                <span className="text-sm font-medium text-foreground">
                  {language === 'ru' ? 'Кастомные теги' : 'Custom tags'}
                </span>
                <p className="text-[11px] text-muted-foreground">{language === 'ru' ? 'Пользовательские метки слова' : 'User-defined word labels'}</p>
              </div>
            </label>
          </div>

          <div className="text-xs text-muted-foreground/50 mb-4 font-mono">
            {language === 'ru' ? 'Формат: JSON' : 'Format: JSON'}
          </div>
        </div>

        <div className="bg-muted/40 p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button
            onClick={handleExport}
            disabled={wordCount === 0 || exported}
            className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-lg transition-all disabled:opacity-50"
          >
            {exported ? (
              <>
                <CheckCircle2 size={16} />
                {language === 'ru' ? 'Готово!' : 'Done!'}
              </>
            ) : (
              <>
                <Download size={16} />
                {language === 'ru' ? 'Экспорт JSON' : 'Export JSON'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
