import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

async function extractVideoId(url: string): Promise<string> {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (match && match[1]) return match[1];
  throw new Error("Invalid YouTube URL");
}

/**
 * Resolve yt-dlp binary path. Checks common locations.
 */
function findYtDlp(): string {
  // Common install locations
  const candidates = [
    'yt-dlp',  // on PATH
    'yt-dlp.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Python', 'pythoncore-3.14-64', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'pythoncore-3.14-64', 'Scripts', 'yt-dlp.exe'),
  ];

  // Also search any Python Scripts dirs
  const localPython = path.join(process.env.LOCALAPPDATA || '', 'Python');
  if (fs.existsSync(localPython)) {
    try {
      for (const dir of fs.readdirSync(localPython)) {
        const candidate = path.join(localPython, dir, 'Scripts', 'yt-dlp.exe');
        if (fs.existsSync(candidate)) candidates.unshift(candidate);
      }
    } catch {}
  }

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
      // Check if it's on PATH
      execSync(`"${c}" --version`, { stdio: 'pipe', timeout: 5000 });
      return c;
    } catch {}
  }

  throw new Error(
    'yt-dlp not found. Install it with: pip install yt-dlp\n' +
    'Then ensure the Scripts directory is on your PATH.'
  );
}

/**
 * Parse a VTT file into an array of { offset, text } entries.
 */
function parseVtt(vttContent: string): Array<{ offset: number; text: string }> {
  const result: Array<{ offset: number; text: string }> = [];
  const lines = vttContent.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    // Match timestamp lines: 00:00:01.000 --> 00:00:04.000
    const tsMatch = line.match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->/);
    if (tsMatch) {
      const hours = parseInt(tsMatch[1], 10);
      const minutes = parseInt(tsMatch[2], 10);
      const seconds = parseInt(tsMatch[3], 10);
      const ms = parseInt(tsMatch[4], 10);
      const offsetMs = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;

      // Collect all text lines until empty line
      i++;
      const textParts: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        // Strip VTT tags like <c>, </c>, <00:00:01.234>, etc.
        const cleaned = lines[i].trim()
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ');
        if (cleaned) textParts.push(cleaned);
        i++;
      }
      const text = textParts.join(' ').trim();
      if (text) {
        result.push({ offset: offsetMs, text });
      }
    } else {
      i++;
    }
  }

  // Deduplicate: auto-generated subs often repeat the same text
  const deduped: typeof result = [];
  let prevText = '';
  for (const entry of result) {
    if (entry.text !== prevText) {
      deduped.push(entry);
      prevText = entry.text;
    }
  }

  return deduped;
}

async function main() {
  const url = process.argv[2];
  const lang = process.argv[3];
  const outPath = process.argv[4];

  if (!url || !lang || !outPath) {
    console.error("Usage: npx tsx fetch-youtube.ts <url> <lang> <outPath> [chunkMinutes]");
    process.exit(1);
  }

  try {
    const videoId = await extractVideoId(url);
    const ytdlp = findYtDlp();
    console.log(`Using yt-dlp: ${ytdlp}`);

    // Create a temp directory for subtitle output
    const tmpDir = path.join(path.dirname(outPath), '.yt-tmp-' + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpBase = path.join(tmpDir, 'subs');

    let vttFile = '';

    // Strategy 1: Try downloading manual subtitles in the requested language
    try {
      console.log(`Trying manual subtitles for lang=${lang}...`);
      execSync(
        `"${ytdlp}" --js-runtimes node --write-sub --sub-lang "${lang}" --sub-format vtt --skip-download -o "${tmpBase}" "https://www.youtube.com/watch?v=${videoId}"`,
        { stdio: 'pipe', timeout: 30000 }
      );
      // Look for the output file
      const files = fs.readdirSync(tmpDir).filter((f: string) => f.endsWith('.vtt'));
      if (files.length > 0) {
        vttFile = path.join(tmpDir, files[0]);
        console.log(`Found manual subtitle: ${files[0]}`);
      }
    } catch {}

    // Strategy 2: Try auto-generated subtitles in the requested language
    if (!vttFile) {
      try {
        console.log(`Trying auto-generated subtitles for lang=${lang}...`);
        execSync(
          `"${ytdlp}" --js-runtimes node --write-auto-sub --sub-lang "${lang}" --sub-format vtt --skip-download -o "${tmpBase}" "https://www.youtube.com/watch?v=${videoId}"`,
          { stdio: 'pipe', timeout: 30000 }
        );
        const files = fs.readdirSync(tmpDir).filter((f: string) => f.endsWith('.vtt'));
        if (files.length > 0) {
          vttFile = path.join(tmpDir, files[0]);
          console.log(`Found auto-generated subtitle: ${files[0]}`);
        }
      } catch {}
    }

    // Strategy 3: Try any available auto-generated subtitles
    if (!vttFile) {
      try {
        console.log(`Trying any available auto-generated subtitles...`);
        execSync(
          `"${ytdlp}" --js-runtimes node --write-auto-sub --sub-format vtt --skip-download -o "${tmpBase}" "https://www.youtube.com/watch?v=${videoId}"`,
          { stdio: 'pipe', timeout: 30000 }
        );
        const files = fs.readdirSync(tmpDir).filter((f: string) => f.endsWith('.vtt'));
        if (files.length > 0) {
          vttFile = path.join(tmpDir, files[0]);
          console.log(`Found fallback subtitle: ${files[0]}`);
        }
      } catch {}
    }

    if (!vttFile) {
      // Cleanup
      try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
      throw new Error(
        `Could not find or download any subtitles for video: ${videoId}\n` +
        `This video may not have subtitles available, or YouTube may be blocking requests.\n` +
        `Try a different video, or check that yt-dlp is up to date: pip install -U yt-dlp`
      );
    }

    // Parse the VTT file
    const vttContent = fs.readFileSync(vttFile, 'utf-8');
    const transcript = parseVtt(vttContent);

    // Cleanup temp directory
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

    if (transcript.length === 0) {
      throw new Error("Downloaded subtitle file was empty after parsing.");
    }

    console.log(`Parsed ${transcript.length} subtitle entries`);

    // Group into chunks (default 3 minutes = 180,000 ms)
    const chunkMinutes = process.argv[5] ? parseInt(process.argv[5], 10) : 3;
    const CHUNK_DURATION = chunkMinutes * 60 * 1000;
    
    let currentChunk = 1;
    let currentText = `## Часть ${currentChunk}\n\n`;
    let chunkEndTime = CHUNK_DURATION;

    for (const item of transcript) {
      if (item.offset > chunkEndTime) {
        currentChunk++;
        while (item.offset > chunkEndTime) {
           chunkEndTime += CHUNK_DURATION;
        }
        currentText += `\n\n## Часть ${currentChunk}\n\n`;
      }
      
      currentText += item.text + " ";
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, currentText.trim(), 'utf-8');
    
    console.log(`Successfully saved transcript to ${outPath}`);
  } catch (error: any) {
    console.error("Failed to fetch transcript:");
    console.error(error.message);
    process.exit(1);
  }
}

main();
