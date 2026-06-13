import { useState, useEffect, useMemo } from 'react';

export interface AnalysisResult {
  meta: {
    source: string;
    language: string;
    totalSections: number;
    totalWords?: number;
    totalTokens: number;
    totalUniqueStems: number;
    stemmer: string;
  };
  sections: Array<{
    index: number;
    title: string;
    totalTokens: number;
    uniqueStems: number;
    newStems: number;
    cumulativeUniqueStems: number;
    newWords: string[];
  }>;
  vocabulary: Array<{
    stem: string;
    displayForm: string;
    forms: Record<string, number>;
    totalCount: number;
    sections: number[];
    pos?: 'Noun' | 'Verb' | 'Adjective' | 'Other';
    examples?: string[];
  }>;
  frequencyDistribution: Array<{
    minOccurrences: number;
    stemCount: number;
    percentage: number;
  }>;
}

export function useAnalysisData(sourceFile: string = 'analysis.json') {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!sourceFile) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const isHttp = window.location.protocol.startsWith('http');
    const suffix = isHttp ? `?t=${Date.now()}` : '';
    fetch(`${sourceFile}${suffix}`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load data');
        return res.text();
      })
      .then((text) => {
        if (text.trim().startsWith('<')) {
          throw new Error('Analysis data not found (received HTML instead of JSON). Make sure you have analyzed a text first.');
        }
        const json = JSON.parse(text);
        setData(json);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [sourceFile]);

  return { data, loading, error };
}

export function useFilteredSections(data: AnalysisResult | null, threshold: number) {
  return useMemo(() => {
    if (!data) return [];
    if (threshold <= 1) return data.sections;

    const validWords = new Set(
      data.vocabulary
        .filter((v) => v.totalCount >= threshold)
        .map((v) => v.stem)
    );

    const seenStems = new Set<string>();
    let cumulative = 0;

    return data.sections.map((section) => {
      const sectionWords = data.vocabulary
        .filter(v => v.sections.includes(section.index) && validWords.has(v.stem));
      
      let newStemsCount = 0;
      const newWords: string[] = [];

      for (const word of sectionWords) {
        if (!seenStems.has(word.stem)) {
          seenStems.add(word.stem);
          newStemsCount++;
          newWords.push(word.stem);
        }
      }

      cumulative += newStemsCount;

      return {
        ...section,
        newStems: newStemsCount,
        cumulativeUniqueStems: cumulative,
        newWords,
      };
    });
  }, [data, threshold]);
}
