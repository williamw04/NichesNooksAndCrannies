# ADR-0003: OpenRouter Free Model Chain

## Context

AI location extraction needs an LLM API. The scraper uses multiple models from OpenRouter's free tier.

## Decision

Use a chain of free OpenRouter models with automatic fallback: `gemma-3-27b-it:free` → `llama-4-maverick:free` → `mistral-small-3.1-24b-instruct:free` → `qwen3-32b:free`. If a model fails or returns empty results, try the next one.

## Why

[NEEDS HUMAN INPUT]

Observable benefits:
- Zero cost for AI extraction
- Resilience against any single model being down or rate-limited
- Preferred model can be overridden via config while keeping the fallback chain
