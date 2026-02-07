export default function DocsPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Model Documentation</h1>
        <p className="max-w-4xl text-sm text-slate-700 dark:text-slate-300">
          This page documents the v1 simulation assumptions and formulas so outputs are auditable and transparent.
        </p>
      </header>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Time Structure</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Discrete monthly simulation steps.</li>
          <li>Horizon range: 12-60 months.</li>
          <li>Each run terminates early when cash balance is less than or equal to zero.</li>
        </ul>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Core Equations</h2>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p>User updates (top-down):</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`U_pre_t = U_(t-1) * g_eff_t
U_churn_t = U_pre_t * c_eff_t
U_t = max(0, U_pre_t - U_churn_t)`}</pre>

          <p>Revenue:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`MRR_t = U_t * ARPU_t
ARR_t = 12 * MRR_t`}</pre>

          <p>Costs and cash:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`profit_t = MRR_t - costs_t
burn_t = max(-profit_t, 0)
cash_t = cash_(t-1) + profit_t + funds_raised_t`}</pre>

          <p>Runway:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`avgBurn_t = rolling_mean(burn, window=3)
runway_t = cash_t / avgBurn_t  (if avgBurn_t > 0, else Infinity)`}</pre>
        </div>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Distributions and Correlation</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Supported distributions: normal, lognormal, beta, triangular, uniform, discrete.</li>
          <li>Optional hard min/max clamps are applied after sampling.</li>
          <li>Correlations use Gaussian copula with Cholesky decomposition.</li>
          <li>If correlation matrix is near non-PSD, diagonal jitter is applied before decomposition.</li>
        </ul>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Macro and Fundraising</h2>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p>Macro index (AR(1)):</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`M_t = rho * M_(t-1) + epsilon_t`}</pre>
          <p>Macro affects growth, churn, and CAC via sensitivity multipliers. CAC is surfaced as a monthly fan chart in the dashboard.</p>

          <p>Fundraising success probability:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`p_success = sigmoid(alpha + beta_arr*log(ARR_t) + beta_growth*growth_t + beta_macro*M_t)`}</pre>
          <p>Each round also uses a sampled time-to-close lag before success/failure is resolved.</p>
        </div>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Outputs and Sensitivity</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>Monthly quantiles reported: P5, P25, P50, P75, P95.</li>
          <li>Cumulative default probability by month.</li>
          <li>Milestone hit probabilities (ARR and profitability templates).</li>
          <li>Sensitivity ranking uses rank-based (Spearman-style) scores.</li>
          <li>Dashboard includes a tornado chart by selected outcome and an input/outcome heatmap.</li>
        </ul>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">API Examples</h2>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <p>Create simulation:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`POST /api/simulations
{
  "model": { ... },
  "scenarios": [{ "id": "base", "name": "Base", "enabled": true }],
  "params": { "nRuns": 5000, "seed": 42, "horizonMonths": 36, "samplePathCount": 75 }
}`}</pre>
          <p>Fetch status/results:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`GET /api/simulations/{runId}`}</pre>
          <p>Export outputs:</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`GET /api/exports/{runId}.csv
GET /api/exports/{runId}.json`}</pre>
          <p>Maintenance cleanup (expired run artifacts):</p>
          <pre className="overflow-x-auto rounded bg-slate-100 dark:bg-slate-950 p-3 text-xs">{`POST /api/maintenance/cleanup
Headers (optional): x-cleanup-token: <CLEANUP_TOKEN>`}</pre>
        </div>
      </article>

      <article className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Troubleshooting</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
          <li>If simulations fail validation, check horizon bounds, distribution params, and correlation matrix shape.</li>
          <li>If discrete probabilities do not sum to 1, use Normalize in the Uncertainty tab.</li>
          <li>If runtime is high, lower runs or horizon and compare scenarios in smaller batches.</li>
          <li>If a run is missing, it may have expired after the 7-day retention window.</li>
        </ul>
      </article>

      <article className="space-y-2 rounded border border-amber-700/40 bg-amber-900/10 p-4">
        <h2 className="text-lg font-semibold">Disclaimer</h2>
        <p className="text-sm text-amber-100/90">
          This is an educational and experimental simulation tool. It is not investment advice, financial advice, tax advice,
          accounting advice, or legal advice.
        </p>
      </article>
    </section>
  );
}
