import { useState } from 'react';
import { Loader2, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { AnalysisResult } from '../hooks/useAnalysisData';
import { type Language } from '../i18n/translations';

// Node modules removed - running in standard browser environment

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function localTranslate(text: string, fromLang: string): Promise<string> {
  try {
    const res = await fetch('http://localhost:8000/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence: text,
        src_lang: fromLang,
        tgt_lang: (window as any)._lastUiLang || 'ru',
        is_word: true
      })
    });
    
    const json = await res.json();
    if (!res.ok || json.status === 'error' || !json.translation) {
      return '—';
    }
    
    return json.translation;
  } catch { return '—'; }
}

async function translateWord(word: string, fromLang: string): Promise<string> {
  const result = await localTranslate(word, fromLang);
  return result === '—' ? '—' : capitalize(result);
}

async function translateSentence(sentence: string, fromLang: string): Promise<string> {
  const result = await localTranslate(sentence, fromLang);
  return result === '—' ? '' : result;
}

/** Escape a value for CSV: wrap in quotes, escape any inner quotes */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

interface AnkiExportUIProps {
  data: AnalysisResult;
  currentUiLanguage: Language;
  defaultWordCount: number;
  ignoredWords?: Set<string>;
}

async function invokeAnkiConnect(action: string, params = {}) {
  const req = { action, version: 6, params };
  try {
    const res = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    const json = await res.json();
    if (Object.prototype.hasOwnProperty.call(json, 'error') && json.error) {
      throw new Error(json.error);
    }
    return json.result;
  } catch (e: any) {
    if (e.message === 'Failed to fetch') {
      throw new Error('AnkiConnect is offline. Is Anki running with the AnkiConnect add-on?');
    }
    throw e;
  }
}

export function AnkiExportUI({ data, currentUiLanguage, defaultWordCount, ignoredWords }: AnkiExportUIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'csv' | 'ankiconnect'>('csv');
  const [wordCount, setWordCount] = useState(defaultWordCount);
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [includeExamples, setIncludeExamples] = useState(true);
  
  // AnkiConnect States
  const [decks, setDecks] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  const loadAnkiData = async () => {
    try {
      const d = await invokeAnkiConnect('deckNames');
      const m = await invokeAnkiConnect('modelNames');
      setDecks(d);
      setModels(m);
      if (d.length > 0) setSelectedDeck(d[0]);
      if (m.length > 0) setSelectedModel(m[0]);
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message);
    }
  };

  const handleExport = async () => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const topWords = [...data.vocabulary]
        .filter(w => !ignoredWords?.has(w.stem))
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, wordCount);

      setProgress({ current: 0, total: topWords.length });
      const userData = (window as any).__vocabcurve_userData || {};
      const srcLangMap: Record<string, string> = { german: 'de', spanish: 'es', polish: 'pl', english: 'en', russian: 'ru' };
      const srcLangCode = srcLangMap[userData.targetLanguage] || 'de';

      if (exportMode === 'csv') {
        const lines: string[] = [];

        for (let i = 0; i < topWords.length; i++) {
          const word = topWords[i];
          const foreignWord = capitalize(word.displayForm);
          const parts = [csvField(foreignWord)];

          const metadata = userData.wordMetadata?.[word.stem];
          let wordAudio = metadata?.audioWord ? `[sound:${metadata.audioWord}]` : '';
          
          if (translateEnabled) {
            const translation = await translateWord(word.displayForm, data.meta.language);
            parts.push(csvField(translation + (wordAudio ? ` ${wordAudio}` : '')));
          } else {
            parts.push(csvField(wordAudio));
          }

          if (includeExamples && word.examples && word.examples.length > 0) {
            const example = word.examples[0];
            let ctxAudio = metadata?.audioContext ? `[sound:${metadata.audioContext}]` : '';
            parts.push(csvField(example + (ctxAudio ? ` ${ctxAudio}` : '')));

            if (translateEnabled) {
              const exTranslation = await translateSentence(example, data.meta.language);
              parts.push(csvField(exTranslation));
            } else {
              parts.push(csvField(''));
            }
          }

          lines.push(parts.join(';'));
          setProgress({ current: i + 1, total: topWords.length });
        }

        const csvContent = '\ufeff' + lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'vocabcurve-export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // ANKICONNECT
        const modelFields = await invokeAnkiConnect('modelFieldNames', { modelName: selectedModel });
        if (!modelFields || modelFields.length === 0) throw new Error("Selected note type has no fields.");

        for (let i = 0; i < topWords.length; i++) {
          const word = topWords[i];
          const foreignWord = capitalize(word.displayForm);
          let translationText = "";
          let contextText = "";
          let contextTransText = "";
          let imageTag = "";

          if (translateEnabled) {
            translationText = await translateWord(word.displayForm, data.meta.language);
          }

          if (includeExamples && word.examples && word.examples.length > 0) {
            contextText = word.examples[0];
            if (translateEnabled) {
              contextTransText = await translateSentence(contextText, data.meta.language);
            }
          }

          // Image processing
          const metadata = userData.wordMetadata?.[word.stem];
          if (metadata && metadata.image) {
            const backendPath = `s:/VocabCurve/userimages/${srcLangCode}/${metadata.image}`;
            try {
              const savedFilename = await invokeAnkiConnect('storeMediaFile', {
                filename: metadata.image,
                path: backendPath
              });
              if (savedFilename) {
                imageTag = `<br><br><img src="${savedFilename}">`;
              }
            } catch (e: any) {
              console.error("Failed to store media file:", e);
              // continue without image
            }
          }

          let wordAudioTag = "";
          let contextAudioTag = "";
          
          if (metadata && metadata.audioWord) {
             const audioPath = `s:/VocabCurve/userimages/${srcLangCode}/${metadata.audioWord}`;
             try {
                const savedAudio = await invokeAnkiConnect('storeMediaFile', {
                   filename: metadata.audioWord,
                   path: audioPath
                });
                if (savedAudio) wordAudioTag = `[sound:${savedAudio}]`;
             } catch (e: any) { console.error("Failed to store audio file:", e); }
          }
          
          if (metadata && metadata.audioContext) {
             const ctxAudioPath = `s:/VocabCurve/userimages/${srcLangCode}/${metadata.audioContext}`;
             try {
                const savedAudio = await invokeAnkiConnect('storeMediaFile', {
                   filename: metadata.audioContext,
                   path: ctxAudioPath
                });
                if (savedAudio) contextAudioTag = `[sound:${savedAudio}]`;
             } catch (e: any) { console.error("Failed to store context audio file:", e); }
          }

          const fields: Record<string, string> = {};
          // Assign field 1 = Word, field 2 = Everything else
          fields[modelFields[0]] = foreignWord;
          if (modelFields.length > 1) {
            const extra = [
              (translationText || wordAudioTag) ? `<b>${translationText}</b> ${wordAudioTag}`.trim() : '',
              (contextText || contextAudioTag) ? `<i>${contextText}</i> ${contextAudioTag}`.trim() : '',
              contextTransText ? contextTransText : '',
              imageTag
            ].filter(Boolean).join('<br><br>');
            fields[modelFields[1]] = extra;
          }

          await invokeAnkiConnect('addNote', {
            note: {
              deckName: selectedDeck,
              modelName: selectedModel,
              fields: fields,
              options: {
                allowDuplicate: false,
                duplicateScope: "deck"
              },
              tags: ["vocabcurve"]
            }
          });

          setProgress({ current: i + 1, total: topWords.length });
        }
      }

      setStatus('success');
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
        setProgress({ current: 0, total: 0 });
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unknown error');
      setStatus('error');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => { setWordCount(defaultWordCount); setIsOpen(true); }}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
        title={currentUiLanguage === 'ru' ? 'Экспорт' : 'Export'}
      >
        <Download size={16} />
        {currentUiLanguage === 'ru' ? 'Экспорт' : 'Export'}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden shadow-emerald-500/10">
        <div className="p-6">
          <h2 className="text-2xl font-serif text-foreground mb-1">
            {currentUiLanguage === 'ru' ? 'Экспорт Словаря' : 'Export Vocabulary'}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {currentUiLanguage === 'ru'
              ? 'Экспорт самых частых слов.'
              : 'Export most frequent words.'}
          </p>

          <div className="flex gap-2 p-1 bg-muted rounded-xl mb-5">
            <button
              onClick={() => setExportMode('csv')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${exportMode === 'csv' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              CSV (ReWord)
            </button>
            <button
              onClick={() => { setExportMode('ankiconnect'); loadAnkiData(); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${exportMode === 'ankiconnect' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              AnkiConnect
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">
                {currentUiLanguage === 'ru' ? 'Количество слов' : 'Number of words'}
              </label>
              <input
                type="number"
                min="1"
                max={data.vocabulary.length}
                value={wordCount}
                onChange={(e) => setWordCount(Math.max(1, Number(e.target.value) || 1))}
                className="w-32 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
              />
              <p className="text-xs text-muted-foreground mt-1 opacity-80">
                {currentUiLanguage === 'ru'
                  ? `Максимум: ${data.vocabulary.length} уникальных слов`
                  : `Max: ${data.vocabulary.length} unique words`}
              </p>
            </div>

            {exportMode === 'ankiconnect' && (
              <div className="grid grid-cols-2 gap-4 mt-2 mb-2 p-3 bg-primary/5 rounded-xl border border-primary/10">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-primary/80">
                    {currentUiLanguage === 'ru' ? 'Колода Anki' : 'Anki Deck'}
                  </label>
                  <select 
                    value={selectedDeck} 
                    onChange={e => setSelectedDeck(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm outline-none"
                  >
                    {decks.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-primary/80">
                    {currentUiLanguage === 'ru' ? 'Тип Карточки' : 'Note Type'}
                  </label>
                  <select 
                    value={selectedModel} 
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm outline-none"
                  >
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium opacity-80">
                  {currentUiLanguage === 'ru' ? 'Автоперевод на русский' : 'Auto-translate to Russian'}
                </label>
              </div>
              <button
                type="button"
                onClick={() => setTranslateEnabled(!translateEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${translateEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${translateEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium opacity-80">
                  {currentUiLanguage === 'ru' ? 'Включить примеры' : 'Include examples'}
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIncludeExamples(!includeExamples)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${includeExamples ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${includeExamples ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {(status === 'loading' || progress.total > 0) && (
              <div className="bg-emerald-500/10 text-emerald-500 rounded-lg p-3 text-sm flex gap-2 items-center border border-emerald-500/20">
                <Loader2 className={`${status === 'loading' ? 'animate-spin' : ''} shrink-0`} size={16} />
                <span>
                  {currentUiLanguage === 'ru' ? `Экспорт: ${progress.current} / ${progress.total}...` : `Exporting: ${progress.current} / ${progress.total}...`}
                </span>
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
                <span>{currentUiLanguage === 'ru' ? 'Успешно завершено!' : 'Successfully completed!'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-muted/40 p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={() => { setIsOpen(false); setStatus('idle'); setProgress({current:0,total:0}); }}
            disabled={status === 'loading'}
            className="px-4 py-2 font-medium text-sm text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            {currentUiLanguage === 'ru' ? 'Отмена' : 'Cancel'}
          </button>

          <button
            onClick={handleExport}
            disabled={status === 'loading' || status === 'success' || (exportMode === 'ankiconnect' && (!selectedDeck || !selectedModel))}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium text-sm rounded-lg transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                {currentUiLanguage === 'ru' ? 'Экспорт...' : 'Exporting...'}
              </>
            ) : (
              <>
                <Download size={16} />
                {currentUiLanguage === 'ru' ? 'Экспорт' : 'Export'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
