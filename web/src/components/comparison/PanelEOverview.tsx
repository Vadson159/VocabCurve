import type { ComparisonResult } from '../../hooks/useComparisonData';
import { useLanguage } from '../../App';
import { t } from '../../i18n/translations';

interface PanelEOverviewProps {
  data: ComparisonResult;
}

export function PanelEOverview({ data }: PanelEOverviewProps) {
  const { language } = useLanguage();
  const texts = data.texts;

  const totalWords = texts.reduce((acc, text) => acc + text.totalTokens, 0);
  const totalUniqueStems = data.cumulativeLadder.finalVocabulary;
  
  // Calculate average overlap
  let totalOverlap = 0;
  let overlapComparisons = 0;
  data.coverage.forEach(c => {
    totalOverlap += c.coveragePercent;
    overlapComparisons++;
  });
  const avgOverlap = overlapComparisons > 0 ? totalOverlap / overlapComparisons : 0;

  // Density = Total Tokens / Unique Stems (higher means more repetition, easier text)
  // Let's invert it for difficulty. High density = hard. Wait, lexical density is unique/total.
  const calculateDensity = (text: any) => text.totalUniqueStems > 0 ? (text.totalUniqueStems / text.totalTokens) * 100 : 0;
  
  const avgDensity = texts.reduce((acc, text) => acc + calculateDensity(text), 0) / Math.max(1, texts.length);

  // Difficulty Ranking
  const rankedTexts = [...texts].sort((a, b) => calculateDensity(b) - calculateDensity(a));

  // Global top words
  const allWordCounts = new Map<string, number>();
  texts.forEach(text => {
    text.topWords.forEach(w => {
      allWordCounts.set(w.displayForm, (allWordCounts.get(w.displayForm) || 0) + w.count);
    });
  });
  const topCorpusWords = Array.from(allWordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16);

  const colors = [
    'text-primary border-primary/20 bg-primary/5',
    'text-[#4a8b9d] border-[#4a8b9d]/20 bg-[#4a8b9d]/5',
    'text-[#d4a373] border-[#d4a373]/20 bg-[#d4a373]/5',
    'text-[#4ade80] border-[#4ade80]/20 bg-[#4ade80]/5',
    'text-secondary border-secondary/20 bg-secondary/5',
  ];

  return (
    <div className="space-y-12">
      {/* Selected Texts Statistics Panel */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-serif text-primary mb-2">{t('Selected Texts Statistics', language)}</h2>
          <p className="text-muted-foreground">
            {language === 'ru' ? 'Обзор словарного запаса выбранных текстов' : 'Vocabulary overview across selected texts'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-background border border-border rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-primary mb-1">{totalWords.toLocaleString()}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('Total Words', language)}</span>
          </div>
          <div className="bg-background border border-border rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-foreground mb-1">{totalUniqueStems.toLocaleString()}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{language === 'ru' ? 'Уникальных стемов' : 'Unique Stems'}</span>
          </div>
          <div className="bg-background border border-border rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-foreground mb-1">~{avgOverlap.toFixed(1)}%</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{language === 'ru' ? 'Пересечение' : 'Vocabulary Overlap'}</span>
          </div>
          <div className="bg-background border border-border rounded-lg p-5 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-serif text-foreground mb-1">{avgDensity.toFixed(2)}%</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{language === 'ru' ? 'Средняя плотность' : 'Avg. Density'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-lg font-serif text-primary mb-1">{language === 'ru' ? 'Рейтинг сложности' : 'Difficulty Ranking'}</h3>
            <p className="text-xs text-muted-foreground mb-4">{language === 'ru' ? 'Отсортировано по лексической плотности (уник. слова на 1000 токенов)' : 'Sorted by lexical density (unique words per 1000 tokens)'}</p>
            <div className="space-y-3">
              {rankedTexts.map((text, i) => (
                <div key={text.id} className="flex flex-col md:flex-row md:items-center justify-between py-2 border-b border-border/50 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium text-foreground truncate max-w-[200px]">{text.label}</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-4 text-sm font-mono text-muted-foreground">
                    <span>{text.totalUniqueStems.toLocaleString()} stems</span>
                    <span className="text-primary font-semibold hidden md:inline">{calculateDensity(text).toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-between bg-muted/10 border border-border/30 rounded px-4 py-2 text-xs font-mono text-muted-foreground">
              <span>Texts: {texts.length}</span>
              <span>Tokens: {totalWords.toLocaleString()}</span>
              <span>Avg. Stems: {Math.round(totalUniqueStems / Math.max(1, texts.length)).toLocaleString()}</span>
              <span>Sections: {texts.reduce((a, t) => a + t.sections, 0)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-serif text-primary mb-1">{language === 'ru' ? 'Самые частые слова корпуса' : 'Most Common Corpus Words'}</h3>
            <p className="text-xs text-muted-foreground mb-4">{language === 'ru' ? 'Слова, часто встречающиеся во всех текстах' : 'Words appearing frequently across all texts'}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {topCorpusWords.map(([word, count], i) => (
                <div key={word} className="flex justify-between items-center py-1 border-b border-border/30 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium text-foreground">{word}</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{count.toLocaleString()}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Text Overview Cards */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-serif text-primary mb-1">{t('Text Overview', language)}</h2>
          <p className="text-sm text-muted-foreground">
            {t('Key statistics and most frequent words for each text.', language)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {texts.map((text, index) => {
            const colorClass = colors[index % colors.length];
            // Find its coverage of everything else combined? Too complex. Keep original stats.
            
            return (
              <div key={text.id} className={`border rounded-lg p-5 flex flex-col ${colorClass} hover:shadow-md transition-shadow`}>
                <h3 className="font-serif font-medium text-lg mb-5 truncate pb-2 border-b border-current/20" title={text.label}>
                  {text.label}
                </h3>
                
                <div className="space-y-3 mb-6 flex-1 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-wider opacity-70 text-xs">{t('Words', language)}</span>
                    <span className="font-mono font-medium">{text.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-wider opacity-70 text-xs">{language === 'ru' ? 'Уник. Стемы' : 'Unique Stems'}</span>
                    <span className="font-mono font-medium">{text.totalUniqueStems.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-wider opacity-70 text-xs">{language === 'ru' ? 'Разделов' : 'Sections'}</span>
                    <span className="font-mono font-medium">{text.sections}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="uppercase tracking-wider opacity-70 text-xs">{language === 'ru' ? 'Плотность' : 'Lexical Density'}</span>
                    <span className="font-mono font-medium">{calculateDensity(text).toFixed(2)}%</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wider opacity-70 mb-3">{language === 'ru' ? 'Топ слов' : 'Top Words'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {text.topWords.slice(0, 15).map((word, i) => (
                      <span 
                        key={i} 
                        className="text-xs bg-background/80 px-2 py-1 rounded border border-current/10 font-medium whitespace-nowrap"
                      >
                        {word.displayForm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
