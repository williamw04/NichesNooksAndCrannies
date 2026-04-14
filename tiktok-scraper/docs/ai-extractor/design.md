# AI Extractor

## Purpose

Extracts named locations from TikTok video descriptions and captions using Qwen via DashScope (Alibaba Cloud). The search query is included in the prompt to guide the model toward the right type of locations.

## Key Methods

- `extractLocations(query, description, subtitles?)`: Extracts named locations from text using Qwen, with search query context (`ai-extractor.ts:21`)
- `extractTags(query)`: Generates TikTok hashtags from a search query (`ai-extractor.ts:42`)
- `callModel(prompt)`: Calls Qwen API and parses the response (`ai-extractor.ts:119`)
- `parseResponse(content)`: Extracts JSON array from LLM response text, filtering for valid locations (`ai-extractor.ts:153`)

## How It Works

1. Builds a prompt that includes the search query, video description, and optional VTT subtitles
2. Calls `qwen-plus` via DashScope's OpenAI-compatible endpoint
3. Parses the LLM response by extracting the first JSON array from the response text
4. Filters results to only include locations with names longer than 2 characters

## Weird Details

- **Response parsing via regex**: The LLM response may contain markdown formatting, explanatory text, or code fences around the JSON array. `parseResponse` uses `content.match(/\[[\s\S]*?\]/)` to extract just the array portion rather than trying to parse the full response (`ai-extractor.ts:156`)
- **Query-guided extraction**: The prompt explicitly includes the search query so the model knows what type of places to look for. For example, a query like "best coffee shops nyc" helps disambiguate vague references and focus on cafe/restaurant names (`ai-extractor.ts:78`)
- **Excludes neighborhoods**: The prompt explicitly instructs the model NOT to extract neighborhoods, cities, or areas — only specific named businesses/venues (`ai-extractor.ts:88`)
- **Single model, no fallback**: Unlike the previous OpenRouter implementation with 4-model fallback chain, Qwen is used directly without fallback. Rate limiting is handled gracefully with empty results.

## Source

- Main file: `src/ai-extractor.ts`
- Types: `src/types.ts` (`AiExtractedLocation`)
- API: DashScope international endpoint (`dashscope-intl.aliyuncs.com/compatible-mode/v1`)