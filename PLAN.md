# PLAN.md - Startup Runway & Growth Monte Carlo Lab

Last updated: 2026-02-07
Owner: Solo founder/engineer
Launch targets:
- v1 usable build by 2026-05-31
- Public alpha by 2026-06-15
Budget target:
- 0 USD/month recurring

## 1. Mission and Success Criteria

### 1.1 Product mission
Build a founder-facing Monte Carlo planning lab that quantifies startup runway risk under uncertainty and produces credible analytics (not a toy), while remaining deployable on free tiers.

### 1.2 Success criteria for v1
- User can build and save a startup model with uncertainty inputs.
- User can run up to 10,000 simulations with deterministic seed behavior.
- App returns default risk, cash runway bands, MRR/ARR distributions, scenario comparison, and sensitivity ranking.
- Run time target for typical 5k-10k x 36 months case is <= 3 seconds (best-effort on free tier, with graceful degradation).
- Outputs are exportable (CSV + JSON).
- Math assumptions are transparent in docs and in-app help.
- Deployment works fully on free-tier infrastructure.

### 1.3 Non-negotiables
- No paid services.
- No reliance on `Math.random` for simulation randomness.
- No hidden formulas; all metrics traceable to documented math.
- Reproducibility for same app version + same seed + same inputs.

## 2. Scope Baseline (PRD Coverage Matrix)

Legend:
- `V1`: in scope for May 31 build
- `P2`: deferred Phase 2+

### 2.1 Modeling and engine
- Startup model core fields: `V1`
- Monthly horizon 12-60: `V1`
- Top-down user growth: `V1`
- Funnel growth model: `P2`
- Single ARPU variable: `V1`
- Multi-tier pricing mix: `P2`
- Expansion revenue: `P2`
- Costs (fixed deterministic + variable + payroll): `V1`
- Hiring slippage randomness: `P2`
- Fundraising rounds (arbitrary user-defined): `V1`
- Fundraising success logistic function: `V1`
- Bridge round fallback: `P2`
- Macro AR(1): `V1`
- Discrete macro crash shocks: `P2`
- Correlation matrix + Cholesky/Gaussian copula: `V1`
- Scenario-specific correlations: `P2`
- Time-varying correlations: `P2`
- Path termination on `cash <= 0`: `V1`

### 2.2 Distributions
- Normal/lognormal/beta/triangular/uniform/discrete: `V1`
- Optional min/max clamps on all distributions: `V1`
- Dedicated truncated normal primitive: `P2`
- Beta affine scaling to `[min,max]`: `V1`

### 2.3 Analytics and outputs
- Per-month aggregate quantiles (5/25/50/75/95): `V1`
- Default probability curve by month: `V1`
- Default month distribution: `V1`
- Survival probability to horizon: `V1`
- Fundraising close probability and timing distributions: `V1`
- Milestones using templates and thresholds: `V1`
- Sensitivity (rank-based, Spearman/PRCC): `V1`
- Sobol/global decomposition: `P2`
- Narrative summary: `V1`

### 2.4 UX and product
- Tabbed model builder: `V1`
- Scenario manager with duplication and overrides: `V1`
- Manual run button + progress/ETA: `V1`
- Scenario comparison view: `V1`
- Drilldown sample paths (50-100): `V1`
- Mobile read-only dashboard support: `V1`
- Full mobile editing: `P2`
- Light + dark modes: `V1` (dark-first fallback)

### 2.5 Data/export/integration
- Save/load models: `V1`
- Save simulation metadata + aggregate outputs: `V1`
- Persist all raw paths: `P2` (not needed)
- CSV export: `V1`
- JSON export: `V1`
- PDF report export: `P2` unless near-zero effort
- Private share links: `V1.5 optional` (ship if ahead of schedule)

### 2.6 Platform and operations
- Next.js + TS frontend: `V1`
- Node/TS simulation backend: `V1`
- Prisma + Postgres: `V1`
- Queue system: `P2`
- Rust/Wasm hot path: `P2`
- Basic CI (lint + test): `V1`
- Sentry integration (free tier): `V1 optional`
- Free-tier deployment and cost guardrails: `V1`

## 3. Execution Strategy

### 3.1 Delivery approach
- Build vertical slices, not isolated layers.
- Prioritize mathematical correctness, validation, and reproducibility before UI polish.
- Keep complex options hidden behind sane defaults.
- Lock public API contracts before dashboard work.

### 3.2 Workstreams
- WS1: Domain model + schema + validation.
- WS2: Simulation engine and deterministic RNG.
- WS3: Aggregation + analytics + sensitivity.
- WS4: API and job orchestration (sync + progress).
- WS5: UI (builder, scenario manager, dashboard, docs).
- WS6: Test harness, CI, performance tuning.
- WS7: Deployment hardening and alpha readiness.

### 3.3 Definition of done (v1)
- All `V1` features from section 2 implemented and tested.
- No P0 correctness bugs in simulations.
- Free-tier deploy reproducible from fresh clone.
- README, docs page, and legal disclaimer complete.

## 4. Detailed Build Plan

### 4.1 Phase A: Foundations (Week 1-2)
Goals:
- Repo scaffolding, architecture skeleton, schema draft, deterministic RNG selection.
Deliverables:
- App shell, DB schema migrations, simulation interfaces, seed tests, CI baseline.

### 4.2 Phase B: Core Engine (Week 3-5)
Goals:
- End-to-end simulation for one scenario with all v1 distributions and correlation.
Deliverables:
- Monte Carlo monthly loop, fundraising logistic model, macro AR(1), aggregates.

### 4.3 Phase C: Product Surfaces (Week 6-9)
Goals:
- Model builder, scenario manager, dashboard visualizations, exports.
Deliverables:
- Complete UI loop from input -> run -> analysis -> export.

### 4.4 Phase D: Hardening + Alpha (Week 10-12)
Goals:
- Accuracy checks, performance tuning, docs polish, deployment stability.
Deliverables:
- 2026-05-31 usable v1 and 2026-06-15 polished public alpha.

## 5. Wireframe-Level Screen Specs

### 5.1 `/` Landing
- Top hero with one-sentence value proposition and `Get Started` CTA.
- 3 cards: `Runway Risk`, `Fundraising Odds`, `Scenario Comparison`.
- Mini screenshot strip of dashboard modules.
- Footer disclaimer link and OSS/GitHub links.

### 5.2 `/model` Model Builder (tabbed)
Tabs:
- Basics
- Revenue
- Costs
- Fundraising
- Uncertainty
- Macro + Correlation
- Milestones

Layout:
- Left: tab navigation + section progress indicator.
- Center: forms with inline validation and helper text.
- Right sticky panel: live model summary (initial cash, burn proxy, horizon, scenario count).

### 5.3 `/scenarios`
- Table/list of scenarios with Base pinned.
- Actions: duplicate, rename, edit overrides, enable/disable in compare run.
- Diff panel shows each scenario override vs Base.

### 5.4 `/simulate`
Top controls:
- Scenario selector (multi-select)
- Runs input (default 5000, max 10000)
- Seed input
- Horizon override (optional)
- `Run Simulation` button

Top KPI cards:
- Default probability by horizon
- Median ARR at horizon
- P5/P95 terminal cash
- Milestone hit probability

Chart grid:
- Cash fan chart
- Cumulative default curve
- ARR fan chart
- Default month histogram
- Fundraising close probability per round
- Sensitivity tornado

Bottom:
- Sample path explorer (50-100 paths)
- Narrative summary panel
- Export buttons CSV/JSON

### 5.5 `/docs`
Sections:
- Modeling assumptions
- Formula references
- Distribution definitions
- Correlation method
- Edge-case behavior
- Disclaimer

## 6. Backlog with Estimates and Acceptance Criteria

Estimate scale:
- `S`: 3-5 hours
- `M`: 6-10 hours
- `L`: 11-16 hours
- `XL`: 17-24 hours

### 6.1 Platform and setup
1. `PLAT-001` Initialize monorepo/app scaffolding (`M`)
- AC: Next.js TS app boots; lint/test scripts wired; `.env.example` present.

2. `PLAT-002` Prisma + Postgres baseline schema (`M`)
- AC: migrations apply cleanly; local dev DB and hosted DB both work.

3. `PLAT-003` CI pipeline (`S`)
- AC: GitHub Actions runs lint + unit tests on PR and `main`.

4. `PLAT-004` Error handling + structured logger (`S`)
- AC: API errors return typed shape with request id; logs include timestamp/severity.

### 6.2 Domain models and validation
5. `MODEL-001` TS domain types for all v1 entities (`M`)
- AC: strict types for model/scenario/distributions/correlation/sim results.

6. `MODEL-002` Zod schemas for API input validation (`M`)
- AC: invalid payloads rejected with actionable messages.

7. `MODEL-003` Correlation matrix validator + PSD repair (`M`)
- AC: invalid matrix rejected or repaired via epsilon jitter with warning artifact.

8. `MODEL-004` Milestone template schema (`S`)
- AC: ARR-by-month and profitability-by-month templates supported.

### 6.3 Simulation engine
9. `SIM-001` Deterministic RNG module (seeded, stable) (`M`)
- AC: same inputs/seed return same draws across runs and platforms.

10. `SIM-002` Distribution samplers (all 6 types + clamps) (`L`)
- AC: parameter validation + statistical smoke tests + clamp behavior.

11. `SIM-003` Gaussian copula + Cholesky transform (`M`)
- AC: sampled rank correlations approximate target matrix over large runs.

12. `SIM-004` Monthly state transition core (`L`)
- AC: growth/churn/revenue/cost/cash/runway update works per spec.

13. `SIM-005` Fundraising dynamics with logistic close probability (`L`)
- AC: rounds start/close/fail logically; cash updated on close success.

14. `SIM-006` Macro AR(1) process + metric impacts (`M`)
- AC: macro evolves monthly; growth/churn/CAC effects applied and clamped.

15. `SIM-007` Default termination and path recording (`S`)
- AC: paths stop at default month; default metadata recorded.

16. `SIM-008` Aggregation pipeline (`L`)
- AC: monthly quantiles, default curves, final distributions computed.

17. `SIM-009` Sensitivity module (Spearman/PRCC) (`M`)
- AC: ranked feature impacts computed for selected outcomes.

18. `SIM-010` Sample path retention policy (`S`)
- AC: store 50-100 representative/random sample paths only.

### 6.4 API and persistence
19. `API-001` `POST /api/simulations` (`M`)
- AC: accepts validated payload; returns run id and status.

20. `API-002` `GET /api/simulations/:id` (`M`)
- AC: returns status/progress/results; handles not found + expired.

21. `API-003` `POST /api/models` and `GET /api/models/:id` (`M`)
- AC: model save/load works; includes scenario and milestone configs.

22. `API-004` Expiration worker/cron for old artifacts (`S`)
- AC: artifacts older than 7 days removed or soft-deleted by schedule.

23. `API-005` Rate/cost guardrails (`S`)
- AC: run cap per request and per session/day enforced with clear errors.

### 6.5 Frontend product
24. `UI-001` App shell, nav, theme system (light/dark) (`M`)
- AC: responsive layout; theme toggle persists preference.

25. `UI-002` Model builder tabs + validation UX (`XL`)
- AC: all v1 inputs editable with contextual helper text and validation states.

26. `UI-003` Scenario manager (`M`)
- AC: create/edit/duplicate scenario overrides and select run set.

27. `UI-004` Simulation control panel + progress (`M`)
- AC: run button, seed/runs/horizon controls, spinner/progress/ETA shown.

28. `UI-005` Dashboard chart suite (`XL`)
- AC: all required v1 charts render with tooltips/legend toggles.

29. `UI-006` Sample path explorer (`M`)
- AC: user can inspect individual sampled paths and compare with median band.

30. `UI-007` Narrative summary generator (`S`)
- AC: generates concise paragraph grounded in computed metrics.

31. `UI-008` Export CSV/JSON (`M`)
- AC: downloads include summary + monthly aggregates + sampled paths.

32. `UI-009` Mobile read-only optimization (`S`)
- AC: core dashboard charts/metrics usable on small screens.

### 6.6 Docs, legal, release
33. `DOC-001` In-app `/docs` math and assumptions (`M`)
- AC: formulas match engine behavior; links to repo docs.

34. `DOC-002` README + setup + architecture overview (`S`)
- AC: clean setup path from clone to deploy.

35. `DOC-003` Legal disclaimer integration (`S`)
- AC: disclaimer visible in docs/footer and simulation results context.

36. `REL-001` Alpha deployment and smoke checklist (`M`)
- AC: deployed URLs stable; smoke tests pass before release cut.

Total effort rough order (solo): 260-340 hours.
At 10-15 h/week baseline, this aligns with the target timeline if scope gates are enforced.

## 7. Cut-Scope Decision Gates

### Gate 1 (end of Week 4)
Condition:
- Core engine not producing stable outputs for single scenario.
Cuts if behind:
- Delay light mode.
- Delay sample path explorer polish.
- Keep sensitivity as Spearman only (no PRCC option toggle).

### Gate 2 (end of Week 7)
Condition:
- Model builder or scenario workflow still unstable.
Cuts if behind:
- Cut private share links.
- Reduce chart set to must-have core (cash fan, default curve, ARR fan, terminal histograms, tornado).
- Keep milestone templates to two canonical templates only.

### Gate 3 (end of Week 9)
Condition:
- Performance > 3s on default profile or repeated bugs.
Cuts if behind:
- Lower default runs to 2000 (cap still 10000).
- Remove ETA estimate and keep simple spinner.
- Postpone mobile refinement beyond minimal layout.

### Gate 4 (end of Week 11)
Condition:
- Release quality risk.
Cuts if behind:
- Defer optional Sentry integration.
- Defer extra prebuilt template (keep SaaS + Consumer App only).
- Defer advanced scenario comparison table columns.

## 8. Testing and Quality Strategy

### 8.1 Unit tests (highest priority)
- Distribution samplers and clamps.
- Correlation transform and PSD repair behavior.
- Monthly transition invariants (no negative users after clamp, etc.).
- Default termination correctness.
- Fundraising logistic probability bounds.
- Reproducibility with fixed seed.

### 8.2 Integration tests
- API simulation lifecycle (`POST` -> `GET` complete).
- Save model/load model round-trip.
- Export payload schema validation.

### 8.3 E2E smoke tests (Playwright)
- Build model, run simulation, see dashboard.
- Compare two scenarios.
- Export CSV + JSON.

### 8.4 Coverage target
- ~70% on simulation core and critical API modules.

## 9. Risks and Mitigation Summary

### 9.1 Technical
- Risk: correlation instability due to non-PSD input.
- Mitigation: validation + epsilon jitter + warning UI.

- Risk: runtime slow for 10k on free tiers.
- Mitigation: optimized loops, typed arrays, selective path retention, concurrency caps.

- Risk: reproducibility bugs from unstable RNG source.
- Mitigation: dedicated seeded RNG module; forbid `Math.random` in engine.

### 9.2 Product
- Risk: too many inputs overwhelm founders.
- Mitigation: defaults, presets, helper text, progressive disclosure.

- Risk: false precision perception.
- Mitigation: explicit uncertainty/disclaimer language and confidence bands.

### 9.3 Delivery
- Risk: solo capacity mismatch.
- Mitigation: strict gate-based de-scoping, lock nonessential features to P2.

## 10. Open-Source and Contribution Readiness

- License: MIT recommended.
- Add `CONTRIBUTING.md` with code style, testing requirements, branch flow.
- Add issue templates for bug report and feature request.
- Label good-first-issues after alpha to attract contributors.

## 11. Immediate Next Actions (first 10 days)

1. Scaffold app + Prisma + CI.
2. Finalize domain schema + validation contracts.
3. Implement deterministic RNG and distribution layer.
4. Build simulation core with one scenario and aggregate outputs.
5. Validate results with fixed-seed snapshot tests.
6. Start `/model` and `/simulate` basic UI loop.
