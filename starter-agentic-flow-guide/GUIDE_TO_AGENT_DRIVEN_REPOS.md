# Guide to Agent-Driven Repository Setup

## Table of Contents
1. [Philosophy](#philosophy)
2. [Writing an Effective AGENTS.md](#writing-an-effective-agentsmd)
3. [Repository Structure](#repository-structure)
4. [Documentation Standards](#documentation-standards)
5. [Enforcement Mechanisms](#enforcement-mechanisms)
6. [Getting Started Checklist](#getting-started-checklist)

---

## Philosophy

### Core Principle: Repository as System of Record
Everything the agent needs to know must be IN the repository. Google Docs, Slack threads, and tribal knowledge don't exist from the agent's perspective.

### The Map vs. Manual Problem
**Anti-pattern**: One massive AGENTS.md file with every rule and instruction (becomes stale, crowds out context, and is hard to maintain)

**Better approach**: Short AGENTS.md as a "table of contents" that points to structured, versioned documentation

### Progressive Disclosure
Agents should:
1. Start with AGENTS.md (the map)
2. Navigate to relevant docs for their specific task
3. Pull in only the context they need

This prevents overwhelming the context window and keeps information focused.

---

## Writing an Effective AGENTS.md

### Keep It Under 150 Lines
Your AGENTS.md should be scannable in one read. If it's getting longer, you're putting too much detail in the map instead of the documentation.

### Essential Sections

#### 1. Purpose Statement (2-3 lines)
What this file does and doesn't do.

```markdown
## Purpose
This file serves as your navigation map. It points you to the right context 
for your current task. This is NOT a comprehensive instruction manual—it's 
a table of contents.
```

#### 2. Core Principles (5-7 bullets)
Foundational truths that shape how agents should think about the codebase.

```markdown
## Core Principles
1. **Repository as System of Record**: If it's not in this repository, it doesn't exist.
2. **Progressive Disclosure**: Start here, then navigate to specific docs.
3. **Mechanical Enforcement**: Architectural rules are enforced by linters.
4. **Documentation is Code**: All docs are versioned and kept current.
```

#### 3. Getting Started Flow
Step-by-step first actions for new work.

```markdown
### Before Starting Work
1. Identify the affected domain(s) from ARCHITECTURE.md
2. Check docs/QUALITY_SCORE.md for current quality baseline
3. Review relevant product specs in docs/product-specs/
```

#### 4. Navigation Table
Quick reference showing where to find specific types of information.

```markdown
| Need | Location |
|------|----------|
| What to build | docs/product-specs/ |
| Why it's designed this way | docs/design-docs/ |
| How the system is organized | ARCHITECTURE.md |
```

#### 5. Key Constraints (High-Level Only)
Critical rules that affect all work. Details go in referenced docs.

```markdown
### Architectural Layers
Dependencies must flow: Types → Config → Repo → Service → Runtime → UI
(See ARCHITECTURE.md for enforcement details)
```

### What NOT to Include

❌ **Detailed implementation instructions** → Put in `docs/DESIGN.md` or domain-specific docs  
❌ **Full API references** → Put in `docs/references/`  
❌ **Long lists of coding standards** → Encode in linters or put in `docs/QUALITY_SCORE.md`  
❌ **Product specifications** → Put in `docs/product-specs/`  
❌ **Historical context** → Put in `docs/design-docs/` with decision rationale

### Anti-Patterns to Avoid

**The Encyclopedia**: 1000+ line AGENTS.md with every rule
- Problem: Crowds out task context, becomes stale, agents can't navigate

**The Vague Map**: "See the docs folder for more info"
- Problem: Agent doesn't know which docs to read for their specific task

**The Micromanager**: Step-by-step instructions for every possible task
- Problem: Brittle, high maintenance, limits agent autonomy

**The Graveyard**: Outdated rules that contradict current code
- Problem: Agents get confused, can't tell what's current

---

## Repository Structure

### Recommended Layout

```
/
├── AGENTS.md                    # Entry point (100-150 lines)
├── ARCHITECTURE.md              # System-wide domain map and layers
├── README.md                    # Human-facing project overview
├── package.json / pyproject.toml
├── docs/
│   ├── design-docs/
│   │   ├── index.md            # Catalog of all design decisions
│   │   ├── core-beliefs.md     # Foundational principles
│   │   ├── auth-system.md      # Example: specific design decisions
│   │   └── ...
│   ├── product-specs/
│   │   ├── index.md            # Catalog of all features
│   │   ├── user-onboarding.md
│   │   ├── payment-flow.md
│   │   └── ...
│   ├── exec-plans/
│   │   ├── active/
│   │   │   └── migrate-to-postgres.md
│   │   ├── completed/
│   │   │   └── initial-scaffold.md
│   │   └── tech-debt-tracker.md
│   ├── references/
│   │   ├── design-system-reference.md
│   │   ├── react-best-practices.md
│   │   └── ...
│   ├── generated/              # Auto-generated reference docs
│   │   └── db-schema.md
│   ├── DESIGN.md               # Architectural patterns
│   ├── FRONTEND.md             # Frontend-specific patterns
│   ├── QUALITY_SCORE.md        # Quality metrics by domain
│   ├── SECURITY.md             # Security patterns and requirements
│   └── RELIABILITY.md          # Error handling, observability
├── src/
│   ├── domains/
│   │   ├── auth/
│   │   ├── billing/
│   │   └── ...
└── tests/
```

### Key Documentation Files

#### ARCHITECTURE.md
Maps out:
- Business domains (auth, billing, analytics, etc.)
- Layer structure within each domain
- Dependency rules between domains
- Package organization

Example structure:
```markdown
# Architecture

## Domains
- **Auth**: User authentication, session management
- **Billing**: Payment processing, subscription management
- **Analytics**: Event tracking, reporting

## Layer Structure
Within each domain:
Types → Config → Repo → Service → Runtime → UI

## Cross-Domain Dependencies
Auth → All domains (via Providers)
Billing → Analytics (for event tracking)
```

#### docs/QUALITY_SCORE.md
Tracks quality metrics over time:
```markdown
# Quality Scorecard

## Grading Scale
A: >90% coverage, full observability, <2s response times
B: >80% coverage, basic observability, <5s response times
C: >60% coverage, minimal observability
D: <60% coverage

## Current Scores (Updated: 2026-02-13)

| Domain | Test Coverage | Observability | Performance | Grade |
|--------|---------------|---------------|-------------|-------|
| Auth   | 95%           | Full          | <1s         | A     |
| Billing| 82%           | Basic         | <3s         | B     |
```

#### docs/product-specs/[feature].md
Template for feature specifications:
```markdown
# Feature: User Onboarding

## User Story
As a new user, I want to complete initial setup in <5 minutes so that 
I can start using the product quickly.

## Acceptance Criteria
- [ ] User can create account with email/password
- [ ] Email verification required before full access
- [ ] Optional profile setup (can skip)
- [ ] Guided tour of key features

## Success Metrics
- 90% of users complete signup within 3 minutes
- 70% of users complete optional profile setup
- <2% drop-off rate during onboarding

## Design References
- See: docs/design-docs/onboarding-flow.md
- Figma: [link to designs]

## Implementation Notes
- Uses Auth domain for account creation
- Analytics events: signup_started, signup_completed, profile_completed
```

#### docs/design-docs/[decision].md
Template for design decisions:
```markdown
# Design Decision: Authentication System

## Problem Statement
We need to handle user authentication with support for email/password, 
OAuth, and future MFA requirements.

## Decision
Implement JWT-based authentication with refresh tokens, using 
industry-standard libraries (passport.js).

## Rationale
- JWT allows stateless authentication
- Refresh tokens provide security with good UX
- Passport.js is well-tested and supports multiple strategies

## Alternatives Considered
1. **Session-based auth**: Rejected due to scaling concerns
2. **Third-party auth service (Auth0)**: Rejected due to cost and vendor lock-in

## Implementation Requirements
- Access tokens: 15min lifetime
- Refresh tokens: 30 day lifetime, rotated on use
- All tokens signed with RS256
- Rate limiting on auth endpoints

## Verification Status
✅ Implemented (2025-09-15)
✅ Documented (2025-09-16)
✅ Tests passing (coverage: 94%)
```

#### docs/exec-plans/active/[initiative].md
Template for execution plans:
```markdown
# Execution Plan: Migration to PostgreSQL

## Goal
Migrate from SQLite to PostgreSQL for production scalability

## Success Criteria
- Zero data loss during migration
- <5min downtime window
- All tests passing against Postgres
- Performance maintained or improved

## Progress Tracker
- [x] Phase 1: Setup Postgres in dev environments (2025-11-01)
- [x] Phase 2: Dual-write to both databases (2025-11-10)
- [ ] Phase 3: Migrate read queries (In Progress)
- [ ] Phase 4: Cutover to Postgres primary (Target: 2025-12-01)
- [ ] Phase 5: Remove SQLite dependencies

## Decision Log
**2025-11-05**: Chose Prisma ORM for type safety and migrations  
**2025-11-12**: Added connection pooling with pg-pool (max 20 connections)

## Blockers
None currently

## Rollback Plan
Keep SQLite dependencies until Phase 5. Can rollback by switching 
DATABASE_URL environment variable.
```

---

## Documentation Standards

### Indexing and Cross-Linking

Every major documentation directory should have an `index.md`:

```markdown
# Design Decisions Index

Last updated: 2026-02-13

## Active Decisions
- [Authentication System](./auth-system.md) - JWT-based auth with refresh tokens
- [Database Strategy](./database-strategy.md) - PostgreSQL migration plan
- [API Versioning](./api-versioning.md) - URL-based versioning approach

## Superseded Decisions
- [Session-based Auth](./archive/session-auth.md) - Replaced by JWT (2025-09)
```

### Freshness Tracking

Include "Last Updated" dates and verification status:
```markdown
**Status**: ✅ Current (verified 2026-02-13)
**Owner**: @backend-team
**Related**: docs/product-specs/authentication.md
```

### LLM-Optimized Reference Docs

For third-party libraries, create condensed references in `docs/references/`:

**Example: docs/references/zod-llms.txt**
```
Zod Schema Validation - Quick Reference for LLMs

Basic Types:
z.string(), z.number(), z.boolean(), z.date()

Validation:
z.string().min(3).max(100).email()
z.number().int().positive().max(100)

Objects:
const UserSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  email: z.string().email()
})

Arrays:
z.array(z.string())

Parsing:
UserSchema.parse(data) // throws on invalid
UserSchema.safeParse(data) // returns {success, data, error}

[Common patterns follow...]
```

### Generated Documentation

Some docs should be auto-generated and kept in `docs/generated/`:
- Database schemas
- API endpoints
- Type definitions
- Dependency graphs

Mark these clearly:
```markdown
<!-- AUTO-GENERATED - DO NOT EDIT MANUALLY -->
<!-- Generated: 2026-02-13 08:30:00 UTC -->
<!-- Generator: scripts/generate-db-schema.ts -->
```

---

## Enforcement Mechanisms

### 1. Custom Linters

Create project-specific ESLint rules or custom linters:

**Example: Layer Dependency Linter**
```javascript
// tools/lint-architecture.js
// Enforces: Types → Config → Repo → Service → Runtime → UI

const allowedImports = {
  types: [],
  config: ['types'],
  repo: ['types', 'config'],
  service: ['types', 'config', 'repo'],
  runtime: ['types', 'config', 'repo', 'service'],
  ui: ['types', 'config', 'repo', 'service', 'runtime']
};

// Check imports and fail if violation detected
// Error messages include remediation guidance
```

**Error message format**:
```
Error: Invalid import in src/domains/auth/service/login.ts
  Import from 'runtime' layer not allowed in 'service' layer
  
  Fix: Move this logic to runtime/ or extract shared code to repo/
  Reference: See ARCHITECTURE.md section "Layer Dependencies"
```

### 2. Structural Tests

Write tests that validate architecture:

```javascript
// tests/architecture.test.ts
describe('Architecture Enforcement', () => {
  it('should not allow UI to import from other domains', () => {
    const uiFiles = glob.sync('src/domains/*/ui/**/*.ts');
    uiFiles.forEach(file => {
      const imports = getImports(file);
      const crossDomainImports = imports.filter(i => 
        i.includes('src/domains/') && !i.includes(getDomain(file))
      );
      expect(crossDomainImports).toEqual([]);
    });
  });
});
```

### 3. Documentation Freshness CI

```yaml
# .github/workflows/doc-freshness.yml
name: Documentation Freshness

on: [push, pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate doc structure
        run: |
          # Check all indices are up to date
          node scripts/validate-doc-indices.js
          
          # Check for broken cross-links
          node scripts/check-doc-links.js
          
          # Verify generated docs are current
          node scripts/verify-generated-docs.js
```

### 4. Automated Doc Gardening

Run a scheduled agent task:

```javascript
// scripts/doc-gardening.js
// Runs daily to check for:
// - Stale dates (>30 days old)
// - Missing cross-references
// - Outdated code examples
// - Inconsistent formatting
//
// Opens PRs with fixes automatically
```

### 5. Pre-commit Hooks

```bash
# .husky/pre-commit
npm run lint:architecture
npm run test:structural
npm run validate:docs
```

---

## Getting Started Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create initial AGENTS.md (100-150 lines max)
- [ ] Create ARCHITECTURE.md with domain map
- [ ] Set up docs/ directory structure
- [ ] Write docs/DESIGN.md with core patterns
- [ ] Create docs/QUALITY_SCORE.md template

### Phase 2: Product Documentation (Week 2)
- [ ] Create docs/product-specs/index.md
- [ ] Document 3-5 core features in product-specs/
- [ ] Create docs/design-docs/core-beliefs.md
- [ ] Document 2-3 key architectural decisions

### Phase 3: Quality Infrastructure (Week 3)
- [ ] Implement basic architectural linters
- [ ] Add structural tests for layer dependencies
- [ ] Create doc freshness validation script
- [ ] Set up CI for documentation checks

### Phase 4: Advanced Features (Week 4)
- [ ] Implement automated doc gardening
- [ ] Create LLM-optimized reference docs
- [ ] Set up execution plan tracking
- [ ] Create tech debt tracker

### Phase 5: Iteration (Ongoing)
- [ ] Review and update AGENTS.md monthly
- [ ] Archive superseded design docs
- [ ] Update quality scores weekly
- [ ] Run doc gardening agent daily

---

## Common Pitfalls and Solutions

### Pitfall 1: AGENTS.md Bloat
**Problem**: File grows to 500+ lines with every rule and instruction

**Solution**: 
- Keep AGENTS.md under 150 lines
- Move detailed instructions to referenced docs
- Use the "table of contents" mental model

### Pitfall 2: Documentation Rot
**Problem**: Docs become stale as code evolves

**Solution**:
- Mechanical freshness checks in CI
- Automated doc gardening agent
- Link docs to code via structural tests
- Make doc updates part of PR requirements

### Pitfall 3: Context Overload
**Problem**: Agent gets overwhelmed with too much documentation at once

**Solution**:
- Use progressive disclosure
- Start with AGENTS.md map
- Navigate to specific docs as needed
- Keep individual docs focused (<500 lines)

### Pitfall 4: Vague Constraints
**Problem**: Rules like "use good patterns" aren't actionable

**Solution**:
- Make rules mechanical and checkable
- Provide examples in docs
- Encode constraints in linters when possible
- Include remediation instructions in error messages

### Pitfall 5: External Dependencies
**Problem**: Critical context lives in Google Docs, Slack, or people's heads

**Solution**:
- Migrate all context to repository
- Create distilled reference docs from external sources
- Make "not in repo = doesn't exist" a hard rule
- Regular audits to find hidden knowledge

---

## Example AGENTS.md Variations

### Minimal (Small Project)
```markdown
# Agent Guide

## What This Is
Navigation map. See detailed docs in /docs.

## Start Here
1. Read ARCHITECTURE.md for system layout
2. Check docs/DESIGN.md for patterns
3. Review docs/product-specs/ for features

## Key Rules
- Layer dependencies: Types → Config → Service → UI
- All data parsed at boundaries (Zod schemas)
- Test coverage: minimum 80%

## Navigation
| Need | Location |
|------|----------|
| Feature specs | docs/product-specs/ |
| Design decisions | docs/design-docs/ |
| Quality metrics | docs/QUALITY.md |
```

### Comprehensive (Large Project)
Use the full template provided earlier in this guide with all sections.

### Domain-Specific (Microservices)
```markdown
# Agent Guide: Billing Service

## Service Purpose
Handles subscription payments, invoicing, and revenue recognition

## Dependencies
- Auth service (for user identity)
- Analytics service (for event tracking)
- Payment provider (Stripe API)

## Start Here
1. Read ARCHITECTURE.md for service boundaries
2. Review docs/api-contracts/ for interfaces
3. Check docs/product-specs/billing/ for features

[... rest of navigation ...]
```

---

## Measuring Success

### Leading Indicators
- Agent task completion rate increasing
- Fewer "capability missing" failures
- Reduced time-to-first-successful-PR
- Lower human review time per PR

### Lagging Indicators
- Code quality metrics stable or improving
- Documentation freshness >95%
- Architectural violations decreasing
- Feature velocity increasing

### Red Flags
- AGENTS.md growing beyond 200 lines
- Documentation with "Last Updated" >90 days old
- Increasing linter disable comments
- Agent frequently requesting missing capabilities
- Human engineers spending >10% time on doc maintenance

---

## Advanced Patterns

### Golden Principles
Create a `docs/golden-principles.md` with mechanical rules:

```markdown
# Golden Principles

These are enforced mechanically via daily cleanup tasks.

## Code Organization
1. **No hand-rolled utilities**: Use shared packages in libs/utils
2. **Parse, don't probe**: Validate data shapes at boundaries
3. **Explicit over implicit**: No magic, all behavior documented

## Data Handling
1. **All external data validated**: Use Zod schemas at API boundaries
2. **Type safety everywhere**: No `any` types except in adapter layers
3. **Null is not a value**: Use Option types or explicit default values

## Observability
1. **Structured logging only**: No console.log
2. **Trace all user journeys**: OpenTelemetry on critical paths
3. **Metrics for everything**: Counter, Gauge, Histogram as appropriate
```

### Cleanup Agent Configuration
```javascript
// agents/cleanup-config.js
module.exports = {
  schedule: 'daily',
  tasks: [
    {
      name: 'enforce-shared-utilities',
      pattern: 'src/**/utils/*.ts',
      check: 'no-duplicate-helpers',
      autofix: true
    },
    {
      name: 'update-quality-scores',
      action: 'npm run quality:measure',
      commit: 'chore: update quality scorecard'
    },
    {
      name: 'validate-boundaries',
      action: 'npm run test:architecture',
      failFast: true
    }
  ]
};
```

### Agent Skills (Repository-Specific)
Create reusable skills for common tasks:

```
skills/
├── db-migration.md       # How to create and run migrations
├── add-api-endpoint.md   # Pattern for new REST endpoints
├── add-feature-flag.md   # How to add and use feature flags
└── observability.md      # Instrumentation patterns
```

Reference these from AGENTS.md or specific docs.

---

## Conclusion

Remember:

1. **AGENTS.md is a map, not a manual** - Keep it short, point to details
2. **Repository is the system of record** - Everything else doesn't exist
3. **Enforce mechanically** - Linters and tests, not just documentation
4. **Progressive disclosure** - Don't overwhelm with context upfront
5. **Iterate continuously** - Monitor what works, improve what doesn't

The goal is to create an environment where agents can:
- Find the right context quickly
- Understand constraints clearly
- Get mechanical feedback on violations
- Ship reliably without micromanagement

This takes investment upfront but pays massive dividends in velocity and quality over time.
