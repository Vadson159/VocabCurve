import { useMemo } from 'react';
import type { AnalysisResult } from './useAnalysisData';

export interface CefrResult {
  level: string;
  score: number;
  distribution: Record<string, number>;
  color: string;
}

export const LEVELS = [
  { level: 'A1', color: '#22c55e' },
  { level: 'A2', color: '#84cc16' },
  { level: 'B1', color: '#eab308' },
  { level: 'B2', color: '#f97316' },
  { level: 'C1', color: '#ef4444' },
  { level: 'C2', color: '#dc2626' },
];

function getColor(level: string): string {
  return LEVELS.find(l => l.level === level)?.color || '#dc2626';
}

/**
 * Estimates CEFR level using three linguistically-validated metrics:
 *
 * 1. Guiraud Index (lexical richness) = uniqueStems / sqrt(totalTokens)
 *    Higher = more diverse vocabulary = harder text.
 *
 * 2. Hapax Ratio = words appearing only once / total unique words
 *    Higher = more rare/specialized vocabulary = harder text.
 *
 * 3. Vocabulary Density = uniqueStems / totalTokens * 1000
 *    Higher = less repetition = harder text.
 *
 * These three metrics are combined into a weighted composite score.
 */
export function useCefrEstimate(data: AnalysisResult | null): CefrResult | null {
  return useMemo(() => {
    if (!data) return null;

    const totalTokens = data.meta.totalTokens;
    const uniqueStems = data.meta.totalUniqueStems;
    const vocab = data.vocabulary;

    if (totalTokens === 0 || uniqueStems === 0) return null;

    // 1. Guiraud Index
    const guiraud = uniqueStems / Math.sqrt(totalTokens);

    // 2. Hapax ratio (words appearing exactly once)
    const hapaxCount = vocab.filter(w => w.totalCount === 1).length;
    const hapaxRatio = hapaxCount / uniqueStems;

    // 3. Vocabulary density (unique per 1000 tokens)
    const density = (uniqueStems / totalTokens) * 1000;

    // 4. Average word length from display forms
    const totalLen = vocab.reduce((s, w) => s + w.displayForm.length * w.totalCount, 0);
    const avgWordLen = totalLen / totalTokens;

    // Language-specific word length normalization
    const lang = data.meta.language;
    let lengthWeight = 0;
    if (lang === 'es') lengthWeight = 1.3; // Spanish words are shorter
    if (lang === 'pl') lengthWeight = 0.5; // Polish words are slightly shorter than German
    if (lang === 'en') lengthWeight = 1.5; // English words are very short

    // Composite score (1–6 scale)
    // Calibrated against known German texts:
    // B1 exam topics (~8k tokens, ~1600 stems, stop words filtered): Guiraud ~17.8, density ~200, hapax ~0.55 -> composite ~0.43 -> score ~3.1 (B1)
    
    // Adjust max thresholds to give a more realistic 0-1 spread
    // Guiraud goes up to 45 for very difficult texts
    const guiraudNorm = Math.min(guiraud / 45, 1);
    // Hapax ratio is usually 0.4 to 0.6. Normalize so 0.6 is 1.0.
    const hapaxNorm = Math.min(hapaxRatio / 0.65, 1);
    // Density (stems per 1000 tokens): short texts have high density (200-300), long texts have low density (50-150).
    // Because short texts shouldn't be penalized as "difficult", density needs to scale logarithmically with length or be weighted less.
    const densityNorm = Math.min(density / 400, 1);
    const wordLenNorm = Math.min((avgWordLen + lengthWeight - 2.5) / 6, 1);

    // Weighted combination → score 0-1
    const composite = 
      guiraudNorm * 0.45 +  // lexical richness is key
      hapaxNorm   * 0.35 +  // rare words
      densityNorm * 0.10 +  // density has less weight to not over-penalize short texts
      wordLenNorm * 0.10;   // word complexity

    // Map composite (0-1) to CEFR score (1-6)
    // Shift the score to be more lenient. A composite of 0.45 should be ~B1 (score=3).
    // For 0.45 * 5.5 = 2.47 + 0.5 = ~3.0 (B1)
    const score = 0.5 + composite * 5.5;

    // Map to level
    let level = 'B1';
    if (score < 1.5) level = 'A1';
    else if (score < 2.5) level = 'A2';
    else if (score < 3.5) level = 'B1';
    else if (score < 4.5) level = 'B2';
    else if (score < 5.5) level = 'C1';
    else level = 'C2';

    // Build distribution by counting vocab items bucketed by their frequency rank
    // Use absolute thresholds based on word frequency in the text
    const distribution: Record<string, number> = {
      'A1': 0, 'A2': 0, 'B1': 0, 'B2': 0, 'C1': 0, 'C2': 0,
    };
    
    let totalAssigned = 0;
    for (const w of vocab) {
      // Weight the distribution by total token count, so A1 words properly reflect their huge presence in the text.
      // E.g., a word that appears 50 times takes up 50 tokens of A1 level.
      const val = w.totalCount;
      if (w.totalCount >= 20) distribution['A1'] += val;
      else if (w.totalCount >= 10) distribution['A2'] += val;
      else if (w.totalCount >= 5) distribution['B1'] += val;
      else if (w.totalCount >= 3) distribution['B2'] += val;
      else if (w.totalCount >= 2) distribution['C1'] += val;
      else distribution['C2'] += val;
      
      totalAssigned += val;
    }
    // Convert to percentages based on total text tokens instead of unique stems.
    for (const k of Object.keys(distribution)) {
      distribution[k] = totalAssigned > 0 ? Math.round((distribution[k] / totalAssigned) * 100) : 0;
    }

    return {
      level,
      score: Math.round(score * 10) / 10,
      distribution,
      color: getColor(level),
    };
  }, [data]);
}
