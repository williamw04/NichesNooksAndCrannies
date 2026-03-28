# OpenRouter Setup Guide

OpenRouter provides access to many LLMs through an OpenAI-compatible API, including free models.

## Setup

### 1. Get API Key

1. Go to https://openrouter.ai/
2. Sign up / Log in
3. Go to https://openrouter.ai/keys
4. Create a new API key (starts with `sk-or-`)

### 2. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your OpenRouter key
nano .env
```

Set these values:
```bash
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-your-key-here
```

### 3. Install Dependencies

```bash
# Activate virtual environment
source .venv/bin/activate

# Install AI agent dependencies
pip install openai
```

### 4. Test

```bash
python test_openrouter.py
```

---

## Free Models

| Model | Notes |
|-------|-------|
| `stepfun/step-3.5-flash:free` | Good reasoning, supports step-by-step thinking |
| `meta-llama/llama-3.2-3b-instruct:free` | Meta's Llama 3.2 (3B parameters) |
| `qwen/qwen-2-7b-instruct:free` | Qwen 2 (7B parameters) |
| `google/gemma-2-9b-it:free` | Google's Gemma 2 (9B parameters) |

---

## Cheap Models

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| `openai/gpt-4o-mini` | $0.15/1M | $0.60/1M | OpenAI's cheapest |
| `meta-llama/llama-3.1-8b-instruct` | $0.055/1M | $0.055/1M | Very cheap |
| `anthropic/claude-3.5-sonnet` | $3/1M | $15/1M | Best quality |

---

## Usage in Code

```python
from src.approaches.ai_agent.utils.llm_client import complete, enrich

# Simple completion
response = complete(
    messages=[{"role": "user", "content": "What's a hidden gem in NYC?"}],
)

# Enrichment (creative writing)
description = enrich(
    messages=[{"role": "user", "content": "Write a description for Joe's Pizza in NYC"}],
)

# With reasoning (for Step models)
response = complete(
    messages=[{"role": "user", "content": "Think step by step: best pizza in NYC?"}],
    enable_reasoning=True,
    model="stepfun/step-3.5-flash:free",
)
```

---

## Cost Estimates

For 50 locations with free models:
- Discovery: Free
- Validation: Free  
- Enrichment: Free
- **Total: $0**

For 50 locations with cheap models:
- Discovery (gpt-4o-mini): ~$0.05
- Validation (gpt-4o-mini): ~$0.03
- Enrichment (claude-3.5-sonnet): ~$0.50
- **Total: ~$0.58**

---

## Model Selection Tips

| Task | Recommended Model |
|------|-------------------|
| Discovery (finding locations) | `meta-llama/llama-3.2-3b-instruct:free` |
| Validation (checking data) | `meta-llama/llama-3.2-3b-instruct:free` |
| Enrichment (creative writing) | `stepfun/step-3.5-flash:free` or `openai/gpt-4o-mini` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Check your API key is correct |
| `Model not found` | Check model name matches exactly |
| `Rate limited` | Free models have rate limits, wait and retry |
| `Timeout` | Increase timeout or use a faster model |