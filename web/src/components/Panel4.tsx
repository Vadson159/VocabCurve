import { useMemo, useState, useEffect } from 'react';
import { Search, X, Check, BarChart2 } from 'lucide-react';
import type { AnalysisResult } from '../hooks/useAnalysisData';
import { useLanguage } from '../App';
import { t } from '../i18n/translations';
import { AnkiExportUI } from './AnkiExportUI';
import { WordDetailPanel } from './WordDetailPanel';
import { formatNounCapitalization } from '../utils/languageRules';

interface Panel4Props {
  data: AnalysisResult | null;
  selectedSectionIndex: number | null;
  onClearSelection: () => void;
  knownWords?: Set<string>;
  onToggleKnown?: (stem: string) => void;
  ignoredWords?: Set<string>;
  onToggleIgnored?: (stem: string) => void;
  trackedWords?: Set<string>;
  onToggleTracked?: (stem: string) => void;
}

export function Panel4({ data, selectedSectionIndex, onClearSelection, knownWords, onToggleKnown, ignoredWords, onToggleIgnored, trackedWords, onToggleTracked }: Panel4Props) {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(50);
  const [posFilter, setPosFilter] = useState<'All' | 'Noun' | 'Verb' | 'Adjective'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Known' | 'Unknown' | 'Tracked'>('All');
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('vocabcurve-autoTranslate') === 'true');

  useEffect(() => {
    localStorage.setItem('vocabcurve-autoTranslate', autoTranslate.toString());
  }, [autoTranslate]);

  useEffect(() => {
    const handleShowInText = () => setSelectedWord(null);
    window.addEventListener('vocabcurve:show-in-text', handleShowInText);
    return () => window.removeEventListener('vocabcurve:show-in-text', handleShowInText);
  }, []);

  const section = useMemo(() => {
    if (!data || selectedSectionIndex === null) return null;
    return data.sections.find((s) => s.index === selectedSectionIndex) || null;
  }, [data, selectedSectionIndex]);

  const wordsToDisplay = useMemo(() => {
    if (!data) return [];

    let words = data.vocabulary;

    if (posFilter !== 'All') {
      words = words.filter(w => w.pos === posFilter);
    }

    if (statusFilter === 'Known' && knownWords) {
      words = words.filter(w => knownWords.has(w.stem));
    } else if (statusFilter === 'Unknown' && knownWords) {
      words = words.filter(w => !knownWords.has(w.stem));
    } else if (statusFilter === 'Tracked' && trackedWords) {
      words = words.filter(w => trackedWords.has(w.stem));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      words = words.filter(
        (w) =>
          w.stem.toLowerCase().includes(query) ||
          w.displayForm.toLowerCase().includes(query) ||
          Object.keys(w.forms).some((f) => f.toLowerCase().includes(query))
      );
    } else if (section) {
      const sectionNewWords = new Set(section.newWords);
      words = words.filter((w) => sectionNewWords.has(w.stem));
    } else {
      words = [...words].sort((a, b) => b.totalCount - a.totalCount).slice(Math.max(0, rangeFrom - 1), rangeTo);
    }

    return words;
  }, [data, section, searchQuery, rangeFrom, rangeTo, posFilter, statusFilter, knownWords, trackedWords]);

  const wordDetails = useMemo(() => {
    if (!data || !selectedWord) return null;
    return data.vocabulary.find((w) => w.stem === selectedWord) || null;
  }, [data, selectedWord]);

  const coverage = useMemo(() => {
    if (!data || !knownWords) return null;
    const total = data.vocabulary.length;
    const known = data.vocabulary.filter(w => knownWords.has(w.stem)).length;
    return { known, total, percent: total > 0 ? Math.round((known / total) * 100) : 0 };
  }, [data, knownWords]);

  if (!data) return null;

  return (
    <div className="w-full bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col">
      <div className="mb-6 flex flex-col gap-4 shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-serif text-foreground mb-1">{language === 'ru' ? 'Исследование слов' : 'Word Explorer'}</h2>
            <p className="text-muted-foreground text-sm">
              {section
                ? (language === 'ru'
                  ? `Новые слова в разделе ${section.index + 1}: ${section.title}`
                  : `New words in Topic ${section.index + 1}: ${section.title}`)
                : (language === 'ru' ? `Слова с ${rangeFrom} по ${rangeTo} (по частоте)` : `Words ${rangeFrom}–${rangeTo} by frequency`)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {coverage && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm">
                <Check size={14} className="text-emerald-500" />
                <span className="text-emerald-600 font-medium">{coverage.percent}%</span>
                <span className="text-muted-foreground text-xs hidden md:inline">
                  ({coverage.known}/{coverage.total})
                </span>
              </div>
            )}
            {section && (
              <button
                onClick={onClearSelection}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
                title={t('Clear selection', language)}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder={language === 'ru' ? 'Поиск по словарю...' : 'Search vocabulary...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {!section && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {language === 'ru' ? 'С' : 'From'}
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 bg-background border border-border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {language === 'ru' ? 'по' : 'to'}
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={rangeTo}
                onChange={(e) => setRangeTo(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 bg-background border border-border rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              {data && (
                <AnkiExportUI data={data} currentUiLanguage={language} defaultWordCount={rangeTo - rangeFrom + 1} ignoredWords={ignoredWords} />
              )}

              <div className="w-px h-6 bg-border mx-2" />

              <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                <div className={`relative w-8 h-4 rounded-full transition-colors ${autoTranslate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={autoTranslate} 
                    onChange={e => setAutoTranslate(e.target.checked)} 
                  />
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoTranslate ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">Auto-translate</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          {(['All', 'Noun', 'Verb', 'Adjective'] as const).map(f => (
            <button
              key={f}
              onClick={() => setPosFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${posFilter === f
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
            >
              {f === 'All' ? (language === 'ru' ? 'Все части речи' : 'All POS') :
                f === 'Noun' ? (language === 'ru' ? 'Существительные' : 'Nouns') :
                  f === 'Verb' ? (language === 'ru' ? 'Глаголы' : 'Verbs') :
                    (language === 'ru' ? 'Прилагательные' : 'Adjectives')}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          {(['All', 'Known', 'Unknown', 'Tracked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === f
                  ? f === 'Tracked' ? 'bg-blue-500 text-white shadow-sm' : 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
            >
              {f === 'All' ? (language === 'ru' ? 'Все' : 'All') :
                f === 'Known' ? (language === 'ru' ? 'Изученные' : 'Known') :
                  f === 'Tracked' ? (language === 'ru' ? '🎯 Tracked' : '🎯 Tracked') :
                    (language === 'ru' ? 'Неизвестные' : 'Unknown')}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <label className="flex items-center gap-1.5 cursor-pointer ml-1 bg-muted px-2 py-1 rounded-full hover:bg-muted/80 transition-colors">
            <input
              type="checkbox"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
              className="rounded-sm border-border text-primary focus:ring-primary/50 text-[10px]"
            />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {language === 'ru' ? 'АВТО-ПЕРЕВОД' : 'AUTO-TRANSLATE'}
            </span>
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 relative">
        <div className="flex-1 min-h-0 h-full overflow-y-auto pr-2 custom-scrollbar">
          {wordsToDisplay.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {t('No words found.', language)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 content-start">
              {wordsToDisplay.map((w) => {
                const isKnown = knownWords?.has(w.stem);
                const isIgnored = ignoredWords?.has(w.stem);
                const isTracked = trackedWords?.has(w.stem);
                return (
                  <button
                    key={w.stem}
                    onClick={() => setSelectedWord(w.stem)}
                    className={`group relative flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all ${selectedWord === w.stem
                        ? 'bg-primary/5 border-primary shadow-sm scale-[1.02]'
                        : isTracked
                          ? 'bg-blue-500/10 border-blue-500/30 shadow-blue-500/5'
                          : isIgnored
                            ? 'bg-muted/30 border-border/50 opacity-50 hover:opacity-80 hover:bg-muted'
                            : isKnown
                              ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                              : 'bg-card border-border hover:bg-muted/50 hover:border-border/80'
                      }`}
                  >
                    {isKnown && !isIgnored && !isTracked && (
                      <Check size={12} className="absolute top-1 right-1 text-emerald-500 opacity-60" />
                    )}
                    {isTracked && !isIgnored && (
                      <span className="absolute top-1 right-1 text-blue-500 opacity-70 text-[10px]">🎯</span>
                    )}
                    {isIgnored && (
                      <span className="absolute top-1 right-1 text-muted-foreground opacity-70 text-[10px]">🚫</span>
                    )}
                    <span className={`text-sm font-medium ${isTracked ? 'text-blue-600' : 'text-foreground'}`}>
                      {(() => {
                        const rawWord = Object.entries(w.forms).sort((a,b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? w.displayForm ?? w.stem;
                        return w.pos === 'Noun' ? formatNounCapitalization(rawWord, data.meta.language || '') : rawWord;
                      })()}
                    </span>
                    <span className="text-xs opacity-60 font-mono">{w.totalCount}</span>
                    {onToggleKnown && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onToggleKnown(w.stem); }}
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 ${isKnown
                            ? 'bg-red-500/80 text-white'
                            : 'bg-emerald-500/80 text-white'
                          }`}
                        title={isKnown
                          ? (language === 'ru' ? 'Убрать из известных' : 'Unmark known')
                          : (language === 'ru' ? 'Отметить как известное' : 'Mark as known')}
                      >
                        {isKnown ? '✕' : '✓'}
                      </span>
                    )}
                    {onToggleTracked && (
                      <span
                        onClick={(e) => { e.stopPropagation(); onToggleTracked(w.stem); }}
                        className={`absolute -top-1 right-4 w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 ${isTracked
                            ? 'bg-rose-500/80 text-white'
                            : 'bg-blue-500/80 text-white'
                          }`}
                        title={isTracked
                          ? (language === 'ru' ? 'Убрать из отслеживаемых' : 'Untrack')
                          : (language === 'ru' ? 'Отслеживать' : 'Track')}
                      >
                        {isTracked ? '✕' : '🎯'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {wordDetails && (
          <div className="w-full md:w-[450px] shrink-0 h-full overflow-y-auto border border-border rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500 custom-scrollbar bg-card z-50">
            <WordDetailPanel
              word={wordDetails as any}
              onClose={() => setSelectedWord(null)}
              autoTranslate={autoTranslate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
