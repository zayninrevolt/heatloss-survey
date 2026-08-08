# Implementation Plan: Heat-loss Survey Maintainability

## Overview

Refactor the static survey application without changing its deployment model. Calculation and persistence logic will become browser-loadable CommonJS-compatible modules so Node's built-in test runner can exercise the same code used by the page. Existing saved surveys remain readable, and each slice leaves `index.html` usable directly or from a static server.

## Architecture Decisions

- Use dependency-free UMD-style modules under `src/` to preserve the current no-build, offline-capable application while supporting `require()` in Node tests.
- Extract pure domain logic before moving DOM rendering. This creates a tested seam and avoids a risky whole-page rewrite.
- Store an explicit schema version in combined heat-loss data and named survey snapshots. Migrations are pure, ordered, idempotent functions.
- Present failures through one accessible status surface; retain console detail for diagnosis and keep offline/manual fallbacks available.
- Use Node's built-in test runner for unit tests and Playwright for a small browser smoke suite.

## Task List

### Phase 1: Tested calculation foundation

- [x] Task 1: Add the dependency-free test harness and extract heat-loss geometry, fabric, ventilation, ground-floor, and altitude calculations.
- [x] Task 2: Extract radiator correction, option generation, and one/two-radiator selection using the existing manufacturer tables.
- [x] Task 3: Add table-driven reference and boundary tests, including independently hand-calculated fixtures.

### Checkpoint: Calculation foundation

- [x] Unit tests pass; browser execution remains pending because local Playwright installation was not approved.

### Phase 2: Durable saved data

- [x] Task 4: Add a versioned survey envelope and pure sequential migrations for legacy combined and named-survey data.
- [ ] Task 5: Route save/restore/import/export through the versioned persistence module and test malformed/legacy/current payloads.

### Checkpoint: Persistence

- [ ] Existing unversioned samples restore, current data round-trips, and failed storage writes preserve in-memory form state.

### Phase 3: Recoverable failures and validation

- [ ] Task 6: Add an accessible application-status component and report storage, print-window, JSON, and lookup failures with recovery guidance.
- [x] Task 7: Add pure range validation and inline warnings for dimensions, temperatures, U-values, ACH, and radiator output without blocking reasonable edge cases.

### Checkpoint: User safety

- [ ] Invalid inputs are visible, calculations avoid non-finite output, and offline lookup failure leaves manual fields usable.

### Phase 4: Module boundaries, browser coverage, and CI

- [ ] Task 8: Move remaining external lookup, rendering, and report orchestration into focused modules while preserving the legacy globals required by inline scripts.
- [x] Task 9: Add browser smoke tests for save/restore, JSON export, postcode lookup failure, and printable output.
- [x] Task 10: Add GitHub Actions for syntax checks, unit tests, and browser smoke tests.
- [x] Task 11: Document calculation provenance, independently checked fixtures, limitations, and local verification commands.

### Checkpoint: Complete

- [ ] All automated checks pass, browser smoke tests pass, direct static usage remains functional, and no saved-data regression is observed.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Inline scripts depend on global function names and load order | High | Keep compatibility globals and migrate one boundary at a time |
| Existing localStorage records have many implicit historical shapes | High | Preserve raw fixtures and test every migration as idempotent |
| Reference calculations could encode current bugs | High | Separate hand-calculated fixtures from snapshot/regression fixtures |
| Browser tests need external postcode service | Medium | Stub failed requests; keep live lookup out of deterministic CI |
| Large HTML split creates a review-hostile diff | Medium | Extract additive modules first, then remove duplicated blocks in focused commits |

## Open Questions

- No blocking questions. The default is to preserve direct `file://` use and avoid adding a production build step.
