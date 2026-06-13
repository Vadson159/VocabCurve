import React, { useState, useEffect } from 'react';
import type { ComparisonResult } from '../../hooks/useComparisonData';
import type { RegistryItem } from '../../hooks/useUserData';
import { ArrowDown, GripVertical, Eye, X } from 'lucide-react';
import { useLanguage } from '../../App';
import { t } from '../../i18n/translations';

interface PanelALadderProps {
  data: ComparisonResult;
  localRegistry: RegistryItem[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleHide: (id: string, currentHidden: boolean) => void;
  onDelete: (id: string) => void;
}

let dragSourceId: string | null = null;

export function PanelALadder({ data, localRegistry, onReorder, onToggleHide, onDelete }: PanelALadderProps) {
  const { language } = useLanguage();
  const { steps, finalVocabulary } = data.cumulativeLadder;
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(false);
    const timer = setTimeout(() => {
      setAnimate(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);
  
  const colors = [
    'bg-[#4a8b9d]', // teal
    'bg-[#d4a373]', // tan
    'bg-[#4ade80]', // green
    'bg-primary',
    'bg-secondary',
  ];

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragSourceId = id;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.4';
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragSourceId || e.dataTransfer.getData('text/plain');
    dragSourceId = null;
    if (!sourceId || sourceId === targetId) return;
    
    const fromIndex = localRegistry.findIndex(item => item.id === sourceId);
    const toIndex = localRegistry.findIndex(item => item.id === targetId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-primary mb-2">{t('The Language Learning Ladder', language)}</h2>
          <p className="text-muted-foreground text-sm">
            {language === 'ru' 
              ? 'Как словарный запас накапливается в текстах. Каждый шаг добавляет новые слова в ваш общий словарь.' 
              : 'How vocabulary builds across texts of increasing difficulty. Each step adds new words to your cumulative vocabulary.'}
          </p>
        </div>
        <div className="text-muted-foreground text-xs leading-none">
          {language === 'ru' ? 'Перетащите для изменения порядка' : 'Drag to reorder'}
        </div>
      </div>

      <div className="space-y-6">
        {steps.map((step, index) => {
          const previousCumulative = index > 0 ? steps[index - 1].cumulativeStems : 0;
          const previousWidthPercent = (previousCumulative / finalVocabulary) * 100;
          const newWidthPercent = (step.stemsAdded / finalVocabulary) * 100;

          return (
            <div 
              key={step.id} 
              className="relative group transition-all duration-200"
              draggable
              onDragStart={(e) => handleDragStart(e, step.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, step.id)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center gap-4">
                  {/* Drag and actions handle */}
                  <div className="flex flex-col gap-1 items-center justify-center p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors h-full mt-2">
                    <div className="cursor-grab active:cursor-grabbing p-1" title="Drag to reorder">
                      <GripVertical size={16} />
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleHide(step.id, false); }}
                        className="p-1 hover:bg-muted rounded-md transition-colors text-foreground/50 hover:text-foreground"
                        title="Hide from analysis"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}
                        className="p-1 hover:bg-destructive/10 rounded-md transition-colors text-foreground/50 hover:text-destructive"
                        title="Delete permanently"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1">
                  {/* Labels above bar */}
                  <div className="flex justify-between items-end mb-1">
                    <div className="font-semibold text-foreground text-[15px]">{step.label}</div>
                    <div className="text-muted-foreground text-xs font-mono">
                      +{step.stemsAdded.toLocaleString()}
                    </div>
                  </div>

                  {/* The Bar */}
                  <div className="h-8 bg-muted/20 rounded-sm overflow-hidden flex relative border-y border-r border-border/50">
                    {index > 0 && (
                      <div 
                        className="h-full bg-transparent border-r border-border/50 transition-all duration-1000 ease-out"
                        style={{ width: animate ? `${previousWidthPercent}%` : '0%' }}
                      />
                    )}
                    <div 
                      className={`h-full ${colors[index % colors.length]} transition-all duration-1000 ease-out`}
                      style={{ width: animate ? `${newWidthPercent}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* Total Stats on right */}
                <div className="w-24 text-right pt-4">
                  <span className="text-foreground font-bold text-[15px] block leading-tight">{step.cumulativeStems.toLocaleString()}</span>
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wider block leading-tight">{t('stems total', language)}</span>
                </div>
              </div>

              {/* Coverage Bridge */}
              {step.coverageOfNext !== null && (
                <div className="flex items-start gap-4 mt-2 ml-10">
                  <div className="flex flex-col items-center">
                    <div className="bg-background border border-border rounded-full p-0.5 z-10">
                      <ArrowDown size={12} className="text-muted-foreground" />
                    </div>
                    <div className="w-px h-8 bg-border/50 -mt-2"></div>
                  </div>
                  <div className="text-[13px] text-muted-foreground mt-0.5">
                    {t('Covers', language)} <strong className="text-foreground font-semibold">{step.coverageOfNext.toFixed(1)}%</strong> {t('of next text', language)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
