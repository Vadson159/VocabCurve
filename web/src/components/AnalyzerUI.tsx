import { useState, useEffect, useRef } from 'react';
import { Loader2, UploadCloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { type Language } from '../i18n/translations';

import { apiExec, apiFsExists, apiFsDelete, apiFsCopy, apiFsRead, apiFsWrite } from '../apiClient';

interface AnalyzerUIProps {
  currentUiLanguage: Language;
  defaultTextLanguage?: string;
  onAnalysisSuccess: (generatedFilename: string) => void;
}

export function AnalyzerUI({ currentUiLanguage, defaultTextLanguage, onAnalysisSuccess }: AnalyzerUIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputType, setInputType] = useState<'file' | 'youtube'>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const targetLanguageToShort: Record<string, string> = {
    german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' 
  };
  
  const [textLanguage, setTextLanguage] = useState(targetLanguageToShort[defaultTextLanguage || 'german'] || 'de');
  
  useEffect(() => {
    setTextLanguage(targetLanguageToShort[defaultTextLanguage || 'german'] || 'de');
  }, [defaultTextLanguage]);

  const [splitPages, setSplitPages] = useState(false);
  const [splitChars, setSplitChars] = useState(1500);
  const [splitDurationMinutes, setSplitDurationMinutes] = useState('3');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setStatus('loading');
    setErrorMessage('');
    const newPaths: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();

        const content = await new Promise<string>((resolve) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });

        // Use our new upload API
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: JSON.stringify({ filename: file.name, content })
        });
        const data = await res.json();
        if (data.success) {
          newPaths.push(data.path);
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      }

      setFilePaths((prev) => [...prev, ...newPaths]);
      setStatus('idle');
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading file');
      setStatus('error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunAnalysis = async () => {
    if ((inputType === 'file' && filePaths.length === 0) || (inputType === 'youtube' && !youtubeUrl)) {
      setErrorMessage(currentUiLanguage === 'ru' ? 'Заполните все поля или перезапустите приложение.' : 'Fill in all fields or restart app.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {

      let addedFiles: string[] = [];
      let finalFilename = '';
      
      const pathsToProcess = inputType === 'file' ? filePaths : [youtubeUrl];

      for (let rawPath of pathsToProcess) {
        if (Array.isArray(rawPath)) rawPath = rawPath.flat(Infinity)[0];
        const targetPath = String(rawPath || '').trim();
        if (!targetPath) continue;

        const tempConfigPath = `temp-config-${Date.now()}-${Math.floor(Math.random() * 1000)}.yaml`;
        
        let targetFile = String(targetPath);
        let filenameBase = 'text';
        let cmd = '';

        if (inputType === 'youtube') {
          const videoIdMatch = String(targetPath).match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
          filenameBase = videoIdMatch ? `youtube-${videoIdMatch[1]}` : `youtube-${Date.now()}`;
          const outputMd = `cache/${filenameBase}.md`;
          targetFile = outputMd;
          cmd = `npx tsx src/fetch-youtube.ts "${targetPath}" ${textLanguage} "${outputMd}" ${splitDurationMinutes} && npx tsx src/cli.ts "${tempConfigPath}"`;
        } else {
          // Manual basic implementation of path basename + extname
          const lastSlash = Math.max(targetFile.lastIndexOf('/'), targetFile.lastIndexOf('\\'));
          const fileOnly = targetFile.substring(lastSlash + 1);
          const lastDot = fileOnly.lastIndexOf('.');
          const baseName = lastDot > 0 ? fileOnly.substring(0, lastDot) : fileOnly;
          
          filenameBase = baseName.replace(/[^\p{L}\p{N}-]/gu, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '').toLowerCase();
          if (splitPages) filenameBase = `${filenameBase}-pages`;
          cmd = `npx tsx src/cli.ts "${tempConfigPath}"`;
        }

        const outputFilename = `${filenameBase}-analyzed.json`;
        finalFilename = outputFilename;
        const outputPath = `cache/${outputFilename}`;

        const configYaml = `
input:
  file: "${String(targetFile).replace(/\\/g, '/')}"
  language: ${textLanguage}

structure:
  split_pattern: "^#{1,3} "
  title_pattern: "^#{1,3} (.+)"
  ${splitPages ? `split_chars: ${splitChars}` : ''}

analysis:
  stemmer: simplemma
  min_word_length: 2
  stop_words: true

output:
  path: "${String(outputPath).replace(/\\/g, '/')}"
`;
        await apiFsWrite(tempConfigPath, configYaml);

        try {
          const { error, stderr } = await apiExec(cmd);
          if (error) {
            throw new Error(stderr || error);
          }
          await apiFsDelete(tempConfigPath);
          
          const distPath = `web/dist/${outputFilename}`;
          const outputPathMd = outputPath.replace(/\.json$/, '.md');
          const distPathMd = distPath.replace(/\.json$/, '.md');

          if (await apiFsExists(outputPath)) {
            await apiFsCopy(outputPath, distPath);
          }
          if (await apiFsExists(outputPathMd)) {
            await apiFsCopy(outputPathMd, distPathMd);
          }
          
          addedFiles.push(filenameBase);
        } catch (err: any) {
          await apiFsDelete(tempConfigPath);
          throw err;
        }
      }

      // ── Append to user-data.json ──
      const userDataPath = 'user-data.json';
      let userData: any = { knownWords: [], ignoredWords: [], trackedWords: [], registry: [], registries: {} };
      const exists = await apiFsExists(userDataPath);
      if (exists) {
        try {
          const raw = await apiFsRead(userDataPath);
          if (raw) {
            const parsed = JSON.parse(raw);
            userData = { ...userData, ...parsed, trackedWords: parsed.trackedWords || [], registries: parsed.registries || {} };
          }
        } catch (e) { }
      }

      const langMap: Record<string, string> = { de: 'german', es: 'spanish', ru: 'russian', pl: 'polish', en: 'english' };
      const targetLangKey = langMap[textLanguage] || 'german';
      
      if (!userData.registries[targetLangKey]) {
        userData.registries[targetLangKey] = [];
      }

      for (const reqBase of addedFiles) {
        // Match against specific language registry
        const langReg = userData.registries[targetLangKey];
        if (!langReg.find((r: any) => r.id === reqBase)) {
          let label = reqBase
            .replace(/-analyzed$/i, '')
            .replace(/[-_]/g, ' ')
            .replace(/(^|\s)\S/g, (c: string) => c.toUpperCase());
            
          // If it's a youtube video, try to fetch the actual title
          if (inputType === 'youtube' && reqBase.startsWith('youtube-')) {
            try {
              const videoId = reqBase.replace('youtube-', '');
              const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
              const data = await res.json();
              if (data && data.title) {
                label = data.title;
              }
            } catch (e) {
              console.warn("Failed to fetch YouTube title via noembed", e);
            }
          }

          const newItem = {
            id: reqBase,
            label,
            file: `cache/${reqBase}-analyzed.json`,
          };
          
          langReg.push(newItem);
          
          // Also push to top-level registry if this language corresponds to the currently active targetLanguage
          if (userData.targetLanguage === targetLangKey) {
            if (!userData.registry.find((r: any) => r.id === reqBase)) {
              userData.registry.push(newItem);
            }
          }
        }
      }
      await apiFsWrite(userDataPath, JSON.stringify(userData, null, 2));

      // Re-generate comparison.json for the specific language
      const compareCmd = `npx tsx src/compare.ts --lang ${targetLangKey}`;
      await apiExec(compareCmd);
      
      try {
        const compSrc = `cache/comparison.json`;
        const compDst = `web/dist/comparison.json`;
        if (await apiFsExists(compSrc)) await apiFsCopy(compSrc, compDst);
      } catch (e) { }

      setStatus('success');
      setTimeout(() => {
        onAnalysisSuccess(finalFilename);
        setIsOpen(false);
        setStatus('idle');
        setFilePaths([]);
      }, 1500);

    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing analysis process');
      setStatus('error');
    }
  };

  if (!isOpen) {
    return (
      <div className="flex gap-3">
        <button
          onClick={() => { setInputType('file'); setIsOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-medium transition-colors"
        >
          <UploadCloud size={18} />
          {currentUiLanguage === 'ru' ? 'Анализ из текста' : 'Analyze Text'}
        </button>
        <button
          onClick={() => { setInputType('youtube'); setIsOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#ff0000]/10 hover:bg-[#ff0000]/20 text-[#ff0000] rounded-lg font-medium transition-colors"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          {currentUiLanguage === 'ru' ? 'С YouTube' : 'From YouTube'}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden shadow-primary/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-2xl font-serif text-foreground">
              {currentUiLanguage === 'ru' ? 'Анализ текста' : 'Analyze Text'}
            </h2>
          </div>
          <div className="flex gap-2 mb-4 mt-2 bg-muted/50 p-1 rounded-lg w-max border border-border">
            <button
              onClick={() => { setInputType('file'); setErrorMessage(''); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${inputType === 'file' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {currentUiLanguage === 'ru' ? 'Локальный файл' : 'Local File'}
            </button>
            <button
              onClick={() => { setInputType('youtube'); setErrorMessage(''); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${inputType === 'youtube' ? 'bg-background shadow-sm text-[#ff0000]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              YouTube
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-6 h-10">
            {inputType === 'file' 
              ? (currentUiLanguage === 'ru' ? 'Markdown (.md), текст, книга (.epub / .fb2), документ (.docx / .pdf). Секции через "## Название".' : 'Markdown (.md), text, book (.epub / .fb2), or document (.docx / .pdf). Chapters via "## Title".')
              : (currentUiLanguage === 'ru' ? 'Вставьте ссылку на YouTube-видео. Субтитры будут скачаны и разбиты на главы автоматически.' : 'Paste a YouTube video link. Subtitles will be downloaded and split into chapters automatically.')}
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">
                {currentUiLanguage === 'ru' ? 'Язык текста' : 'Text Language'}
              </label>
              <div className="relative">
                <select 
                  value={textLanguage}
                  onChange={(e) => setTextLanguage(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:border-border/80"
                >
                  <option value="de">{currentUiLanguage === 'ru' ? '🇩🇪 Немецкий (de)' : '🇩🇪 German (de)'}</option>
                  <option value="en">{currentUiLanguage === 'ru' ? '🇬🇧 Английский (en)' : '🇬🇧 English (en)'}</option>
                  <option value="es">{currentUiLanguage === 'ru' ? '🇪🇸 Испанский (es)' : '🇪🇸 Spanish (es)'}</option>
                  <option value="ru">{currentUiLanguage === 'ru' ? '🇷🇺 Русский (ru)' : '🇷🇺 Russian (ru)'}</option>
                  <option value="pl">{currentUiLanguage === 'ru' ? '🇵🇱 Польский (pl)' : '🇵🇱 Polish (pl)'}</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-70">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>

            {inputType === 'file' ? (
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-80">
                  {currentUiLanguage === 'ru' ? 'Файл с текстом' : 'Text File'}
                </label>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex gap-2">
                    <input 
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <input 
                      type="text"
                      value={filePaths.join('; ')}
                      onChange={(e) => setFilePaths(e.target.value.split(';').map(s=>s.trim()).filter(Boolean))}
                      placeholder={currentUiLanguage === 'ru' ? 'C:\\...\\книга.epub; C:\\...\\книга2.epub' : 'C:\\path\\book.epub; C:\\path\\book2.epub'}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      {currentUiLanguage === 'ru' ? 'Обзор...' : 'Browse...'}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 opacity-80">
                    {currentUiLanguage === 'ru' ? 'Вставьте полный путь к файлу в это поле, либо выберите через "Обзор...".' : 'Paste the absolute path to your file here, or click Browse.'}
                  </p>
                  <label className="flex items-center gap-2 mt-4 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={splitPages} 
                      onChange={(e) => setSplitPages(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/50"
                    />
                    <span className="text-sm font-medium opacity-90 text-foreground">
                      {currentUiLanguage === 'ru' ? 'Разбить на страницы' : 'Split into pages'}
                    </span>
                  </label>
                  {splitPages && (
                    <div className="ml-6 mt-1.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground opacity-80">
                          {currentUiLanguage === 'ru' ? 'Символов на страницу:' : 'Characters per page:'}
                        </label>
                        <input 
                          type="number" 
                          value={splitChars} 
                          onChange={(e) => setSplitChars(Math.max(10, Number(e.target.value)))}
                          className="bg-background border border-border rounded-md px-2 py-0.5 text-xs focus:ring-1 focus:ring-primary outline-none transition-all w-20"
                          min={10}
                          step={100}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground opacity-80">
                        {currentUiLanguage === 'ru' ? 'Текст будет автоматически разделен на части указанного размера.' : 'Text will be automatically divided into chunks of this size.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1.5 opacity-80">
                  {currentUiLanguage === 'ru' ? 'Ссылка на видео' : 'Video URL'}
                </label>
                <div className="flex flex-col gap-2 mt-2">
                  <input 
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-red-500/50 outline-none transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1 opacity-80">
                    {currentUiLanguage === 'ru' ? 'Например: https://youtu.be/dQw4w9WgXcQ' : 'Example: https://youtu.be/dQw4w9WgXcQ'}
                  </p>
                  
                  <label className="block text-sm font-medium mt-4 mb-1.5 opacity-80">
                    {currentUiLanguage === 'ru' ? 'Разбивка по времени' : 'Split by time'}
                  </label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      max="120"
                      value={splitDurationMinutes}
                      onChange={(e) => setSplitDurationMinutes(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all pr-12"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground opacity-70 text-sm">
                      {currentUiLanguage === 'ru' ? 'мин' : 'min'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-500/10 text-red-500 rounded-lg p-3 text-sm flex gap-2 items-start border border-red-500/20">
                <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                <div className="break-all whitespace-pre-wrap font-mono text-xs">{errorMessage}</div>
              </div>
            )}

            {status === 'success' && (
              <div className="bg-emerald-500/10 text-emerald-500 rounded-lg p-3 text-sm flex gap-2 items-center border border-emerald-500/20">
                <CheckCircle2 className="shrink-0" size={16} />
                <span>{currentUiLanguage === 'ru' ? 'Успешно обработано! Загружаем...' : 'Success! Loading...'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-muted/40 p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            disabled={status === 'loading'}
            className="px-4 py-2 font-medium text-sm text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            {currentUiLanguage === 'ru' ? 'Отмена' : 'Cancel'}
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={(inputType === 'file' ? filePaths.length === 0 : !youtubeUrl) || status === 'loading' || status === 'success'}
            className={`flex items-center gap-2 px-6 py-2 font-medium text-sm rounded-lg transition-all shadow-sm disabled:opacity-50 ${inputType === 'youtube' ? 'bg-[#ff0000] hover:bg-[#ff0000]/90 text-white shadow-[#ff0000]/20' : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20'}`}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {currentUiLanguage === 'ru' ? 'Анализ...' : 'Analyzing...'}
              </>
            ) : (
              currentUiLanguage === 'ru' ? 'Начать' : 'Analyze'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
