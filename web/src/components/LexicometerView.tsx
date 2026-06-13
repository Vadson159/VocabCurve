import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';
import { t } from '../i18n/translations';
import { X, Search, Plus, Edit2, Download, ChevronLeft, ChevronRight, CheckSquare, Square, Tag, GripVertical, RotateCcw } from 'lucide-react';
import { WordDetailPanel } from './WordDetailPanel';
import { apiFsRead } from '../apiClient';
import { getArticle, formatNounCapitalization } from '../utils/languageRules';

interface VocabularyWord {
  stem: string;
  displayForm: string;
  article?: string;
  totalCount: number;
  pos?: string;
  forms: Record<string, number>;
  examples?: { text: string; source: string }[];
  sections: number[];
  origin?: string;
}

interface ChainFile {
  type: 'file';
  id: string;
  label: string;
  file: string;
  uniqueStems: number;
}

interface ChainOp {
  type: 'op';
  op: '+' | '-' | '=';
}

type ChainItem = ChainFile | ChainOp;

async function loadVocabFromFile(filePath: string): Promise<VocabularyWord[]> {
  try {
    // Normalize path: if it starts with ./web/public, try cache/ instead as fallback
    let normalizedPath = filePath.replace(/^\.\/web\/public\//, 'cache/');
    const rawContent = await apiFsRead(normalizedPath);
    if (!rawContent) return [];
    const raw = JSON.parse(rawContent);
    const origin = raw.meta?.source?.split('/').pop() || 'Unknown';
    if (raw?.vocabulary && Array.isArray(raw.vocabulary)) {
      return raw.vocabulary.map((v: any) => ({
        ...v,
        origin
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
}

export function LexicometerView() {
  const { userData, toggleKnownWord, addTagsToWords, updateLexicometerChain } = useSharedUserData();
  const { language } = useLanguage();
  
  const chain = useMemo(() => userData.lexicometerChain || [], [userData.lexicometerChain]);
  const setChain = useCallback((newChain: ChainItem[] | ((prev: ChainItem[]) => ChainItem[])) => {
    if (typeof newChain === 'function') {
      updateLexicometerChain(newChain(chain));
    } else {
      updateLexicometerChain(newChain);
    }
  }, [chain, updateLexicometerChain]);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [posFilter, setPosFilter] = useState<'All' | 'Noun' | 'Verb' | 'Adjective'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Known' | 'Unknown' | 'Tracked'>('All');
  const [autoTranslate, setAutoTranslate] = useState(() => localStorage.getItem('vocabcurve-autoTranslate') === 'true');

  useEffect(() => {
    localStorage.setItem('vocabcurve-autoTranslate', autoTranslate.toString());
  }, [autoTranslate]);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [bulkTagMenuOpen, setBulkTagMenuOpen] = useState(false);
  const [bulkTagName, setBulkTagName] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [wordsPerPage, setWordsPerPage] = useState(20);
  const [jumpPage, setJumpPage] = useState('');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const chainContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [vocabCache, setVocabCache] = useState<Record<string, VocabularyWord[]>>({});

  useEffect(() => {
    const handleShowInText = () => setSelectedWord(null);
    window.addEventListener('vocabcurve:show-in-text', handleShowInText);
    return () => window.removeEventListener('vocabcurve:show-in-text', handleShowInText);
  }, []);

  const knownWords = useMemo(() => new Set(userData.knownWords), [userData.knownWords]);
  const trackedWords = useMemo(() => new Set(userData.trackedWords || []), [userData.trackedWords]);
  const ignoredWords = useMemo(() => new Set(userData.ignoredWords || []), [userData.ignoredWords]);

  useEffect(() => {
    const fileItems = chain.filter((item): item is ChainFile => item.type === 'file');
    const loadMissing = async () => {
      let needsUpdate = false;
      const newCache = { ...vocabCache };
      for (const fi of fileItems) {
        if (!newCache[fi.file]) {
          const vocab = await loadVocabFromFile(fi.file);
          if (vocab.length > 0) {
            newCache[fi.file] = vocab;
            needsUpdate = true;
          }
        }
      }
      if (needsUpdate) setVocabCache(newCache);
    };
    loadMissing();
  }, [chain, vocabCache]);

  const updateMenuPos = useCallback(() => {
    if (addMenuOpen && plusBtnRef.current) {
      const rect = plusBtnRef.current.getBoundingClientRect();
      const isSmallScreen = window.innerWidth < 768;
      setMenuPos({ 
        top: rect.bottom + 8, 
        left: isSmallScreen ? window.innerWidth / 2 : rect.left + rect.width / 2 
      });
    }
  }, [addMenuOpen]);

  useEffect(() => {
    updateMenuPos();
    if (addMenuOpen) {
      const container = chainContainerRef.current;
      window.addEventListener('scroll', updateMenuPos, true);
      window.addEventListener('resize', updateMenuPos);
      if (container) container.addEventListener('scroll', updateMenuPos);
      return () => {
        window.removeEventListener('scroll', updateMenuPos, true);
        window.removeEventListener('resize', updateMenuPos);
        if (container) container.removeEventListener('scroll', updateMenuPos);
      };
    }
  }, [addMenuOpen, updateMenuPos]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
        setEditIndex(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    return () => { setAddMenuOpen(false); };
  }, []);

  const addText = useCallback((regItem: { id: string; label: string; file: string }) => {
    setChain(prev => {
      if (prev.length === 0) return [{ type: 'file', id: regItem.id, label: regItem.label, file: regItem.file, uniqueStems: 0 }];
      return [...prev, { type: 'op', op: '+' as const }, { type: 'file', id: regItem.id, label: regItem.label, file: regItem.file, uniqueStems: 0 }];
    });
    setAddMenuOpen(false);
  }, [setChain]);

  const clearChain = useCallback(() => {
    setChain([]);
    setSelectedWord(null);
    setSelectedWords(new Set());
  }, [setChain]);

  const removeText = useCallback((fileIndex: number) => {
    setChain(prev => {
      const next = [...prev];
      if (fileIndex === 0) {
        if (next.length > 1) next.splice(0, 2);
        else next.splice(0, 1);
      } else {
        if (fileIndex > 0 && next[fileIndex-1].type === 'op') {
          next.splice(fileIndex - 1, 2);
        } else {
          next.splice(fileIndex, 1);
        }
      }
      return next;
    });
  }, [setChain]);

  const setOp = useCallback((opIndex: number, newOp: '+' | '-' | '=') => {
    setChain(prev => {
      const next = [...prev];
      if (next[opIndex] && next[opIndex].type === 'op') {
        next[opIndex] = { type: 'op', op: newOp };
      }
      return next;
    });
  }, [setChain]);

  const resultVocabulary = useMemo(() => {
    if (chain.length === 0) return [];
    let currentVocab: Map<string, VocabularyWord> | null = null;
    let nextOp: '+' | '-' | '=' | null = null;
    for (const item of chain) {
      if (item.type === 'file') {
        const fileVocab = vocabCache[item.file] || [];
        const fileMap = new Map(fileVocab.map(v => [v.stem, v]));
        if (currentVocab === null) currentVocab = new Map(fileVocab.map(v => [v.stem, { ...v }]));
        else if (nextOp === '+') {
          for (const [stem, word] of fileMap) {
            const existing = currentVocab.get(stem);
            if (existing) {
              existing.totalCount += word.totalCount;
              // Merge examples
              const combinedEx = [...(existing.examples || []), ...(word.examples || [])];
              // De-duplicate same text and limit
              existing.examples = combinedEx.filter((ex, index, self) => 
                index === self.findIndex((t) => t.text === ex.text)
              ).slice(0, 6);
              // Merge forms
              for (const [f, c] of Object.entries(word.forms)) {
                existing.forms[f] = (existing.forms[f] || 0) + c;
              }
            } else currentVocab.set(stem, { ...word });
          }
        } else if (nextOp === '-') {
             for (const stem of fileMap.keys()) currentVocab.delete(stem);
        } else if (nextOp === '=') {
          const intersection = new Map<string, VocabularyWord>();
          for (const [stem, word] of fileMap) {
            if (currentVocab.has(stem)) {
              const existing = currentVocab.get(stem)!;
              existing.totalCount += word.totalCount;
              // Merge examples
              const combinedEx = [...(existing.examples || []), ...(word.examples || [])];
              existing.examples = combinedEx.filter((ex, index, self) => 
                index === self.findIndex((t) => t.text === ex.text)
              ).slice(0, 6);
               // Merge forms
               for (const [f, c] of Object.entries(word.forms)) {
                existing.forms[f] = (existing.forms[f] || 0) + c;
              }
              intersection.set(stem, existing);
            }
          }
          currentVocab = intersection;
        }
        nextOp = null;
      } else if (item.type === 'op') nextOp = item.op;
    }
    return Array.from(currentVocab?.values() || []).sort((a, b) => b.totalCount - a.totalCount);
  }, [chain, vocabCache]);

  const filteredWords = useMemo(() => {
    let words = resultVocabulary;
    if (posFilter !== 'All') words = words.filter(w => w.pos === posFilter);
    if (statusFilter === 'Known') words = words.filter(w => knownWords.has(w.stem));
    else if (statusFilter === 'Unknown') words = words.filter(w => !knownWords.has(w.stem));
    else if (statusFilter === 'Tracked') words = words.filter(w => trackedWords.has(w.stem));
    if (!search) return words;
    const s = search.toLowerCase();
    return words.filter(w => w.displayForm.toLowerCase().includes(s) || w.stem.toLowerCase().includes(s));
  }, [resultVocabulary, search, posFilter, statusFilter, knownWords, trackedWords]);

  const paginatedWords = filteredWords.slice((currentPage - 1) * wordsPerPage, currentPage * wordsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredWords.length / wordsPerPage));
  const maxFreq = useMemo(() => resultVocabulary[0]?.totalCount || 1, [resultVocabulary]);

  const toggleWordSelection = (stem: string) => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(stem)) next.delete(stem);
      else next.add(stem);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      paginatedWords.forEach(w => next.add(w.stem));
      return next;
    });
  };

  const clearSelection = () => setSelectedWords(new Set());

  const handleBulkTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkTagName.trim()) return;
    addTagsToWords(Array.from(selectedWords), [bulkTagName.trim().toLowerCase()]);
    setBulkTagName('');
    setBulkTagMenuOpen(false);
    clearSelection();
  };

  const exportCSV = () => {
    const headers = ['Word', 'Lemma', 'Frequency', 'Origin'];
    const rows = resultVocabulary.map(w => [w.displayForm, w.stem, w.totalCount, w.origin]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lexicometer_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (chain[index].type !== 'file') {
      e.preventDefault();
      return;
    }
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { if (e.target instanceof HTMLElement) e.target.style.opacity = '0.5'; }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex || chain[dropIndex].type !== 'file') return;

    setChain(prev => {
      const items = [...prev];
      const files = items.filter((it): it is ChainFile => it.type === 'file');
      const ops = items.filter((it): it is ChainOp => it.type === 'op');
      
      const draggedFileIdx = Math.floor(draggedIdx / 2);
      const droppedFileIdx = Math.floor(dropIndex / 2);
      
      const [draggedFile] = files.splice(draggedFileIdx, 1);
      files.splice(droppedFileIdx, 0, draggedFile);
      
      const nextChain: (ChainFile | ChainOp)[] = [];
      files.forEach((f, i) => {
        nextChain.push(f);
        if (i < ops.length) {
          nextChain.push(ops[i]);
        }
      });
      return nextChain;
    });
    setDraggedIdx(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    if (e.target instanceof HTMLElement) e.target.style.opacity = '1';
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div 
        ref={chainContainerRef}
        className="bg-card rounded-2xl p-8 border border-border/50 shadow-2xl overflow-x-auto no-scrollbar shrink-0 relative z-20"
      >
        <div className="flex items-center gap-6 min-w-max">
          {chain.map((item, i) => {
            if (item.type === 'file') {
              const fileIndex = Math.floor(i / 2) + 1;
              const vocabSize = vocabCache[item.file]?.length || 0;
              return (
                <div 
                  key={`file-${i}-${item.id}`} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                  className="relative group cursor-grab active:cursor-grabbing"
                >
                  <div className={`w-72 bg-muted/50 border border-border rounded-xl p-5 hover:border-primary/30 transition-all shadow-lg ${draggedIdx === i ? 'border-primary' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                         <GripVertical size={12} className="text-muted-foreground/60" />
                         <span className="text-[10px] font-bold text-primary tracking-widest uppercase">TEXT {fileIndex.toString().padStart(2, '0')}</span>
                      </div>
                      <button onClick={() => removeText(i)} className="text-muted-foreground/60 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <h4 className="text-foreground font-serif text-lg truncate mb-1">{item.label}</h4>
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">
                      {vocabSize.toLocaleString()} UNIQUE LEMMAS
                    </p>
                    <div onClick={() => { setEditIndex(i); setAddMenuOpen(true); }} className="absolute -bottom-2 -right-2 p-2 bg-muted/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-border/50 cursor-pointer z-10 hover:bg-muted">
                      <Edit2 size={12} className="text-primary" />
                    </div>
                  </div>
                </div>
              );
            } else {
              return (
                <div key={`op-${i}`} className="flex flex-col gap-1.5 shrink-0">
                  {(['+', '-', '='] as const).map(opChar => (
                    <button key={opChar} onClick={() => setOp(i, opChar)} className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-all border ${item.op === opChar ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'}`}>
                      {opChar}
                    </button>
                  ))}
                </div>
              );
            }
          })}
          <div className="relative shrink-0 flex items-center gap-4">
            <button 
              ref={plusBtnRef}
              onClick={() => setAddMenuOpen(!addMenuOpen)} 
              className="w-16 h-16 rounded-full bg-muted/50 border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/60 hover:border-primary/40 hover:text-primary transition-all group"
            >
              <Plus size={24} />
            </button>
            {chain.length > 0 && (
              <button 
                onClick={clearChain}
                title={language === 'ru' ? 'Очистить анализ' : 'Reset Analysis'}
                className="w-12 h-12 rounded-full bg-red-500/5 border border-dashed border-red-500/10 flex items-center justify-center text-red-500/20 hover:border-red-500/40 hover:text-red-500 transition-all active:scale-95"
              >
                <RotateCcw size={20} />
              </button>
            )}
            {addMenuOpen && createPortal(
              <div 
                ref={menuRef}
                style={{ 
                   position: 'fixed', 
                   top: `${menuPos.top}px`, 
                   left: `${menuPos.left}px`, 
                   transform: 'translateX(-50%)',
                   zIndex: 9999
                }}
                className="w-72 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden divide-y divide-white/5 animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div className="px-5 py-3 text-[10px] font-bold text-primary/70 uppercase tracking-[0.2em] bg-muted/50 flex justify-between items-center">
                  <span>{editIndex !== null ? (language === 'ru' ? 'Заменить текст' : 'Replace Vocabulary') : (language === 'ru' ? 'Добавить текст' : 'Add Vocabulary')}</span>
                  <button onClick={() => { setAddMenuOpen(false); setEditIndex(null); }} className="hover:text-foreground transition-colors"><X size={12} /></button>
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
                  {userData.registry.length === 0 ? <div className="p-6 text-xs text-muted-foreground/60 italic text-center">No texts analyzed yet</div> :
                    userData.registry.map(reg => (
                      <button key={reg.id} onClick={() => { if (editIndex !== null) { setChain(prev => { const next = [...prev]; next[editIndex] = { type: 'file', id: reg.id, label: reg.label, file: reg.file, uniqueStems: 0 }; return next; }); setEditIndex(null); } else addText(reg); setAddMenuOpen(false); }} className="w-full px-4 py-3 text-sm text-left hover:bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground transition-all flex items-center gap-3 active:scale-95">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary" />
                        <span className="truncate flex-1">{reg.label}</span>
                      </button>
                    ))
                  }
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-8 items-start flex-1 min-h-[600px] overflow-visible px-4 md:px-0 scroll-smooth">
        <div className={`bg-card rounded-2xl border border-border/50 shadow-2xl flex flex-col transition-all duration-500 overflow-hidden h-fit min-w-0 ${selectedWord ? 'flex-[2] hidden md:flex' : 'flex-1'}`}>
          <div className="p-8 border-b border-border/50 flex flex-col justify-between gap-6 shrink-0">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 w-full">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-serif text-foreground tracking-tight truncate">{t('Vocabulary Result Set', language)}</h2>
                </div>
                <p className="text-muted-foreground/70 text-xs mt-1 uppercase tracking-widest">
                  {language === 'ru' ? 'Отображение' : 'Showing'} {paginatedWords.length.toLocaleString()} {language === 'ru' ? 'из' : 'of'} {filteredWords.length.toLocaleString()} {language === 'ru' ? 'результатов' : 'results'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 border border-border/50 rounded-lg">
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Show:</span>
                  <input type="number" min="5" max="500" value={wordsPerPage} onChange={(e) => { const val = Math.max(5, Math.min(500, Number(e.target.value) || 20)); setWordsPerPage(val); setCurrentPage(1); }} className="bg-transparent border-none text-xs text-primary font-mono w-10 focus:outline-none focus:ring-0 text-center" />
                </div>
                <div className="relative group flex-1 lg:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors" size={16} />
                  <input type="text" placeholder={t('Search word or lemma...', language)} value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="bg-muted/80 border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 w-full lg:w-48 transition-all" />
                </div>
                <button onClick={exportCSV} className="px-4 py-2.5 bg-muted/50 hover:bg-muted border border-border rounded-lg text-[10px] font-bold text-muted-foreground tracking-widest uppercase transition-all flex items-center gap-2">
                  <Download size={14} /> {language === 'ru' ? 'ЭКСПОРТ CSV' : 'EXPORT CSV'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border/50 mb-2 pb-4">
                {(['All', 'Noun', 'Verb', 'Adjective'] as const).map(f => (
                  <button key={f} onClick={() => setPosFilter(f)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border tracking-wider uppercase ${posFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'}`}>
                    {f === 'All' ? (language === 'ru' ? 'Все POS' : 'All POS') : f === 'Noun' ? (language === 'ru' ? 'Сущ.' : 'Nouns') : f === 'Verb' ? (language === 'ru' ? 'Глаг.' : 'Verbs') : (language === 'ru' ? 'Прил.' : 'Adjectives')}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {(['All', 'Known', 'Unknown', 'Tracked'] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border tracking-wider uppercase ${statusFilter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-border/80'}`}>
                    {f === 'All' ? (language === 'ru' ? 'Все' : 'All') : f === 'Known' ? (language === 'ru' ? 'Изученные' : 'Known') : f === 'Unknown' ? (language === 'ru' ? 'Неизвестные' : 'Unknown') : '🎯 TRACKED'}
                  </button>
                ))}
                <div className="w-px h-4 bg-muted mx-1 shrink-0" />
                <label className="flex items-center gap-1.5 cursor-pointer bg-muted/50 px-3 py-1.5 rounded-full hover:bg-muted transition-colors border border-border shrink-0 group">
                  <div className={`relative w-8 h-4 rounded-full transition-colors ${autoTranslate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={autoTranslate} 
                      onChange={e => setAutoTranslate(e.target.checked)} 
                    />
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoTranslate ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap uppercase tracking-wider">{language === 'ru' ? 'АВТО-ПЕРЕВОД' : 'AUTO-TRANSLATE'}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar min-h-0">
            <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="bg-muted/30 text-[10px] font-bold text-muted-foreground/60 tracking-[0.2em] uppercase">
                  <th className="px-8 py-5 border-b border-border/50 w-16 text-center">
                    <button onClick={selectedWords.size > 0 ? clearSelection : selectAllOnPage} className="hover:text-primary transition-colors">
                      {selectedWords.size > 0 ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="px-8 py-5 border-b border-border/50 w-1/4">WORD</th>
                  <th className="px-8 py-5 border-b border-border/50 w-1/4">LEMMA (ROOT)</th>
                  <th className="px-8 py-5 border-b border-border/50 w-1/4">FREQUENCY</th>
                  <th className="px-8 py-5 border-b border-border/50 text-right">ORIGIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedWords.map((w, idx) => {
                  const isIgnored = ignoredWords.has(w.stem);
                  const isKnown = knownWords.has(w.stem);
                  const isTracked = trackedWords.has(w.stem);
                  return (
                    <tr key={`${w.stem}-${idx}`} onClick={() => setSelectedWord(w.stem)} className={`hover:bg-muted/30 transition-all group cursor-pointer ${isIgnored ? 'opacity-30' : ''} ${selectedWord === w.stem ? 'bg-primary/5' : ''} ${selectedWords.has(w.stem) ? 'bg-primary/10' : ''}`}>
                      <td className="px-8 py-5 text-center">
                        <button onClick={(e) => { e.stopPropagation(); toggleWordSelection(w.stem); }} className="hover:text-primary transition-colors">
                          {selectedWords.has(w.stem) ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} className="text-muted-foreground/30 group-hover:text-muted-foreground/60" />}
                        </button>
                      </td>
                      <td className="px-8 py-5 truncate">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${isTracked ? 'text-blue-600' : isKnown ? 'text-emerald-500/70' : 'text-foreground'}`}>
                            {(() => {
                               const rawWord = Object.entries(w.forms).sort((a,b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? w.displayForm ?? w.stem;
                               const langStr = userData.targetLanguage || '';
                               return w.pos === 'Noun' ? formatNounCapitalization(rawWord, langStr) : rawWord;
                            })()}
                          </span>
                          {isTracked && <span className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">★ TRACKED</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5 font-serif italic text-muted-foreground truncate">
                        {(() => {
                           const langStr = userData.targetLanguage || '';
                           const capLemma = w.pos === 'Noun' ? formatNounCapitalization(w.stem, langStr) : w.stem;
                           const art = w.article || getArticle(w.stem, w.pos || '', langStr);
                           return art ? `${art} ${capLemma}` : capLemma;
                        })()}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3 w-full max-w-[180px]">
                          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/80 rounded-full transition-all" style={{ width: `${Math.max(2, (w.totalCount / maxFreq) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{w.totalCount.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right text-[11px] text-muted-foreground/60 uppercase tracking-wider truncate">{w.origin}</td>
                    </tr>
                  );
                })}
                {paginatedWords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground/40 italic text-sm">
                      {search ? 'No words matching your query found.' : 'Construct a chain of texts to analyze vocabulary.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-center gap-4 text-muted-foreground/60 shrink-0">
            <div className="text-[10px] font-bold tracking-widest uppercase">{chain.length > 0 && <span>Chain context: {Math.floor(chain.filter(x=>x.type==='file').length)} TEXTS</span>}</div>
            {totalPages > 1 && (
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-lg border border-border/50">
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Go:</span>
                  <input type="text" placeholder="#" value={jumpPage} onChange={(e) => { const val = e.target.value; if (val === '' || /^\d+$/.test(val)) { setJumpPage(val); const p = Number(val); if (p >= 1 && p <= totalPages) setCurrentPage(p); } }} className="bg-transparent border-none text-xs text-primary font-mono w-8 focus:outline-none focus:ring-0 text-center placeholder:text-muted-foreground/30" />
                </div>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="hover:text-foreground disabled:opacity-0 transition-all font-bold"><ChevronLeft size={20} /></button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono tracking-widest text-muted-foreground">{currentPage}</span>
                  <span className="text-[10px] text-muted-foreground/60">/</span>
                  <span className="text-xs font-bold font-mono tracking-widest text-muted-foreground">{totalPages}</span>
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="hover:text-foreground disabled:opacity-0 transition-all font-bold"><ChevronRight size={20} /></button>
              </div>
            )}
            <div className="text-[10px] font-bold tracking-widest uppercase hidden md:block"><span>Page {currentPage} of {totalPages}</span></div>
          </div>
        </div>
        
        {selectedWord && (
          <div className="w-full md:w-[450px] shrink-0 h-[calc(100vh-14rem)] sticky top-32 overflow-y-auto border border-border/50 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500 custom-scrollbar bg-card z-50">
            <WordDetailPanel 
              word={resultVocabulary.find(w => w.stem === selectedWord) || null} 
              onClose={() => setSelectedWord(null)}
              autoTranslate={autoTranslate}
            />
          </div>
        )}
      </div>

      {selectedWords.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-8 py-4 rounded-full shadow-[0_0_50px_rgba(217,119,87,0.3)] flex items-center gap-8 z-50 animate-in slide-in-from-bottom-8 duration-500">
          <div className="flex items-center gap-3 pr-8 border-r border-border/50"><span className="text-xs font-bold uppercase tracking-widest">{selectedWords.size} SELECTED</span></div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <button onClick={() => setBulkTagMenuOpen(!bulkTagMenuOpen)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-colors"><Tag size={16} /> Bulk Tag</button>
              {bulkTagMenuOpen && (
                <div className="absolute bottom-full mb-4 left-0 bg-card border border-border rounded-xl p-4 shadow-2xl min-w-[240px]">
                  <form onSubmit={handleBulkTag} className="flex gap-2">
                    <input autoFocus type="text" placeholder="e.g. unit_1" value={bulkTagName} onChange={e => setBulkTagName(e.target.value)} className="bg-muted/80 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 w-full" />
                    <button type="submit" className="bg-primary text-primary-foreground p-1.5 rounded-lg hover:bg-primary/80"><Plus size={16} /></button>
                  </form>
                </div>
              )}
            </div>
            <button onClick={() => { Array.from(selectedWords).forEach(s => toggleKnownWord(s)); clearSelection(); }} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-colors"><CheckSquare size={16} /> Mark Known</button>
            <button onClick={clearSelection} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider hover:text-foreground transition-colors pl-8 border-l border-border/50"><X size={16} /> Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
