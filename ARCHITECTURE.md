# ARCHITECTURE.md - v1 Technical Architecture

Last updated: 2026-02-07

## 1. Architecture Goals

- Keep full stack in TypeScript.
- Support deterministic, reproducible simulations.
- Fit 0 USD/month budget on free tiers.
- Preserve a clean seam for future Rust/Wasm engine swap.

## 2. Deployment Topology (0 USD/month)

## 2.1 Preferred v1 topology
- Frontend + API: Next.js on Vercel free tier.
- Database: free-tier Postgres provider (choose provider with active free plan at implementation time).

Rationale:
- Single deploy target simplifies operations.
- No separate backend service to manage initially.
- Route handlers can host simulation API in Node runtime.

## 2.2 Fallback topology
- Frontend: Vercel free tier.
- Backend: small Node service on a free host.
- DB: same free-tier Postgres provider.

Use fallback only if Vercel execution limits become a blocker.

## 2.3 Cost control constraints
- Cap runs/request to 10k.
- Cap runs/day/session (configurable, e.g., 100).
- Keep simulation artifacts 7 days then expire.
- Do not store all raw paths.

## 3. Component Architecture

### 3.1 Modules
- `web-ui`: forms, charts, UX logic.
- `api`: route handlers, validation, orchestration.
- `sim-core`: deterministic simulation engine (pure TS module).
- `analytics`: aggregation, sensitivity, narrative synthesis.
- `data`: Prisma models and repositories.

### 3.2 Runtime boundaries
- Client:
  - Form state, chart rendering, local interaction.
- Server:
  - Validation, simulation execution, aggregation, persistence, exports.

### 3.3 Engine seam for future Rust/Wasm
Define an interface the current TS engine implements:

```ts
export interface SimulationEngine {
  run(input: SimulationInput): Promise<SimulationOutput>;
}
```

Future Wasm module only needs to satisfy this contract.

## 4. Data Model (Prisma-level)

### 4.1 Core tables
- `model_configs`
  - `id`, `name`, `payload_json`, `created_at`, `updated_at`
- `simulation_runs`
  - `id`, `model_config_id`, `status`, `seed`, `n_runs`, `horizon_months`, `started_at`, `completed_at`, `expires_at`
- `simulation_results`
  - `id`, `simulation_run_id`, `summary_json`, `monthly_aggregates_json`, `sample_paths_json`, `sensitivity_json`, `narrative_text`

### 4.2 Optional table
- `shared_links` (v1.5)
  - `id`, `token`, `model_config_id or simulation_run_id`, `created_at`, `expires_at`

### 4.3 JSON payload strategy
Use JSON columns to avoid over-normalization while schema is evolving.
Strong runtime validation with Zod before write/read.

## 5. Folder Structure and Naming Conventions

Recommended structure:

```text
.
├─ app/
│  ├─ (marketing)/
│  ├─ model/
│  ├─ scenarios/
│  ├─ simulate/
│  ├─ docs/
│  └─ api/
│     ├─ models/
│     ├─ simulations/
│     └─ exports/
├─ components/
│  ├─ ui/
│  ├─ forms/
│  ├─ charts/
│  └─ layout/
├─ lib/
│  ├─ domain/
│  ├─ validation/
│  ├─ sim/
│  │  ├─ engine/
│  │  ├─ rng/
│  │  ├─ distributions/
│  │  ├─ correlation/
│  │  └─ transitions/
│  ├─ analytics/
│  ├─ export/
│  ├─ db/
│  └─ utils/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ public/
├─ PLAN.md
├─ ARCHITECTURE.md
├─ MATH_SPEC.md
└─ ROADMAP.md
```

Naming conventions:
- Files: kebab-case (`simulation-engine.ts`).
- Types/interfaces: PascalCase.
- Functions/variables: camelCase.
- Constants: UPPER_SNAKE_CASE.
- Zod schemas suffix: `Schema`.
- DTO suffix: `Dto`.

## 6. API Contracts (v1)

## 6.1 `POST /api/models`
Creates or updates a model config.

Request body:
```json
{
  "id": "optional-existing-id",
  "name": "B2B SaaS Base",
  "model": {
    "timeHorizonMonths": 36,
    "initialCash": 500000,
    "startingUsers": 120,
    "startingMrr": 12000,
    "revenueModel": {
      "growthMode": "top_down",
      "momGrowthDistributionId": "dist_growth",
      "arpuDistributionId": "dist_arpu",
      "churnDistributionId": "dist_churn"
    },
    "costModel": {
      "fixedCosts": [{"month": 1, "amount": 25000}],
      "variableCostPerUserDistributionId": "dist_cogs",
      "hiringPlan": [{"month": 4, "role": "Engineer", "salary": 12000, "count": 2}]
    },
    "fundraisingPlan": {
      "rounds": [
        {
          "name": "Seed+",
          "targetMonth": 10,
          "targetAmount": 2000000,
          "preMoneyValuation": 12000000,
          "timeToCloseDistributionId": "dist_close_lag",
          "valuationMultiplierDistributionId": "dist_val_mult"
        }
      ],
      "logisticParams": {"alpha": -2.0, "betaArr": 0.45, "betaGrowth": 1.1, "betaMacro": 0.6}
    },
    "macroModel": {"rho": 0.65, "sigma": 0.2, "gammaGrowth": 0.12, "gammaChurn": 0.08, "gammaCac": 0.1},
    "distributions": [],
    "correlation": {"variables": ["growth", "churn", "arpu", "macro"], "matrix": [[1, -0.4, 0.2, 0.5], [-0.4, 1, -0.1, -0.5], [0.2, -0.1, 1, 0.2], [0.5, -0.5, 0.2, 1]]},
    "milestones": [{"type": "ARR_BY_MONTH", "threshold": 1000000, "month": 24}]
  },
  "scenarios": []
}
```

Response:
```json
{"id":"mdl_123","savedAt":"2026-02-07T22:00:00.000Z"}
```

## 6.2 `GET /api/models/:id`
Response:
```json
{
  "id": "mdl_123",
  "name": "B2B SaaS Base",
  "model": {"...": "..."},
  "scenarios": [{"id":"scn_base","name":"Base"}],
  "updatedAt": "2026-02-07T22:00:00.000Z"
}
```

## 6.3 `POST /api/simulations`
Creates a simulation run.

Request:
```json
{
  "modelId": "mdl_123",
  "scenarioIds": ["scn_base", "scn_bear"],
  "params": {
    "nRuns": 5000,
    "seed": 424242,
    "horizonMonths": 36,
    "samplePathCount": 75
  }
}
```

Response:
```json
{"runId":"run_456","status":"queued"}
```

## 6.4 `GET /api/simulations/:id`
Response (completed):
```json
{
  "runId": "run_456",
  "status": "completed",
  "progress": 100,
  "params": {"nRuns": 5000, "seed": 424242, "horizonMonths": 36},
  "summary": {
    "defaultProbabilityByHorizon": 0.28,
    "medianArrAtHorizon": 3100000,
    "terminalCashP5": -120000,
    "terminalCashP95": 8500000,
    "survivalProbability": 0.72
  },
  "monthlyAggregates": [{"month":1,"cash":{"p5":420000,"p50":510000,"p95":610000}}],
  "sensitivity": [{"input":"momGrowth.mean","score":-0.63,"outcome":"defaultByHorizon"}],
  "samplePaths": [{"run":14,"cash":[500000,470000,430000]}],
  "narrative": "In 28% of simulations, the company ran out of cash before month 36...",
  "expiresAt": "2026-02-14T22:00:00.000Z"
}
```

## 6.5 Export endpoints
- `GET /api/exports/:runId.csv`
- `GET /api/exports/:runId.json`

## 7. Validation and Guardrails

### 7.1 Input guardrails
- `nRuns` in `[100, 10000]`.
- `horizonMonths` in `[12, 60]`.
- Probabilities in `[0, 1]`.
- Distribution params checked for feasibility.
- Correlation matrix dimensions and symmetry enforced.

### 7.2 Runtime guardrails
- Concurrency limit for scenario runs per request.
- Timeout budget per simulation; fail gracefully with partial diagnostics.
- Artifact expiration policy default 7 days.

## 8. Progress and Execution Model

Because queue is deferred in v1:
- `POST /api/simulations` creates run record.
- Work executes synchronously in server handler context.
- `GET /api/simulations/:id` polled by frontend for status/progress.

If sync execution proves unreliable on host limits:
- fallback to lightweight background worker process in free Node host.

## 9. Observability

- Structured logs for:
  - simulation start/end
  - duration
  - seed, runs, horizon
  - validation failures
  - expiry deletions
- Optional Sentry free integration for unhandled exceptions.
- Simple health endpoint: `GET /api/health`.

## 10. Security and Compliance

- No auth in v1 by default.
- No PII storage expected.
- Add legal disclaimer in footer/docs/results page.
- Use provider-managed TLS and DB encryption defaults.

## 11. Scaling Path (post-v1)

- Add queue (BullMQ/Redis) for long-running jobs.
- Add cached identical-request memoization.
- Replace TS engine hot loop with Rust/Wasm under same engine interface.
- Add auth and share-link permissions.
