# Tech Debt Tracker

**Last Updated:** 2026-03-10

This document tracks known technical debt, prioritization, and remediation plans.

## Active Tech Debt

| ID | Description | Impact | Priority | Status | Target |
|----|-------------|--------|----------|--------|--------|
| - | No active tech debt (project in setup phase) | - | - | - | - |

## Potential Future Debt

| ID | Description | When to Address | Notes |
|----|-------------|-----------------|-------|
| TD-001 | No caching layer | When rate limits become issue | Start simple, add Redis if needed |
| TD-002 | No database persistence | When >100 locations needed | CSV sufficient for MVP |
| TD-003 | No CI/CD pipeline | When team grows | Manual testing acceptable for now |
| TD-004 | No API key rotation | When in production | Environment variables sufficient for dev |
| TD-005 | No monitoring/alerting | When running in production | Logs sufficient for MVP |

## Architecture Decisions to Revisit

### ADR-001: CSV Output Only
**Decision**: Use CSV as primary output format  
**Rationale**: Simple, portable, 50 locations is small  
**Revisit When**: Need >500 locations or query capabilities  
**Alternative**: SQLite database

### ADR-002: No Web Framework
**Decision**: Run as CLI scripts, not web service  
**Rationale**: Batch processing, not real-time  
**Revisit When**: Need scheduled runs or API access  
**Alternative**: FastAPI service with scheduler

### ADR-003: Python Over Node.js
**Decision**: Use Python for all scrapers and agents  
**Rationale**: Better ecosystem for scraping (PRAW, BeautifulSoup) and AI (LangChain)  
**Revisit When**: Need unified stack with frontend  
**Alternative**: TypeScript with equivalent libraries

### ADR-004: Separate Approaches
**Decision**: Keep AI, Scraper, and Hybrid as separate code paths  
**Rationale**: Different use cases, clear separation  
**Revisit When**: Code duplication becomes problematic  
**Alternative**: Unified pipeline with pluggable stages

## Remediation Log

| Date | ID | Action | Result |
|------|-----|--------|--------|
| - | - | No remediation yet | - |

---

**Process**:
1. Add new debt immediately when discovered
2. Review weekly
3. Prioritize P1/P2 items immediately
4. Archive resolved items to remediation log