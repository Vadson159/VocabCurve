import os
import asyncio
import edge_tts

class TTSService:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        
        # Mapping our internal language names to Edge-TTS ShortNames
        self.voice_map = {
            'en': 'en-US-GuyNeural',
            'ru': 'ru-RU-DmitryNeural',
            'de': 'de-DE-KillianNeural',
            'es': 'es-ES-AlvaroNeural',
            'pl': 'pl-PL-MarekNeural',
            'english': 'en-US-GuyNeural',
            'russian': 'ru-RU-DmitryNeural',
            'german': 'de-DE-KillianNeural',
            'spanish': 'es-ES-AlvaroNeural',
            'polish': 'pl-PL-MarekNeural'
        }
        
        # Ensure output dir exists
        os.makedirs(output_dir, exist_ok=True)
        
    def map_language_code(self, lang: str) -> str:
        lang_map = {
            'english': 'en',
            'german': 'de',
            'spanish': 'es',
            'polish': 'pl',
            'russian': 'ru',
            'en': 'en',
            'de': 'de',
            'es': 'es',
            'pl': 'pl',
            'ru': 'ru'
        }
        return lang_map.get(lang.lower(), 'en')

    def _get_voice(self, lang: str) -> str:
        return self.voice_map.get(lang.lower(), 'en-US-GuyNeural')

    def generate_audio(self, text: str, lang: str, filename: str, voice_override: str = None) -> str:
        """
        Wrapper to run the async generation in a synchronous environment.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._generate_audio_async(text, lang, filename, voice_override))
        finally:
            loop.close()

    async def _generate_audio_async(self, text: str, lang: str, filename: str, voice_override: str = None) -> str:
        lang_code = self.map_language_code(lang)
        voice = voice_override if voice_override else self._get_voice(lang)
        
        # Subdirectory for language
        lang_dir = os.path.join(self.output_dir, lang_code)
        os.makedirs(lang_dir, exist_ok=True)
        
        filepath = os.path.join(lang_dir, filename)
        
        # If file already exists, just return it
        if os.path.exists(filepath):
            return filename
            
        print(f"Generating Edge-TTS audio: '{text[:30]}...' using {voice}")
        
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filepath)
            return filename
        except Exception as e:
            print(f"Error generating Edge-TTS audio: {e}")
            raise e
