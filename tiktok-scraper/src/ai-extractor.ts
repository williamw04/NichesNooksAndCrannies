import { AiExtractedLocation } from './types.js';

const DASHSCOPE_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-plus';

export class AiExtractor {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, options?: { baseUrl?: string; model?: string }) {
    this.apiKey = apiKey;
    this.baseUrl = options?.baseUrl || DASHSCOPE_BASE_URL;
    this.model = options?.model || DEFAULT_MODEL;
  }

  async extractLocations(
    query: string,
    description: string,
    subtitles?: string,
  ): Promise<AiExtractedLocation[]> {
    const prompt = this.buildPrompt(query, description, subtitles);

    try {
      const result = await this.callModel(prompt);
      if (result.length > 0) return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.log(`  AI extraction failed: ${msg}`);
    }

    return [];
  }

  async extractTags(query: string): Promise<string[]> {
    const prompt = `Generate 5-10 TikTok hashtag suggestions for finding videos about: "${query}"

Return ONLY a valid JSON array of strings. Each string should be a TikTok hashtag without the # symbol. Example: ["nyc cafes", "manhattancoffee", "coffeetok"]

Rules:
- Tags should be popular/widely-used hashtags that real TikTok users would tag their videos with
- Include both broad tags (e.g. "coffeetok") and specific tags (e.g. "nyccafe")
- All lowercase, no spaces or special characters within each tag
- No # prefix
- If the query mentions a city, include city-specific tags`;

    try {
      const response = await fetch(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 300,
          }),
        },
      );

      if (!response.ok) return [];
      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      const tags = parsed
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .map((t: string) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter((t: string) => t.length > 0);

      if (tags.length > 0) return tags;
    } catch {
      // fall through
    }

    return [];
  }

  private buildPrompt(query: string, description: string, subtitles?: string): string {
    return `You are extracting specific named businesses and locations from TikTok videos.

The goal: find the actual places (stores, restaurants, cafes, etc.) featured in videos found by the search query "${query}".

The query tells you what type of places to look for. Use it to disambiguate vague references and guide extraction toward specific venue names.

Return ONLY a valid JSON array of objects with "name" and "type" fields.
Example: [{"name": "Abraço", "type": "cafe"}, {"name": "Devocion Coffee", "type": "cafe"}]

Rules:
- Extract only SPECIFIC, NAMED business/venue names (e.g. "Joe's Pizza", "Devocion Coffee")
- Do NOT extract neighborhoods, cities, boroughs, or areas (e.g. "West Village", "NYC", "Manhattan")
- Do NOT extract generic references (e.g. "a cafe", "this place", "the park")
- Do NOT extract hashtags as locations
- If the text mentions a specific business name, extract it even if it appears informal or abbreviated
- If no specific named businesses/venues are found, return []
- Use the query "${query}" to understand context and what types of places to look for

Video description: "${description}"${
      subtitles ? `\n\nVideo captions/transcript: "${subtitles}"` : ''
    }`;
  }

  private async callModel(prompt: string): Promise<AiExtractedLocation[]> {
    const response = await fetch(
      `${this.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
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
