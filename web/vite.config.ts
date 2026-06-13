import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'

function nodeApiPlugin() {
  const logFile = path.resolve(process.cwd(), '..', 'cache', 'terminal_log.txt');
  
  const logToDisk = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    const line = `[${time}] ${msg}\n`;
    process.stdout.write(line);
    try {
      fs.appendFileSync(logFile, line, 'utf8');
    } catch (e) { }
  };

  return {
    name: 'node-api',
    configureServer(server: any) {
      logToDisk(`SERVER STARTUP - cwd: ${process.cwd()}`);
      logToDisk(`PROJECT ROOT CACHE: ${path.resolve(process.cwd(), '..', 'cache')}`);

      // 1. Ultra-robust middleware for cache and diagnostic logging
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url.split('?')[0];
        const filename = decodeURIComponent(url.split('/').pop() || '');
        
        // Log all requests to disk for debugging
        logToDisk(`REQ: ${req.method} ${req.url}`);

        // If it's a data file, check the cache folder first (even if /cache/ prefix is missing)
        const isDataFile = filename.endsWith('.json') || filename.endsWith('.md');
        if (isDataFile) {
          const targetPath = path.resolve(process.cwd(), '..', 'cache', filename);
          if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isFile()) {
            logToDisk(`HIT: Serving ${filename} from cache via fallback`);
            res.setHeader('Content-Type', filename.endsWith('.json') ? 'application/json' : 'text/markdown');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return res.end(fs.readFileSync(targetPath));
          }
        }
        
        next();
      });

      // 2. API middleware
      server.middlewares.use('/api', (req: any, res: any, next: any) => {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            const data = body ? JSON.parse(body) : {};
            res.setHeader('Content-Type', 'application/json');
            
            const url = req.url.split('?')[0];
            console.log(`[API] ${req.method} ${url}`);

            const resolvePath = (p: string) => path.isAbsolute(p) ? p : path.resolve(process.cwd(), '..', p);

            if (url.includes('/fs/read')) {
              const targetPath = resolvePath(data.path);
              if (!fs.existsSync(targetPath)) {
                return res.end(JSON.stringify({ error: 'File not found', content: null }));
              }
              const content = fs.readFileSync(targetPath, 'utf-8');
              return res.end(JSON.stringify({ content }));
            }
            
            if (url.includes('/fs/write')) {
              const targetPath = resolvePath(data.path);
              fs.mkdirSync(path.dirname(targetPath), { recursive: true });
              fs.writeFileSync(targetPath, data.content, 'utf-8');
              return res.end(JSON.stringify({ success: true }));
            }

            if (url.includes('/fs/exists')) {
              const targetPath = resolvePath(data.path);
              return res.end(JSON.stringify({ exists: fs.existsSync(targetPath) }));
            }

            if (url.includes('/fs/delete')) {
              const targetPath = resolvePath(data.path);
              if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
              return res.end(JSON.stringify({ success: true }));
            }

            if (url.includes('/fs/copy')) {
              const srcPath = resolvePath(data.src);
              const dstPath = resolvePath(data.dst);
              if (fs.existsSync(srcPath)) {
                fs.mkdirSync(path.dirname(dstPath), { recursive: true });
                fs.copyFileSync(srcPath, dstPath);
              }
              return res.end(JSON.stringify({ success: true }));
            }

            if (url.includes('/fs/readdir')) {
              const targetPath = resolvePath(data.path);
              if (!fs.existsSync(targetPath)) return res.end(JSON.stringify({ files: [] }));
              const files = fs.readdirSync(targetPath);
              return res.end(JSON.stringify({ files }));
            }

            if (url.includes('/upload')) {
              try {
                // Handle binary file upload from browser to local server (into cache/uploads)
                const filename = data.filename || 'uploaded-file';
                const uploadDir = path.resolve(process.cwd(), '..', 'cache', 'uploads');
                if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                
                const targetPath = path.join(uploadDir, filename);
                const base64Data = data.content.split(';base64,').pop();
                fs.writeFileSync(targetPath, base64Data, { encoding: 'base64' });
                
                return res.end(JSON.stringify({ success: true, path: `cache/uploads/${filename}` }));
              } catch(e: any) {
                console.error(`[API] Upload error: ${e.message}`);
                return res.end(JSON.stringify({ success: false, error: e.message }));
              }
            }

            if (url.includes('/dialog')) {
              try {
                const tempPs1 = path.resolve(process.cwd(), '..', 'cache', 'temp-dialog.ps1');
                const psCmd = 'Add-Type -AssemblyName PresentationFramework; $d = New-Object Microsoft.Win32.OpenFileDialog; $d.Multiselect = $true; if($d.ShowDialog()) { $d.FileNames -join "|" }';
                fs.writeFileSync(tempPs1, psCmd, 'utf-8');
                
                exec(`powershell -STA -NoProfile -ExecutionPolicy Bypass -File "${tempPs1}"`, (error, stdout, stderr) => {
                  if (error || stderr) {
                    console.error(`[API] PowerShell Error: ${error?.message || stderr}`);
                  }
                  try { if (fs.existsSync(tempPs1)) fs.unlinkSync(tempPs1); } catch(e) {}
                  const paths = (stdout || '').trim().split('|').filter(Boolean);
                  console.log(`[API] Dialog result: ${paths.length} files`);
                  res.end(JSON.stringify({ paths }));
                });
                return;
              } catch(e: any) {
                console.error(`[API] Dialog catch: ${e.message}`);
                return res.end(JSON.stringify({ paths: [] }));
              }
            }

            if (url.includes('/exec')) {
              const rootDir = path.resolve(process.cwd(), '..');
              const binPath = path.resolve(rootDir, 'node_modules', '.bin');
              const envPath = `${binPath}${path.delimiter}${process.env.PATH || ''}`;
              
              exec(data.cmd, { cwd: rootDir, env: { ...process.env, PATH: envPath } }, (error: any, stdout: any, stderr: any) => {
                res.end(JSON.stringify({ 
                  error: error ? error.message : null, 
                  stdout, 
                  stderr 
                }));
              });
              return;
            }
            
            next();
          } catch (err: any) {
            console.error(`[API] Parse error: ${err.message}`);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), nodeApiPlugin()],
})
