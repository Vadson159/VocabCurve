import { useState, useEffect } from 'react';
import { X, Settings2, Save, Key, Volume2, Trash2, Loader2 } from 'lucide-react';
import { useSharedUserData } from '../contexts/UserDataContext';
import { useLanguage } from '../App';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Available Edge-TTS voices per language
const VOICE_OPTIONS: Record<string, { label: string; voices: { id: string; name: string; gender: string }[] }> = {
  en: {
    label: 'English',
    voices: [
      { id: 'en-US-GuyNeural', name: 'Guy', gender: '♂' },
      { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: '♂' },
      { id: 'en-US-EricNeural', name: 'Eric', gender: '♂' },
      { id: 'en-US-AriaNeural', name: 'Aria', gender: '♀' },
      { id: 'en-US-JennyNeural', name: 'Jenny', gender: '♀' },
      { id: 'en-US-MichelleNeural', name: 'Michelle', gender: '♀' },
      { id: 'en-GB-RyanNeural', name: 'Ryan (UK)', gender: '♂' },
      { id: 'en-GB-SoniaNeural', name: 'Sonia (UK)', gender: '♀' },
    ]
  },
  de: {
    label: 'Deutsch',
    voices: [
      { id: 'de-DE-KillianNeural', name: 'Killian', gender: '♂' },
      { id: 'de-DE-ConradNeural', name: 'Conrad', gender: '♂' },
      { id: 'de-DE-KatjaNeural', name: 'Katja', gender: '♀' },
      { id: 'de-DE-AmalaNeural', name: 'Amala', gender: '♀' },
      { id: 'de-AT-JonasNeural', name: 'Jonas (AT)', gender: '♂' },
      { id: 'de-AT-IngridNeural', name: 'Ingrid (AT)', gender: '♀' },
    ]
  },
  es: {
    label: 'Español',
    voices: [
      { id: 'es-ES-AlvaroNeural', name: 'Álvaro', gender: '♂' },
      { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: '♀' },
      { id: 'es-MX-JorgeNeural', name: 'Jorge (MX)', gender: '♂' },
      { id: 'es-MX-DaliaNeural', name: 'Dalia (MX)', gender: '♀' },
      { id: 'es-AR-TomasNeural', name: 'Tomás (AR)', gender: '♂' },
      { id: 'es-AR-ElenaNeural', name: 'Elena (AR)', gender: '♀' },
    ]
  },
  pl: {
    label: 'Polski',
    voices: [
      { id: 'pl-PL-MarekNeural', name: 'Marek', gender: '♂' },
      { id: 'pl-PL-ZofiaNeural', name: 'Zofia', gender: '♀' },
    ]
  },
  ru: {
    label: 'Русский',
    voices: [
      { id: 'ru-RU-DmitryNeural', name: 'Дмитрий', gender: '♂' },
      { id: 'ru-RU-SvetlanaNeural', name: 'Светлана', gender: '♀' },
      { id: 'ru-RU-DariyaNeural', name: 'Дария', gender: '♀' },
    ]
  }
};

const DEFAULT_VOICES: Record<string, string> = {
  en: 'en-US-GuyNeural',
  ru: 'ru-RU-DmitryNeural',
  de: 'de-DE-KillianNeural',
  es: 'es-ES-AlvaroNeural',
  pl: 'pl-PL-MarekNeural'
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { userData, setYandexApiKey, setTtsVoices } = useSharedUserData();
  const { language } = useLanguage();
  const [yandexKey, setYandexKey] = useState(userData.yandexApiKey || '');
  const [voices, setVoices] = useState<Record<string, string>>(
    userData.ttsVoices || { ...DEFAULT_VOICES }
  );

  useEffect(() => {
    if (isOpen) {
      setYandexKey(userData.yandexApiKey || '');
      setVoices(userData.ttsVoices || { ...DEFAULT_VOICES });
    }
  }, [isOpen, userData.yandexApiKey, userData.ttsVoices]);

  const [clearingTexts, setClearingTexts] = useState(false);
  const [clearingMedia, setClearingMedia] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setYandexApiKey(yandexKey);
    setTtsVoices(voices);
    onClose();
  };

  const handleVoiceChange = (langCode: string, voiceId: string) => {
    setVoices(prev => ({ ...prev, [langCode]: voiceId }));
  };

  const handleClearTexts = async () => {
    setClearingTexts(true);
    setClearResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/cache/clear-texts', { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        setClearResult(language === 'ru' ? `Удалено файлов: ${json.removed}` : `Removed ${json.removed} files`);
      } else {
        setClearResult(json.message || 'Error');
      }
    } catch { setClearResult(language === 'ru' ? 'Бэкенд недоступен' : 'Backend offline'); }
    finally { setClearingTexts(false); }
  };

  const handleClearMedia = async () => {
    setClearingMedia(true);
    setClearResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/cache/clear-media', { method: 'POST' });
      const json = await res.json();
      if (json.status === 'success') {
        setClearResult(language === 'ru' ? `Удалено файлов: ${json.removed}` : `Removed ${json.removed} files`);
      } else {
        setClearResult(json.message || 'Error');
      }
    } catch { setClearResult(language === 'ru' ? 'Бэкенд недоступен' : 'Backend offline'); }
    finally { setClearingMedia(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden shadow-primary/10">
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif text-foreground flex items-center gap-2">
              <Settings2 size={24} className="text-primary" />
              {language === 'ru' ? 'Настройки' : 'Settings'}
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Yandex API Key */}
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80 flex items-center gap-2">
                <Key size={14} /> Yandex Dictionary API Key
              </label>
              <input
                type="text"
                value={yandexKey}
                onChange={(e) => setYandexKey(e.target.value)}
                placeholder="dict.1.1.2026..."
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              <p className="text-xs text-muted-foreground mt-2 opacity-80 leading-relaxed">
                {language === 'ru' 
                  ? 'Яндекс Словарь используется для перевода основных слов и синонимов внутри карточки.' 
                  : 'Yandex Dictionary is used for translating main words and synonyms in the detail panel.'}
              </p>
            </div>

            {/* TTS Voice Selection */}
            <div>
              <label className="block text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
                <Volume2 size={14} /> {language === 'ru' ? 'Голоса озвучки (TTS)' : 'TTS Voices'}
              </label>
              <p className="text-xs text-muted-foreground mb-4 opacity-80 leading-relaxed">
                {language === 'ru'
                  ? 'Выберите голос для озвучки слов и предложений на каждом языке.'
                  : 'Select a voice for word and sentence pronunciation per language.'}
              </p>
              <div className="space-y-3">
                {Object.entries(VOICE_OPTIONS).map(([langCode, { label, voices: voiceList }]) => (
                  <div key={langCode} className="flex items-center gap-3">
                    <span className="text-xs font-mono uppercase text-muted-foreground w-16 shrink-0 tracking-wider">
                      {label}
                    </span>
                    <select
                      value={voices[langCode] || DEFAULT_VOICES[langCode]}
                      onChange={(e) => handleVoiceChange(langCode, e.target.value)}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none cursor-pointer"
                    >
                      {voiceList.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.gender} {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Cache Management */}
            <div>
              <label className="block text-sm font-medium mb-3 opacity-80 flex items-center gap-2">
                <Trash2 size={14} /> {language === 'ru' ? 'Управление кэшем' : 'Cache Management'}
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 bg-background/60 border border-border/50 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/90">
                      {language === 'ru' ? 'Кэш текстов' : 'Text Cache'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {language === 'ru'
                        ? 'Анализы, сравнения, морфология, временные файлы'
                        : 'Analyses, comparisons, morphology, temp files'}
                    </p>
                  </div>
                  <button
                    onClick={handleClearTexts}
                    disabled={clearingTexts}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {clearingTexts ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {language === 'ru' ? 'Очистить' : 'Clear'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 bg-background/60 border border-border/50 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground/90">
                      {language === 'ru' ? 'Медиа файлы' : 'Media Files'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {language === 'ru'
                        ? 'Скачанные картинки и сгенерированные аудио'
                        : 'Downloaded images & generated audio'}
                    </p>
                  </div>
                  <button
                    onClick={handleClearMedia}
                    disabled={clearingMedia}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {clearingMedia ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    {language === 'ru' ? 'Очистить' : 'Clear'}
                  </button>
                </div>
                {clearResult && (
                  <p className="text-xs text-center text-primary/70 animate-in fade-in duration-300">{clearResult}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 font-medium text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            {language === 'ru' ? 'Отмена' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 font-medium text-sm rounded-lg transition-all shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
          >
            <Save size={16} />
            {language === 'ru' ? 'Сохранить' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
