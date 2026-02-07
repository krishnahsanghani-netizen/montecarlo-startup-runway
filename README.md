# Startup Runway & Growth Monte Carlo Lab

Founder-focused Monte Carlo modeling app for startup runway, growth, and fundraising risk.

This project is designed as an educational FP&A/quant simulation tool. It models uncertainty across growth, churn, pricing, costs, macro conditions, and fundraising dynamics, then surfaces risk distributions and scenario comparisons in an interactive dashboard.

## License

This project is licensed under the MIT License. See `LICENSE`.

## Disclaimer

This software is for educational and experimental analysis only.  
It is not investment, financial, legal, tax, or accounting advice.

## Features

### Implemented

- Monte Carlo simulation engine (seeded, reproducible).
- Multiple distribution families:
  - `normal`, `lognormal`, `beta`, `triangular`, `uniform`, `discrete`
- Correlated sampling via Gaussian copula + Cholesky decomposition.
- Revenue modeling:
  - top-down growth mode
- Cost modeling:
  - fixed, variable, payroll
- Fundraising modeling:
  - close timing uncertainty
  - logistic success model (ARR, growth, macro)
- Macro modeling:
  - AR(1) index
- Analytics and output:
  - fan charts, histograms, default curves
  - scenario overlays (Base/Bull/Bear/custom)
  - sensitivity tornado + heatmap
  - CSV and JSON export

### Planned (Post-v1 / Phase 2+)

- Time-varying and scenario-specific correlation support.
- Revenue modeling additions:
  - funnel mode (visitors -> signup -> activation)
  - expansion revenue
- Cost modeling additions:
  - payroll multiplier
  - hiring slippage
- Fundraising modeling additions:
  - metric gates
  - bridge fallback rounds
- Macro modeling addition:
  - discrete macro shock process

## Tech Stack

- Frontend: Next.js, React, TypeScript, Tailwind
- Charts: Recharts
- Backend/API: Next.js route handlers (Node runtime)
- Validation: Zod
- Persistence: Prisma + Postgres (optional), in-memory fallback
- Tests: Vitest (+ Playwright scaffold)

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create local env file:
```bash
cp .env.example .env.local
```

3. Run dev server:
```bash
npm run dev
```

4. Open:
`http://localhost:3000`

## Environment Variables

See `.env.example`:

- `DATABASE_URL` (optional): Postgres connection string for Prisma-backed persistence.
- `CLEANUP_TOKEN` (optional): token required by cleanup maintenance endpoint.

## Validation and Benchmarks

Run checks:
```bash
npm run lint
npm run test
```

Benchmark-oriented test coverage includes:
- model complexity thresholds
- quantile/output coverage
- convergence/reseeding stability
- sanity and monotonicity checks
- latency target checks

## Security and Data

- Do not commit `.env`, `.env.local`, credentials, or private keys.
- This app is a modeling tool and does not require customer PII for normal use.
- If you expose deployed endpoints publicly, set `CLEANUP_TOKEN`.

## Documentation

- `PRD.md`
- `ARCHITECTURE.md`
- `MATH_SPEC.md`
- `ROADMAP.md`
- `PLAN.md`
