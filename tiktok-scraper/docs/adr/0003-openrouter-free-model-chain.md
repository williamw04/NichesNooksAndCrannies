# ADR-0003: OpenRouter Free Model Chain

**Status: Superseded** — Replaced by ADR-0007 (Qwen via DashScope).

## Context

AI location extraction needs an LLM API. The scraper originally used multiple models from OpenRouter's free tier.

## Decision (Original)

Use a chain of free OpenRouter models with automatic fallback: `gemma-3-27b-it:free` → `llama-4-maverick:free` → `mistral-small-3.1-24b-instruct:free` → `qwen3-32b:free`. If a model fails or returns empty results, try the next one.

## Why Superseded

- OpenRouter free tier rate limits (429 errors) caused frequent extraction failures
- The fallback chain added complexity but didn't reliably avoid rate limits
- User provided DashScope API key for Qwen, which has better availability
- Query-guided prompts (including the search query in the extraction prompt) require consistent model behavior, not fallback to different models

## Replacement

See `src/ai-extractor.ts` for the current implementation using Qwen via DashScope.