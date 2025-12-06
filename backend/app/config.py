from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Database (PostgreSQL for proper concurrent read/write support)
    database_url: str = "postgresql://localhost/bias_tool"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8080"

    # Application
    session_duration: int = 3600
    max_iterations: int = 1000
    min_iterations: int = 10
    debug: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string"""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
