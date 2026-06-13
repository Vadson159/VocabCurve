import { useState, useEffect, createContext, useContext } from 'react';
import { useAnalysisData } from './hooks/useAnalysisData';
import { useComparisonData } from './hooks/useComparisonData';
import { useCefrEstimate } from './hooks/useCefrEstimate';
import { Panel1 } from './components/Panel1';
import { Panel2 } from './components/Panel2';
import { Panel3 } from './components/Panel3';
import { Panel4 } from './components/Panel4';
import { ComparisonView } from './components/ComparisonView';
import { AnalyzerUI } from './components/AnalyzerUI';
import { ResetCustomTextsUI } from './components/ResetCustomTextsUI';
import { CefrBadge } from './components/CefrBadge';
import { InteractiveReader } from './components/InteractiveReader';
import { VocabularyView } from './components/VocabularyView';
import { LexicometerView } from './components/LexicometerView';
import { Loader2, Sun, Moon, Settings as SettingsIcon } from 'lucide-react';
import { type Language, t } from './i18n/translations';
import { SettingsModal } from './components/SettingsModal';
import { type TargetLanguage, triggerGlobalCompare, defaultRegistries } from './hooks/useUserData';
import { UserDataProvider, useSharedUserData } from './contexts/UserDataContext';

type ViewMode = 'single' | 'comparison' | 'vocabulary' | 'lexicometer';

export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
}>({ language: 'en', setLanguage: () => { } });

export const TargetLanguageContext = createContext<{
  targetLanguage: TargetLanguage;
  setTargetLanguage: (lang: TargetLanguage) => void;
}>({ targetLanguage: 'german', setTargetLanguage: () => { } });

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTargetLanguage() {
  return useContext(TargetLanguageContext);
}

function AppContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('comparison');
  const { userData, toggleKnownWord, toggleIgnoredWord, toggleTrackedWord, setTargetLanguage } = useSharedUserData();
  
  const [sourceFile, setSourceFile] = useState(() => {
    const saved = localStorage.getItem('vocabcurve-sourceFile');
    if (saved === 'analysis.json' || !saved) return '';
    return saved;
  });
  
  const [language, setLanguageRaw] = useState<Language>(() => (localStorage.getItem('vocabcurve-uiLanguage') as Language) || 'en');
  const setLanguage = (lang: Language) => {
    setLanguageRaw(lang);
    localStorage.setItem('vocabcurve-uiLanguage', lang);
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('vocabcurve-theme') as 'light' | 'dark') || 'dark');
  
  // Validation effect: ensure selected sourceFile actually exists in the registry
  useEffect(() => {
    if (!userData.registry || userData.registry.length === 0) {
      if (sourceFile) setSourceFile('');
      return;
    }
    
    const validFiles = userData.registry.map(r => r.file.replace('./web/public/', '').replace('web/public/', ''));
    if (!sourceFile || !validFiles.includes(sourceFile)) {
      setSourceFile(validFiles[0]);
    }
  }, [userData.registry, sourceFile]);

  const { data: singleData, loading: singleLoading, error: singleError } = useAnalysisData(sourceFile || undefined);
  const { data: comparisonData, loading: comparisonLoading, error: comparisonError, refetch: refetchComparison } = useComparisonData();
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);

  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const knownWords = new Set(userData.knownWords);
  const ignoredWords = new Set(userData.ignoredWords);
  const trackedWords = new Set(userData.trackedWords || []);
  const registryFiles = userData.registry;
  const cefr = useCefrEstimate(singleData);

  const [isAiOnline, setIsAiOnline] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Sync UI language for components that use window._lastUiLang (AnkiExport, InteractiveReader)
  useEffect(() => {
    (window as any)._lastUiLang = language;
  }, [language]);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/status');
        const json = await res.json();
        setIsAiOnline(json.status === 'online');
      } catch (e) {
        setIsAiOnline(false);
      }
    };
    checkBackend();
    const timer = setInterval(checkBackend, 10000);
    return () => clearInterval(timer);
  }, []);

  // Persist sourceFile selection
  useEffect(() => {
    localStorage.setItem('vocabcurve-sourceFile', sourceFile);
  }, [sourceFile]);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vocabcurve-theme', theme);
  }, [theme]);

  const handleLanguageSwitch = (tl: TargetLanguage) => {
    if (tl === userData.targetLanguage) return;
    setIsChangingLanguage(true);
    setTargetLanguage(tl);

    // Auto-select first registry file for new language for the Single Text Analysis
    const newRegistry = userData.registries?.[tl] || defaultRegistries[tl];
    if (newRegistry && newRegistry.length > 0) {
      setSourceFile(newRegistry[0].file.replace('./web/public/', ''));
    }

    triggerGlobalCompare(() => {
      refetchComparison();
      setIsChangingLanguage(false);
    });
  };

  // Global navigation listener for "Show in text"
  useEffect(() => {
    const handleGlobalShowInText = (e: any) => {
      // Avoid infinite loop since we re-dispatch this below
      if (e.detail?._isRetry) return;

      const { source, sentence } = e.detail;
      if (source) {
        // 1. Switch to single view
        setViewMode('single');

        // 2. Load the specific file (stripping ANY public-prefix if needed)
        // Paths might be ./web/public/file.json or web/public/file.json or /public/file.json
        let cleanSource = source
          .replace(/\\/g, '/')
          .replace(/^\.\//, '')
          .replace(/^web\/public\//, '')
          .replace(/^public\//, '')
          .replace(/^cache\//, '');
        
        // Ensure it doesn't start with a slash
        if (cleanSource.startsWith('/')) cleanSource = cleanSource.substring(1);

        setSourceFile(cleanSource);
        // Re-dispatch after a small delay to ensure InteractiveReader is mounted and listening
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('vocabcurve:show-in-text', {
            detail: { sentence, source, _isRetry: true }
          }));
        }, 150);
      }
    };
    window.addEventListener('vocabcurve:show-in-text', handleGlobalShowInText);
    return () => window.removeEventListener('vocabcurve:show-in-text', handleGlobalShowInText);
  }, [userData.targetLanguage]);

  const handleAnalysisSuccess = (filename: string) => {
    if ((window as any).reloadUserData) {
      (window as any).reloadUserData();
    }
    setSourceFile(filename);
    setViewMode('single');
    refetchComparison();
  };

  const loading = (viewMode === 'single' && singleLoading) || (viewMode === 'comparison' && comparisonLoading);
  const error = viewMode === 'single' ? singleError : (viewMode === 'comparison' ? comparisonError : null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="animate-spin" size={32} />
          <p className="font-serif text-lg">Analyzing corpus...</p>
        </div>
      </div>
    );
  }

  // Only show full-screen error if we explicitly have an error object and no data,
  // but allow normal rendering to show empty states if data just doesn't exist.
  if (error && !singleData && !comparisonData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border p-6 rounded-xl max-w-md text-center">
          <h2 className="text-xl font-serif text-primary mb-2">Notice</h2>
          <p className="text-muted-foreground text-sm">
            {error?.message || 'Data file not found. Have you imported structural texts yet?'}
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button onClick={() => setViewMode('vocabulary')} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg transition-colors text-sm hover:bg-primary/90">
              Open Vocabulary
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="px-4 py-2 bg-muted text-foreground border border-border rounded-lg transition-colors text-sm hover:bg-muted/80">
              Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compute personal coverage for current text
  const personalCoverage = singleData ? (() => {
    const total = singleData.vocabulary.length;
    const known = singleData.vocabulary.filter(w => knownWords.has(w.stem)).length;
    return { known, total, percent: total > 0 ? Math.round((known / total) * 100) : 0 };
  })() : null;

  const targetLanguageLabels: Record<TargetLanguage, { short: string; full: string }> = {
    german: { short: 'DE', full: language === 'ru' ? 'Немецкий' : 'German' },
    spanish: { short: 'ES', full: language === 'ru' ? 'Испанский' : 'Spanish' },
    polish: { short: 'PL', full: language === 'ru' ? 'Польский' : 'Polish' },
    english: { short: 'EN', full: language === 'ru' ? 'Английский' : 'English' },
    russian: { short: 'RU', full: language === 'ru' ? 'Русский' : 'Russian' },
  };
  const targetLanguages: TargetLanguage[] = ['german', 'spanish', 'polish', 'english', 'russian'];

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <TargetLanguageContext.Provider value={{ targetLanguage: userData.targetLanguage, setTargetLanguage }}>
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
          <div className="max-w-7xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-border">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight">
                    {t('Extensive Reading Analysis', language)}
                  </h1>
                  <div className="flex bg-card border border-border rounded-lg p-1 md:hidden gap-1">
                    {(['de', 'es', 'pl', 'en', 'ru'] as Language[]).map(l => (
                      <button
                        key={l}
                        onClick={() => setLanguage(l)}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${language === l ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                    <div className="w-px bg-border" />
                    <button
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    >
                      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title={language === 'ru' ? 'Настройки' : 'Settings'}
                    >
                      <SettingsIcon size={14} />
                    </button>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${isAiOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isAiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">{isAiOnline ? 'AI' : 'OFF'}</span>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground max-w-2xl">
                  {t('A visual exploration of vocabulary progression across texts.', language)}
                </p>
              </div>

              <div className="flex flex-col gap-4 items-end">
                <div className="hidden md:flex bg-card border border-border rounded-lg p-1 mb-2 gap-1">
                  {(['de', 'es', 'pl', 'en', 'ru'] as Language[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLanguage(l)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${language === l ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  >
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    title={language === 'ru' ? 'Настройки' : 'Settings'}
                  >
                    <SettingsIcon size={14} />
                    <span>{language === 'ru' ? 'Настройки' : 'Settings'}</span>
                  </button>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${isAiOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isAiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{isAiOnline ? 'Local AI Online' : 'Local AI Offline'}</span>
                  </div>
                </div>
                <div className="hidden md:flex bg-card border border-border rounded-lg p-1 mb-2 gap-1" title={language === 'ru' ? 'Изучаемый язык' : 'Target language'}>
                  {targetLanguages.map(tl => (
                    <button
                      key={tl}
                      onClick={() => handleLanguageSwitch(tl)}
                      disabled={isChangingLanguage}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${userData.targetLanguage === tl ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        } ${isChangingLanguage ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={targetLanguageLabels[tl].full}
                    >
                      {targetLanguageLabels[tl].short}
                    </button>
                  ))}
                </div>
                <div className="flex bg-card border border-border rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('comparison')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'comparison'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                  >
                    {t('Comparison View', language)}
                  </button>
                  <button
                    onClick={() => setViewMode('single')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'single'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                  >
                    {t('Single Text Analysis', language)}
                  </button>
                  <button
                    onClick={() => setViewMode('lexicometer')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'lexicometer'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                  >
                    {t('Lexicometer', language)}
                  </button>
                  <button
                    onClick={() => setViewMode('vocabulary')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${viewMode === 'vocabulary'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                  >
                    {language === 'ru' ? 'Словарь' : 'Vocabulary'}
                  </button>
                </div>
                <div className="flex gap-3">
                  <AnalyzerUI currentUiLanguage={language} defaultTextLanguage={userData.targetLanguage} onAnalysisSuccess={handleAnalysisSuccess} />
                  {viewMode === 'comparison' && (
                    <ResetCustomTextsUI
                      currentUiLanguage={language}
                      onResetSuccess={() => {
                        window.location.reload();
                      }}
                    />
                  )}
                </div>

                {viewMode === 'single' && singleData && (
                  <div className="flex flex-col gap-2 items-end">
                    <select
                      value={sourceFile}
                      onChange={(e) => setSourceFile(e.target.value)}
                      className="bg-card border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2"
                    >
                      {registryFiles.map(f => {
                        const jsonFile = f.file.replace(/^\.\/web\/public\//, '');
                        return (
                          <option key={f.id} value={jsonFile}>{f.label}</option>
                        );
                      })}
                    </select>
                    <div className="flex gap-4 text-sm font-mono text-muted-foreground bg-card px-4 py-2 rounded-lg border border-border items-center">
                      {cefr && <CefrBadge cefr={cefr} />}
                      <div className="w-px h-6 bg-border"></div>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider opacity-60">
                          {t(sourceFile === 'analysis.json' ? 'Topics' : 'Chapters', language)}
                        </span>
                        <span className="text-foreground">{singleData.meta.totalSections}</span>
                      </div>
                      <div className="w-px bg-border"></div>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider opacity-60" title={language === 'ru' ? 'Слов' : 'Words'}>{t('Words', language)}</span>
                        <span className="text-foreground">{singleData.meta.totalWords?.toLocaleString() ?? singleData.meta.totalTokens.toLocaleString()}</span>
                      </div>
                      <div className="w-px bg-border"></div>
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider opacity-60" title={language === 'ru' ? 'Уникальных (без игнорируемых)' : 'Unique (excluding ignored)'}>{t('Unique Words', language)}</span>
                        <span className="text-foreground">
                          {(singleData.meta.totalUniqueStems - singleData.vocabulary.filter(w => ignoredWords.has(w.stem)).length).toLocaleString()}
                        </span>
                      </div>
                      {personalCoverage && personalCoverage.known > 0 && (
                        <>
                          <div className="w-px bg-border"></div>
                          <div className="flex flex-col">
                            <span className="text-xs uppercase tracking-wider opacity-60">
                              {language === 'ru' ? 'Знаю' : 'Known'}
                            </span>
                            <span className="text-emerald-500 font-medium">{personalCoverage.percent}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </header>

            <main className={`space-y-8 transition-opacity duration-300 ${isChangingLanguage ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {viewMode === 'comparison' && comparisonData ? (
                <ComparisonView data={comparisonData} onRefresh={refetchComparison} />
              ) : viewMode === 'vocabulary' ? (
                <VocabularyView key={userData.targetLanguage} />
              ) : viewMode === 'lexicometer' ? (
                <LexicometerView key={userData.targetLanguage} />
              ) : viewMode === 'single' ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                    <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                      {language === 'ru' ? 'Анализируемый текст:' : 'Analyzing Text:'}
                    </div>
                    <select
                      value={sourceFile}
                      onChange={(e) => setSourceFile(e.target.value)}
                      className="w-full sm:max-w-md bg-background border border-border rounded-lg px-4 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:border-border/80 truncate font-semibold"
                    >
                      {!userData.registry.length && (
                        <option value="analysis.json">{language === 'ru' ? 'Нет доступных текстов' : 'No texts available'}</option>
                      )}
                      {userData.registry.map(reg => (
                        <option key={reg.id} value={reg.file.replace('./web/public/', '')}>
                          {reg.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {singleData ? (
                    <>
                      <section>
                        <Panel1
                          data={singleData}
                          onSectionClick={setSelectedSectionIndex}
                          selectedSectionIndex={selectedSectionIndex}
                        />
                      </section>

                      <section>
                        <Panel2 data={singleData} />
                      </section>

                      <section className="flex flex-col gap-8">
                        <div className="w-full">
                          <Panel3 data={singleData} />
                        </div>
                        <div className="w-full h-[600px] lg:h-[700px]">
                          <Panel4
                            data={singleData}
                            selectedSectionIndex={selectedSectionIndex}
                            onClearSelection={() => setSelectedSectionIndex(null)}
                            knownWords={knownWords}
                            onToggleKnown={toggleKnownWord}
                            ignoredWords={ignoredWords}
                            onToggleIgnored={toggleIgnoredWord}
                            trackedWords={trackedWords}
                            onToggleTracked={toggleTrackedWord}
                          />
                        </div>
                      </section>

                      <section>
                        <InteractiveReader
                          data={singleData}
                          knownWords={knownWords}
                          onToggleWord={toggleKnownWord}
                          ignoredWords={ignoredWords}
                          trackedWords={trackedWords}
                        />
                      </section>
                    </>
                  ) : (
                    <div className="bg-card border border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center mt-8">
                      <p className="text-muted-foreground">{language === 'ru' ? 'Выбранный текст загружается или не найден.' : 'Selected text is loading or not found.'}</p>
                    </div>
                  )}
                </>
              ) : null}
            </main>

            <footer className="pt-8 pb-4 text-center text-sm text-muted-foreground border-t border-border">
              <p>
                {viewMode === 'single' && singleData
                  ? `${t('dataSource', language)}: ${singleData.meta.source} • ${t('language', language)}: ${singleData.meta.language}`
                  : `${t('language', language)}: ${userData.targetLanguage} • ${t('texts', language)}: ${userData.registry.length}`}
              </p>
            </footer>
          </div>

          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        </div>
      </TargetLanguageContext.Provider>
    </LanguageContext.Provider>
  );
}

function App() {
  return (
    <UserDataProvider>
      <AppContent />
    </UserDataProvider>
  );
}

export default App;
