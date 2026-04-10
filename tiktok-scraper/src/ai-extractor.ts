import { AiExtractedLocation } from './types.js';

const FALLBACK_MODELS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-4-maverick:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'qwen/qwen3-32b:free',
];

export class AiExtractor {
  private apiKey: string;
  private models: string[];

  constructor(apiKey: string, preferredModel?: string) {
    this.apiKey = apiKey;
    this.models = preferredModel
      ? [preferredModel, ...FALLBACK_MODELS.filter(m => m !== preferredModel)]
      : [...FALLBACK_MODELS];
  }

  async extractLocations(
    description: string,
    subtitles?: string,
  ): Promise<AiExtractedLocation[]> {
    const prompt = this.buildPrompt(description, subtitles);

    for (const model of this.models) {
      try {
        const result = await this.callModel(model, prompt);
        // Empty results count as failure — try the next model in the chain
        if (result.length > 0) return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.log(`  AI model ${model} failed: ${msg}`);
        continue;
      }
    }

    return [];
  }

  private buildPrompt(description: string, subtitles?: string): string {
    let prompt = `Extract any specific named places, restaurants, cafes, shops, parks, landmarks, museums, or other named locations mentioned in this text.

Return ONLY a valid JSON array of objects with "name" and "type" fields. Example: [{"name": "Central Perk Cafe", "type": "cafe"}]

Rules:
- Only include specific, named locations (not generic references like "a cafe" or "the park")
- Do not include city names, states, or countries
- Do not include hashtags as locations
- If no specific named locations are mentioned, return []

Video description: "${description}"`;

    if (subtitles) {
      prompt += `\n\nVideo captions/transcript: "${subtitles}"`;
    }

    return prompt;
  }

  private async callModel(
    model: string,
    prompt: string,
  ): Promise<AiExtractedLocation[]> {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://tiktok-scraper.local',
          'X-Title': 'TikTok Location Extractor',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 500,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`${response.status}: ${body.substring(0, 200)}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content || '';

    return this.parseResponse(content);
  }

  private parseResponse(content: string): AiExtractedLocation[] {
    // LLM response may contain markdown fences or explanatory text around the JSON array.
    // Extract just the array portion via regex rather than parsing the full response.
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (item: any) =>
            item && typeof item.name === 'string' && item.name.trim().length > 2,
        )
        .map((item: any) => ({
          name: (item.name as string).trim(),
          type: typeof item.type === 'string' ? item.type.trim() : 'unknown',
        }));
    } catch {
      return [];
    }
  }
}
