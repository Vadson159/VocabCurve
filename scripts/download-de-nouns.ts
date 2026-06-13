import fs from 'fs';
import path from 'path';

async function downloadDeNouns() {
  const publicDir = path.join(process.cwd(), 'web', 'public');
  const targetPath = path.join(publicDir, 'de-nouns.json');

  if (fs.existsSync(targetPath)) {
    console.log('German nouns database already exists. Skipping download.');
    return;
  }

  console.log('Downloading offline German noun database from GitHub...');
  try {
    const res = await fetch('https://raw.githubusercontent.com/Andrew-2609/german-nouns-handler/master/output/formatted-nouns.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    // The format is: [{ noun: "A", gender: "neuter", article: "das" }, ...]
    const data = await res.json();
    
    const nounMap: Record<string, string> = {};
    for (const item of data) {
      if (item.noun && item.article) {
        nounMap[item.noun.toLowerCase()] = item.article;
      }
    }

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, JSON.stringify(nounMap));
    console.log(`Successfully created local dictionary with ${Object.keys(nounMap).length} nouns at ${targetPath}`);
  } catch (error) {
    console.error('Failed to download German nouns database:', error);
  }
}

downloadDeNouns();
