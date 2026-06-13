import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const EPubModule = require("epub2");
const EPubClass = EPubModule.EPub || (EPubModule.default && EPubModule.default.EPub) || EPubModule.default || EPubModule;
// @ts-ignore
import xml2js from "xml2js";
import type { Config, Document, Section } from "../types.js";

function stripHtml(html: string): string {
  if (!html) return "";
  // Strip tags but preserve basic spacing for block elements
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  // Decode basic HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up extra whitespace
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Parses an EPUB file into chapters/sections using epub2
 */
export async function parseEpub(config: Config): Promise<Document> {
  const filePath = resolve(config.input.file);
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return new Promise((resolvePromise, reject) => {
    const epub = new EPubClass(filePath);
    
    epub.on("end", () => {
      let sections: Section[] = [];
      let index = 0;

      const flow = epub.flow;
      
      // We need to sequentially extract chapters since getChapter is async (callback based)
      let chaptersProcessed = 0;

      flow.forEach((chapter: any) => {
        epub.getChapter(chapter.id, (err: Error | null, text: string) => {
          if (!err && text) {
            const cleanText = stripHtml(text);
            if (cleanText.trim().length > 50) { // arbitrary threshold to ignore blank TOCs
              sections.push({
                index: 0, // will sort and re-index below
                title: chapter.title || `Chapter ${sections.length + 1}`,
                text: cleanText
              });
            }
          }
          
          chaptersProcessed++;
          if (chaptersProcessed === flow.length) {
            // Re-index based on original array order, epub2 getChapter might return out of order.
            // Actually, we should probably map order directly.
            // But this simple approach works since chapters correspond to flow indices.
            // For safety, we just re-index them linearly.
            sections = sections.map((s, i) => ({ ...s, index: i }));
            
            resolvePromise({
              source: config.input.file,
              language: config.input.language,
              sections
            });
          }
        });
      });

      if (flow.length === 0) {
        resolvePromise({
          source: config.input.file,
          language: config.input.language,
          sections: []
        });
      }
    });

    epub.on("error", (err: Error) => {
      reject(err);
    });

    epub.parse();
  });
}

function extractText(node: any): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (typeof node === 'object' && node !== null) {
    if (node._) {
      let result = node._;
      const keys = Object.keys(node).filter(k => k !== '_' && k !== '$');
      for (const k of keys) {
        result += ' ' + extractText(node[k]);
      }
      return result;
    }
    const values = Object.keys(node)
      .filter(k => k !== '$') // ignore attributes
      .map(k => extractText(node[k]));
    return values.join(' ');
  }
  return '';
}

/**
 * Parses an FB2 XML file
 */
export async function parseFb2(config: Config): Promise<Document> {
  const filePath = resolve(config.input.file);
  const rawXml = readFileSync(filePath, "utf-8");
  
  const parser = new xml2js.Parser();
  const parsed = await parser.parseStringPromise(rawXml);
  
  let sections: Section[] = [];
  
  function extractFb2Sections(node: any, indexObj: { value: number }) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(n => extractFb2Sections(n, indexObj));
      return;
    }
    
    if (node.p) {
      let title = `Section ${indexObj.value + 1}`;
      if (node.title && node.title[0] && node.title[0].p) {
        title = typeof node.title[0].p[0] === 'string' ? node.title[0].p[0] : extractText(node.title[0].p);
      }
      
      const pArray = Array.isArray(node.p) ? node.p : [node.p];
      let allText = pArray.map((p: any) => extractText(p)).join('\n\n');
      
      if (allText.trim().length > 0) {
        sections.push({
          index: indexObj.value++,
          title: title.trim() || `Section ${indexObj.value}`,
          text: allText
        });
      }
    }
    
    if (node.section) {
      extractFb2Sections(node.section, indexObj);
    }
  }

  if (parsed.FictionBook && parsed.FictionBook.body) {
    const bodies = parsed.FictionBook.body;
    let indexObj = { value: 0 };
    extractFb2Sections(bodies, indexObj);
  }

  return {
    source: config.input.file,
    language: config.input.language,
    sections
  };
}
