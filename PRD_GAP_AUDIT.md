# PRD Coverage Audit

## Status Key
- `DONE`: Implemented and wired through model schema, engine, and UI/API flow.
- `OUT_OF_SCOPE_BY_PRD`: Explicit non-goal in PRD.
- `OPTIONAL_IN_PRD`: Marked optional in PRD; not required for 100% core compliance.

## 1. Core Modeling + Engine
- Monthly horizon 12-60 with seeded Monte Carlo: `DONE`
- Correlated sampling with Cholesky + PSD jitter: `DONE`
- Time-varying correlation support by month: `DONE`
- Scenario-level correlation overrides: `DONE`
- Top-down growth mode: `DONE`
- Funnel growth mode (visitors -> signup -> activation): `DONE`
- Churn after acquisition ordering: `DONE`
- ARPU revenue and ARR conversion: `DONE`
- Expansion revenue (upgrade fraction * additional ARPU): `DONE`
- Fixed + payroll + variable cost model: `DONE`
- Payroll multiplier support: `DONE`
- Hiring slippage randomness: `DONE`
- Macro AR(1) dynamics: `DONE`
- Macro shocks (probability, impact, duration): `DONE`
- Fundraising rounds with:
  - close lag distributions: `DONE`
  - close success logistic function: `DONE`
  - optional close-probability multipliers: `DONE`
  - valuation multipliers: `DONE`
  - ARR/growth metric gating: `DONE`
  - fallback bridge round behavior: `DONE`
- Default termination on cash <= 0: `DONE`
- Rolling runway on trailing burn: `DONE`

## 2. Distributions
- Normal, lognormal, beta, triangular, uniform, discrete: `DONE`
- Clamp min/max: `DONE`
- Beta affine scaling over [min,max]: `DONE`
- Discrete table + normalization helper in UI: `DONE`

## 3. Outputs / Metrics
- Monthly aggregates for users/new/churned/MRR/ARR/cash/burn/runway/CAC: `DONE`
- Monthly cost breakdown aggregates (fixed/payroll/variable/total): `DONE`
- Funds raised per month aggregates: `DONE`
- Macro/growth/churn realized monthly aggregates: `DONE`
- Mean/std + P5/P25/P50/P75/P95 for tracked series: `DONE`
- Default probability curve + default month distribution: `DONE`
- Survival probability: `DONE`
- Terminal ARR/cash histograms: `DONE`
- Fundraising outcomes:
  - success probabilities
  - close month distributions
  - amount raised histograms
  - valuation histograms: `DONE`
- Milestone probabilities: `DONE`
- Sensitivity (rank-correlation based): `DONE`
- Per-run outcomes (default month, terminal ARR/cash, max drawdown, max burn): `DONE`
- Narrative summary generation: `DONE`

## 4. Product/UI/API
- Model builder tabs with advanced JSON: `DONE`
- Added UI controls for new features (funnel, expansion, slippage, payroll multiplier, macro shocks, fundraising gates/bridge): `DONE`
- Scenario manager with macro + correlation override controls and JSON mode: `DONE`
- Simulation dashboard with KPI cards/charts/sensitivity/comparisons: `DONE`
- CSV + JSON exports: `DONE`
- Save/load model endpoints: `DONE`
- Simulation create/poll endpoints: `DONE`
- Expiration + cleanup endpoint: `DONE`

## 5. Infrastructure/Quality
- TypeScript full-stack implementation: `DONE`
- Prisma repository + in-memory fallback: `DONE`
- Lint/test pipeline passing: `DONE`
- Perf smoke test for 10k x 36 envelope: `DONE`

## 6. Items Not Required For PRD Core
- Multi-user collaboration: `OUT_OF_SCOPE_BY_PRD`
- Full enterprise auth/roles: `OUT_OF_SCOPE_BY_PRD`
- Real-time external market data feeds: `OUT_OF_SCOPE_BY_PRD`
- Full GAAP/accounting system: `OUT_OF_SCOPE_BY_PRD`
- Rust/Wasm module in v1: `OPTIONAL_IN_PRD`
- PDF report generation: `OPTIONAL_IN_PRD`
