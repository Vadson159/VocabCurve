import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AnalysisResult } from "./types.js";

interface TextSource {
  id: string;
  label: string;
  file: string;
  hidden?: boolean;
}

interface CoveragePair {
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
  targetTotalStems: number;
  coveredStems: number;
  coveragePercent: number;
  bridgeWords: Array<{
    displayForm: string;
    stem: string;
    countInTarget: number;
  }>;
  bridgeWordsTotal: number;
}

interface TextSummary {
  id: string;
  label: string;
  totalWords: number;
  totalTokens: number;
  totalUniqueStems: number;
  sections: number;
  topWords: Array<{ displayForm: string; count: number }>;
  curve: Array<{ section: number; newStems: number; cumulative: number }>;
}

interface ComparisonResult {
  generatedAt: string;
  texts: TextSummary[];
  coverage: CoveragePair[];
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
  globalDictionary: Record<string, any>;
}

// ── Load registry from user-data.json ──────────────────────
// Find the first argument that looks like a JSON path, otherwise fallback
let userDataPath = resolve("./user-data.json");
if (process.argv.length > 2) {
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].endsWith(".json") && existsSync(resolve(process.argv[i]))) {
      userDataPath = resolve(process.argv[i]);
      break;
    }
  }
}

let SOURCES: TextSource[] = [];

if (existsSync(userDataPath)) {
  try {
    const userData = JSON.parse(readFileSync(userDataPath, "utf-8"));
    const lang = process.argv[process.argv.indexOf("--lang") + 1] || userData.targetLanguage || "english";
    SOURCES = (userData.registries && userData.registries[lang]) ? userData.registries[lang] : (userData.registry || []);
    console.log(`Processing language: ${lang} (${SOURCES.length} sources)`);
  } catch (e) {
    console.error(`Failed to parse user-data.json: ${e}`);
    process.exit(1);
  }
} else {
  // Fallback: try old text-registry.json
  const legacyPath = resolve("./text-registry.json");
  if (existsSync(legacyPath)) {
    SOURCES = JSON.parse(readFileSync(legacyPath, "utf-8"));
  } else {
    console.error(`Neither user-data.json nor text-registry.json found.`);
    process.exit(1);
  }
}

// Allow any number of texts so the UI graph can represent 1 or 0 texts after deletion

// ── Filter only texts whose analysis files actually exist and are not hidden ──
const validSources = SOURCES.filter((s) => {
  if (s.hidden) return false;
  const p = resolve(s.file);
  if (!existsSync(p)) {
    console.warn(`  Skipping "${s.label}" — file not found: ${p}`);
    return false;
  }
  return true;
});

if (validSources.length < 2) {
  console.warn("Less than 2 valid texts found. Proceeding to output empty coverage to sync UI.");
}

function loadAnalysis(file: string): AnalysisResult {
  return JSON.parse(readFileSync(resolve(file), "utf-8")) as AnalysisResult;
}

function getStemSet(analysis: AnalysisResult): Set<string> {
  return new Set(analysis.vocabulary.map((w) => w.stem));
}

function computeCoverage(
  source: AnalysisResult,
  sourceInfo: TextSource,
  target: AnalysisResult,
  targetInfo: TextSource,
): CoveragePair {
  const sourceStems = getStemSet(source);
  const targetStems = getStemSet(target);

  let covered = 0;
  const bridge: CoveragePair["bridgeWords"] = [];

  for (const word of target.vocabulary) {
    if (sourceStems.has(word.stem)) {
      covered++;
    } else {
      bridge.push({
        displayForm: word.displayForm,
        stem: word.stem,
        countInTarget: word.totalCount,
      });
    }
  }

  bridge.sort((a, b) => b.countInTarget - a.countInTarget);

  return {
    sourceId: sourceInfo.id,
    sourceLabel: sourceInfo.label,
    targetId: targetInfo.id,
    targetLabel: targetInfo.label,
    targetTotalStems: targetStems.size,
    coveredStems: covered,
    coveragePercent:
      Math.round((covered / targetStems.size) * 1000) / 10,
    bridgeWords: bridge.slice(0, 100),
    bridgeWordsTotal: bridge.length,
  };
}

const analyses = validSources.map((s) => ({
  source: s,
  data: loadAnalysis(s.file),
}));

const texts: TextSummary[] = analyses.map(({ source, data }) => ({
  id: source.id,
  label: source.label,
  totalWords: data.meta.totalWords ?? data.meta.totalTokens,
  totalTokens: data.meta.totalTokens,
  totalUniqueStems: data.meta.totalUniqueStems,
  sections: data.meta.totalSections,
  topWords: data.vocabulary.slice(0, 30).map((w) => ({
    displayForm: w.displayForm,
    count: w.totalCount,
  })),
  curve: data.sections.map((s) => ({
    section: s.index,
    newStems: s.newStems,
    cumulative: s.cumulativeUniqueStems,
  })),
}));

// ── Coverage matrix (N×N) ──
const coverage: CoveragePair[] = [];
for (let i = 0; i < analyses.length; i++) {
  for (let j = 0; j < analyses.length; j++) {
    if (i === j) continue;
    coverage.push(
      computeCoverage(
        analyses[i].data,
        analyses[i].source,
        analyses[j].data,
        analyses[j].source,
      ),
    );
  }
}

// ── Cumulative ladder (in registry order) ──
const cumulativeStems = new Set<string>();
const ladderSteps = analyses.map(({ source, data }, idx) => {
  const stemsBefore = cumulativeStems.size;
  for (const w of data.vocabulary) {
    cumulativeStems.add(w.stem);
  }
  const stemsAdded = cumulativeStems.size - stemsBefore;

  let coverageOfNext: number | null = null;
  if (idx < analyses.length - 1) {
    const nextStems = getStemSet(analyses[idx + 1].data);
    let covered = 0;
    for (const stem of nextStems) {
      if (cumulativeStems.has(stem)) covered++;
    }
    coverageOfNext = Math.round((covered / nextStems.size) * 1000) / 10;
  }

  return {
    id: source.id,
    label: source.label,
    stemsAdded,
    cumulativeStems: cumulativeStems.size,
    coverageOfNext,
  };
});

// ── Global Dictionary (Merged Context) ──
const globalDictionary: Record<string, any> = {};

for (const { data, source } of analyses) {
  for (const w of data.vocabulary) {
    if (!globalDictionary[w.stem]) {
      globalDictionary[w.stem] = {
        stem: w.stem,
        displayForm: w.displayForm,
        forms: { ...w.forms },
        totalCount: w.totalCount,
        pos: w.pos,
        examples: [...(w.examples || [])],
        sections: [{ sourceId: source.id, indexes: [...w.sections] }]
      };
    } else {
      const g = globalDictionary[w.stem];
      g.totalCount += w.totalCount;
      // Merge forms
      for (const [f, c] of Object.entries(w.forms)) {
        g.forms[f] = (g.forms[f] || 0) + (c as number);
      }
      if (w.examples && w.examples.length > 0) {
        g.examples.push(...w.examples);
        if (g.examples.length > 500) g.examples = g.examples.slice(0, 500);
      }
      // Track sections per source
      g.sections.push({ sourceId: source.id, indexes: [...w.sections] });
    }
  }
}

const result: ComparisonResult = {
  generatedAt: new Date().toISOString(),
  texts,
  coverage,
  cumulativeLadder: {
    steps: ladderSteps,
    finalVocabulary: cumulativeStems.size,
  },
  globalDictionary,
};

const outputPath = resolve("./cache/comparison.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

console.log(`\n✓ Comparison complete (${validSources.length} texts)`);
for (const t of texts) {
  console.log(`  ${t.label}: ${t.totalTokens.toLocaleString()} tokens, ${t.totalUniqueStems.toLocaleString()} unique stems`);
}
console.log(`\nOutput: ${outputPath}`);
