import os
from pathlib import Path

class Config:
    DEFAULT_PORT: int = int(os.getenv("PORT", 8888))
    TEACHER_PIN: str = os.getenv("TEACHER_PIN", "123456")
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DIST_DIR: Path = BASE_DIR / "dist"
    PUBLIC_DIR: Path = BASE_DIR / "public"

config = Config()
