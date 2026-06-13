import fs from 'fs';
import path from 'path';

export interface MorphInfo {
  article?: string;
  pos?: 'Noun' | 'Verb' | 'Adjective' | 'Other';
}

export async function enhanceGenders(nouns: string[], lang: string): Promise<Record<string, MorphInfo>> {
  if (lang !== 'de' && lang !== 'es' && lang !== 'pl' && lang !== 'ru' && lang !== 'en') return {};

  const cacheFile = path.resolve('cache', `morphology-${lang}.json`);
  let localCache: Record<string, MorphInfo> = {};

  if (fs.existsSync(cacheFile)) {
    try {
      localCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch(e) {}
  }

  const missingWords = nouns.filter(n => !localCache[n.toLowerCase()]);
  if (missingWords.length > 0) {
    try {
      const res = await fetch('http://localhost:8000/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: missingWords, lang })
      });
      const json = await res.json();
      if (json.status === 'success') {
        const data = json.data;
        for (const word of Object.keys(data)) {
          const entry = data[word];
          const info: MorphInfo = {};
          
          // Map spaCy POS to our internal POS categories
          if (entry.pos === 'VERB' || entry.pos === 'AUX') info.pos = 'Verb';
          else if (entry.pos === 'NOUN' || entry.pos === 'PROPN') info.pos = 'Noun';
          else if (entry.pos === 'ADJ') info.pos = 'Adjective';
          else info.pos = 'Other';

          // Map spaCy gender to articles
          const gender = entry.gender;
          if (lang === 'de' && (entry.pos === 'NOUN' || entry.pos === 'PROPN')) {
            if (gender === 'Masc') info.article = 'der';
            else if (gender === 'Fem') info.article = 'die';
            else if (gender === 'Neut') info.article = 'das';
          } else if (lang === 'es' && (entry.pos === 'NOUN' || entry.pos === 'PROPN')) {
            if (gender === 'Masc') info.article = 'el';
            else if (gender === 'Fem') info.article = 'la';
          }

          localCache[word] = info;
        }
        
        if (!fs.existsSync(path.resolve('cache'))) {
          fs.mkdirSync(path.resolve('cache'), { recursive: true });
        }
        fs.writeFileSync(cacheFile, JSON.stringify(localCache, null, 2));
      }
    } catch (e) {
      console.warn('Backend lookup failed. Ensure local AI is running.');
    }
  }

  return localCache;
}

function extractGender(page: any, wordKey: string, lang: string, cache: Record<string, string>) {
  try {
    const content = page?.revisions?.[0]?.slots?.main?.['*'];
    if (!content) return;

    if (lang === 'de') {
      if (content.includes('{{m}}')) cache[wordKey] = 'der';
      else if (content.includes('{{f}}')) cache[wordKey] = 'die';
      else if (content.includes('{{n}}')) cache[wordKey] = 'das';
      else cache[wordKey] = ''; 
    } else if (lang === 'es') {
      if (content.includes('{{m}}')) cache[wordKey] = 'el';
      else if (content.includes('{{f}}')) cache[wordKey] = 'la';
      else cache[wordKey] = '';
    }
  } catch(e) {}
}
