"""LLM client factory for OpenRouter and OpenAI support."""

from typing import Optional

from openai import OpenAI

from src.approaches.ai_agent.config.settings import Settings, get_settings
from src.shared.services.cache import get_cache
from src.shared.services.logger import get_logger

logger = get_logger(__name__)
cache = get_cache()


def create_llm_client(settings: Optional[Settings] = None) -> OpenAI:
    """Create an LLM client configured for OpenRouter or OpenAI."""
    settings = settings or get_settings()
    config = settings.get_llm_client_config()

    return OpenAI(
        api_key=config["api_key"],
        base_url=config["base_url"],
    )


def get_default_model(settings: Optional[Settings] = None) -> str:
    """Get the default model for the current provider."""
    settings = settings or get_settings()
    config = settings.get_llm_client_config()
    return config["model_default"]


def get_enrichment_model(settings: Optional[Settings] = None) -> str:
    """Get the enrichment model for the current provider."""
    settings = settings or get_settings()
    config = settings.get_llm_client_config()
    return config["model_enrichment"]


def complete(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    enable_reasoning: bool = False,
    cache_key: Optional[str] = None,
    cache_ttl: int = 86400,
    settings: Optional[Settings] = None,
) -> str:
    """Complete a chat completion with the configured LLM.

    Args:
        messages: List of message dicts
        model: Model name or None for default
        temperature: Sampling temperature
        max_tokens: Max tokens in response
        enable_reasoning: Enable reasoning for supported models
        cache_key: Optional cache key for response caching
        cache_ttl: Cache TTL in seconds (default 24 hours)
        settings: Settings instance

    Returns:
        Response content string
    """
    settings = settings or get_settings()

    if cache_key:
        cached = cache.get(cache_key)
        if cached:
            logger.debug("Cache hit", cache_key=cache_key)
            return cached

    client = create_llm_client(settings)
    model = model or get_default_model(settings)

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if enable_reasoning and settings.llm_provider == "openrouter":
        kwargs["extra_body"] = {"reasoning": {"enabled": True}}

    response = client.chat.completions.create(**kwargs)
    message = response.choices[0].message

    content = ""
    if message.content:
        content = message.content
    elif hasattr(message, "reasoning_details") and message.reasoning_details:
        reasoning_text = ""
        for detail in message.reasoning_details:
            if isinstance(detail, dict):
                reasoning_text += detail.get("text", "") or ""
            elif hasattr(detail, "text"):
                reasoning_text += detail.text or ""

        if reasoning_text:
            import re

            final_match = re.search(
                r"(?:Final answer|Answer|Result|The answer is)[:\s]+(.+?)(?:\n|$)",
                reasoning_text,
                re.IGNORECASE,
            )
            if final_match:
                content = final_match.group(1).strip()
            else:
                lines = reasoning_text.strip().split("\n")
                content = lines[-1] if lines else reasoning_text
        else:
            content = str(message.reasoning_details)
    else:
        content = str(message)

    if cache_key and content:
        cache.set(cache_key, content, ttl=cache_ttl)

    usage = response.usage
    if usage:
        logger.info(
            "LLM call",
            model=model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            reasoning_enabled=enable_reasoning,
        )

    return content


def complete_with_reasoning(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1000,
    settings: Optional[Settings] = None,
) -> tuple[str, Optional[str]]:
    """Complete with reasoning, returning both content and reasoning.

    Args:
        messages: List of message dicts
        model: Model name
        temperature: Sampling temperature
        max_tokens: Max tokens
        settings: Settings instance

    Returns:
        Tuple of (content, reasoning_content)
    """
    settings = settings or get_settings()
    client = create_llm_client(settings)
    model = model or get_enrichment_model(settings)

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if settings.llm_provider == "openrouter":
        kwargs["extra_body"] = {"reasoning": {"enabled": True}}

    response = client.chat.completions.create(**kwargs)
    message = response.choices[0].message

    reasoning_content = None
    if hasattr(message, "reasoning_details") and message.reasoning_details:
        reasoning_parts = []
        for detail in message.reasoning_details:
            if isinstance(detail, dict):
                text = detail.get("text", "")
                if text:
                    reasoning_parts.append(text)
            elif hasattr(detail, "text") and detail.text:
                reasoning_parts.append(detail.text)
        reasoning_content = "\n".join(reasoning_parts) if reasoning_parts else None
    elif hasattr(message, "reasoning_content") and message.reasoning_content:
        reasoning_content = message.reasoning_content

    content = message.content or ""

    if not content and reasoning_content:
        import re

        final_match = re.search(
            r"(?:Final answer|Answer|Result|The answer is)[:\s]+(.+?)(?:\n|$)",
            reasoning_content,
            re.IGNORECASE,
        )
        if final_match:
            content = final_match.group(1).strip()
        else:
            lines = reasoning_content.strip().split("\n")
            content = lines[-1] if lines else ""

    usage = response.usage
    if usage:
        logger.info(
            "LLM call with reasoning",
            model=model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            has_reasoning=reasoning_content is not None,
        )

    return content, reasoning_content


def enrich(
    messages: list[dict],
    temperature: float = 0.8,
    max_tokens: int = 500,
    enable_reasoning: bool = True,
    settings: Optional[Settings] = None,
) -> str:
    """Complete with enrichment model (higher quality for creative tasks).

    Args:
        messages: List of message dicts
        temperature: Sampling temperature
        max_tokens: Max tokens
        enable_reasoning: Enable reasoning (default True for enrichment)
        settings: Settings instance

    Returns:
        Response content string
    """
    settings = settings or get_settings()
    model = get_enrichment_model(settings)
    return complete(
        messages=messages,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        enable_reasoning=enable_reasoning,
        settings=settings,
    )
