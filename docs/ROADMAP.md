# Roadmap and status

Ordered by dependency. A box is checked **only** when the work is in the repository and verified. Last updated: 2026-10-30.

## Phase 1 - Audit and repair

- [x] Repair `vercel.json` (duplicate `env` key, frozen-lockfile install with no lockfile, unscoped build, no SPA rewrites)
- [x] Pin toolchain (`packageManager`, Node and pnpm engines) and remove dead scripts
- [x] Replace README with an accurate status-driven version
- [ ] Audit `api`, `database` and `shared-types` sources and tsconfigs
- [ ] Commit a `pnpm-lock.yaml` and restore `--frozen-lockfile`
- [ ] Confirm a clean `pnpm install && pnpm build` (verified in CI or Vercel logs)
- [ ] Rewrite `.env.example` with documented, secret-free variables

## Phase 2 - Build and deploy

- [ ] Link a Vercel project to this repository and confirm a green production build
- [ ] Decide and document API hosting (serverless vs Node host)
- [ ] CI workflow: install, typecheck, test, build on every PR

## Phase 3 - Application shell

- [ ] Design system (dark developer-tool theme, restrained blue/violet/gold)
- [ ] Routing and layout: overview, projects, rubrics, evaluations, tests, issues, analytics, settings
- [ ] Authentication and per-project authorization
- [ ] PostgreSQL schema and migrations

## Phase 4 - Rubric Intelligence

- [ ] Source ingestion: URL, PDF, document, pasted text
- [ ] Criterion extraction with verification status and confidence
- [ ] Editable rubrics; JSON, CSV and report export
- [ ] Rubric versioning and impact on prior evaluations

## Phase 5 - Verdict Engine

- [ ] Deterministic check framework
- [ ] Configurable AI provider layer with schema-validated output
- [ ] Criterion-level results, confidence and overall verdict
- [ ] Provider-failure handling (never recorded as success)
- [ ] Multi-Judge Consensus

## Phase 6 - Closed loop

- [ ] Findings to repair-prompt generation
- [ ] Re-evaluation and old-vs-new comparison
- [ ] Resolved / remaining / regression tracking
- [ ] Quality Regression Gate

## Phase 7 - QA management and analytics

- [ ] Test case management and execution
- [ ] Issue tracking
- [ ] Analytics from persisted data
- [ ] Human review with audit history

## Phase 8 - Integrations and reports

- [ ] GitHub repository evaluation linked to files and lines
- [ ] Evidence Graph view
- [ ] Shareable reports with methodology and limitations

## Phase 9 - Hardening

- [ ] Unit, integration and end-to-end tests with real recorded results
- [ ] Rate limiting, safe retries, prompt-injection defenses
- [ ] Security review and documentation pass

## Known limitations

- The web application is currently a stub.
- No automated tests exist yet, so none are reported as passing.
- Nothing in the roadmap past Phase 1 is implemented.
