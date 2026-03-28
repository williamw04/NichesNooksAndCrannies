"""Test OpenRouter integration."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.approaches.ai_agent.config.settings import get_settings
from src.approaches.ai_agent.utils.llm_client import (
    complete,
    create_llm_client,
    get_default_model,
    get_enrichment_model,
)


def test_openrouter():
    """Test OpenRouter integration."""
    settings = get_settings()

    print(f"LLM Provider: {settings.llm_provider}")
    print(f"Default Model: {get_default_model(settings)}")
    print(f"Enrichment Model: {get_enrichment_model(settings)}")
    print(f"Is Free Model: {settings.is_free_model(get_default_model(settings))}")
    print()

    # Test simple completion
    print("Testing simple completion...")
    response = complete(
        messages=[{"role": "user", "content": "Say 'Hello, NYC!' in exactly that format."}],
        max_tokens=50,
        settings=settings,
    )
    print(f"Response: {response}")
    print()

    # Test with reasoning disabled (more reliable)
    print("Testing without reasoning...")
    response2 = complete(
        messages=[{"role": "user", "content": "Name one pizza place in NYC."}],
        max_tokens=100,
        enable_reasoning=False,
        settings=settings,
    )
    print(f"Response: {response2}")

    # Test reasoning (for Step models)
    if "stepfun" in get_default_model(settings):
        print("Testing reasoning-enabled completion...")
        response = complete(
            messages=[
                {"role": "user", "content": "How many r's are in 'strawberry'? Think carefully."}
            ],
            max_tokens=500,
            enable_reasoning=True,
            settings=settings,
        )
        print(f"Response: {response}")
        print()


if __name__ == "__main__":
    test_openrouter()
