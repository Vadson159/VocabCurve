import type { CefrResult } from '../hooks/useCefrEstimate';
import { LEVELS } from '../hooks/useCefrEstimate';
import { useLanguage } from '../App';

const levelColorMap: Record<string, string> = Object.fromEntries(
  LEVELS.map(l => [l.level, l.color])
);

interface CefrBadgeProps {
  cefr: CefrResult;
}

export function CefrBadge({ cefr }: CefrBadgeProps) {
  const { language } = useLanguage();
  
  return (
    <div className="group relative inline-flex items-center">
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium text-sm transition-all cursor-default"
        style={{
          backgroundColor: `${cefr.color}15`,
          borderColor: `${cefr.color}40`,
          color: cefr.color,
        }}
      >
        <span className="text-xs opacity-70">CEFR</span>
        <span className="font-bold text-base">{cefr.level}</span>
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[200px]">
          <p className="text-xs font-medium text-foreground mb-2">
            {language === 'ru' ? 'Распределение лексики' : 'Vocabulary Distribution'}
          </p>
          <div className="space-y-1">
            {Object.entries(cefr.distribution).map(([level, pct]) => (
              <div key={level} className="flex items-center gap-2 text-xs">
                <span className="w-6 font-mono font-bold text-muted-foreground">{level}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: levelColorMap[level] || cefr.color }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-muted-foreground">{pct}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 opacity-60">
            {language === 'ru' ? `Оценка сложности: ${cefr.score}/6` : `Difficulty score: ${cefr.score}/6`}
          </p>
        </div>
      </div>
    </div>
  );
}
