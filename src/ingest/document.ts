import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

import type { Config, Document, Section } from "../types.js";

function createSections(text: string, title: string): Section[] {
  // Return as a single section natively; cli.ts will split character limits if requested by config
  if (!text || text.trim().length === 0) {
    return [];
  }
  return [
    {
      index: 0,
      title,
      text: text.trim()
    }
  ];
}

export async function parseDocx(config: Config): Promise<Document> {
  const filePath = resolve(config.input.file);
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const buffer = readFileSync(filePath);
  // mammoth extracts only raw text, ignoring images and formatting
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value || '';

  const filename = filePath.split(/[\\/]/).pop() || 'document.docx';

  return {
    source: config.input.file,
    language: config.input.language,
    sections: createSections(rawText, filename)
  };
}

export async function parsePdf(config: Config): Promise<Document> {
  const filePath = resolve(config.input.file);
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const buffer = readFileSync(filePath);
  // pdf-parse extracts only text by default
  const data = await pdfParse(buffer);
  const rawText = data.text || '';

  const filename = filePath.split(/[\\/]/).pop() || 'document.pdf';

  return {
    source: config.input.file,
    language: config.input.language,
    sections: createSections(rawText, filename)
  };
}
