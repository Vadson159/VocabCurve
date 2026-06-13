import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { parseMarkdown } from "./ingest/markdown.js";
import { parseEpub, parseFb2 } from "./ingest/ebook.js";
import { parseDocx, parsePdf } from "./ingest/document.js";
import { createStemmer, createBatchStemmer } from "./analyze/stem.js";
import {
  buildSectionTokenData,
  buildVocabulary,
} from "./analyze/frequency.js";
import {
  buildProgression,
  buildFrequencyDistribution,
} from "./analyze/progression.js";
import { tokenize } from "./analyze/tokenize.js";
import type { AnalysisResult } from "./types.js";

const configPath = process.argv[2] ?? "config.yaml";

console.log(`Loading config from ${configPath}...`);
const config = loadConfig(configPath);
console.log(`  Input: ${config.input.file}`);
console.log(`  Language: ${config.input.language}`);
console.log(`  Stemmer: ${config.analysis.stemmer}`);

console.log("\nParsing document...");
let doc;
const ext = config.input.file.toLowerCase();
if (ext.endsWith('.epub')) {
  doc = await parseEpub(config);
} else if (ext.endsWith('.fb2')) {
  doc = await parseFb2(config);
} else if (ext.endsWith('.docx')) {
  doc = await parseDocx(config);
} else if (ext.endsWith('.pdf')) {
  doc = await parsePdf(config);
} else {
  doc = parseMarkdown(config);
}

if ((config.structure.splitChars && config.structure.splitChars > 0) || (doc.sections.length === 1 && doc.sections[0].text.length > 5000)) {
  const size = (config.structure.splitChars && config.structure.splitChars > 0) 
    ? config.structure.splitChars 
    : 10000;
  
  if (!config.structure.splitChars || config.structure.splitChars === 0) {
    console.log(`  Auto-splitting large document into sections (default ${size} chars)...`);
  } else {
    console.log(`  Applying manual content splitting (${size} chars/section)...`);
  }
  
  const allText = doc.sections.map((s: any) => s.text).join('\n\n');
  
  const newSections = [];
  let currentStart = 0;
  let index = 0;
  while (currentStart < allText.length) {
    let rawEnd = currentStart + size;
    let end = rawEnd;
    if (rawEnd < allText.length) {
      const chunk = allText.slice(currentStart, rawEnd);
      const lastDoubleNewline = chunk.lastIndexOf('\n\n');
      const lastNewline = chunk.lastIndexOf('\n');
      const lastSpace = chunk.lastIndexOf(' ');
      
      if (lastDoubleNewline > size / 2) end = currentStart + lastDoubleNewline;
      else if (lastNewline > size / 2) end = currentStart + lastNewline;
      else if (lastSpace > 0) end = currentStart + lastSpace;
    }
    
    const textChunk = allText.slice(currentStart, end);
    if (textChunk.trim().length > 0) {
      newSections.push({ index: index, title: `Часть ${index + 1}`, text: textChunk.trim() });
      index++;
    }
    currentStart = end;
    while (currentStart < allText.length && allText[currentStart].trim() === '') {
      currentStart++;
    }
  }
  doc.sections = newSections;
}
console.log(`  Found ${doc.sections.length} sections`);

console.log("\nAnalyzing...");

const tokenOpts = {
  minWordLength: config.analysis.minWordLength ?? 2,
  filterStopWords: config.analysis.stopWords ?? false,
  language: config.input.language,
};

let stem;
let lemmaDisplayForms: Map<string, string> | undefined;
if (config.analysis.stemmer === "simplemma") {
  const allUniqueTokens = new Set<string>();
  const allOriginalForms = new Map<string, string>();
  for (const section of doc.sections) {
    const result = tokenize(section.text, tokenOpts);
    for (const token of result.tokens) {
      allUniqueTokens.add(token);
    }
    for (const [lower, original] of result.originalForms) {
      if (!allOriginalForms.has(lower)) {
        allOriginalForms.set(lower, original);
      }
    }
  }
  const batchResult = createBatchStemmer(Array.from(allUniqueTokens), allOriginalForms, config.input.language);
  stem = batchResult.stem;
  lemmaDisplayForms = batchResult.lemmaDisplayForms;
} else {
  stem = createStemmer(config.analysis.stemmer);
}

const sectionData = buildSectionTokenData(doc, stem, tokenOpts);

const vocabulary = await buildVocabulary(doc, sectionData, lemmaDisplayForms);
const progression = buildProgression(doc, sectionData);

const totalWords = sectionData.reduce(
  (sum, s) => sum + s.rawWordCount,
  0,
);
const totalTokens = sectionData.reduce(
  (sum, s) => sum + s.tokens.length,
  0,
);
const totalUniqueStems = vocabulary.length;

const frequencyDistribution = buildFrequencyDistribution(
  totalUniqueStems,
  vocabulary,
);

const result: AnalysisResult = {
  meta: {
    source: config.input.file,
    language: config.input.language,
    analyzedAt: new Date().toISOString(),
    totalSections: doc.sections.length,
    totalWords,
    totalTokens,
    totalUniqueStems,
    stemmer: config.analysis.stemmer,
  },
  sections: progression,
  vocabulary,
  frequencyDistribution,
};

const outputPath = resolve(config.output.path);
const outputMdPath = outputPath.replace(/\.json$/, ".md");
mkdirSync(dirname(outputPath), { recursive: true });

// Set metadata source to the purified markdown file so the Reader can always open it
result.meta.source = outputMdPath.replace(/\\/g, "/");
if (result.meta.source.includes("/web/")) {
  result.meta.source = result.meta.source.split("/web/").pop()!;
}

const allText = doc.sections.map((s: any) => s.text).join("\n\n");
writeFileSync(outputMdPath, allText, "utf-8");
writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

console.log(`\n✓ Analysis complete`);
console.log(`  Sections: ${result.meta.totalSections}`);
console.log(`  Total words (raw): ${result.meta.totalWords}`);
console.log(`  Total tokens (filtered): ${result.meta.totalTokens}`);
console.log(`  Unique stems: ${result.meta.totalUniqueStems}`);
console.log(`  Output: ${outputPath}`);

console.log("\nFrequency distribution:");
for (const bucket of frequencyDistribution) {
  console.log(
    `  Words appearing ${bucket.minOccurrences}+ times: ${bucket.stemCount} (${bucket.percentage}%)`,
  );
}

console.log(`\nTop 20 words:`);
for (const word of vocabulary.slice(0, 20)) {
  const formsList = Object.entries(word.forms)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([form, count]) => `${form}(${count})`)
    .join(", ");
  console.log(
    `  ${word.displayForm.padEnd(20)} ${String(word.totalCount).padStart(4)}×  [${formsList}]`,
  );
}
