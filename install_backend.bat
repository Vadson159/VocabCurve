@echo off
cd /d "%~dp0"
echo Setting up Python Electronic Environment...

if not exist "backend\.venv" (
    echo Creating virtual environment...
    python -m venv backend\.venv
)

echo Activating virtual environment...
call backend\.venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip
pip install fastapi "uvicorn[standard]" spacy transformers torch torchvision torchaudio pydantic sentencepiece

echo Downloading spaCy models...
python -m spacy download en_core_web_sm
python -m spacy download es_core_news_sm
python -m spacy download de_core_news_sm
python -m spacy download ru_core_news_sm
python -m spacy download pl_core_news_sm

echo Setup Complete!
pause
