"""Settings and configuration for AI agents."""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    llm_provider: str = Field(default="openrouter", alias="LLM_PROVIDER")

    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(
        default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL"
    )
    openrouter_model_default: str = Field(
        default="qwen/qwen-2-7b-instruct:free", alias="OPENROUTER_MODEL_DEFAULT"
    )
    openrouter_model_enrichment: str = Field(
        default="stepfun/step-3.5-flash:free", alias="OPENROUTER_MODEL_ENRICHMENT"
    )

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_base_url: Optional[str] = Field(default=None, alias="OPENAI_BASE_URL")
    openai_model_default: str = Field(default="gpt-3.5-turbo", alias="OPENAI_MODEL_DEFAULT")
    openai_model_enrichment: str = Field(default="gpt-4-turbo", alias="OPENAI_MODEL_ENRICHMENT")

    free_models: list[str] = [
        "stepfun/step-3.5-flash:free",
        "meta-llama/llama-3.2-3b-instruct:free",
        "qwen/qwen-2-7b-instruct:free",
        "google/gemma-2-9b-it:free",
    ]

    cheap_models: dict[str, dict] = {
        "openai/gpt-4o-mini": {"input": 0.15, "output": 0.60},
        "meta-llama/llama-3.1-8b-instruct": {"input": 0.055, "output": 0.055},
        "anthropic/claude-3.5-sonnet": {"input": 3.0, "output": 15.0},
    }

    serpapi_key: str = Field(default="", alias="SERPAPI_KEY")
    google_maps_api_key: str = Field(default="", alias="GOOGLE_MAPS_API_KEY")

    max_locations: int = Field(default=50, alias="MAX_LOCATIONS")
    output_dir: str = Field(default="./data/output", alias="OUTPUT_DIR")

    requests_per_minute: int = Field(default=60, alias="REQUESTS_PER_MINUTE")
    reddit_rate_limit: int = Field(default=60, alias="REDDIT_RATE_LIMIT")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    def get_llm_client_config(self) -> dict:
        if self.llm_provider == "openrouter":
            return {
                "api_key": self.openrouter_api_key,
                "base_url": self.openrouter_base_url,
                "model_default": self.openrouter_model_default,
                "model_enrichment": self.openrouter_model_enrichment,
            }
        else:
            return {
                "api_key": self.openai_api_key,
                "base_url": self.openai_base_url,
                "model_default": self.openai_model_default,
                "model_enrichment": self.openai_model_enrichment,
            }

    def is_free_model(self, model: str) -> bool:
        return model.endswith(":free") or model in self.free_models

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        if model not in self.cheap_models:
            if self.is_free_model(model):
                return 0.0
            return -1

        pricing = self.cheap_models[model]
        cost = (
            input_tokens / 1_000_000 * pricing["input"]
            + output_tokens / 1_000_000 * pricing["output"]
        )
        return cost


@lru_cache
def get_settings() -> Settings:
    return Settings()
