# Core Beliefs

**Version:** 1.0  
**Last Updated:** 2026-03-10

These are the foundational principles that guide all development in this repository.

## 1. Data Integrity Over Convenience

**Belief**: Never fabricate data. If it can't be verified, leave it null.

**Implications**:
- All coordinates must be validated against Google Maps
- All gem level 3 locations must have verifiable community sources
- Missing data is better than fake data
- Source URLs are required for provenance

**Enforcement**:
- Validation tests on all output data
- Coordinate verification before commit
- Source tracking for all gem level 3 locations

## 2. No Chains or Franchises

**Belief**: Hidden gems are unique, local spots—not corporate chains.

**Implications**:
- Chain detection in validation pipeline
- Only original/iconic locations allowed (e.g., original Starbucks in Seattle)
- Franchise locations automatically rejected

**Enforcement**:
- Chain name blacklist
- Google Maps business type check
- Manual review for edge cases

## 3. Quality Over Quantity

**Belief**: 50 excellent locations > 500 mediocre ones.

**Implications**:
- Descriptions must have personality (pass "friend test")
- AI vibe summaries must be evocative, not generic
- Tags should be varied and vibe-focused
- Each location should feel like a real recommendation

**Enforcement**:
- Description quality checks
- Vibe summary uniqueness validation
- Tag diversity metrics

## 4. Progressive Disclosure in Architecture

**Belief**: Start simple, add complexity only when needed.

**Implications**:
- Web scraper approach before AI agent
- Single CSV output before database
- Simple scripts before frameworks
- Manual testing before automated pipelines

**Enforcement**:
- Architecture reviews before adding dependencies
- "Why not simpler?" question in PRs
- Document alternatives considered

## 5. Parse, Don't Probe

**Belief**: Validate data at boundaries with explicit schemas.

**Implications**:
- All API responses validated with Pydantic
- All scraped data parsed through schemas
- No optional chaining on external data
- Explicit error handling for malformed data

**Examples**:
```python
# ✅ CORRECT: Parse with schema
from pydantic import BaseModel

class RedditPost(BaseModel):
    title: str
    url: str
    score: int
    subreddit: str

post = RedditPost.parse_obj(api_response)

# ❌ WRONG: Probe and hope
title = api_response.get('title', '')
```

## 6. Source Diversity

**Belief**: Hidden gems are found in diverse sources, not just Google Maps.

**Implications**:
- Reddit is the primary source for gem level 3
- Atlas Obscura for unique/historical spots
- Local blogs for neighborhood favorites
- Google Maps for validation and enrichment, not discovery

**Enforcement**:
- Track source provenance per location
- Require multiple sources for gem level 3
- Score based on source quality

## 7. Cost Awareness

**Belief**: Every API call costs money. Be intentional.

**Implications**:
- Cache aggressively
- Batch requests when possible
- Use free tiers before paid
- GPT-3.5 for simple tasks, GPT-4 for enrichment only

**Enforcement**:
- Cost tracking per run
- Rate limiting on all external APIs
- Monthly cost review

## 8. Deterministic Where Possible

**Belief**: Reproducible results build trust.

**Implications**:
- Web scraper approach is deterministic
- AI agent approach requires acceptance of variability
- Hybrid combines best of both
- Seed random for reproducibility

**Enforcement**:
- Pin dependency versions
- Document random seeds
- Version control for prompts

## 9. Test Real Scenarios

**Belief**: Tests should validate against real-world expectations.

**Implications**:
- Integration tests with real API responses (recorded)
- Output validation against known good locations
- Gem distribution tests
- Description quality spot checks

**Enforcement**:
- Recorded API responses in tests
- Sample locations for validation
- Manual review before final output

## 10. Documentation is Code

**Belief**: If it's not documented, it doesn't exist.

**Implications**:
- All approaches documented in `docs/product-specs/`
- All architectural decisions in `docs/design-docs/`
- All execution plans tracked in `docs/exec-plans/`
- AGENTS.md is the entry point

**Enforcement**:
- PR requires doc updates
- Stale doc checks in CI
- Cross-references validated

## Application

### When Adding a New Scraper
1. Does it respect rate limits? (Cost awareness)
2. Does it validate responses? (Parse, don't probe)
3. Does it track sources? (Source diversity)
4. Is it tested? (Test real scenarios)

### When Adding AI Components
1. Is it necessary or could a scraper work? (Progressive disclosure)
2. Is cost acceptable? (Cost awareness)
3. Can results be validated? (Data integrity)
4. Is it documented? (Documentation is code)

### When Reviewing Output
1. Any fabricated data? (Data integrity)
2. Any chains? (No chains)
3. Do descriptions have personality? (Quality over quantity)
4. Is gem distribution correct? (Data quality metrics)

## Evolution

These beliefs evolve as we learn:

**Process for updating**:
1. Propose change in `docs/design-docs/`
2. Discuss with team
3. Update this document
4. Update enforcement mechanisms

---

**Remember**: These beliefs guide every decision. When in doubt, refer back to these principles.
