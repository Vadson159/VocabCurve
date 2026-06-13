import { useState, useEffect } from 'react';
import { apiFsRead } from '../apiClient';
export interface ComparisonResult {
  texts: Array<{
    id: string;
    label: string;
    totalTokens: number;
    totalUniqueStems: number;
    sections: number;
    topWords: Array<{ displayForm: string; count: number }>;
    curve: Array<{ section: number; newStems: number; cumulative: number }>;
  }>;
  coverage: Array<{
    sourceId: string;
    sourceLabel: string;
    targetId: string;
    targetLabel: string;
    targetTotalStems: number;
    coveredStems: number;
    coveragePercent: number;
    bridgeWords: Array<{ displayForm: string; stem: string; countInTarget: number }>;
    bridgeWordsTotal: number;
  }>;
  cumulativeLadder: {
    steps: Array<{
      id: string;
      label: string;
      stemsAdded: number;
      cumulativeStems: number;
      coverageOfNext: number | null;
    }>;
    finalVocabulary: number;
  };
  globalDictionary: Record<string, {
    stem: string;
    displayForm: string;
    forms: Record<string, number>;
    totalCount: number;
    pos: string;
    examples: string[];
    sections: Array<{ sourceId: string; indexes: number[] }>;
  }>;
}

export function useComparisonData() {
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);

    try {
      const isHttp = window.location.protocol.startsWith('http');
      if (isHttp) {
        // In local web mode, safely read from disk via api directly to avoid Vite caching
        // First try the new 'cache' folder
        let raw = await apiFsRead('cache/comparison.json');
        if (!raw) {
          // Fallback to old location during migration
          raw = await apiFsRead('web/public/comparison.json');
        }
        
        if (raw) {
          setData(JSON.parse(raw));
          setLoading(false);
          return;
        }
      }
      
      // Fallback
      const suffix = isHttp ? `?t=${Date.now()}` : '';
      const res = await fetch(`cache/comparison.json${suffix}`, { cache: 'no-store', headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } });
      if (!res.ok) throw new Error('Failed to load comparison data');
      
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        throw new Error('Comparison data not found (received HTML format).');
      }
      
      setData(JSON.parse(text));
      setLoading(false);
    } catch (err: any) {
      setError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}
