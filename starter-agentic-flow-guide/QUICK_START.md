# Quick Start: Agent-Driven Repository

This is a simplified getting started guide. For the full guide, see GUIDE_TO_AGENT_DRIVEN_REPOS.md

## Step 1: Create AGENTS.md (Your Navigation Map)

Create a file called `AGENTS.md` in your repository root with ~100-150 lines:

```markdown
# Agent Operating Guide

## Purpose
This file is your navigation map. It points to detailed docs, not contains them.

## Core Principles
1. Repository as System of Record
2. Progressive Disclosure
3. Mechanical Enforcement
4. Documentation is Code

## Getting Started
1. Read ARCHITECTURE.md for domain structure
2. Check docs/QUALITY_SCORE.md for current state
3. Review docs/product-specs/ for features

## Navigation
| Need | Location |
|------|----------|
| Feature specs | docs/product-specs/ |
| Design decisions | docs/design-docs/ |
| Architecture | ARCHITECTURE.md |
| Quality metrics | docs/QUALITY_SCORE.md |

## Key Constraints
- Layers: Types → Config → Repo → Service → Runtime → UI
- Test coverage: 80% minimum
- All data parsed at boundaries
```

## Step 2: Create Directory Structure

```bash
mkdir -p docs/{design-docs,product-specs,exec-plans/{active,completed},references}
```

## Step 3: Create ARCHITECTURE.md

Document your:
- Business domains (auth, billing, etc.)
- Layer structure within domains
- Dependency rules between domains

## Step 4: Write Core Documentation

Create these essential docs:
- `docs/design-docs/core-beliefs.md` - Your foundational principles
- `docs/QUALITY_SCORE.md` - Quality tracking by domain
- `docs/product-specs/[feature].md` - Feature specifications

## Step 5: Add Enforcement

Implement:
- Custom ESLint rules for architecture
- Structural tests for dependencies
- CI checks for doc freshness

## What Makes This Work

1. **Keep AGENTS.md Short** - It's a map, not a manual
2. **Everything In Repo** - No external dependencies
3. **Mechanical Rules** - Enforce with tools, not docs
4. **Progressive Disclosure** - Agents navigate as needed

## Example Feature Documentation Flow

When agent builds a feature:
1. Creates/updates `docs/product-specs/[feature].md`
2. Updates `docs/design-docs/` if architectural changes
3. Creates execution plan in `docs/exec-plans/active/`
4. Updates quality score after completion
5. Moves plan to `completed/` when done

All in the same PR as the code!

## Common Mistakes to Avoid

❌ AGENTS.md with 1000+ lines  
❌ Stale documentation  
❌ Rules only in docs (not enforced)  
❌ Context outside the repository  

✅ Short AGENTS.md pointing to details  
✅ Automated freshness checks  
✅ Linters and tests enforcing rules  
✅ Everything versioned in repo  

---

See the full files for detailed examples and templates.
