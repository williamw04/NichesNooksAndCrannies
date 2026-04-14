## Description

Brief description of what this PR does and why.

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 🔧 Refactor (code improvement without changing behavior)
- [ ] 📝 Documentation update
- [ ] 🧹 Chore (maintenance, dependencies, configs)
- [ ] ⚠️ Breaking change (requires migration or config updates)

## Changes Summary

| Area | Changes |
|------|---------|
| **Files Changed** | List key files modified |
| **Lines Changed** | ~X insertions, ~Y deletions |

## Testing

- [ ] Unit tests pass (`npm test` / `pytest`)
- [ ] Integration tests pass
- [ ] Type checks pass (`tsc --noEmit` / `mypy`)
- [ ] Lint checks pass (`eslint` / `ruff`)
- [ ] Manual testing completed

### Test Commands Run

```bash
# TypeScript
cd tiktok-scraper && npx tsc --noEmit

# Python
python3 -c "from src.approaches.unified_pipeline import UnifiedPipeline"
```

## Code Review Checklist

- [ ] Code is readable and follows project conventions
- [ ] No hardcoded secrets or credentials
- [ ] Error handling is appropriate
- [ ] Edge cases are handled
- [ ] Comments explain non-obvious logic
- [ ] No dead code or commented-out blocks

## Documentation Updates

- [ ] README updated if public API changed
- [ ] AGENTS.md updated if architecture changed
- [ ] Design docs updated if implementation changed
- [ ] ADRs added/updated for significant decisions

## Breaking Changes

If this PR includes breaking changes, describe:
- What breaks
- Migration steps
- Version impact

## Screenshots / Demo

(Optional) Add screenshots or demo output for UI changes.

## Related Issues

Link any related issues: #XXX

## Merge Checklist

Before merging:
- [ ] All CI checks pass
- [ ] No unresolved conversations
- [ ] Branch is up to date with main
- [ ] Squash merge or merge commit (specify preference)