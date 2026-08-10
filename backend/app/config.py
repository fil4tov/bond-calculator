from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://bonds:bonds_dev_password@postgres:5432/bonds"
    session_cookie_name: str = "bonds_session"
    session_days: int = Field(default=30, ge=1)
    cookie_secure: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()

