import { useState, useMemo, useEffect } from 'react';
import { Check, Target, Ban, Search, X, FileText, RotateCcw, BarChart2, Download, Tag, ChevronUp, ChevronDown, PlusCircle } from 'lucide-react';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';
import { useComparisonData } from '../hooks/useComparisonData';
import { WordDetailPanel } from './WordDetailPanel';
import { ExportModal } from './ExportModal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export function VocabularyView() {
  const { language } = useLanguage();
  const { 
    userData, 
    addImportedWords,
    addTrackedWords,
    addKnownWords,
    resetAllVocabulary
  } = useSharedUserData();
  
  const { data: comparisonData } = useComparisonData();

  const [activeTab, setActiveTab] = useState<'overview' | 'imported' | 'tracked' | 'known' | 'ignored' | 'registry' | 'tags'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ field: 'word' | 'date' | 'tags'; direction: 'asc' | 'desc' | null }>({ field: 'date', direction: 'desc' });
  
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('vocabcurve-autoTranslate') === 'true');

  useEffect(() => {
    localStorage.setItem('vocabcurve-autoTranslate', autoTranslate.toString());
  }, [autoTranslate]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Set<string>>(new Set());
  
  const [chartPeriod, setChartPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [chartFilters, setChartFilters] = useState({
    imported: true,
    tracked: true,
    known: true,
    ignored: true,
  });
  
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<'imported' | 'tracked' | 'known'>('imported');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Clear selected word when switching tabs
  useEffect(() => {
    setSelectedWord(null);
  }, [activeTab]);

  useEffect(() => {
    const handleShowInText = () => setSelectedWord(null);
    window.addEventListener('vocabcurve:show-in-text', handleShowInText);
    return () => window.removeEventListener('vocabcurve:show-in-text', handleShowInText);
  }, []);

  const wordList = useMemo(() => {
    let raw: string[] = [];
    if (activeTab === 'imported') raw = [...(userData.importedWords || [])];
    else if (activeTab === 'tracked') raw = [...(userData.trackedWords || [])];
    else if (activeTab === 'known') raw = [...(userData.knownWords || [])];
    else if (activeTab === 'ignored') raw = [...(userData.ignoredWords || [])];
    else if (activeTab === 'tags') {
      const allWithMetadata = Object.keys(userData.wordMetadata || {});
      if (selectedTag) {
        raw = allWithMetadata.filter(w => userData.wordMetadata?.[w]?.tags?.includes(selectedTag));
      } else {
        raw = allWithMetadata.filter(w => (userData.wordMetadata?.[w]?.tags?.length || 0) > 0);
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace(/^#/, '');
      raw = raw.filter(w => {
        const metadata = userData.wordMetadata?.[w];
        const matchesWord = w.toLowerCase().includes(q);
        const matchesTags = metadata?.tags?.some(t => t.toLowerCase().includes(q));
        return matchesWord || matchesTags;
      });
    }
    
    const dates = userData.wordDates || {};
    const metadata = userData.wordMetadata || {};

    if (sortConfig.direction === null) {
      return raw.sort((a, b) => {
        const da = new Date(dates[a] || 0).getTime();
        const db = new Date(dates[b] || 0).getTime();
        return db - da;
      });
    }

    return raw.sort((a, b) => {
      let comparison = 0;
      if (sortConfig.field === 'word') {
        comparison = a.localeCompare(b);
      } else if (sortConfig.field === 'date') {
        comparison = new Date(dates[a] || 0).getTime() - new Date(dates[b] || 0).getTime();
      } else if (sortConfig.field === 'tags') {
        const ta = metadata[a]?.tags?.[0] || '';
        const tb = metadata[b]?.tags?.[0] || '';
        comparison = ta.localeCompare(tb);
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [userData, activeTab, searchQuery, selectedTag, sortConfig]);

  const handleSort = (field: 'word' | 'date' | 'tags') => {
    setSortConfig(prev => {
      if (prev.field === field) {
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        if (prev.direction === 'desc') return { field, direction: null };
        return { field, direction: 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const registryList = useMemo(() => {
    if (activeTab !== 'registry') return [];
    let items = userData.registry || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(r => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    return items;
  }, [userData, activeTab, searchQuery]);

  const chartData = useMemo(() => {
    if (activeTab !== 'overview') return [];
    const dataByDate = new Map<string, any>();
    const dates = userData.wordDates || {};
    
    const getGroupKey = (isoStr: string) => {
      if (!isoStr) return 'Unknown';
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return 'Unknown';
      if (chartPeriod === 'day') return d.toISOString().split('T')[0];
      if (chartPeriod === 'week') {
        const dWeek = new Date(d);
        dWeek.setUTCDate(d.getUTCDate() - d.getUTCDay());
        return dWeek.toISOString().split('T')[0] + ' (Week)';
      }
      return d.toISOString().slice(0, 7); 
    };

    const processList = (list: string[] = [], key: string) => {
      list.forEach(w => {
        const group = getGroupKey(dates[w]);
        if (!dataByDate.has(group)) {
          dataByDate.set(group, { date: group, known: 0, tracked: 0, ignored: 0, imported: 0 });
        }
        dataByDate.get(group)[key]++;
      });
    };

    if (chartFilters.known) processList(userData.knownWords, 'known');
    if (chartFilters.tracked) processList(userData.trackedWords, 'tracked');
    if (chartFilters.imported) processList(userData.importedWords, 'imported');
    if (chartFilters.ignored) processList(userData.ignoredWords, 'ignored');

    return Array.from(dataByDate.values()).sort((a, b) => {
      if (a.date === 'Unknown') return -1;
      if (b.date === 'Unknown') return 1;
      return a.date.localeCompare(b.date);
    });
  }, [userData, chartPeriod, activeTab, chartFilters]);

  const loadTranslation = async (stem: string) => {
    if (translations[stem] || translating.has(stem)) return;
    setTranslating(prev => new Set(prev).add(stem));
    try {
      const res = await fetch('http://localhost:8000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: stem,
          src_lang: userData.targetLanguage,
          tgt_lang: language,
          is_word: true
        })
      });
      
      const json = await res.json();
      if (res.ok && json.status !== 'error' && json.translation) {
        setTranslations(prev => ({ ...prev, [stem]: json.translation.toLowerCase() }));
      }
    } catch (e) {}
    setTranslating(prev => { const n = new Set(prev); n.delete(stem); return n; });
  };

  useEffect(() => {
    if (autoTranslate && activeTab !== 'registry' && activeTab !== 'overview') {
      for (const stem of wordList.slice(0, 50)) {
        loadTranslation(stem);
      }
    }
  }, [autoTranslate, wordList, activeTab]);

  const tabs = [
    { id: 'overview' as const, icon: BarChart2, label: language === 'ru' ? 'Обзор' : 'Overview', count: null, color: '#3b82f6' },
    { id: 'imported' as const, icon: Download, label: language === 'ru' ? 'Импорт' : 'Imported', count: (userData.importedWords || []).length, color: '#3b82f6' },
    { id: 'tracked' as const, icon: Target, label: language === 'ru' ? 'Отслеживаемые' : 'Tracked', count: (userData.trackedWords || []).length, color: '#f59e0b' },
    { id: 'known' as const, icon: Check, label: language === 'ru' ? 'Изученные' : 'Known', count: (userData.knownWords || []).length, color: '#10b981' },
    { id: 'ignored' as const, icon: Ban, label: language === 'ru' ? 'Скрытые' : 'Ignored', count: (userData.ignoredWords || []).length, color: '#94a3b8' },
    { id: 'tags' as const, icon: Tag, label: language === 'ru' ? 'Теги' : 'Tags', count: Object.values(userData.wordMetadata || {}).filter(m => (m.tags?.length || 0) > 0).length, color: '#f97316' },
    { id: 'registry' as const, icon: FileText, label: language === 'ru' ? 'Тексты' : 'Registry', count: (userData.registry || []).length, color: '#3b82f6' },
  ];

  const handleResetVocabulary = () => {
    if (window.confirm(language === 'ru' ? 'Сбросить весь словарный запас?' : 'Reset all vocabulary?')) {
      resetAllVocabulary();
    }
  };

  const handleExport = () => {
    setIsExportOpen(true);
  };

  const exportListType = (['tracked', 'known', 'imported', 'ignored'].includes(activeTab) ? activeTab : 'all') as 'tracked' | 'known' | 'imported' | 'ignored' | 'all';

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const words = importText.split(/[\n,;]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    if (words.length > 0) {
      if (importStatus === 'tracked') addTrackedWords(words);
      else if (importStatus === 'known') addKnownWords(words);
      else addImportedWords(words);
    }
    setImportText('');
    setIsImportOpen(false);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const selectedWordDetails = useMemo(() => {
    if (!selectedWord) return null;
    const globalDict = (comparisonData as any)?.globalDictionary || {};
    if (globalDict[selectedWord]) return globalDict[selectedWord];
    return { stem: selectedWord, displayForm: selectedWord, totalCount: 0, forms: {}, examples: [] };
  }, [selectedWord, comparisonData]);

  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    Object.values(userData.wordMetadata || {}).forEach(m => {
      m.tags?.forEach(t => tagsSet.add(t));
    });
    return Array.from(tagsSet).sort();
  }, [userData.wordMetadata]);

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm h-[calc(100vh-12rem)] flex flex-col overflow-hidden animate-in fade-in duration-500">
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} wordListType={exportListType} />

      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6">
            <h2 className="text-xl font-serif text-foreground mb-4">{language === 'ru' ? 'Импорт слов' : 'Import Words'}</h2>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-40 bg-background border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/50 resize-none outline-none mb-4"
              placeholder="e.g. lesen, gehen, laufen..."
            />
            <div className="flex gap-2 mb-6">
              {(['imported', 'tracked', 'known'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setImportStatus(s)}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-all ${
                    importStatus === s ? 'bg-primary/10 border-primary/40 text-primary font-bold' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setIsImportOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg">Cancel</button>
              <button onClick={handleImportSubmit} className="px-6 py-2 bg-primary text-primary-foreground font-bold text-sm rounded-lg shadow-sm">IMPORT</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col border-b border-border bg-muted/10 shrink-0">
        <div className="flex overflow-x-auto custom-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none ${
                   isActive ? 'border-primary text-primary bg-background' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                <div 
                  className={`w-2 h-2 rounded-full mr-2 ${tab.id === 'overview' ? 'hidden' : ''}`} 
                  style={{ backgroundColor: tab.color }} 
                />
                <Icon size={16} className={isActive ? 'text-primary' : 'opacity-70'} />
                {tab.label}
                {tab.count !== null && <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{tab.count}</span>}
              </button>
            );
          })}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-border/50 bg-background/50 justify-end">
            <button 
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-md border border-primary/20 transition-colors hover:bg-primary/20"
            >
              <Download size={14} /> <span>{language === 'ru' ? 'Экспорт' : 'Export'}</span>
            </button>
            <button 
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 text-xs text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-md border border-emerald-500/20 transition-colors hover:bg-emerald-500/20"
            >
              <PlusCircle size={14} /> <span>{language === 'ru' ? 'Импорт' : 'Import'}</span>
            </button>
          {activeTab === 'tags' && (
            <select 
              value={selectedTag || ''} 
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="bg-muted border border-border rounded-md px-2 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">{language === 'ru' ? 'Все теги' : 'All Tags'}</option>
              {uniqueTags.map(tag => <option key={tag} value={tag}>#{tag}</option>)}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <input
              type="text"
              placeholder={language === 'ru' ? 'Поиск...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-40 bg-background border border-border rounded-md pl-8 pr-8 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={12} /></button>}
          </div>
          <button 
            onClick={() => setAutoTranslate(!autoTranslate)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${autoTranslate ? 'bg-primary/20 border-primary/50 text-primary font-bold' : 'bg-muted border-border text-muted-foreground hover:bg-muted/50'}`}
          >
            {language === 'ru' ? 'Перевод' : 'Translate'}
          </button>
          <button onClick={handleResetVocabulary} className="flex items-center gap-1.5 text-xs text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-md border border-rose-500/20 hover:bg-rose-500/20 transition-colors" title="Reset Vocabulary">
            <RotateCcw size={12} /> <span className="hidden md:inline">{language === 'ru' ? 'Сброс' : 'Reset'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-card flex min-h-0">
        {activeTab === 'overview' ? (
           <div className="p-8 w-full h-full overflow-y-auto">
             <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                <div>
                  <h3 className="text-xl font-serif text-primary">{language === 'ru' ? 'Активность' : 'Vocabulary activity'}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg mr-4">
                      {(['day', 'week', 'month'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setChartPeriod(p)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${chartPeriod === p ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {p === 'day' ? (language === 'ru' ? 'День' : 'Day') : p === 'week' ? (language === 'ru' ? 'Неделя' : 'Week') : (language === 'ru' ? 'Месяц' : 'Month')}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      {(['imported', 'known', 'tracked'] as const).map(f => (
                        <label key={f} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={chartFilters[f as keyof typeof chartFilters]}
                            onChange={() => setChartFilters(prev => ({ ...prev, [f]: !prev[f as keyof typeof prev] }))}
                            className="w-3 h-3 rounded border-border text-primary focus:ring-0 focus:ring-offset-0 bg-background"
                          />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                            {f}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
             </div>
             <div className="h-[400px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', borderRadius: '8px' }} />
                    <Legend iconType="circle" />
                    <Bar dataKey="known" name="Known" fill="#10b981" />
                    <Bar dataKey="tracked" name="Tracked" fill="#f59e0b" />
                    <Bar dataKey="imported" name="Imported" fill="#3b82f6" />
                  </BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        ) : activeTab === 'registry' ? (
           <div className="p-6 w-full h-full overflow-y-auto">
             <table className="w-full text-xs text-left">
               <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-bold">
                 <tr>
                    <th className="p-4 w-12">#</th>
                    <th className="p-4">ID</th>
                    <th className="p-4">TITLE</th>
                    <th className="p-4">PATH</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                  {registryList.map((r, i) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="p-4 text-muted-foreground font-mono">{i+1}</td>
                      <td className="p-4 font-mono text-primary">{r.id}</td>
                      <td className="p-4 font-medium">{r.label}</td>
                      <td className="p-4 text-muted-foreground truncate max-w-xs">{r.file}</td>
                    </tr>
                  ))}
               </tbody>
             </table>
           </div>
        ) : (
           <div className="flex-1 overflow-hidden relative">
             <div className="flex-1 w-full h-full overflow-y-auto p-6 transition-all custom-scrollbar">
                {wordList.length === 0 ? (
                   <div className="flex items-center justify-center h-40 text-muted-foreground italic border border-dashed border-border rounded-xl">List is empty</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase tracking-widest border-b border-border">
                      <tr>
                        <th className="pb-4 pt-2 font-bold w-12 text-muted-foreground/30">#</th>
                        <th 
                          className="pb-4 pt-2 font-bold text-left cursor-pointer hover:text-primary transition-colors group"
                          onClick={() => handleSort('word')}
                        >
                          <div className="flex items-center gap-1">
                            {language === 'ru' ? 'Слово' : 'Word'}
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronUp size={10} className={sortConfig.field === 'word' && sortConfig.direction === 'asc' ? 'text-primary' : ''} />
                              <ChevronDown size={10} className={sortConfig.field === 'word' && sortConfig.direction === 'desc' ? 'text-primary' : ''} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="pb-4 pt-2 font-bold text-left cursor-pointer hover:text-primary transition-colors group"
                          onClick={() => handleSort('date')}
                        >
                          <div className="flex items-center gap-1">
                            {language === 'ru' ? 'Добавлено' : 'Added'}
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronUp size={10} className={sortConfig.field === 'date' && sortConfig.direction === 'asc' ? 'text-primary' : ''} />
                              <ChevronDown size={10} className={sortConfig.field === 'date' && sortConfig.direction === 'desc' ? 'text-primary' : ''} />
                            </div>
                          </div>
                        </th>
                        <th 
                          className="pb-4 pt-2 font-bold text-right cursor-pointer hover:text-primary transition-colors group"
                          onClick={() => handleSort('tags')}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronUp size={10} className={sortConfig.field === 'tags' && sortConfig.direction === 'asc' ? 'text-primary' : ''} />
                              <ChevronDown size={10} className={sortConfig.field === 'tags' && sortConfig.direction === 'desc' ? 'text-primary' : ''} />
                            </div>
                            TAGS
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {wordList.map((stem, i) => {
                        const metadata = userData.wordMetadata?.[stem];
                        const date = userData.wordDates?.[stem];
                        const isKnown = (userData.knownWords || []).includes(stem);
                        const isTracked = (userData.trackedWords || []).includes(stem);

                        return (
                          <tr key={stem} onClick={() => setSelectedWord(stem)} className={`group hover:bg-muted/30 cursor-pointer transition-colors ${selectedWord === stem ? 'bg-primary/5' : ''}`}>
                            <td className="py-4 font-mono text-xs text-muted-foreground">{i + 1}</td>
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                {metadata?.image && (
                                  <div className="w-8 h-8 rounded overflow-hidden shrink-0 border border-border/50 bg-black/20 group-hover:scale-150 group-hover:shadow-xl transition-all origin-left z-10 relative">
                                    <img 
                                      src={`http://localhost:8000/userimages/${(() => {
                                        const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
                                        return srcLangMap[userData.targetLanguage] || 'de';
                                      })()}/${metadata.image}`}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col">
                                  <span className={`font-serif text-[15px] ${isKnown ? 'text-emerald-500/70' : isTracked ? 'text-amber-500' : 'text-foreground'}`}>{stem}</span>
                                  {autoTranslate && translations[stem] && (
                                    <span className="text-[10px] text-primary italic opacity-70">{translations[stem]}</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 text-xs font-mono text-muted-foreground opacity-50">{formatDate(date)}</td>
                            <td className="py-4 text-right">
                               <div className="flex flex-wrap justify-end gap-1">
                                  {metadata?.tags?.slice(0, 3).map(t => (
                                    <span key={t} className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">#{t}</span>
                                  ))}
                                  {(metadata?.tags?.length || 0) > 3 && <span className="text-[9px] text-muted-foreground">+{metadata!.tags!.length - 3}</span>}
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
             </div>
             
             {selectedWord && (
               <div className="absolute right-0 top-0 bottom-0 w-full md:w-[450px] border-l border-border bg-card shadow-2xl z-50 animate-in slide-in-from-right duration-300">
                 <WordDetailPanel 
                   word={selectedWordDetails as any}
                   onClose={() => setSelectedWord(null)}
                   autoTranslate={autoTranslate}
                 />
               </div>
             )}
           </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border bg-muted/10 flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground/50 shrink-0">
        <div className="flex gap-8">
           <span>Known: {userData.knownWords.length}</span>
           <span>Tracked: {userData.trackedWords.length}</span>
           <span>Tagged: {Object.values(userData.wordMetadata || {}).filter(m => (m.tags?.length || 0) > 0).length}</span>
        </div>
        <div>VocabCurve Engine v2.5</div>
      </div>
    </div>
  );
}
