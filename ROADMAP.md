# ROADMAP.md - Timeline, Milestones, and Scope Gates

Last updated: 2026-02-07
Planning window: 2026-02-09 to 2026-06-15
Baseline capacity: 10-15 hours/week
Stretch capacity: occasional 20-hour weeks

## 1. Milestone Dates

- `M0` Planning lock: 2026-02-09
- `M1` Core simulation correctness baseline: 2026-03-08
- `M2` End-to-end app loop (build -> run -> charts): 2026-04-05
- `M3` Feature-complete v1 candidate: 2026-05-17
- `M4` Usable v1 freeze: 2026-05-31
- `M5` Public alpha launch: 2026-06-15

## 2. Weekly Plan

## Week 1 (Feb 9-Feb 15)
Objectives:
- Repository setup, CI, Prisma schema skeleton, domain types.
Deliverables:
- `PLAT-001`, `PLAT-003`, initial `MODEL-001`.
Exit criteria:
- Clean local boot + test + lint.

## Week 2 (Feb 16-Feb 22)
Objectives:
- Validation schemas and model persistence.
Deliverables:
- `PLAT-002`, `MODEL-002`, `API-003` draft.
Exit criteria:
- Save/load model round-trip works.

## Week 3 (Feb 23-Mar 1)
Objectives:
- Deterministic RNG + distributions.
Deliverables:
- `SIM-001`, `SIM-002`.
Exit criteria:
- Seed snapshot tests pass.

## Week 4 (Mar 2-Mar 8)
Objectives:
- Correlation + core monthly transitions.
Deliverables:
- `MODEL-003`, `SIM-003`, `SIM-004`.
Exit criteria:
- Single-scenario simulation returns coherent cash/revenue paths.

Gate 1 (end of Week 4):
- If unstable, cut noncritical UI polish items immediately.

## Week 5 (Mar 9-Mar 15)
Objectives:
- Fundraising + macro dynamics.
Deliverables:
- `SIM-005`, `SIM-006`, `SIM-007`.
Exit criteria:
- End-to-end path termination and fundraising outcomes validated.

## Week 6 (Mar 16-Mar 22)
Objectives:
- Aggregation and sensitivity analytics.
Deliverables:
- `SIM-008`, `SIM-009`, `SIM-010`.
Exit criteria:
- Monthly quantiles, default curve, tornado ranking available via API.

## Week 7 (Mar 23-Mar 29)
Objectives:
- Simulation API lifecycle and guardrails.
Deliverables:
- `API-001`, `API-002`, `API-005`.
Exit criteria:
- Frontend can start run and poll status.

Gate 2 (end of Week 7):
- If behind, cut share links and reduce chart scope to essentials.

## Week 8 (Mar 30-Apr 5)
Objectives:
- Model builder core tabs and validation UX.
Deliverables:
- `UI-001`, `UI-002` (first complete pass).
Exit criteria:
- User can configure full v1 model and scenarios.

## Week 9 (Apr 6-Apr 12)
Objectives:
- Dashboard core charts and run controls.
Deliverables:
- `UI-004`, `UI-005` core set.
Exit criteria:
- Full app loop operational.

Gate 3 (end of Week 9):
- If performance/quality risk, lower default run count and trim secondary views.

## Week 10 (Apr 13-Apr 19)
Objectives:
- Scenario manager, sample path explorer, exports.
Deliverables:
- `UI-003`, `UI-006`, `UI-008`.
Exit criteria:
- Scenario compare + CSV/JSON exports working.

## Week 11 (Apr 20-Apr 26)
Objectives:
- Narrative summary, docs route, legal disclaimer.
Deliverables:
- `UI-007`, `DOC-001`, `DOC-003`.
Exit criteria:
- Transparent math + disclaimer visible.

## Week 12 (Apr 27-May 3)
Objectives:
- Integration and E2E tests; bug burn-down.
Deliverables:
- E2E smoke suite, integration suite stabilization.
Exit criteria:
- Critical flows covered by automation.

## Week 13 (May 4-May 10)
Objectives:
- Performance optimization and latency tuning.
Deliverables:
- Loop optimizations, payload size reduction, retention tuning.
Exit criteria:
- Typical 5k-10k run near <= 3s target in deploy-like environment.

## Week 14 (May 11-May 17)
Objectives:
- Feature-complete candidate and freeze prep.
Deliverables:
- `M3` candidate, known-issues list triaged.
Exit criteria:
- No open P0 defects.

Gate 4 (end of Week 14):
- If quality risk persists, defer optional Sentry and extra template.

## Week 15 (May 18-May 24)
Objectives:
- Docs polish, README, contributor and deployment docs.
Deliverables:
- `DOC-002`, release notes draft.
Exit criteria:
- Fresh clone and deploy instructions validated.

## Week 16 (May 25-May 31)
Objectives:
- Usable v1 freeze and stabilization.
Deliverables:
- `M4` freeze tag, smoke-tested deployment.
Exit criteria:
- Demo-ready build usable by external testers.

## Week 17-18 (Jun 1-Jun 15)
Objectives:
- Alpha polish, demo recording, onboarding docs, launch execution.
Deliverables:
- Final alpha release + announcement.
Exit criteria:
- `M5` public alpha launched.

## 3. Capacity Plan

Estimated total effort: 260-340 hours.
Expected baseline from Feb 9-Jun 15 (18 weeks):
- 180-270 hours at 10-15 h/week.

Implication:
- You need strict de-scoping discipline or some high-output weeks.
- Keep optional items behind gates and avoid phase creep.

## 4. Must-Have vs Nice-to-Have for v1 Freeze

Must-have:
- Deterministic engine with correlations, macro, fundraising logistic model.
- Model builder + scenario manager.
- Run controls + core dashboard charts.
- Sensitivity ranking.
- CSV/JSON export.
- Docs + disclaimer.

Nice-to-have:
- Private share links.
- Enhanced mobile polish.
- Extra chart variants.
- Sentry integration.
- Third template beyond SaaS/Consumer.

## 5. Launch Readiness Checklist

Technical:
- All P0/P1 bugs closed.
- CI green on main.
- DB migrations clean from empty state.

Product:
- At least 2 model templates available.
- Narrative summary understandable to founder audience.
- Docs page matches implemented behavior.

Ops:
- Free-tier limits documented.
- Cost guardrails enabled.
- Artifact expiration active.

Legal:
- Disclaimer visible in footer/docs/results contexts.

## 6. Post-Alpha Phase 2 Queue

- Funnel growth model.
- Expansion revenue.
- Hiring slippage randomness.
- Macro discrete shocks.
- Bridge rounds.
- Scenario-specific correlation.
- Queue worker for long runs.
- Optional Rust/Wasm engine backend.
- Auth and private share permissions.
