import os
from pathlib import Path
from dotenv import load_dotenv

# Sempre carregar o .env do backend, não importa onde você rode o comando
BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../backend
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)

ENV = os.getenv("ENV", "dev")
APP_NAME = os.getenv("APP_NAME", "MarginFlow")
APP_SECRET = os.getenv("APP_SECRET", "dev-secret-change-me")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(f"DATABASE_URL não definido em {ENV_PATH}")