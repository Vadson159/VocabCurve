# VocabCurve

<div align="center">
  <img src="https://i.imgur.com/mwOjvVY.png" alt="Screenshot 1" width="800"/>
  <img src="https://i.imgur.com/18xXJYV.png" alt="Screenshot 2" width="800"/>
  <img src="https://i.imgur.com/131f90u.png" alt="Screenshot 3" width="800"/>
  <img src="https://i.imgur.com/pXcqDoW.png" alt="Screenshot 4" width="800"/>
  <img src="https://i.imgur.com/IoaKcYr.png" alt="Screenshot 5" width="800"/>
  <img src="https://i.imgur.com/G26RtaE.png" alt="Screenshot 6" width="800"/>
  <img src="https://i.imgur.com/nTOpJro.png" alt="Screenshot 7" width="800"/>
  <img src="https://i.imgur.com/9Bc4VXF.png" alt="Screenshot 8" width="800"/>
</div>

VocabCurve is an advanced, fully local tool for interactive text reading, vocabulary analysis, and language learning. It acts as your personal reading assistant that tracks your known vocabulary, provides instant translations, generates audio pronunciations, and finds contextual images—all without relying on expensive cloud APIs (mostly local, except for Bing Image Search and Edge TTS).

## 🌟 Key Features

* **Advanced NLP & Lemmatization:** Uses `spaCy` to accurately lemmatize words (grouping variations like *went* and *go*) and analyze sentence structure.
* **Local Translation (NLLB-200):** Leverages Meta's `nllb-200-distilled-600M` model for completely offline, high-quality translations for sentences and words across 200+ languages.
* **Interactive Reader:** Click any word while reading to see its lemma, frequency, and translation. Add it to your learning list or mark it as known.
* **Text-to-Speech (Edge-TTS):** Instantly generate high-quality voice pronunciation for words or full sentences.
* **Image Association:** Automatically search and download images via Bing Image Search to associate visual memory with new vocabulary.
* **Vocabulary Tracking:** Keep track of Known, Ignored, and Tracked (learning) words. Your vocabulary grows visually as you read.
* **Text Analysis & Difficulty Estimation:** Analyze texts before reading to see how many new words they contain, readability scores (CEFR estimation), and vocabulary distribution.

## 🛠 Tech Stack

* **Backend:** Python + FastAPI
  * `spaCy` for NLP pipelines
  * `Transformers` (HuggingFace) for local translation models
  * `edge-tts` for voice synthesis
* **Frontend:** React + Vite + Tailwind CSS v4 + TypeScript

## 🚀 Getting Started

### Prerequisites
* **Node.js** (for the frontend)
* **Python 3.10+** (for the backend)

### 1. Start the Backend
The backend runs all the heavy NLP and translation models.

```bash
cd backend
python -m venv .venv
# On Windows
.venv\Scripts\activate
# On macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
# Run the FastAPI server
uvicorn main:app --reload --port 8000
```
*Note: The first time you use the local translator or spaCy, it will download the necessary models (e.g., NLLB-200 and language-specific spaCy models).*

### 2. Start the Frontend
In a new terminal window:

```bash
cd web
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.

## 📂 Project Structure

* `/backend` - The Python FastAPI server handling NLP, TTS, image search, and local translation.
* `/web` - The React application, interactive reader, and dashboard.
* `/src` & `/scripts` - CLI tools and scripts for preprocessing and analysis.
* `/userimages` - Locally saved images fetched from Bing.
* `user-data.json` - Your local database of tracked, known, and ignored words.

## 🙏 Acknowledgements
This project is an advanced fork and expansion of the original [vocab-curve](https://github.com/acheronex/vocab-curve) created by acheronex.

## 📜 License
MIT

---
## Support
If you find this project helpful, consider supporting its development:

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://buymeacoffee.com/vadson)
