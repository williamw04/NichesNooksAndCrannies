# AI Extractor

## Purpose

Extracts named locations from TikTok video descriptions and captions using OpenRouter's LLM API. Falls back through multiple free models if the preferred one fails.

## Key Methods

- `extractLocations(description, subtitles?)`: Extracts named locations from text using AI, with model fallback chain (`ai-extractor.ts:21`)
- `callModel(model, prompt)`: Calls a single OpenRouter model and parses the response (`ai-extractor.ts:61`)
- `parseResponse(content)`: Extracts JSON array from LLM response text, filtering for valid locations (`ai-extractor.ts:95`)

## How It Works

1. Builds a prompt asking the LLM to extract specific named locations from video description and optional subtitles
2. Calls the preferred model first, then falls back through a chain of free models if any fails
3. Parses the LLM response by extracting the first JSON array from the response text
4. Filters results to only include locations with names longer than 2 characters

## Weird Details

- **Response parsing via regex**: The LLM response may contain markdown formatting, explanatory text, or code fences around the JSON array. `parseResponse` uses `content.match(/\[[\s\S]*?\]/)` to extract just the array portion rather than trying to parse the full response (`ai-extractor.ts:96`)
- **Four-model fallback chain**: Falls back through `gemma-3-27b-it:free` → `llama-4-maverick:free` → `mistral-small-3.1-24b-instruct:free` → `qwen3-32b:free`. If the preferred model is one of these, it's moved to the front of the chain (`ai-extractor.ts:3-8`)
- **Empty results trigger fallback**: A model "fails" if it returns an empty array — the code tries the next model even on HTTP success (`ai-extractor.ts:30`)

## Source

- Main file: `src/ai-extractor.ts`
- Types: `src/types.ts` (`AiExtractedLocation`)
