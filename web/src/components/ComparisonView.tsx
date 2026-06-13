import { useState, useCallback, useEffect } from 'react';
import type { ComparisonResult } from '../hooks/useComparisonData';
import { type RegistryItem, defaultRegistries } from '../hooks/useUserData';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';
import { PanelALadder } from './comparison/PanelALadder';
import { PanelBCoverage } from './comparison/PanelBCoverage';
import { PanelCCurves } from './comparison/PanelCCurves';
import { PanelDBridge } from './comparison/PanelDBridge';
import { PanelEOverview } from './comparison/PanelEOverview';
import { X, EyeOff, Loader2, GripVertical, Eye, RotateCcw } from 'lucide-react';

import { apiExec, apiFsExists, apiFsCopy } from '../apiClient';

interface ComparisonViewProps {
  data: ComparisonResult;
  onRefresh: () => void;
}

export function ComparisonView({ data, onRefresh }: ComparisonViewProps) {
  const { language } = useLanguage();
  const { userData, updateRegistry } = useSharedUserData();
  const [localRegistry, setLocalRegistry] = useState<RegistryItem[]>(userData.registry);
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    setLocalRegistry(userData.registry);
  }, [userData.registry]);

  const runCompare = useCallback(async (newReg: RegistryItem[]) => {
    setIsProcessing(true);
    updateRegistry(newReg); // Saves user-data.json

    const compareCmd = `npx tsx src/compare.ts`;
    
    await apiExec(compareCmd);
    try {
      const compSrc = `web/public/comparison.json`;
      const compDst = `web/dist/comparison.json`;
      if (await apiFsExists(compSrc)) {
        await apiFsCopy(compSrc, compDst);
      }
    } catch (e) {}

    onRefresh();
    setIsProcessing(false);
  }, [updateRegistry, onRefresh]);

  const handleToggleHide = (id: string, currentHidden: boolean) => {
    const next = localRegistry.map(item => item.id === id ? { ...item, hidden: !currentHidden } : item);
    setLocalRegistry(next);
    runCompare(next);
  };

  const handleDelete = (id: string) => {
    // Only allow deletions of non-default texts, maybe? Or all? User requested delete.
    const next = localRegistry.filter(item => item.id !== id);
    setLocalRegistry(next);
    runCompare(next);
  };

  const handleReset = () => {
    if (!window.confirm(language === 'ru' ? 'Сбросить все кастомные тексты?' : 'Reset all custom texts?')) return;
    const lang = userData.targetLanguage || 'german';
    const langDefaults = defaultRegistries[lang] || defaultRegistries.german;
    const next = langDefaults.map(item => ({ ...item, hidden: false }));
    setLocalRegistry(next);
    runCompare(next);
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    // Small delay to allow visual drag image to capture before styling changes
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;

    const items = [...localRegistry];
    const draggedItem = items[draggedIdx];
    items.splice(draggedIdx, 1);
    items.splice(dropIndex, 0, draggedItem);
    
    setLocalRegistry(items);
    runCompare(items);
    setDraggedIdx(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIdx(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const items = [...localRegistry];
    const item = items[fromIndex];
    items.splice(fromIndex, 1);
    items.splice(toIndex, 0, item);
    setLocalRegistry(items);
    runCompare(items);
  };

  return (
    <div className={`space-y-12 animate-in fade-in duration-500 ${isProcessing ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* ACTIVE TEXTS BAR */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[1px] rounded-xl">
            <div className="bg-card border border-border px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Loader2 className="animate-spin text-primary" size={16} />
              <span className="text-sm font-medium">Recomputing analysis...</span>
            </div>
          </div>
        )}
        
        <div className="flex-none">
          <div className="bg-accent/20 text-accent-foreground border border-accent/30 font-bold px-3 py-1.5 rounded-full text-xs tracking-wider uppercase">
            ACTIVE TEXTS
          </div>
        </div>

        <div className="flex-1 flex flex-wrap gap-2 items-center min-h-[40px]">
          {localRegistry.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-grab active:cursor-grabbing ${
                item.hidden 
                  ? 'bg-muted/30 border-border text-muted-foreground' 
                  : 'bg-background border-border text-foreground shadow-sm hover:border-primary/40'
              }`}
            >
              <GripVertical size={14} className="opacity-40" />
              <span className="text-sm font-medium mr-1 truncate max-w-[120px] md:max-w-[200px]" title={item.label}>
                {item.label}
              </span>
              
              <div className="flex items-center gap-1 ml-1 border-l border-border/50 pl-2">
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleToggleHide(item.id, !!item.hidden); }}
                  className="p-1 hover:bg-muted rounded-full transition-colors opacity-70 hover:opacity-100"
                  title={item.hidden ? "Show" : "Hide"}
                >
                  {item.hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(item.id); }}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors opacity-70 hover:opacity-100"
                  title="Delete"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={handleReset}
          className="flex-none flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <RotateCcw size={14} />
          <span>{language === 'ru' ? 'Сбросить' : 'Reset'}</span>
        </button>
      </div>

      {localRegistry.filter(r => !r.hidden).length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 flex flex-col items-center text-center">
          <p className="text-muted-foreground">
            {language === 'ru' 
              ? 'Нет активных текстов для сравнения. Добавьте или отобразите тексты для анализа.' 
              : 'No active texts for comparison. Add or unhide texts to analyze.'}
          </p>
        </div>
      ) : (
        <>
          <section>
            <PanelALadder 
              data={data} 
              localRegistry={localRegistry} 
              onReorder={handleReorder} 
              onToggleHide={handleToggleHide}
              onDelete={handleDelete}
            />
          </section>

          <section className="w-full">
            <PanelEOverview data={data} />
          </section>

          <section className="w-full">
            <PanelCCurves data={data} />
          </section>

          <section className="w-full">
            <PanelBCoverage data={data} />
          </section>

          <section className="w-full">
            <PanelDBridge data={data} />
          </section>
        </>
      )}
    </div>
  );
}
