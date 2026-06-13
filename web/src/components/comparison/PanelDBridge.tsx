import { useState, useMemo } from 'react';
import type { ComparisonResult } from '../../hooks/useComparisonData';
import { useLanguage } from '../../App';
import { useSharedUserData } from '../../contexts/UserDataContext';
import { t } from '../../i18n/translations';
import { Search, ChevronDown, ChevronRight, CheckCircle2, EyeOff, Target } from 'lucide-react';

interface PanelDBridgeProps {
  data: ComparisonResult;
}

export function PanelDBridge({ data }: PanelDBridgeProps) {
  const { language } = useLanguage();
  const { userData } = useSharedUserData();
  
  const knownWords = new Set(userData.knownWords);
  const ignoredWords = new Set(userData.ignoredWords);
  const trackedWords = new Set(userData.trackedWords || []);

  const [selectedPair, setSelectedPair] = useState<string>(() => {
    const firstCoverage = data.coverage && data.coverage.length > 0 ? data.coverage[0] : null;
    return firstCoverage ? `${firstCoverage.sourceId}-${firstCoverage.targetId}` : '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'known' | 'tracked' | 'ignored' | 'unmarked'>('all');
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({ core: true, medium: false, rare: false });

  const currentCoverage = useMemo(() => {
    if (!selectedPair) return null;
    const [sourceId, targetId] = selectedPair.split('-');
    return data.coverage?.find(c => c.sourceId === sourceId && c.targetId === targetId);
  }, [data, selectedPair]);

  const filteredBridgeWords = useMemo(() => {
    if (!currentCoverage) return [];
    
    let words = currentCoverage.bridgeWords;
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      words = words.filter(w => w.displayForm.toLowerCase().includes(q) || w.stem.toLowerCase().includes(q));
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      words = words.filter(w => {
        if (filterStatus === 'known') return knownWords.has(w.stem);
        if (filterStatus === 'tracked') return trackedWords.has(w.stem);
        if (filterStatus === 'ignored') return ignoredWords.has(w.stem);
        if (filterStatus === 'unmarked') return !knownWords.has(w.stem) && !trackedWords.has(w.stem) && !ignoredWords.has(w.stem);
        return true;
      });
    }
    
    return words;
  }, [currentCoverage, searchQuery, filterStatus, knownWords, trackedWords, ignoredWords]);

  const tiers = useMemo(() => {
    const core = filteredBridgeWords.filter(w => w.countInTarget >= 20);
    const medium = filteredBridgeWords.filter(w => w.countInTarget >= 6 && w.countInTarget < 20);
    const rare = filteredBridgeWords.filter(w => w.countInTarget < 6);
    return { core, medium, rare };
  }, [filteredBridgeWords]);

  if (!currentCoverage) return null;

  const toggleTier = (tier: string) => {
    setExpandedTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };

  const getWordStatusStyle = (stem: string) => {
    if (knownWords.has(stem)) return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    if (trackedWords.has(stem)) return 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    if (ignoredWords.has(stem)) return 'border-muted-foreground/30 bg-muted/30 text-muted-foreground opacity-60';
    return 'border-border bg-background text-foreground';
  };

  const renderTier = (id: string, label: string, colorClass: string, words: any[]) => {
    if (words.length === 0) return null;
    const isExpanded = expandedTiers[id];
    
    return (
      <div className="border border-border rounded-lg overflow-hidden mb-4 bg-card">
        <button 
          onClick={() => toggleTier(id)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
            <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
            <span className="font-medium text-foreground">{label}</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{words.length} words</span>
        </button>
        
        {isExpanded && (
          <div className="p-4 border-t border-border bg-background/50">
            <div className="flex flex-wrap gap-2">
              {words.map((word, i) => (
                <div
                  key={i}
                  className={`flex items-center rounded-md overflow-hidden border hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 cursor-default ${getWordStatusStyle(word.stem)}`}
                  title={`Stem: ${word.stem}`}
                >
                  <span className="px-3 py-1.5 text-sm font-medium">
                    {word.displayForm}
                  </span>
                  <span className="px-2 py-1.5 text-xs border-l border-current/20 opacity-80 font-mono flex items-center bg-current/5">
                    {word.countInTarget}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-serif text-primary mb-2">{t('Bridge Words', language)}</h2>
          <p className="text-muted-foreground max-w-2xl">
            {t('Words that appear in the target text but are NOT covered by the source text.', language)}
          </p>
        </div>
        
        <div className="flex flex-col gap-3 min-w-[300px]">
          <select 
            className="bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium"
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
          >
            {data.coverage.map(c => (
              <option key={`${c.sourceId}-${c.targetId}`} value={`${c.sourceId}-${c.targetId}`}>
                {c.sourceLabel} → {c.targetLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-background border border-border rounded-lg p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-3xl font-serif text-foreground block md:inline mb-1 md:mb-0">
            {currentCoverage.bridgeWordsTotal.toLocaleString()}
          </span>
          <span className="text-muted-foreground md:ml-2">
            words in <strong className="text-foreground">{currentCoverage.targetLabel}</strong> not covered by <strong className="text-foreground">{currentCoverage.sourceLabel}</strong>
          </span>
        </div>
        <div className="text-left md:text-right border-t md:border-t-0 border-border pt-4 md:pt-0">
          <span className="text-sm text-muted-foreground block">{t('Coverage', language)}</span>
          <span className="text-2xl font-medium text-primary">
            {currentCoverage.coveragePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder={language === 'ru' ? 'Фильтр списка слов...' : 'Filter bridge words...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border text-foreground rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        
        <div className="flex p-1 bg-muted/30 border border-border rounded-lg gap-1 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterStatus === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {language === 'ru' ? 'Все' : 'All'}
          </button>
          <button
            onClick={() => setFilterStatus('known')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterStatus === 'known' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <CheckCircle2 size={14} /> {language === 'ru' ? 'Изучено' : 'Known'}
          </button>
          <button
            onClick={() => setFilterStatus('tracked')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterStatus === 'tracked' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Target size={14} /> {language === 'ru' ? 'Трекинг' : 'Tracked'}
          </button>
          <button
            onClick={() => setFilterStatus('ignored')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${filterStatus === 'ignored' ? 'bg-muted text-muted-foreground opacity-80' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <EyeOff size={14} /> {language === 'ru' ? 'Игнор' : 'Ignored'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(searchQuery || filterStatus !== 'all') && filteredBridgeWords.length === 0 ? (
          <div className="text-center py-12 bg-background border border-border border-dashed rounded-xl">
            <p className="text-muted-foreground">{language === 'ru' ? 'Слова не найдены по текущим фильтрам.' : 'No words match the current filters.'}</p>
          </div>
        ) : (
          <>
            {renderTier('core', 'Core (20+ occurrences)', 'bg-emerald-500', tiers.core)}
            {renderTier('medium', 'Medium (6-19 occurrences)', 'bg-amber-500', tiers.medium)}
            {renderTier('rare', 'Rare (1-5 occurrences)', 'bg-rose-500', tiers.rare)}
          </>
        )}
      </div>
    </div>
  );
}
