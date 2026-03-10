# Core Beliefs

**Version**: 1.0  
**Last Updated**: 2026-02-13

These are the foundational principles that guide all architectural and design decisions in this repository. They are mechanically enforced where possible and culturally reinforced where not.

## 1. Repository as System of Record

**Belief**: If knowledge isn't in the repository, it doesn't exist.

**Implications**:
- All design decisions documented in `docs/design-docs/`
- All product requirements in `docs/product-specs/`
- All execution plans in `docs/exec-plans/`
- No critical information in Slack, Google Docs, or tribal knowledge

**Enforcement**:
- PR template requires documentation links
- CI fails if docs are stale (>30 days without update)
- Architectural decisions must be in-repo before implementation

## 2. Parse, Don't Probe

**Belief**: Validate data shapes at boundaries. Never probe data structures or guess schemas.

**Implications**:
- All external data validated with Zod schemas
- All API responses typed and validated
- All database queries return typed results
- No YOLO-style data access

**Examples**:
```typescript
// ✅ CORRECT: Parse at boundary
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string()
});

const user = UserSchema.parse(apiResponse);

// ❌ WRONG: Probe and hope
const userId = apiResponse.user?.id || apiResponse.userId;
```

**Enforcement**:
- ESLint rule: no optional chaining on external data
- Review checklist: all API boundaries have schemas
- Tests must validate schema errors

## 3. Explicit Over Implicit

**Belief**: No magic. All behavior should be obvious from reading the code.

**Implications**:
- No global state mutations without explicit context
- No hidden side effects
- Configuration is explicit and documented
- Dependencies are injected, not globals

**Examples**:
```typescript
// ✅ CORRECT: Explicit dependencies
class UserService {
  constructor(
    private repo: UserRepository,
    private logger: Logger,
    private metrics: MetricsClient
  ) {}
}

// ❌ WRONG: Hidden dependencies
class UserService {
  getUser() {
    db.query(...) // Where did 'db' come from?
  }
}
```

**Enforcement**:
- No global variables except constants
- Dependency injection required for services
- ESLint rule: no implicit any

## 4. Mechanical Enforcement Over Convention

**Belief**: If a rule matters, encode it in tooling. Don't rely on human discipline.

**Implications**:
- Architecture validated by structural tests
- Code style enforced by Prettier/ESLint
- Documentation freshness checked in CI
- Security rules in automated scanners

**Examples**:
- Layered architecture validated by `tests/architecture.test.ts`
- File size limits enforced by ESLint
- Import patterns checked by custom rules
- Documentation links validated in CI

**Enforcement**:
- CI must pass before merge
- No eslint-disable without justification comment
- Pre-commit hooks for quick feedback

## 5. Shared Utilities Over Duplication

**Belief**: Common patterns belong in shared packages, not duplicated across domains.

**Implications**:
- Utilities in `src/utils/` are shared across domains
- No copy-paste of helper functions
- Extract patterns after 2nd use (Rule of Three)
- Shared code has 100% test coverage

**Examples**:
```typescript
// ✅ CORRECT: Use shared utility
import { formatCurrency } from '@/utils/formatting';

// ❌ WRONG: Duplicate helper
function formatCurrency(amount: number) { ... }
```

**Enforcement**:
- Daily cleanup agent finds duplicates
- Review checklist: check for reimplemented helpers
- Linter warns on similar function names

## 6. Observability is Not Optional

**Belief**: If it's not observable, it's not production-ready.

**Implications**:
- All services instrumented with OpenTelemetry
- Structured logging on all critical paths
- Metrics for business and technical KPIs
- Traces for all user journeys

**Requirements**:
- Every service has: traces, logs, metrics
- Every user journey has: success/failure metrics, latency P95/P99
- Every error logged with context
- Every critical operation has a trace span

**Examples**:
```typescript
// ✅ CORRECT: Full observability
async function createUser(data: CreateUserInput) {
  return tracer.startActiveSpan('createUser', async (span) => {
    logger.info('Creating user', { email: data.email });
    
    const user = await repo.create(data);
    metrics.counter('users.created').inc();
    
    span.setAttributes({ userId: user.id });
    return user;
  });
}
```

**Enforcement**:
- CI checks for missing telemetry imports
- Quality score tracks observability coverage
- Production readiness checklist requires observability

## 7. Security by Default

**Belief**: Security is not a feature to add later. It's built-in from the start.

**Implications**:
- All user input validated and sanitized
- Authentication required by default (explicit opt-out)
- Audit logging on all sensitive operations
- Rate limiting on all public endpoints

**Requirements**:
- All API endpoints authenticated unless explicitly public
- All data mutations logged to audit trail
- All sensitive data encrypted at rest
- All external API calls validated

**Enforcement**:
- Security linter checks for common vulnerabilities
- Penetration testing before major releases
- Automated dependency scanning
- Manual security review for auth changes

## 8. Test Coverage Reflects Criticality

**Belief**: Higher-risk code deserves higher test coverage.

**Coverage Requirements**:
- Repository layer: 100% (data integrity is critical)
- Service layer: 95% (business logic must be correct)
- Runtime layer: 85% (request handling needs validation)
- UI layer: 70% (visual changes are lower risk)

**Test Types**:
- Unit tests: All business logic
- Integration tests: All API endpoints
- E2E tests: Critical user journeys only

**Enforcement**:
- CI fails if coverage drops below thresholds
- Quality score tracks coverage per domain
- PRs show coverage diff

## 9. Documentation is Code

**Belief**: Documentation should be versioned, reviewed, and tested like code.

**Implications**:
- All docs in repository (no external wikis)
- Docs updated in same PR as code changes
- Stale docs fail CI
- Documentation has owners

**Requirements**:
- Product specs for all features
- Design docs for all architectural decisions
- API documentation for all endpoints
- README for all major components

**Enforcement**:
- CI validates doc structure and links
- PR template requires doc updates
- Automated doc gardening agent
- Freshness checks in CI

## 10. Optimize for Deletion

**Belief**: The best code is no code. Make things easy to remove.

**Implications**:
- Features behind feature flags (easy to disable)
- Clear domain boundaries (easy to extract)
- Minimal coupling (easy to delete)
- Deprecation process (safe to remove)

**Practices**:
- Feature flags for all new features
- Dependency injection (not singletons)
- Domain-driven design (clear boundaries)
- Archive superseded code (don't delete history)

**Enforcement**:
- Architectural tests enforce loose coupling
- Feature flag audit finds unused flags
- Dependency graph tracks coupling

## Application of Beliefs

### When Designing Features
1. Where will this be documented? (`docs/product-specs/`)
2. What boundaries need validation? (Parse, don't probe)
3. What will be logged/traced? (Observability)
4. What are the security implications? (Security by default)
5. How will this be tested? (Coverage by criticality)

### When Writing Code
1. Is this explicit enough? (No magic)
2. Could this be a shared utility? (No duplication)
3. Is this observable? (Traces, logs, metrics)
4. Is this secure? (Validate, sanitize, authenticate)
5. Can this be deleted easily? (Optimize for deletion)

### When Reviewing Code
1. Are architectural rules followed? (Mechanical enforcement)
2. Is documentation updated? (Docs are code)
3. Is this parseable? (No probing)
4. Is coverage adequate? (By criticality)
5. Is it observable? (Not optional)

## Evolution

These beliefs are not immutable. They evolve as we learn.

**Process for updating**:
1. Propose change in `docs/design-docs/`
2. Discuss with team
3. Update this document
4. Update enforcement mechanisms
5. Update training materials

**Last major revision**: 2025-09-15 (Initial version)

## Conclusion

These beliefs guide every decision we make. When in doubt:
1. Check if a belief applies
2. See how similar problems were solved
3. Document your decision
4. Encode the rule if it matters

The goal is to build software that is:
- Reliable (through testing and observability)
- Secure (by default, not as an afterthought)
- Maintainable (through clear structure and documentation)
- Evolvable (through loose coupling and mechanical enforcement)
