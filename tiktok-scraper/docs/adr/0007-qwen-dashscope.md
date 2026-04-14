# ADR-0007: Qwen via DashScope for AI Extraction

## Context

AI location extraction needs a reliable LLM API. The previous implementation used OpenRouter's free tier with a 4-model fallback chain, but hit frequent rate limits (429 errors) causing extraction failures.

The user has a DashScope API key for Qwen (Alibaba Cloud's LLM service).

## Decision

Switch to Qwen via DashScope international endpoint (`dashscope-intl.aliyuncs.com/compatible-mode/v1`) using the `qwen-plus` model. Use OpenAI-compatible API format.

## Why

- **Better availability**: DashScope has fewer rate limit issues than OpenRouter free tier
- **User-provided key**: User already has DashScope credentials
- **Query-guided extraction**: Including the search query in the prompt helps the model focus on relevant location types. This works better with a consistent model rather than fallback to different models with different behaviors
- **OpenAI-compatible**: DashScope's international endpoint uses OpenAI-compatible format, simplifying integration
- **Cost-effective**: Qwen pricing is competitive; `qwen-plus` balances quality and cost

## Implementation

- Endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`
- Model: `qwen-plus` (default, can be overridden)
- Prompt includes search query + video description + VTT subtitles
- Explicitly excludes neighborhoods/cities from extraction results
- Environment variable: `QWEN_API_KEY`

## Trade-offs

- **No fallback chain**: If Qwen fails, extraction returns empty (no retry with alternate models). This is simpler and matches the reality that fallback didn't help with OpenRouter anyway.
- **API key required**: Unlike OpenRouter free tier, requires a DashScope account. User has provided one.