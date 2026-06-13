import { basename } from "node:path";
import type { Document, WordEntry, ExampleEntry } from "../types.js";
import { enhanceGenders } from "./wiktionary-gender.js";
import type { StemFunction } from "./stem.js";
import { tokenize, type TokenizeOptions, type TokenizeResult } from "./tokenize.js";

export interface SectionTokenData {
  sectionIndex: number;
  tokens: string[];
  rawWordCount: number;
  originalForms: Map<string, string>;
  stemmedTokens: Map<string, string[]>;
}

export function buildSectionTokenData(
  doc: Document,
  stem: StemFunction,
  tokenOpts: TokenizeOptions,
): SectionTokenData[] {
  return doc.sections.map((section) => {
    const result: TokenizeResult = tokenize(section.text, tokenOpts);
    const stemmedTokens = new Map<string, string[]>();

    for (const token of result.tokens) {
      const stemKey = stem(token);
      const existing = stemmedTokens.get(stemKey);
      if (existing) {
        existing.push(token);
      } else {
        stemmedTokens.set(stemKey, [token]);
      }
    }

    return {
      sectionIndex: section.index,
      tokens: result.tokens,
      rawWordCount: result.rawWordCount,
      originalForms: result.originalForms,
      stemmedTokens,
    };
  });
}

export async function buildVocabulary(
  doc: Document,
  sectionData: SectionTokenData[],
  lemmaDisplayForms?: Map<string, string>,
): Promise<WordEntry[]> {
  const globalStems = new Map<
    string,
    { forms: Map<string, number>; sections: Set<number> }
  >();

  for (const section of sectionData) {
    for (const [stemKey, tokens] of section.stemmedTokens) {
      let entry = globalStems.get(stemKey);
      if (!entry) {
        entry = { forms: new Map(), sections: new Set() };
        globalStems.set(stemKey, entry);
      }

      entry.sections.add(section.sectionIndex);
      for (const token of tokens) {
        entry.forms.set(token, (entry.forms.get(token) ?? 0) + 1);
      }
    }
  }

  const vocabulary: WordEntry[] = [];

  const allSentences = doc.sections.flatMap(s => 
    s.text.split(/(?<=[.?!])\s+/).map(x => x.trim()).filter(x => x.length > 0)
  );

  for (const [stem, entry] of globalStems) {
    const forms: Record<string, number> = {};
    let totalCount = 0;
    let maxCount = 0;
    let mostFrequentForm = stem;

    for (const [form, count] of entry.forms) {
      forms[form] = count;
      totalCount += count;
      if (count > maxCount) {
        maxCount = count;
        mostFrequentForm = form;
      }
    }

    let displayForm: string;
    if (lemmaDisplayForms?.has(stem)) {
      displayForm = lemmaDisplayForms.get(stem)!;
    } else {
      displayForm = mostFrequentForm;
    }

    // POS Heuristic
    let pos: 'Noun' | 'Verb' | 'Adjective' | 'Other' = 'Other';
    const lang = doc.language.toLowerCase();
    
    if (lang === 'spanish' || lang === 'es') {
      if (stem.endsWith('ar') || stem.endsWith('er') || stem.endsWith('ir')) {
        pos = 'Verb';
      } else if (stem.match(/(mente|ísimo|osa|oso|ico|ica)$/)) {
        pos = 'Adjective';
      } else if (stem.match(/(ción|sión|dad|tad|tud|aje|ero|era)$/)) {
        pos = 'Noun';
      }
    } else if (lang === 'polish' || lang === 'pl') {
      if (stem.endsWith('ć') || stem.endsWith('c')) {
        pos = 'Verb';
      } else if (stem.match(/(ość|nie|cie|ar|er|or)$/)) {
        pos = 'Noun';
      } else if (stem.match(/(owy|owa|owe|ny|na|ne|ski|ska|ske)$/)) {
        pos = 'Adjective';
      }
    } else if (lang === 'russian' || lang === 'ru') {
      if (stem.match(/(ть|ти|ться|тись)$/)) {
        pos = 'Verb';
      } else if (stem.match(/(ий|ый|ая|ое|ые|ие|ой|ая|ее)$/)) {
        pos = 'Adjective';
      } else if (stem.match(/(ость|ство|ние|тие|ик|ка|ия|ие)$/)) {
        pos = 'Noun';
      }
    } else if (lang === 'english' || lang === 'en') {
      if (stem.match(/(ing|ize|ify|en)$/) && stem.length > 4) {
        pos = 'Verb';
      } else if (stem.match(/(able|ible|ous|ive|ful|less|al|ic|ish|y)$/) && stem.length > 3) {
        pos = 'Adjective';
      } else if (stem.match(/(ion|ity|ment|ness|nce|ery|ship|ism)$/)) {
        pos = 'Noun';
      }
    } else {
      // German and fallback
      if (displayForm && displayForm.length > 1 && displayForm[0] === displayForm[0].toUpperCase()) {
        pos = 'Noun';
      } else if (stem.endsWith('en') || stem.endsWith('t') || stem.endsWith('st')) {
        pos = 'Verb';
      } else if (stem.match(/(ig|lich|bar|isch|sam|haft)$/)) {
        pos = 'Adjective';
      }
    }

    // Example Sentences
    const examples: ExampleEntry[] = [];
    const safeForm = mostFrequentForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex
    const searchRegex = new RegExp(`\\b${safeForm}\\b`, 'i');
    
    // Clean source name (remove directory and -analyzed.md suffix if present)
    const sourceName = basename(doc.source)
      .replace(/-analyzed\.md$/i, '')
      .replace(/\.(docx|pdf|md|txt|json)$/i, '');

    for (const sent of allSentences) {
      if (searchRegex.test(sent)) {
        examples.push({ text: sent, source: sourceName });
        if (examples.length >= 200) break; // Increased from 2 to 200 examples per source
      }
    }

    vocabulary.push({
      stem,
      displayForm,
      forms,
      totalCount,
      sections: Array.from(entry.sections).sort((a, b) => a - b),
      pos,
      examples,
    });
  }

  // Inject spaCy morphology results for accurate POS and articles
  const morphology = await enhanceGenders(vocabulary.map(v => v.stem), doc.language);
  for (const v of vocabulary) {
    const morph = morphology[v.stem.toLowerCase()];
    if (morph) {
      if (morph.pos) v.pos = morph.pos;
      if (morph.article) v.article = morph.article;
    }
  }

  return vocabulary.sort((a, b) => b.totalCount - a.totalCount);
}
