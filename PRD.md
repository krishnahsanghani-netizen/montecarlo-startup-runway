# Startup Runway & Growth Monte Carlo Lab – Product Requirements Document (PRD)

## 0. Meta

- **Audience:** High school senior / early‑college engineer with solid JS/TS + some Python, aiming for “serious quant-ish” project.
- **Style:** Single‑founder build, but architected like a real product.
- **Core idea:** A web app that lets a user model a startup’s growth, unit economics, and fundraising over time using a **Monte Carlo simulation engine**. It outputs deep risk metrics, visualizations, and scenario comparisons in a polished dashboard.

---

## 1. Product Overview

### 1.1 Problem

Founders and operators usually work off point estimates (“we’ll grow 20% MoM”, “burn 50k/month”) and static spreadsheets. Reality is noisy:

- Revenue, churn, CAC, fundraising, and macro conditions are **uncertain and correlated**.
- A simple deterministic spreadsheet hides **risk** (e.g., probability of running out of cash before a round closes).
- Most Monte Carlo tools are either too trivial ( inside enterprise finance tools.

### 1.2 Solution

Build a **Startup Runway & Growth Monte Carlo Lab**:

- Users define a startup model (revenue engine, costs, fundraising plan, macro assumptions).
- Each uncertain variable is modeled as a **probability distribution** (with optional correlations).
- The simulation engine runs **thousands of Monte Carlo paths** over a multi‑year horizon (e.g., 36–60 months).
- The app visualizes:
  - Distribution of **cash runway** and **probability of default**.
  - Distributions of **MRR/ARR**, user counts, burn, valuation over time.
  - **Scenario comparison**: base / bull / bear / custom.
  - **Sensitivity analysis**: what inputs actually drive risk.
- Front end is a polished, interactive Next.js app; backend is a dedicated simulation service.

### 1.3 Goals

- **Impressiveness:** Look and behave like a legit early‑stage quant/FP&A product, not a school project.
- **Depth:** Non‑toy model: correlations, multiple distributions, fundraising dynamics, scenario anaensitivity metrics.
- **Transparency:** Clear assumptions / formulas so a reviewer can see rigor.
- **Extensibility:** Architecture that can support other domains (portfolio, SaaS benchmarking) later.

### 1.4 Non‑Goals

- Real‑time market data feeds (e.g., pulling interest rates or macro data).
- Full‑blown accounting system (no GAAP financial statements beyond simplified P&L + cashflow).
- Multi‑tenant auth/roles beyond minimal login (if you add auth at all).

---

## 2. User Personas & Use Cases

### 2.1 Personas

1. **Founder / Operator (primary)**
   - Wants to know: “If I hire 3 engineers and increase marketing, what’s my probability of running out of cash by Month 18?”
   - Non‑technical, but comfortable adjusting sliders and reading charts.

2. **Student / Analyst (secondary)**
   - Uses the tool to learn Monte Carlo, unit economics, and risk.
   - May want to export data to CSV and do custom analysis.

3. **Admissions / Recruiter (implicit)**
   - Evaluates the app as a signal of teytical sophistication.

### 2.2 Core Use Cases

- **UC1: Build a base startup model**
  - Define initial cash, monthly fixed costs, variable costs, user growth, pricing, churn, CAC, fundraising plan.

- **UC2: Add uncertainty + distributions**
  - For each key input (e.g., MoM growth, churn, CAC, close probability of fundraising), choose a probability distribution and parameters.

- **UC3: Run Monte Carlo simulation**
  - Specify # of runs, time horizon, random seed.
  - Start simulation; see progress; get outputs as charts + summary panels.

- **UC4: Compare scenarios**
  - Create multiple named scenarios (Base, Aggressive Growth, Recession, Disaster).
  - Run all; visually compare distributions.

- **UC5: Sensitivity / risk analysis**
  - See which inputs drive most variance in key outcomes (e.g., probability of default, ARR at 36 months).

- **UC6: Export & share**
  - Export results to CSV.
  - Optionally save and reload model configs.

---

## 3. System Architecture

### 3.1 High‑Level Architecture

**Frontend:** Next.js + React + TypeScript
  - Pages: Model builder, Simulation dashboard, Scenario comparison, About/Docs.
  - Data viz: e.g., Recharts, D3, Plotly, or similar.

- **Backend Simulation Service:**
  - Option A: Node/TypeScript (fast enough with optimized loops).
  - Option B (more quant‑vibes): Python (FastAPI) with NumPy for vectorized simulation.

- **Optional Performance Module:**
  - Rust compiled to WebAssembly for the hot simulation loop, called from frontend or backend.

- **Persistence:**
  - Simple PostgreSQL (via Prisma/Drizzle) or SQLite for:
    - Saved model configs.
    - Scenario definitions.
    - Simulation metadata (not necessarily full path data if huge).

- **Communication:**
  - REST or JSON RPC over HTTP:
    - `POST /api/simulations` – start simulation.
    - `GET /api/simulations/:id` – get results/summary.
    - `POST /api/models` – save model config.
    - etc.

---

## 4. Data Model & Domain Logic

### 4.1 Time Structure

- Discrete time steps: **monthly**.on: 12–60 months (user‑selectable; default 36).
- Each simulation run produces:
  - An ordered sequence of monthly state vectors.

### 4.2 Core Entities

1. **StartupModel**
   - `name`
   - `time_horizon_months`
   - `initial_cash`
   - `starting_users`
   - `starting_mrr`
   - `macro_sensitivity` params (see 4.6)
   - Lists of:
     - `RevenueModel`
     - `CostModel`
     - `FundraisingPlan`
     - `HiringPlan`
     - `DistributionDefinitions`
     - `ScenarioDefinitions`

2. **RevenueModel**
   - **User Growth:**
     - Base deterministic growth structure (e.g., `user_growth_mode: "top_down" | "funnel"`)
     - Top‑down: a base % MoM growth with uncertainty.
     - Funnel: visitors → signups → active users with conversion rates.
   - **Pricing:**
     - `avg_revenue_per_user` (ARPU) with potential uncertainty.
     - Optionally multiple pricing tiers and mix percentages.

3. **CostModel**
   - Fixed costs: `rent`, `tools`, etc.
   - Variable costs: `cogs_per_user`, `support_cost_per_user`.
   t‑driven costs: salary per role, headcount plan by month, optionally random delays/hiring slippage.

4. **FundraisingPlan**
   - Each planned round:
     - `round_name` (Seed, Series A, etc.)
     - `target_month` (approximate)
     - `target_amount`
     - `pre_money_valuation`
     - **Uncertain elements:**
       - `close_probability_distribution`
       - `time_to_close_distribution` (lag in months)
       - `valuation_multiplier_distribution` (adjust base valuation)
   - Optionally dependency on metrics (e.g., must hit certain ARR to unlock round).

5. **HiringPlan**
   - For each future month:
     - Planned hires by role with salary ranges.
     - Potential uncertainty in hiring date and salary.

6. **DistributionDefinition**
   - ID, name (e.g., “MoM growth rate”, “Logo churn rate”).
   - Type:
     - `normal`
     - `lognormal`
     - `beta`
     - `triangular`
     - `uniform`
     - `discrete` (e.g., scenario weights)
   - Parameters:
     - Normal: mean, std, min/max clamps.
     - Logan/logmean, std/logstd.
     - Beta: alpha, beta, min, max.
     - Triangular: min, mode, max.
     - Uniform: min, max.
     - Discrete: (value, probability) pairs.
   - Scales & constraints (e.g., bounded to [0, 1] for churn).

7. **ScenarioDefinition**
   - Name (Base, Bull, Bear, etc.).
   - Overrides for:
     - Distribution parameters (e.g., more volatility in Bear).
     - Macro index behavior (see 4.6).
     - Fundraising probabilities.
     - CAC multipliers.

8. **CorrelationModel**
   - Correlation matrix between selected distributions (e.g., MoM growth, churn, CAC, macro index).
   - Implementation detail: use **Cholesky decomposition** of correlation matrix to transform independent normals into correlated ones.

### 4.3 State Vector per Month

For each month \( t \), state includes:

- `month_index`
- **Users / Revenue:**
  - `active_users`
  - `new_users`
  - `churned_users`
  - `mrr` (monthly recurring revenue)
  - `arr` (annual recurring revenue)
- **Costs:**
  - `fixed_costs`
  - `variable_costs`
  - `payroll_costs`
  - `total_costs`
- **Cash & Runway:**
  - `cash_balance`
  - `net_burn` (if positive)
  - `runway_months_remaining` (cash_balance / avg_burn_recent_n_months, or simple current_burn)
- **Fundraising:**
  - `funds_raised_this_month`
  - `valuation_this_round`
  - `round_status` (not_started / in_progress / closed / failed)
- **Macro & other:**
  - `macro_index_value`
  - `growth_rate_realized`
  - `churn_rate_realized`
  - `cac_realized`
  - Any shock indicators.

---

## 5. Simulation Engine

### 5.1 Overview

For each **simulation run**:

1. Initialize startup state at month 0.
2. For each month \( t = 1, \dots, T \):
   - Sample all relevant random variables (with correlation).
   - Compute user growth, churn, revenue.
   - Compute costs and burn.
   - Update cash balance and runway.
   - Evaluate fundraising events.
   - Record outputs.
   - Check termination conditions (e.g., cash ≤ 0).

### 5.2 Pseudocode (High Level)

```text
for sim in 1..N_SIMULATIONS:
  state = initial_ate(startup_model)
  macro_state = init_macro_state(startup_model)
  for t in 1..T:
    draws = sample_correlated_randoms(distribution_defs, correlation_matrix, macro_state)
    macro_state = update_macro_state(macro_state, draws)

    user_metrics = update_users(state, draws, startup_model, macro_state, t)
    revenue_metrics = update_revenue(state, user_metrics, draws, startup_model, macro_state, t)
    cost_metrics = update_costs(state, user_metrics, startup_model, t)
    fundraising_metrics = update_fundraising(state, startup_model, draws, macro_state, t)

    state = update_state(state, user_metrics, revenue_metrics, cost_metrics, fundraising_metrics)

    record_month(sim, t, state)
    if state.cash_balance <= 0:
      mark_default(sim, t)
      break
 5.3 Random Sampling & Correlation
Base random source:

Use a high‑quality PRNG (e.g., Mersenne Twister, PCG, or default RNG with seed).

Support setting a global seed for reproducibility.

Correlation:

Specify correlation matrix 
C
C for some variables (e.g., growth, churn, CAC, macro_index).

Compute Cholesky 
L
L of 
C
C.

Each month:

Sample independent standard normals 
z
∼
N
(
0
,
I
)
z∼N(0,I).

Compute correlated normals 
y
=
L
z
y=Lz.

Transform 
y
y to desired distributions via inverse CDF (e.g., normal → any distribution through inverse CDF or using copula approach).

5.4 User Growth & Churn Calculations
Growth:

Let:

g
t
g 
t
  be realized MoM growth factor for users at month 
t
t, sampled from distribution (e.g., lognormal around mean 1.10).

U
t
−
1
U 
t−1
  be active users at month 
t
−
1
t−1.

New users before churn:

U
t
pre-churn
=
U
t
−
1
⋅
g
t
U 
t
pre-churn
 =U 
t−1
 ⋅g 
t
 

Or use funnel model:

visitors
t
∼
visitors 
t
 ∼ distribution

\text{signup_rext{activation_rate}_t \sim distribution

\text{new_users}_t = \text{visitors}_t \cdot \text{signup_rate}_t \cdot \text{activation_rate}_t

Churn:

Let:

c
t
c 
t
  be churn fraction, e.g., 
c
t
∼
beta
(
α
,
β
)
c 
t
 ∼beta(α,β).

Churned users:

churned
t
=
U
t
pre-churn
⋅
c
t
churned 
t
 =U 
t
pre-churn
 ⋅c 
t
 

Final users:

U
t
=
U
t
pre-churn
−
churned
t
U 
t
 =U 
t
pre-churn
 −churned 
t
 

5.5 Revenue & Pricing Calculations
ARPU (Average Revenue Per User):

a
t
∼
a 
t
 ∼ distribution (e.g., lognormal with constraints).

MRR:

MRR
t
=
U
t
⋅
a
t
MRR 
t
 =U 
t
 ⋅a 
t
 

ARR:

ARR
t
=
12
⋅
MRR
t
ARR 
t
 =12⋅MRR 
t
 

(Optional) Upgrades / Expansion revenue:

Let:

Fraction of users who upgrade: 
u
t
∼
u 
t
 ∼ distribution.

Additional ARPU for upgraded users: 
Δ
a
t
∼
Δa 
t
 ∼ distribution.

Then:

Expansion revenue 
=
U
t
⋅
u
t
⋅
Δ
a
t
=U 
t
 ⋅u 
t
 ⋅Δa 
t
 

Total MRR 
=
U
t
⋅
a
t
+
expansion revenue
=U 
t
 ⋅a 
t
 +expansion revenue

5.6 Cost Calculaine + occasional step increases).

Or some fixed costs can be uncertain (e.g., “rent increase risk”).

Payroll:

For each planned hire, define:

name, role, base_salary, start_month_distribution.

For each month, compute headcount and payroll cost.

Variable costs:

\text{cogs_per_user}_t \sim distribution.

\text{variable_costs}_t = \text{cogs_per_user}_t \cdot U_t

Total costs:

costs
t
=
fixed
t
+
payroll
t
+
variable
t
costs 
t
 =fixed 
t
 +payroll 
t
 +variable 
t
 

5.7 Cash & Runway Calculations
Net profit / loss:

profit
t
=
MRR
t
−
costs
t
profit 
t
 =MRR 
t
 −costs 
t
 

Net burn:

burn
t
=
max
⁡
(
−
profit
t
,
0
)
burn 
t
 =max(−profit 
t
 ,0)

Cash update:

cash
t
=
cash
t
−
1
+
profit
t
+
funds_raised
t
cash 
t
 =cash 
t−1
 +profit 
t
 +funds_raised 
t
 

Runway:

Basic:

runway
t
=
cash
t
/
burn
t
runway 
t
 =cash 
t
 /burn 
t
  (if burn_t > 0, else infinite).

Smoothed:

Use average burn over last N months for numerator.

Default condition:

If cash_t <= 0 → mark month 
t
nd stop this run.

5.8 Fundraising Dynamics
Each planned round 
R
R has:

Target month 
m
R
m 
R
 .

Round window (e.g., months 
[
m
R
−
3
,
m
R
+
3
]
[m 
R
 −3,m 
R
 +3]).

Round amount distribution (around target).

Valuation base (pre‑money) with multiplier distribution.

Monthly check (for each month 
t
t):

If not yet started and 
t
t in pre‑window:

With some probability start raising.

If raising:

Draw time to close 
Δ
t
Δt from distribution.

At close month 
t
+
Δ
t
t+Δt, determine:

Probability of success based on macro + metrics:

E.g., logistic function:

p
success
=
σ
(
α
+
β
1
⋅
log
⁡
(
ARR
t
)
+
β
2
⋅
growth_rate
t
+
β
3
⋅
macro
t
)
p 
success
 =σ(α+β 
1
 ⋅log(ARR 
t
 )+β 
2
 ⋅growth_rate 
t
 +β 
3
 ⋅macro 
t
 ).

If success:

Funds raised 
F
t
∼
F 
t
 ∼ distribution.

Valuation multiplier 
∼
∼ distribution.

Update cash_t += F_t.

Else:

Round fails; optional fallback (bridge round with lower amount, harsher terms).

5.9 Macro Index & Shocks
Model (1) process:

M
t
=
ρ
M
t
−
1
+
ϵ
t
M 
t
 =ρM 
t−1
 +ϵ 
t
 , where 
ϵ
t
∼
N
(
0
,
σ
2
)
ϵ 
t
 ∼N(0,σ 
2
 ).

Impact:

Growth adjustment:

Effective growth factor:

g
t
eff
=
g
t
⋅
(
1
+
γ
g
M
t
)
g 
t
eff
 =g 
t
 ⋅(1+γ 
g
 M 
t
 ).

Churn adjustment:

c
t
eff
=
c
t
⋅
(
1
+
γ
c
M
t
)
c 
t
eff
 =c 
t
 ⋅(1+γ 
c
 M 
t
 ).

CAC adjustment:

CAC
t
eff
=
CAC
t
⋅
(
1
+
γ
cac
M
t
)
CAC 
t
eff
 =CAC 
t
 ⋅(1+γ 
cac
 M 
t
 ).

Fundraising probability:

Already included via logistic function above.

Optional discrete shocks:

E.g., “macro crash” event with low probability in any month:

If triggered, set 
M
t
M 
t
  to very negative value and/or temporarily spike churn and reduce growth.

6. Outputs & Metrics
6.1 Per‑Run Outputs (micro‑level)
For each simulation run 
i
i:

Time series for each month:

active_users, new_users, churned_users

MRR, ARR

cash_balance

burn

runway_months_remaining

macro_index

funds_raised_this_month, valuation_this_round

Summary per run:

defaultl_cash

terminal_arr

max_drawdown_cash

max_burn_rate

Did key milestones get hit? (e.g., ARR > X by month Y)

6.2 Aggregated Outputs (macro‑level)
Across all runs:

Runway & Default Risk

Probability of default by each month 
P
(
cash
≤
0
 by 
t
)
P(cash≤0 by t).

Distribution of default month.

Probability of surviving full horizon without default.

Revenue & Growth

For each month:

Mean, median, standard deviation of MRR/ARR.

Percentiles (5th, 25th, 50th, 75th, 95th) of MRR/ARR.

Cash & Burn

Cash balance distribution by month.

Burn distribution by month.

Drawdown metrics:

Max drawdown of cash: difference between peak and trough.

Fundraising Outcomes

Probability each round closes successfully.

Distribution of closing month (vs planned).

Distribution of amounts raised and valuations.

Milestone Probabilities

Probability of hitting custom user‑defined milestones (e.g., ARR > 1M by Month 24).

Probability of being profitable by Month T.

6.3 Sensitivity & Attribution Metrics
Input sensitical / global):

For each input distribution parameter (e.g., mean MoM growth, churn mean, CAC mean):

Compute correlation or partial rank correlation with key outcomes:

Default by T (indicator).

ARR at month T.

Cash at month T.

Produce tornado chart ranking inputs by absolute effect size.

Scenario decomposition:

Compare scenario sets:

Differences in default probability.

Differences in distribution of ARR, cash, etc.

7. UX / UI Requirements
7.1 Pages / Screens
Landing / Overview

One‑paragraph explanation of Monte Carlo and startup modeling.

“Get Started” button → Model Builder.

Links to documentation / “How the model works”.

Model Builder

Multi‑step wizard or tabbed interface:

Basics: initial cash, starting users, time horizon.

Revenue: growth model, ARPU, churn.

Costs: fixed, payroll, variable.

Fundraising: planned rounds.

Uncertainty: configure distributions.

Macro & correlations.

Live preview of model summary.

Scenario Manager

List of scenarios with toggle switches.

Fio:

Override parameters via forms.

Ability to duplicate and edit scenarios.

Simulation Dashboard

Controls:

of runs, random seed, horizon override (if allowed).
“Run simulation” button; progress indicator/spinner.

Visualizations (see 7.2).

Key metric cards at top:

Default probability by horizon.

Median ARR at horizon.

5th/95th percentile cash at horizon.

Probability of hitting user‑defined milestone.

Scenario Comparison View

Side‑by‑side or overlay charts for multiple scenarios:

E.g., probability of default vs. time, ARR bands, etc.

Table summarizing key stats per scenario.

Data / Export View

Buttons:

Export summary stats as CSV.

Export all path data (if not too large) or subset.

Optional: simple text summary generator (“In 62% of simulations, you run out of cash before Month 18…”).

7.2 Visualizations
Use consistent color palette and typography; charts should look “fintech / SaaS dashboard” quality.

Runway & Default:

Line chart with shaded band (5th–95th percentil
Step function or line for cumulative default probability over time.

Revenue & Users:

Fan chart (percentile bands) of MRR/ARR and users over time.

Overlay median path vs. percentile bands.

Distributions at Horizon:

Histogram / density plot of ARR at final month.

Histogram of terminal cash.

Histogram of default month.

Fundraising:

Violin or box plots for valuation distributions per round.

Bar chart: probability of successful close for each round.

Sensitivity:

Tornado chart: horizontal bars for each input showing effect on outcome (e.g., change in default probability when moving input from 25th to 75th percentile).

Heatmap: correlations between inputs and outcomes.

Scenario Comparison:

Multiple lines/bands per scenario on same plots, with legend.

7.3 Interactions
Hover tooltips on charts with exact values.

Clickable legends to toggle series visibility.

“Drilldown”:

Click a percentile band to lock view.

Option to inspect a few example individual simulation paths.

8. Technical Implementn Details
8.1 Frontend (Next.js + TypeScript)
Structure:

/ – Landing.

/model – Model builder.

/scenarios – Scenario manager.

/simulate – Simulation dashboard.

/docs – Model documentation.

State Management:

Use React Context or Zustand/Redux to manage current StartupModel and scenarios.

Debounced auto‑save to backend (optional, but impressive).

Forms:

Use a form library (e.g., React Hook Form) for robust validation:

Ensure probabilities in [0,1], positive amounts, etc.

API Calls:

POST /api/simulations with:

Serialized StartupModel.

Selected ScenarioDefinitions.

Simulation parameters (n_runs, seed, horizon).

Poll GET /api/simulations/:id until status completed.

8.2 Backend
Simulation Service API:

Implement in Node/TS or Python (FastAPI).

Endpoints:

POST /simulations: creates a simulation job.

GET /simulations/:id: fetches status + results.

Job Handling:

For MVP: run synchronously but with a small limit on n_runs (e.g., up to 10k).

For extra polish:

Use a job queue (e.g., allow longer runs asynchronously.

Show an in‑app notification when simulation completes.

Simulation Engine:

Written in an optimized, pure function style:

Input: model + scenario + n_runs + seed.

Output: aggregated stats + optionally thin sample of paths.

Use vectorized math where possible.

Optionally abstract sampling into a “RandomStream” object.

8.3 Optional Rust / WebAssembly Module
Extract core Monte Carlo loop into Rust:

Expose function taking:

Flattened parameters & distribution definitions.

n_runs, horizon.

Return:

Aggregated summary statistics + maybe path data.

Compile to WebAssembly:

Either:

Run in frontend (browser side) to avoid server load.

Or run in backend for higher control and easier data aggregation.

Use a Web Worker in frontend for running Wasm without blocking UI thread.

9. Non‑Functional Requirements
Performance:

Target: 10k runs × 36 months within ~1–3 seconds on typical laptop for default model.

Reproducibility:

If user sets a seed, repeated runs with nputs should yield identical aggregated outputs.

Robustness:

Handle edge cases: zero burn, infinite runway, no users, etc.

Testability:

Unit tests for:

Distribution sampling functions.

Correlation transformation.

Cashflow and runway logic.

Simple scenarios where closed‑form expectations are known.

Documentation:

/docs page:

Explain each assumption.

Show formulas.

Simple small‑scale example with 10 runs to illustrate.

10. Feature List (Checklist Style)
10.1 Core Modeling
 Define initial cash, starting users, time horizon.

 Configure revenue model (growth + churn + ARPU).

 Configure cost model (fixed, payroll, variable).

 Define fundraising plan with uncertain close timing and success probability.

 Configure macro index and its parameters.

 Define probability distributions for key inputs.

 Define correlation matrix and enforce validity.

10.2 Simulation Engine
 Implement PRNG with seeding.

 Implement independent sampling for all distributions.

 Implement correlation via Cholesky.

 Iment monthly loop with:

 User growth & churn.

 Revenue & ARR.

 Costs & burn.

 Cash balance & runway.

 Fundraising events.

 Macro index updates.

 Implement termination on default.

 Capture per‑run metrics and aggregated statistics.

10.3 Analytics & Metrics
 Default probability curve over time.

 Distribution of default month.

 Distribution of ARR & cash at each month.

 Milestone probability calculator (user‑defined).

 Sensitivity analysis (correlations / PRCC).

 Scenario comparison metrics.

10.4 Frontend & UX
 Model builder UI with validation.

 Scenario manager UI.

 Simulation run controls & progress feedback.

 Dashboard with:

 Runway chart (with bands).

 Revenue/user fan charts.

 Histograms of terminal outcomes.

 Fundraising success charts.

 Sensitivity / tornado chart.

 Scenario comparison view.

 Export CSV.

10.5 Polish / Extras
 Seed field for reproducibility.

 Tooltips explaining each parameter and metric.

 Pre‑defined example models (e.g., “SaaS app”, “Marketplace�de (optional but nice).

 Simple “story” summary that verbalizes results.

11. Roadmap / Phases
Phase 1 – MVP Engine + Simple UI
Basic model: initial cash, simple growth, churn, ARPU, fixed cost.

Single scenario, independent distributions, no correlation.

Run simulations, show:

Cash bands over time.

Default probability.

ARR distribution at horizon.

Minimal UI for input + a couple charts.

Phase 2 – Fundraising & Macro
Add fundraising plan with uncertain success + timing.

Add macro index and its influence on growth, churn, CAC, fundraising.

Add scenario system (Base/Bull/Bear).

Phase 3 – Correlations & Sensitivity
Implement correlation model via Cholesky.

Add sensitivity analysis and tornado chart.

Add more advanced charts.

Phase 4 – Performance & Polish
Optimize engine (vectorization / Rust+Wasm).

Add scenario comparison view.

Improve UI design, exports, documentation.

12. Deliverables
Codebase:

Next.js frontend with pages and components as described.

Backend simulation service PI.

(Optional) Rust/Wasm module for core simulation.

Documentation:

/docs page explaining math.

README summarizing architecture and how to run.

Demo:

Hosted web app with at least:

1–2 pre‑configured example models.

Ability for user to tweak inputs and re‑run simulations.

text
