# MATH_SPEC.md - Simulation Mathematics and Algorithms

Last updated: 2026-02-07
Scope: v1 math spec aligned to `PLAN.md` and `ARCHITECTURE.md`

## 1. Time and Notation

- Time step: monthly.
- Horizon: `T` months, where `12 <= T <= 60`.
- Runs: `N`, where `100 <= N <= 10,000`.
- Path index: `i in {1..N}`.
- Month index: `t in {1..T}`.

State vector per path-month:
- `U_t`: active users.
- `U_new_t`: new users added this month.
- `U_churn_t`: users churned this month.
- `MRR_t`, `ARR_t`.
- `C_fixed_t`, `C_var_t`, `C_payroll_t`, `C_total_t`.
- `profit_t`, `burn_t`, `cash_t`, `runway_t`.
- `M_t`: macro index.
- Fundraising fields: status, raised amount, valuation.

## 2. Deterministic Randomness

- Use seeded PRNG with deterministic behavior across OS/CPU for same app version.
- Do not use `Math.random`.
- All random draws come from a deterministic `RandomStream(seed)` abstraction.

Pseudo-interface:

```ts
interface RandomStream {
  nextUniform01(): number; // (0,1)
  nextStandardNormal(): number; // via deterministic transform
}
```

## 3. Distribution Definitions (v1)

Supported types:
- `normal(mu, sigma)`
- `lognormal(logMu, logSigma)`
- `beta(alpha, beta)` scaled to `[min,max]`
- `triangular(min, mode, max)`
- `uniform(min, max)`
- `discrete([{value, p}, ...])`

Common behavior:
- Optional hard clamps: `clampMin`, `clampMax`.
- Sampling pipeline:
  1. raw sample by type
  2. optional affine transform (beta scaling)
  3. clamp to bounds

## 4. Correlated Sampling via Gaussian Copula

Given `k` correlated variables in the model:
- Correlation matrix `C` (`k x k`, symmetric, ones on diagonal).
- Validate PSD. If non-PSD, apply diagonal jitter:
  - `C' = C + eps * I` iteratively until Cholesky succeeds.

Monthly draw process:
1. Draw `z ~ N(0, I_k)`.
2. Cholesky `L` from `C` (or repaired `C'`).
3. Compute correlated normal vector `y = L z`.
4. Convert each `y_j` to uniform via `u_j = Phi(y_j)`.
5. Transform `u_j` through target inverse CDF for variable `j`.
6. Apply per-variable clamps.

Notes:
- Correlation is global and static in v1.
- Same variable order must be preserved for matrix mapping.

## 5. Macro Process (AR(1))

Initialization:
- `M_0 = 0` (default, configurable later).

Transition:
- `M_t = rho * M_(t-1) + eps_t`
- `eps_t ~ N(0, sigma^2)`

Parameter constraints:
- `rho in (-1, 1)`
- `sigma >= 0`

Impact multipliers:
- `g_eff_t = g_t * (1 + gamma_g * M_t)`
- `c_eff_t = c_t * (1 + gamma_c * M_t)`
- `cac_eff_t = cac_t * (1 + gamma_cac * M_t)`

Clamp effective rates to safe ranges before downstream use.

## 6. User Growth and Churn (v1 top-down)

Given previous users `U_(t-1)`:

1. Sample baseline growth factor `g_t` from configured distribution.
2. Apply macro adjustment to get `g_eff_t`.
3. Pre-churn users:
   - `U_pre_t = U_(t-1) * g_eff_t`
4. Sample churn fraction `c_t`, apply macro -> `c_eff_t`.
5. Churned users:
   - `U_churn_t = U_pre_t * c_eff_t`
6. Final users:
   - `U_t = U_pre_t - U_churn_t`
7. New users display metric:
   - `U_new_t = max(U_pre_t - U_(t-1), 0)`

Engine may keep fractional users; UI rounds for display.

## 7. Revenue Model (v1)

- Sample `arpu_t` from distribution.
- `MRR_t = U_t * arpu_t`
- `ARR_t = 12 * MRR_t`

No expansion revenue in v1.

## 8. Cost Model (v1)

- Fixed costs `C_fixed_t`: deterministic schedule value at month `t`.
- Payroll costs `C_payroll_t`: sum of salaries of active planned hires by month.
- Variable costs:
  - sample `cogs_per_user_t`
  - `C_var_t = cogs_per_user_t * U_t`
- Total:
  - `C_total_t = C_fixed_t + C_payroll_t + C_var_t`

## 9. Profit, Burn, Cash, Runway

- `profit_t = MRR_t - C_total_t`
- `burn_t = max(-profit_t, 0)`
- `cash_t = cash_(t-1) + profit_t + funds_raised_t`

Runway denominator:
- rolling average burn over last `N_burn` months (`N_burn = 3` default).
- `avgBurn_t = mean(burn_{max(1,t-N_burn+1)} ... burn_t)`

Runway:
- if `avgBurn_t > 0`, `runway_t = cash_t / avgBurn_t`
- else `runway_t = Infinity`

Default condition:
- if `cash_t <= 0`, path defaults at month `t` and terminates immediately.

## 10. Fundraising Dynamics (v1)

Each round `R` has:
- `targetMonth m_R`
- `targetAmount`
- `preMoneyValuation`
- `timeToCloseDistribution`
- `valuationMultiplierDistribution`

Lifecycle:
1. Round becomes active around configured window logic.
2. On active month, draw `delta_t` (time to close).
3. At close month evaluate success probability with logistic model:
   - `p_success = sigma(alpha + beta1*log(max(ARR_t, eps)) + beta2*growth_t + beta3*M_t)`
4. Draw Bernoulli success.
5. If success:
   - draw raised amount `F_t`
   - draw valuation multiplier `v_mult_t`
   - valuation `V_t = preMoneyValuation * v_mult_t`
   - `funds_raised_t = F_t`
6. If failure:
   - no fallback bridge in v1

Where `sigma(x) = 1 / (1 + exp(-x))`.

## 11. Milestones

Template 1: ARR threshold by month
- Indicator per run:
  - `I_arr = 1` if `ARR_m >= threshold` else `0`

Template 2: profitability by month
- `I_profit = 1` if exists `t <= m` with `profit_t >= 0` and non-burning persistence rule if used.

Probability estimate across runs:
- `P = (1/N) * sum_i I_i`

## 12. Per-run Outputs

For each path `i`:
- monthly vectors for selected metrics.
- summary:
  - `defaultMonth_i` (or null)
  - `terminalCash_i`
  - `terminalArr_i`
  - `maxBurn_i`
  - `maxDrawdownCash_i`

Max drawdown cash:
- running peak `P_t = max(P_{t-1}, cash_t)`
- drawdown `D_t = P_t - cash_t`
- `maxDrawdown = max_t D_t`

## 13. Aggregate Outputs

For each month `t` and metric `X_t`:
- mean, median, std.
- quantiles `q05,q25,q50,q75,q95`.

Default curves:
- cumulative default probability by month:
  - `P_default_by_t = (# runs with defaultMonth <= t) / N`
- survival probability:
  - `P_survive = 1 - P_default_by_T`

Terminal distributions:
- histograms for `terminalCash`, `terminalARR`, `defaultMonth`.

Fundraising aggregates:
- close probability by round.
- distribution of close month.
- distribution of raised amount and valuation.

## 14. Sensitivity Metric (v1)

Primary metric: Spearman rank correlation.

For each input parameter `theta_j` and outcome `Y`:
- compute rank vectors `rank(theta_j_i)` and `rank(Y_i)` across runs.
- Spearman score `rho_j = corr(rank(theta_j), rank(Y))`.

Outcomes to compute at minimum:
- default by horizon (binary indicator).
- terminal ARR.
- terminal cash.

Tornado ranking:
- sort by `abs(rho_j)` descending.

Optional upgrade path:
- PRCC with regression on ranks to control for confounding.

## 15. Sample Path Retention Policy

- Persist full aggregates for all `N` runs.
- Keep `K` sampled paths where `K in [50,100]`.
- Sampling strategy v1:
  - stratified by terminal cash quantiles to preserve tail behavior.

## 16. Narrative Summary Logic (v1)

Template-driven text generated from key aggregates:
- default risk statement.
- survival statement.
- ARR uncertainty statement.
- fundraising likelihood highlights.
- milestone likelihood statement.

Rule:
- Narrative must quote computed values exactly (rounded for readability).
- No model claims beyond generated metrics.

## 17. Numerical Stability and Edge Cases

- Clamp invalid rates (e.g., negative churn, churn > 1) after transform.
- Guard against `log(0)` in fundraising model using epsilon floor.
- If variance params invalid, reject request at validation layer.
- If `avgBurn_t == 0`, runway is Infinity.
- Ensure no NaN propagates silently; fail-fast with diagnostics.

## 18. Reference Pseudocode

```text
for each scenario s:
  init correlated sampler state
  for sim i in 1..N:
    init state_0
    init macro M_0
    for month t in 1..T:
      draw correlated factors
      update macro M_t
      compute growth/churn/users
      compute revenue
      compute costs
      evaluate fundraising
      update cash/profit/burn/runway
      record monthly metrics
      if cash_t <= 0:
        mark default and break
    compute per-run summaries
  aggregate monthly and terminal metrics
  compute milestones and sensitivity
  retain sampled paths
return scenario outputs + compare deltas
```

## 19. Validation Test Cases (Math)

- Fixed seed snapshot for deterministic regression.
- Zero-volatility distributions should converge to deterministic spreadsheet-like outcome.
- No-cost scenario should never default if revenue nonnegative.
- High churn + low growth stress test should produce elevated default probability.
- Correlation sign sanity:
  - higher growth and lower churn should co-move per configured sign.
