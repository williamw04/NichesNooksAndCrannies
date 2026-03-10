# Agent Operating Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-13

## Purpose

This file serves as your navigation map. It points you to the right context for your current task. This is NOT a comprehensive instruction manual—it's a table of contents.

## Core Principles

1. **Repository as System of Record**: If it's not in this repository, it doesn't exist.
2. **Progressive Disclosure**: Start here, then navigate to specific documentation as needed.
3. **Mechanical Enforcement**: Architectural rules are enforced by linters, not convention.
4. **Documentation is Code**: All docs are versioned, structured, and kept current.

## Getting Started

### First-Time Setup
1. Read `ARCHITECTURE.md` for the system-wide domain map and layer structure
2. Review `docs/DESIGN.md` for architectural patterns and constraints
3. Check `docs/design-docs/core-beliefs.md` for foundational principles

### Before Starting Work
1. Identify the affected domain(s) from `ARCHITECTURE.md`
2. Check `docs/QUALITY_SCORE.md` for current quality baseline
3. Review relevant product specs in `docs/product-specs/`
4. For complex work, check `docs/exec-plans/active/` for ongoing initiatives

## Where to Find Information

### Product & Design
- **Product Specifications**: `docs/product-specs/index.md`
  - What features exist, user requirements, acceptance criteria
- **Design Decisions**: `docs/design-docs/index.md`
  - Why architectural choices were made
- **Design System**: `docs/references/design-system-reference-llms.txt`
  - UI components, styling patterns, interaction patterns

### Architecture & Code
- **System Architecture**: `ARCHITECTURE.md`
  - Domain boundaries, layer dependencies, package structure
- **Quality Standards**: `docs/QUALITY_SCORE.md`
  - Test coverage requirements, observability expectations, reliability grades
- **Security Requirements**: `docs/SECURITY.md`
  - Authentication patterns, data validation, boundary enforcement
- **Reliability Patterns**: `docs/RELIABILITY.md`
  - Error handling, retry logic, circuit breakers, observability

### Implementation Planning
- **Active Plans**: `docs/exec-plans/active/`
  - Current initiatives, progress tracking, decision logs
- **Completed Plans**: `docs/exec-plans/completed/`
  - Historical context, lessons learned
- **Tech Debt**: `docs/exec-plans/tech-debt-tracker.md`
  - Known issues, prioritization, remediation plans

### Frontend Development
- **Frontend Guide**: `docs/FRONTEND.md`
  - Component patterns, state management, styling conventions
- **UI Testing**: `docs/FRONTEND.md#testing`
  - Validation strategies, browser automation, visual regression

### Reference Materials
Located in `docs/references/`:
- Technology-specific guides formatted for LLM consumption
- Third-party library documentation
- Best practices for common dependencies

## Working in This Repository

### Development Workflow
1. **Understand the Task**: Read related product specs and design docs
2. **Plan the Work**: For complex tasks, create an execution plan in `docs/exec-plans/active/`
3. **Implement**: Follow architectural constraints from `ARCHITECTURE.md`
4. **Validate**: Use local dev environment with observability stack
5. **Document**: Update relevant docs as part of the same PR
6. **Review**: Request both agent and human reviews as appropriate

### Quality Gates
All PRs must pass:
- Structural linters (layer dependencies, naming conventions)
- Test coverage requirements (see `docs/QUALITY_SCORE.md`)
- Documentation freshness checks
- Observability instrumentation validation

### When Implementation Fails
If you're stuck:
1. Check if required abstractions exist in the codebase
2. Verify dependencies are properly documented
3. Look for similar patterns in completed work
4. If capability is missing: document the gap, implement the capability first

## Key Constraints

### Architectural Layers
Within each domain, dependencies must flow forward through layers:
```
Types → Config → Repo → Service → Runtime → UI
```
Cross-cutting concerns (auth, telemetry, feature flags) enter via Providers only.

### Code Quality
- Parse data at boundaries (see `docs/SECURITY.md#data-validation`)
- Structured logging only (no console.log)
- Telemetry on all critical paths
- File size limit: 500 lines (enforced by linter)
- Test coverage: minimum 80% for services, 100% for repositories

### Documentation Standards
- Product specs must have: user story, acceptance criteria, success metrics
- Design docs must have: problem statement, decision rationale, alternatives considered
- Execution plans must track: progress, blockers, decisions made
- All docs must be cross-linked and indexed

## Enforcement

These rules are not suggestions—they're enforced mechanically:
- Custom ESLint rules for architectural constraints
- Structural tests for dependency graphs
- CI jobs for documentation freshness
- Automated doc-gardening agent runs daily

When linters fail, read the error message—it contains remediation instructions.

## Getting Help

1. **For clarification on constraints**: Read the referenced documentation
2. **For missing capabilities**: Document the gap in `docs/exec-plans/tech-debt-tracker.md`
3. **For architectural questions**: Consult `ARCHITECTURE.md` and `docs/DESIGN.md`
4. **For product questions**: Check `docs/product-specs/` and `docs/PRODUCT_SENSE.md`

## Navigation Quick Reference

| Need | Location |
|------|----------|
| What to build | `docs/product-specs/` |
| Why it's designed this way | `docs/design-docs/` |
| How the system is organized | `ARCHITECTURE.md` |
| Quality expectations | `docs/QUALITY_SCORE.md` |
| Current work in progress | `docs/exec-plans/active/` |
| Security patterns | `docs/SECURITY.md` |
| Frontend patterns | `docs/FRONTEND.md` |
| Observability standards | `docs/RELIABILITY.md` |
| Tech debt backlog | `docs/exec-plans/tech-debt-tracker.md` |

---

**Remember**: This file is your starting point. Navigate to specific documentation as needed for your task. Don't try to hold everything in context—use the structured docs to find what you need.
