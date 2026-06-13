import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BookOpen, Eye, EyeOff, X } from 'lucide-react';
import type { AnalysisResult } from '../hooks/useAnalysisData';
import { useLanguage } from '../App';
import { WordDetailPanel } from './WordDetailPanel';

import { apiFsRead } from '../apiClient';

interface InteractiveReaderProps {
  data: AnalysisResult | null;
  knownWords?: Set<string>;
  onToggleWord?: (stem: string) => void;
  ignoredWords?: Set<string>;
  trackedWords?: Set<string>;
}

export function InteractiveReader({ data, knownWords, onToggleWord, ignoredWords, trackedWords }: InteractiveReaderProps) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [showHighlights, setShowHighlights] = useState(true);
  const [selectedStem, setSelectedStem] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Build a set of all stems for quick lookup
  const stemLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (!data) return map;
    for (const w of data.vocabulary) {
      for (const form of Object.keys(w.forms)) {
        map.set(form.toLowerCase(), w.stem);
      }
      map.set(w.displayForm.toLowerCase(), w.stem);
      map.set(w.stem.toLowerCase(), w.stem);
    }
    return map;
  }, [data]);

  // Get full word data for the selected stem
  const selectedWordData = useMemo(() => {
    if (!selectedStem || !data) return null;
    return data.vocabulary.find(w => w.stem === selectedStem) || null;
  }, [selectedStem, data]);

  const unknownCount = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const w of data.vocabulary) {
      if (!knownWords?.has(w.stem) && (!ignoredWords || !ignoredWords.has(w.stem))) count++;
    }
    return count;
  }, [data, knownWords, ignoredWords]);

  const loadSource = useCallback(async () => {
    if (!data) {
      setSourceText('No analysis data available to load source.');
      return;
    }
    try {
      const sourcePath = data.meta.source;
      let content = await apiFsRead(sourcePath);
      
      if (content === null) {
         const filename = sourcePath.split('/').pop()?.split('\\').pop();
         if (filename) {
           const cachePath = `cache/${filename}`;
           const distPath = `web/dist/${filename}`;
           const mdPath = cachePath.replace(/\.[^/.]+$/, "") + ".md";
           const distMdPath = distPath.replace(/\.[^/.]+$/, "") + ".md";
           
           if (mdPath !== sourcePath) {
             content = await apiFsRead(mdPath);
           }
           if (content === null && distMdPath !== sourcePath) {
             content = await apiFsRead(distMdPath);
           }
         }
      }

      if (content !== null) {
        setSourceText(content);
      } else {
        setSourceText(`File not found: ${sourcePath}`);
      }
    } catch (e: any) {
      setSourceText(`Error loading source: ${e.message}`);
    }
  }, [data?.meta.source]);

  const handleOpen = () => {
    if (!sourceText) loadSource();
    setIsOpen(true);
  };

  const handleWordClick = (word: string) => {
    const stem = stemLookup.get(word.toLowerCase());
    if (!stem) return;
    setSelectedStem(stem);
  };

  const handleWordDoubleClick = (word: string) => {
    const stem = stemLookup.get(word.toLowerCase());
    if (stem && onToggleWord) onToggleWord(stem);
  };

  // "Show in text" handler — scrolls to the sentence in the reader
  const handleShowInText = useCallback((sentence: string, _source: string) => {
    setIsOpen(true);
    setSelectedStem(null); // close the panel
    
    const tryScroll = (retries = 0) => {
      if (!contentRef.current) {
        if (retries < 15) setTimeout(() => tryScroll(retries + 1), 200);
        return;
      }
      
      const paragraphs = contentRef.current.querySelectorAll('p, h2, h3');
      if (paragraphs.length === 0) {
        if (retries < 15) setTimeout(() => tryScroll(retries + 1), 200);
        return;
      }

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
      const normalizedTarget = normalize(sentence);
      
      for (const el of paragraphs) {
        const elText = normalize(el.textContent || '');
        if (elText.includes(normalizedTarget) || (elText.length > 20 && normalizedTarget.includes(elText))) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-card', 'rounded-lg', 'bg-primary/5');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-card', 'rounded-lg', 'bg-primary/5');
          }, 3000);
          return;
        }
      }
    };
    
    tryScroll();
  }, []);

  useEffect(() => {
    const handleGlobalShowInText = (e: any) => {
      if (e.detail && e.detail.sentence) {
        if (!sourceText) {
            loadSource();
        }
        handleShowInText(e.detail.sentence, e.detail.source || '');
      }
    };
    window.addEventListener('vocabcurve:show-in-text', handleGlobalShowInText);
    return () => window.removeEventListener('vocabcurve:show-in-text', handleGlobalShowInText);
  }, [handleShowInText, sourceText, loadSource]);

  const renderText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, li) => {
      if (line.startsWith('## ')) {
        return (
          <h3 key={li} className="text-xl font-serif text-primary mt-8 mb-3 pb-2 border-b border-border">
            {line.replace(/^## /, '')}
          </h3>
        );
      }
      if (line.startsWith('# ')) {
        return (
          <h2 key={li} className="text-2xl font-serif text-foreground mt-6 mb-4">
            {line.replace(/^# /, '')}
          </h2>
        );
      }
      if (line.trim() === '') return <br key={li} />;

      const tokens = line.split(/(\s+|[.,!?;:"""''()—–\-\[\]{}])/);
      return (
        <p key={li} className="mb-2 leading-relaxed text-foreground/90">
          {tokens.map((token, ti) => {
            const cleanToken = token.replace(/[.,!?;:"""''()—–\-\[\]{}]/g, '');
            const stem = cleanToken.length >= 2 ? stemLookup.get(cleanToken.toLowerCase()) : null;

            if (!stem) {
              return <span key={ti}>{token}</span>;
            }

            const isKnown = knownWords?.has(stem);
            const isIgnored = ignoredWords?.has(stem);
            const isTracked = trackedWords?.has(stem);
            const isUnknown = !isKnown && !isIgnored;
            const isSelected = stem === selectedStem;

            let className = 'transition-all rounded-[2px] px-[1px]';
            let title = '';

            if (isSelected) {
              className += ' bg-primary/20 border-b-2 border-primary cursor-pointer';
            } else if (isIgnored) {
              className += ' text-muted-foreground/70 cursor-default';
              title = language === 'ru' ? 'Игнорируемое слово' : 'Ignored word';
            } else if (isTracked) {
              className += ' bg-blue-500/15 border-b border-blue-500/40 hover:bg-blue-500/25 cursor-pointer';
              title = language === 'ru' ? 'Отслеживаемое слово' : 'Tracked word';
            } else if (showHighlights && isUnknown) {
              className += ' bg-amber-500/15 border-b border-amber-500/40 hover:bg-amber-500/25 cursor-pointer';
              title = language === 'ru' ? 'Клик — подробнее' : 'Click for details';
            } else if (isKnown) {
              className += ' hover:bg-emerald-500/10 cursor-pointer';
              title = language === 'ru' ? 'Известное слово' : 'Known word';
            } else {
              className += ' hover:bg-muted/50 cursor-pointer';
            }

            return (
              <span
                key={ti}
                onClick={() => !isIgnored && handleWordClick(cleanToken)}
                onDoubleClick={() => !isIgnored && handleWordDoubleClick(cleanToken)}
                className={className}
                title={title}
              >
                {token}
              </span>
            );
          })}
        </p>
      );
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="w-full bg-card border border-border rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="group-hover:text-primary transition-colors" />
          <span className="font-medium">
            {language === 'ru' ? 'Открыть интерактивное чтение' : 'Open Interactive Reader'}
          </span>
        </div>
        <span className="text-xs bg-muted/50 px-2 py-0.5 rounded-md">
          {unknownCount} {language === 'ru' ? 'незнакомых' : 'unknown'}
        </span>
      </button>
    );
  }

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-primary" />
          <h2 className="text-xl font-serif text-foreground">
            {language === 'ru' ? 'Интерактивное чтение' : 'Interactive Reader'}
          </h2>
          <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
            {unknownCount} {language === 'ru' ? 'незнакомых' : 'unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHighlights(!showHighlights)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showHighlights 
                ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20' 
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {showHighlights ? <Eye size={14} /> : <EyeOff size={14} />}
            {language === 'ru' ? 'Подсветка' : 'Highlights'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: '500px', maxHeight: '80vh' }}>
        {/* Text content */}
        <div ref={contentRef} className={`overflow-y-auto px-8 py-6 custom-scrollbar transition-all ${selectedStem ? 'w-1/2' : 'w-full'}`}>
          <div className="max-w-3xl mx-auto text-[15px] leading-7 font-sans">
            {sourceText ? renderText(sourceText) : (
              <div className="text-muted-foreground text-center py-12">
                {language === 'ru' ? 'Загрузка текста...' : 'Loading text...'}
              </div>
            )}
          </div>
        </div>

        {/* Word detail sidebar */}
        {selectedStem && selectedWordData && (
          <div className="w-1/2 border-l border-border overflow-y-auto custom-scrollbar">
            <WordDetailPanel
              word={selectedWordData as any}
              onClose={() => setSelectedStem(null)}
              autoTranslate={true}
              onShowInText={handleShowInText}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-border bg-muted/30 flex items-center gap-6 text-xs text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/40" />
          {language === 'ru' ? 'Незнакомое слово' : 'Unknown word'}
        </span>
        <span>{language === 'ru' ? 'Клик = подробнее' : 'Click = details'}</span>
        <span>{language === 'ru' ? 'Двойной клик = отметить как известное' : 'Double-click = mark as known'}</span>
      </div>
    </div>
  );
}
