# Design Decisions Index

**Last Updated**: 2026-03-10

## Active Decisions

| Decision | Status | Document | Summary |
|----------|--------|----------|---------|
| Reddit Scraping Method | ✅ Decided | [reddit-scraping-method.md](./reddit-scraping-method.md) | Use `.json` endpoint as primary, Apify as backup |
| Output Format | ✅ Decided | In master-spec.md | CSV with 16-column schema |
| Three-Approach Architecture | ✅ Decided | In ARCHITECTURE.md | Web Scraper, AI Agent, Hybrid |

## Decision Process

1. **Research alternatives** - Document in design doc
2. **Create decision matrix** - Compare pros/cons/cost
3. **Make decision** - Document rationale
4. **Implement** - Update relevant code
5. **Review** - Revisit if circumstances change

## Template for New Decisions

```markdown
# Design Decision: [Title]

**Date**: YYYY-MM-DD
**Status**: Proposed | Decided | Superseded
**Decision Makers**: Team

## Problem Statement
[What problem are we solving?]

## Decision
[What did we decide?]

## Alternatives Considered
[List alternatives with pros/cons]

## Rationale
[Why this decision?]

## Risks and Mitigations
[What could go wrong?]
```