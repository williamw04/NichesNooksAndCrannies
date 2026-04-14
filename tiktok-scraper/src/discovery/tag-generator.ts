const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'of', 'to', 'for', 'and', 'or',
  'is', 'are', 'was', 'were', 'be', 'been', 'with', 'from', 'by',
  'best', 'top', 'most', 'my', 'your', 'our', 'good', 'great', 'really',
  'places', 'place', 'spots', 'spot', 'find', 'near', 'around', 'go',
  'must', 'visit', 'thing', 'things', 'can', 'you', 'how', 'what',
  'where', 'when', 'why', 'this', 'that', 'it',
]);

function queryToTag(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .join('');
}

function queryToKebab(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0)
    .join('-');
}

export interface TagCandidate {
  tag: string;
  url: string;
  source: 'heuristic' | 'ai';
}

function heuristicTags(query: string, city?: string): TagCandidate[] {
  const candidates: TagCandidate[] = [];
  const words = query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const meaningfulWords = words.filter(w => !STOP_WORDS.has(w));

  // Full query as tag: "hidden gems nyc" -> "hiddengemsnyc"
  candidates.push({
    tag: queryToTag(query),
    url: `https://www.tiktok.com/tag/${queryToTag(query)}`,
    source: 'heuristic',
  });

  // Meaningful words only: "hidden gems nyc" -> "hiddengems"
  if (meaningfulWords.length < words.length) {
    const meaningfulTag = meaningfulWords.join('');
    if (meaningfulTag.length > 2 && meaningfulTag !== candidates[0].tag) {
      candidates.push({
        tag: meaningfulTag,
        url: `https://www.tiktok.com/tag/${meaningfulTag}`,
        source: 'heuristic',
      });
    }
  }

  // City + meaningful words: "nyc" + "hiddengems" -> "nychiddengems"
  if (city) {
    const cityLower = city.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cityTag = cityLower + meaningfulWords.join('');
    if (cityTag !== candidates[0].tag && cityTag.length > cityLower.length) {
      candidates.push({
        tag: cityTag,
        url: `https://www.tiktok.com/tag/${cityTag}`,
        source: 'heuristic',
      });
    }

    // Meaningful + city: "hiddengems" + "nyc" -> "hiddengemsnyc"
    const tagCity = meaningfulWords.join('') + cityLower;
    if (tagCity !== candidates[0].tag && tagCity !== cityTag) {
      candidates.push({
        tag: tagCity,
        url: `https://www.tiktok.com/tag/${tagCity}`,
        source: 'heuristic',
      });
    }
  }

  // Deduplicate by tag
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.tag)) return false;
    seen.add(c.tag);
    return true;
  });
}

export interface DiscoverCandidate {
  slug: string;
  url: string;
}

function heuristicDiscoverUrls(query: string, city?: string): DiscoverCandidate[] {
  const candidates: DiscoverCandidate[] = [];
  const kebab = queryToKebab(query);

  // Simple kebab: "hidden gems nyc" -> "hidden-gems-nyc"
  candidates.push({
    slug: kebab,
    url: `https://www.tiktok.com/discover/${kebab}`,
  });

  // Without city suffix if query contains city
  if (city) {
    const cityKebab = city.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const withoutCity = kebab.replace(new RegExp(`-?${cityKebab}-?$`), '').replace(/-+$/, '');
    if (withoutCity && withoutCity !== kebab) {
      candidates.push({
        slug: withoutCity,
        url: `https://www.tiktok.com/discover/${withoutCity}`,
      });
    }
  }

  return candidates;
}

export async function generateTags(
  query: string,
  city?: string,
  aiExtractor?: { extractTags(query: string): Promise<string[]> } | null,
): Promise<TagCandidate[]> {
  const heuristic = heuristicTags(query, city);

  if (aiExtractor) {
    try {
      const aiTags = await aiExtractor.extractTags(query);
      const aiCandidates: TagCandidate[] = aiTags.map(tag => ({
        tag,
        url: `https://www.tiktok.com/tag/${tag}`,
        source: 'ai' as const,
      }));

      const seen = new Set(heuristic.map(h => h.tag));
      const uniqueAi = aiCandidates.filter(c => !seen.has(c.tag));
      return [...heuristic, ...uniqueAi];
    } catch {
      return heuristic;
    }
  }

  return heuristic;
}

export function generateDiscoverUrls(query: string, city?: string): DiscoverCandidate[] {
  return heuristicDiscoverUrls(query, city);
}
