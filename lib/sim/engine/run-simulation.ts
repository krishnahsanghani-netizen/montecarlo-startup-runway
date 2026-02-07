import {
  CorrelationModel,
  DistributionDefinition,
  FundraisingRound,
  ScenarioDefinition,
  ScenarioResult,
  SensitivityPoint,
  SimulationOutput,
  SimulationRequest
} from "@/lib/domain/types";
import { choleskyWithJitter, multiplyLowerMatrixVector } from "@/lib/sim/correlation/cholesky";
import { sampleDistribution } from "@/lib/sim/distributions/sample";
import { Pcg32, nextStandardNormal } from "@/lib/sim/rng/pcg32";

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, x) => sum + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
}

function quantileSet(values: number[]) {
  if (values.length === 0) {
    return {
      mean: 0,
      std: 0,
      p5: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p95: 0
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p = (q: number) => {
    const idx = (sorted.length - 1) * q;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const t = idx - lo;
    return sorted[lo] * (1 - t) + sorted[hi] * t;
  };
  return {
    mean: mean(values),
    std: std(values),
    p5: p(0.05),
    p25: p(0.25),
    p50: p(0.5),
    p75: p(0.75),
    p95: p(0.95)
  };
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function stdNormalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax);
  return sign * y;
}

function resolveDistributionById(distributions: DistributionDefinition[]): Map<string, DistributionDefinition> {
  return new Map(distributions.map((d) => [d.id, d]));
}

function applyScenario(defs: DistributionDefinition[], scenario: ScenarioDefinition): DistributionDefinition[] {
  if (!scenario.distributionParamOverrides) return defs;
  return defs.map((def) => {
    const override = scenario.distributionParamOverrides?.[def.id];
    if (!override) return def;
    return {
      ...def,
      params: {
        ...def.params,
        ...override
      }
    };
  });
}

function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = Array(values.length).fill(0);
  let cursor = 0;
  while (cursor < indexed.length) {
    let end = cursor;
    while (end + 1 < indexed.length && indexed[end + 1].v === indexed[cursor].v) end += 1;
    const avgRank = (cursor + end + 2) / 2;
    for (let j = cursor; j <= end; j += 1) ranks[indexed[j].i] = avgRank;
    cursor = end + 1;
  }
  return ranks;
}

function pearson(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  const meanA = a.reduce((s, x) => s + x, 0) / a.length;
  const meanB = b.reduce((s, x) => s + x, 0) / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function computeSensitivity(
  inputs: Array<Record<string, number>>,
  defaultFlags: number[],
  terminalArr: number[],
  terminalCash: number[]
): SensitivityPoint[] {
  if (inputs.length === 0) return [];
  const keys = Object.keys(inputs[0]);
  const outcomeDefs: Array<{ name: SensitivityPoint["outcome"]; values: number[] }> = [
    { name: "defaultByHorizon", values: defaultFlags },
    { name: "terminalArr", values: terminalArr },
    { name: "terminalCash", values: terminalCash }
  ];

  const points: SensitivityPoint[] = [];
  for (const key of keys) {
    const xRank = rank(inputs.map((row) => row[key]));
    for (const outcome of outcomeDefs) {
      const yRank = rank(outcome.values);
      const score = pearson(xRank, yRank);
      points.push({ input: key, score, outcome: outcome.name });
    }
  }

  return points.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 24);
}

function generateNarrative(result: ScenarioResult): string {
  const s = result.summary;
  const topSensitivity = result.sensitivity[0];
  const firstMilestone = s.milestoneProbabilities[0];
  const medianDrawdown = percentile(result.runOutcomes.map((x) => x.maxDrawdownCash), 0.5);
  const sensitivitySnippet = topSensitivity
    ? ` Strongest sensitivity: ${topSensitivity.input} (${topSensitivity.outcome}, ${topSensitivity.score.toFixed(2)}).`
    : "";
  const milestoneSnippet = firstMilestone
    ? ` Milestone ${firstMilestone.type} by month ${firstMilestone.month} hit in ${Math.round(firstMilestone.probability * 100)}% of runs.`
    : "";

  return `Default by horizon occurred in ${Math.round(s.defaultProbabilityByHorizon * 100)}% of runs; survival was ${Math.round(s.survivalProbability * 100)}%. Median ARR at horizon was ${Math.round(s.medianArrAtHorizon).toLocaleString()}, with terminal cash P5/P95 at ${Math.round(s.terminalCashP5).toLocaleString()} / ${Math.round(s.terminalCashP95).toLocaleString()}. Median max cash drawdown was ${Math.round(medianDrawdown).toLocaleString()}.${milestoneSnippet}${sensitivitySnippet}`;
}

function buildHistogram(values: number[], bins = 20): Array<{ binStart: number; binEnd: number; count: number; probability: number }> {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ binStart: min, binEnd: max, count: values.length, probability: 1 }];
  }

  const width = (max - min) / bins;
  const counts = Array(bins).fill(0);
  for (const value of values) {
    const raw = Math.floor((value - min) / width);
    const idx = Math.min(bins - 1, Math.max(0, raw));
    counts[idx] += 1;
  }

  return counts.map((count, idx) => ({
    binStart: min + idx * width,
    binEnd: min + (idx + 1) * width,
    count,
    probability: count / values.length
  }));
}

interface PendingRoundClose {
  outcomeKey: string;
  roundId: string;
  roundName: string;
  closeMonth: number;
  targetAmount: number;
  preMoneyValuation: number;
  amountDistributionId?: string;
  valuationMultiplierDistributionId?: string;
  closeProbabilityDistributionId?: string;
  requiredArrMin?: number;
  requiredGrowthMin?: number;
  fallbackBridgeRound?: FundraisingRound["fallbackBridgeRound"];
}

function latestFixedCost(month: number, schedule: Array<{ month: number; amount: number }>): number {
  const active = schedule.filter((x) => x.month <= month);
  return active.length > 0 ? active[active.length - 1].amount : 0;
}

function precomputeFixedCostsByMonth(horizon: number, schedule: Array<{ month: number; amount: number }>): number[] {
  const sorted = [...schedule].sort((a, b) => a.month - b.month);
  const out = Array(horizon).fill(0);
  let pointer = 0;
  let current = 0;
  for (let month = 1; month <= horizon; month += 1) {
    while (pointer < sorted.length && sorted[pointer].month <= month) {
      current = sorted[pointer].amount;
      pointer += 1;
    }
    out[month - 1] = current;
  }
  return out;
}

function resolveMatrixForMonth(
  month: number,
  baseCorrelation: CorrelationModel | undefined,
  scenario: ScenarioDefinition
): number[][] | null {
  const scenarioByMonth = scenario.correlationsByMonthOverride
    ?.filter((x) => x.month <= month)
    .sort((a, b) => b.month - a.month)[0]?.matrix;
  if (scenarioByMonth) return scenarioByMonth;

  if (scenario.correlationOverride?.matrix?.length) return scenario.correlationOverride.matrix;

  const baseByMonth = baseCorrelation?.byMonth
    ?.filter((x) => x.month <= month)
    .sort((a, b) => b.month - a.month)[0]?.matrix;
  if (baseByMonth) return baseByMonth;

  return baseCorrelation?.matrix?.length ? baseCorrelation.matrix : null;
}

function validateMetricGate(event: PendingRoundClose, arr: number, growth: number): boolean {
  if (event.requiredArrMin !== undefined && arr < event.requiredArrMin) return false;
  if (event.requiredGrowthMin !== undefined && growth < event.requiredGrowthMin) return false;
  return true;
}

export function runSimulation(request: SimulationRequest, runId: string): SimulationOutput {
  const scenarios = request.scenarios.length > 0 ? request.scenarios : [{ id: "base", name: "Base", enabled: true }];
  const activeScenarios = scenarios.filter((s) => s.enabled !== false);
  const results: ScenarioResult[] = [];

  for (const scenario of activeScenarios) {
    const rng = new Pcg32(request.params.seed);
    const distributions = applyScenario(request.model.distributions, scenario);
    const distById = resolveDistributionById(distributions);
    const macroModel = {
      ...request.model.macroModel,
      ...(scenario.macroOverrides ?? {})
    };

    const horizon = request.params.horizonMonths;
    const nRuns = request.params.nRuns;
    const correlationVariables = request.model.correlation?.variables ?? [];
    const decompositionCache = new Map<string, ReturnType<typeof choleskyWithJitter>>();
    const lowerByMonth: Array<number[][] | null> = [];
    for (let month = 1; month <= horizon; month += 1) {
      const monthMatrix = resolveMatrixForMonth(month, request.model.correlation, scenario);
      if (!monthMatrix) {
        lowerByMonth.push(null);
        continue;
      }
      const key = JSON.stringify(monthMatrix);
      let decomposition = decompositionCache.get(key);
      if (!decomposition) {
        decomposition = choleskyWithJitter(monthMatrix);
        decompositionCache.set(key, decomposition);
      }
      lowerByMonth.push(decomposition.matrix);
    }
    const fixedCostByMonth = precomputeFixedCostsByMonth(horizon, request.model.costModel.fixedCosts);
    const roundById = new Map(request.model.fundraisingPlan.rounds.map((round) => [round.id, round]));

    const cashByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const usersByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const newUsersByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const churnedUsersByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const mrrByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const arrByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const burnByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const runwayByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const cacByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const fixedCostByMonthAgg: number[][] = Array.from({ length: horizon }, () => []);
    const payrollByMonthAgg: number[][] = Array.from({ length: horizon }, () => []);
    const variableCostByMonthAgg: number[][] = Array.from({ length: horizon }, () => []);
    const totalCostByMonthAgg: number[][] = Array.from({ length: horizon }, () => []);
    const fundsRaisedByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const macroByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const growthByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const churnByMonth: number[][] = Array.from({ length: horizon }, () => []);
    const defaultMonthCounts: number[] = Array(horizon).fill(0);

    const terminalCash: number[] = [];
    const terminalArr: number[] = [];
    const samplePaths: ScenarioResult["samplePaths"] = [];
    const runOutcomes: ScenarioResult["runOutcomes"] = [];
    const defaultFlags: number[] = [];
    const sensitivityInputs: Array<Record<string, number>> = [];
    const milestoneHits = request.model.milestones.map(() => 0);
    const roundOutcomes = new Map<
      string,
      {
        roundId: string;
        roundName: string;
        attempts: number;
        successes: number;
        closeMonthCounts: Map<number, number>;
        amountsRaised: number[];
        valuations: number[];
      }
    >();

    for (const round of request.model.fundraisingPlan.rounds) {
      roundOutcomes.set(round.id, {
        roundId: round.id,
        roundName: round.name,
        attempts: 0,
        successes: 0,
        closeMonthCounts: new Map<number, number>(),
        amountsRaised: [],
        valuations: []
      });
    }

    const anyJitter = Array.from(decompositionCache.values()).some((x) => x.jitterApplied);

    for (let run = 0; run < nRuns; run += 1) {
      let users = request.model.startingUsers;
      let cash = request.model.initialCash;
      let arr = request.model.startingMrr * 12;
      let macro = 0;
      let defaulted = false;
      let activeShockMonthsRemaining = 0;
      let activeShockImpact = 0;

      const cashPath: number[] = [];
      const usersPath: number[] = [];
      const newUsersPath: number[] = [];
      const churnedUsersPath: number[] = [];
      const mrrPath: number[] = [];
      const arrPath: number[] = [];
      const burnPath: number[] = [];
      const runwayPath: number[] = [];
      const macroPath: number[] = [];
      const fundsRaisedPath: number[] = [];
      const valuationPath: number[] = [];
      const profitPath: number[] = [];
      const burnWindow: number[] = [];
      const pendingClosesByMonth = new Map<number, PendingRoundClose[]>();
      const roundState = new Map<string, { started: boolean; completed: boolean; failed: boolean; bridgeUsed: boolean }>();
      let peakCash = cash;
      let maxDrawdownCash = 0;
      let maxBurnRate = 0;
      let defaultMonth: number | null = null;

      for (const round of request.model.fundraisingPlan.rounds) {
        roundState.set(round.id, { started: false, completed: false, failed: false, bridgeUsed: false });
      }

      const payrollDeltas = Array(horizon + 1).fill(0);
      const hiringSlippageDist = request.model.costModel.hiringSlippageDistributionId
        ? distById.get(request.model.costModel.hiringSlippageDistributionId)
        : undefined;
      for (const hire of request.model.costModel.hiringPlan) {
        const slippage = hiringSlippageDist ? Math.max(0, Math.round(sampleDistribution(hiringSlippageDist, rng))) : 0;
        const startMonth = Math.min(horizon, Math.max(1, hire.month + slippage));
        payrollDeltas[startMonth - 1] += hire.salary * hire.count;
      }
      const payrollByMonth = Array(horizon).fill(0);
      let runningPayroll = 0;
      for (let i = 0; i < horizon; i += 1) {
        runningPayroll += payrollDeltas[i];
        payrollByMonth[i] = runningPayroll;
      }

      let sensitivitySnapshot: Record<string, number> | null = null;

      for (let month = 1; month <= horizon; month += 1) {
        if (defaulted) break;

        const lower = lowerByMonth[month - 1];

        const uniforms = new Map<string, number>();
        const correlatedNormalByVar = new Map<string, number>();
        if (lower && correlationVariables.length > 0) {
          const normals = Array.from({ length: lower.length }, () => nextStandardNormal(rng));
          const correlatedNormals = multiplyLowerMatrixVector(lower, normals);
          for (let i = 0; i < correlationVariables.length; i += 1) {
            const normal = correlatedNormals[i] ?? 0;
            const u = stdNormalCdf(normal);
            uniforms.set(correlationVariables[i], Math.min(1 - Number.EPSILON, Math.max(Number.EPSILON, u)));
            correlatedNormalByVar.set(correlationVariables[i], normal);
          }
        }

        const growthDist = distById.get(request.model.revenueModel.momGrowthDistributionId);
        const churnDist = distById.get(request.model.revenueModel.churnDistributionId);
        const arpuDist = distById.get(request.model.revenueModel.arpuDistributionId);
        const cacDist = request.model.revenueModel.cacDistributionId
          ? distById.get(request.model.revenueModel.cacDistributionId)
          : undefined;
        const cogsDist = distById.get(request.model.costModel.variableCostPerUserDistributionId);

        if (!growthDist || !churnDist || !arpuDist || !cogsDist) {
          throw new Error("Missing required distribution references");
        }

        const growthBase = sampleDistribution(growthDist, rng, uniforms.get("growth"));
        const churnBase = sampleDistribution(churnDist, rng, uniforms.get("churn"));
        const arpu = sampleDistribution(arpuDist, rng, uniforms.get("arpu"));
        const cacBase = cacDist ? sampleDistribution(cacDist, rng, uniforms.get("cac")) : 0;
        const cogsPerUser = sampleDistribution(cogsDist, rng, uniforms.get("cogs"));

        const macroShockBase = correlatedNormalByVar.get("macro") ?? nextStandardNormal(rng);

        if (macroModel.shock?.enabled) {
          if (activeShockMonthsRemaining <= 0 && rng.nextUniform() < macroModel.shock.monthlyProbability) {
            const impactDist = distById.get(macroModel.shock.impactDistributionId);
            activeShockImpact = impactDist ? sampleDistribution(impactDist, rng) : -1;
            activeShockMonthsRemaining = macroModel.shock.durationMonths;
          }
        }

        macro = macroModel.rho * macro + macroModel.sigma * macroShockBase + (activeShockMonthsRemaining > 0 ? activeShockImpact : 0);
        if (activeShockMonthsRemaining > 0) activeShockMonthsRemaining -= 1;

        const growthEff = Math.max(0, growthBase * (1 + macroModel.gammaGrowth * macro));
        const churnEff = Math.min(1, Math.max(0, churnBase * (1 + macroModel.gammaChurn * macro)));
        const cacEff = Math.max(0, cacBase * (1 + macroModel.gammaCac * macro));

        const usersBefore = users;
        let preChurnUsers = usersBefore * growthEff;
        let newUsers = Math.max(preChurnUsers - usersBefore, 0);

        if (request.model.revenueModel.growthMode === "funnel" && request.model.revenueModel.funnel) {
          const visitorsDist = distById.get(request.model.revenueModel.funnel.visitorsDistributionId);
          const signupDist = distById.get(request.model.revenueModel.funnel.signupRateDistributionId);
          const activationDist = distById.get(request.model.revenueModel.funnel.activationRateDistributionId);
          if (!visitorsDist || !signupDist || !activationDist) {
            throw new Error("Missing funnel distribution references");
          }
          const visitors = Math.max(0, sampleDistribution(visitorsDist, rng, uniforms.get("visitors")));
          const signupRate = Math.min(1, Math.max(0, sampleDistribution(signupDist, rng, uniforms.get("signupRate"))));
          const activationRate = Math.min(1, Math.max(0, sampleDistribution(activationDist, rng, uniforms.get("activationRate"))));
          newUsers = Math.max(0, visitors * signupRate * activationRate);
          preChurnUsers = usersBefore + newUsers;
        }

        const churnedUsers = preChurnUsers * churnEff;
        users = Math.max(0, preChurnUsers - churnedUsers);

        const baseMrr = users * arpu;
        let expansionRevenue = 0;
        if (request.model.revenueModel.expansion?.enabled) {
          const fracDist = distById.get(request.model.revenueModel.expansion.upgradeFractionDistributionId);
          const addArpuDist = distById.get(request.model.revenueModel.expansion.additionalArpuDistributionId);
          if (fracDist && addArpuDist) {
            const upgradeFraction = Math.min(1, Math.max(0, sampleDistribution(fracDist, rng, uniforms.get("upgradeFraction"))));
            const addArpu = Math.max(0, sampleDistribution(addArpuDist, rng, uniforms.get("additionalArpu")));
            expansionRevenue = users * upgradeFraction * addArpu;
          }
        }

        const mrr = baseMrr + expansionRevenue;
        arr = mrr * 12;

        const fixedCost = fixedCostByMonth[month - 1] ?? latestFixedCost(month, request.model.costModel.fixedCosts);
        const payrollBase = payrollByMonth[month - 1] ?? 0;
        const payroll = payrollBase * (request.model.costModel.payrollTaxMultiplier ?? 1);
        const variableCost = users * cogsPerUser;
        const totalCosts = fixedCost + payroll + variableCost;

        const profit = mrr - totalCosts;
        const burn = Math.max(-profit, 0);
        burnWindow.push(burn);
        if (burnWindow.length > 3) burnWindow.shift();
        const avgBurn = burnWindow.reduce((s, x) => s + x, 0) / burnWindow.length;
        const runway = avgBurn > 0 ? cash / avgBurn : Number.POSITIVE_INFINITY;

        for (const round of request.model.fundraisingPlan.rounds) {
          const state = roundState.get(round.id);
          if (!state || state.completed || state.failed || state.started) continue;
          const windowStart = Math.max(1, round.targetMonth - 3);
          const windowEnd = Math.min(horizon, round.targetMonth + 3);
          if (month < windowStart || month > windowEnd) continue;

          const startNow = month === windowEnd ? true : rng.nextUniform() <= 0.55;
          if (!startNow) continue;

          state.started = true;
          const closeLagDef = distById.get(round.timeToCloseDistributionId);
          const closeLag = closeLagDef ? Math.max(0, Math.round(sampleDistribution(closeLagDef, rng))) : 0;
          const closeMonth = Math.min(horizon, month + closeLag);
          const entry: PendingRoundClose = {
            outcomeKey: round.id,
            roundId: round.id,
            roundName: round.name,
            closeMonth,
            targetAmount: round.targetAmount,
            preMoneyValuation: round.preMoneyValuation,
            amountDistributionId: round.amountDistributionId,
            valuationMultiplierDistributionId: round.valuationMultiplierDistributionId,
            closeProbabilityDistributionId: round.closeProbabilityDistributionId,
            requiredArrMin: round.requiredArrMin,
            requiredGrowthMin: round.requiredGrowthMin,
            fallbackBridgeRound: round.fallbackBridgeRound
          };
          const bucket = pendingClosesByMonth.get(closeMonth) ?? [];
          bucket.push(entry);
          pendingClosesByMonth.set(closeMonth, bucket);
        }

        let fundsRaised = 0;
        let valuationThisMonth = 0;
        const roundsClosingNow = pendingClosesByMonth.get(month) ?? [];
        for (const event of roundsClosingNow) {
          if (!roundOutcomes.has(event.outcomeKey)) {
            roundOutcomes.set(event.outcomeKey, {
              roundId: event.roundId,
              roundName: event.roundName,
              attempts: 0,
              successes: 0,
              closeMonthCounts: new Map<number, number>(),
              amountsRaised: [],
              valuations: []
            });
          }

          const outcome = roundOutcomes.get(event.outcomeKey)!;
          outcome.attempts += 1;
          outcome.closeMonthCounts.set(month, (outcome.closeMonthCounts.get(month) ?? 0) + 1);

          const gatePass = validateMetricGate(event, arr, growthEff);
          const probabilityMultiplierDist = event.closeProbabilityDistributionId
            ? distById.get(event.closeProbabilityDistributionId)
            : undefined;
          const probabilityMultiplier = probabilityMultiplierDist
            ? Math.min(1, Math.max(0, sampleDistribution(probabilityMultiplierDist, rng)))
            : 1;

          const p =
            logistic(
              request.model.fundraisingPlan.logisticParams.alpha +
                request.model.fundraisingPlan.logisticParams.betaArr * Math.log(Math.max(arr, 1)) +
                request.model.fundraisingPlan.logisticParams.betaGrowth * growthEff +
                request.model.fundraisingPlan.logisticParams.betaMacro * macro
            ) * probabilityMultiplier;

          const state = roundState.get(event.roundId);
          const success = gatePass && rng.nextUniform() <= p;
          if (success) {
            const amountDist = event.amountDistributionId ? distById.get(event.amountDistributionId) : undefined;
            const valuationMultDist = event.valuationMultiplierDistributionId
              ? distById.get(event.valuationMultiplierDistributionId)
              : undefined;
            const amountRaised = amountDist ? sampleDistribution(amountDist, rng) : event.targetAmount;
            const valuationMultiplier = valuationMultDist ? sampleDistribution(valuationMultDist, rng) : 1;
            const realizedValuation = Math.max(0, event.preMoneyValuation * valuationMultiplier);

            fundsRaised += amountRaised;
            valuationThisMonth = Math.max(valuationThisMonth, realizedValuation);
            outcome.successes += 1;
            outcome.amountsRaised.push(amountRaised);
            outcome.valuations.push(realizedValuation);
            if (state) {
              state.completed = true;
              state.failed = false;
            }
            continue;
          }

          if (state) state.failed = true;
          if (state && event.fallbackBridgeRound?.enabled && !state.bridgeUsed) {
            state.bridgeUsed = true;
            const bridge = event.fallbackBridgeRound;
            const bridgeOutcomeKey = `${event.roundId}__bridge`;
            const bridgeLagDist = bridge.closeLagDistributionId ? distById.get(bridge.closeLagDistributionId) : undefined;
            const bridgeLag = bridgeLagDist ? Math.max(0, Math.round(sampleDistribution(bridgeLagDist, rng))) : 1;
            const bridgeCloseMonth = Math.min(horizon, month + bridgeLag);
            const originRound = roundById.get(event.roundId);
            const bridgeEntry: PendingRoundClose = {
              outcomeKey: bridgeOutcomeKey,
              roundId: event.roundId,
              roundName: `${event.roundName} (Bridge)`,
              closeMonth: bridgeCloseMonth,
              targetAmount: event.targetAmount * 0.25,
              preMoneyValuation: event.preMoneyValuation * 0.7,
              amountDistributionId: bridge.amountDistributionId,
              valuationMultiplierDistributionId: bridge.valuationMultiplierDistributionId,
              closeProbabilityDistributionId: originRound?.closeProbabilityDistributionId,
              requiredArrMin: undefined,
              requiredGrowthMin: undefined
            };
            const bridgeBucket = pendingClosesByMonth.get(bridgeCloseMonth) ?? [];
            bridgeBucket.push(bridgeEntry);
            pendingClosesByMonth.set(bridgeCloseMonth, bridgeBucket);
          }
        }

        cash = cash + profit + fundsRaised;

        if (!sensitivitySnapshot) {
          sensitivitySnapshot = {
            growthEff,
            churnEff,
            arpu,
            cacEff,
            cogsPerUser,
            macro,
            expansionRevenue,
            fundsRaised
          };
        }

        cashByMonth[month - 1].push(cash);
        usersByMonth[month - 1].push(users);
        newUsersByMonth[month - 1].push(newUsers);
        churnedUsersByMonth[month - 1].push(churnedUsers);
        mrrByMonth[month - 1].push(mrr);
        arrByMonth[month - 1].push(arr);
        burnByMonth[month - 1].push(burn);
        runwayByMonth[month - 1].push(Number.isFinite(runway) ? runway : 1e9);
        cacByMonth[month - 1].push(cacEff);
        fixedCostByMonthAgg[month - 1].push(fixedCost);
        payrollByMonthAgg[month - 1].push(payroll);
        variableCostByMonthAgg[month - 1].push(variableCost);
        totalCostByMonthAgg[month - 1].push(totalCosts);
        fundsRaisedByMonth[month - 1].push(fundsRaised);
        macroByMonth[month - 1].push(macro);
        growthByMonth[month - 1].push(growthEff);
        churnByMonth[month - 1].push(churnEff);

        cashPath.push(cash);
        usersPath.push(users);
        newUsersPath.push(newUsers);
        churnedUsersPath.push(churnedUsers);
        mrrPath.push(mrr);
        arrPath.push(arr);
        burnPath.push(burn);
        runwayPath.push(runway);
        macroPath.push(macro);
        fundsRaisedPath.push(fundsRaised);
        valuationPath.push(valuationThisMonth);
        profitPath.push(profit);
        peakCash = Math.max(peakCash, cash);
        maxDrawdownCash = Math.max(maxDrawdownCash, peakCash - cash);
        maxBurnRate = Math.max(maxBurnRate, burn);

        if (cash <= 0) {
          defaulted = true;
          defaultMonthCounts[month - 1] += 1;
          defaultMonth = month;
        }
      }

      terminalCash.push(cashPath[cashPath.length - 1] ?? cash);
      terminalArr.push(arrPath[arrPath.length - 1] ?? arr);
      defaultFlags.push(defaulted ? 1 : 0);
      sensitivityInputs.push(
        sensitivitySnapshot ?? { growthEff: 1, churnEff: 0, arpu: 0, cacEff: 0, cogsPerUser: 0, macro: 0, expansionRevenue: 0, fundsRaised: 0 }
      );

      for (let i = 0; i < request.model.milestones.length; i += 1) {
        const milestone = request.model.milestones[i];
        const monthIdx = Math.max(0, Math.min(milestone.month - 1, horizon - 1));
        let hit = false;
        if (milestone.type === "ARR_BY_MONTH") {
          hit = (arrPath[monthIdx] ?? 0) >= milestone.threshold;
        } else if (milestone.type === "PROFITABILITY_BY_MONTH") {
          hit = profitPath.slice(0, monthIdx + 1).some((p) => p >= milestone.threshold);
        }
        if (hit) milestoneHits[i] += 1;
      }

      if (samplePaths.length < request.params.samplePathCount) {
        samplePaths.push({
          run,
          users: usersPath,
          newUsers: newUsersPath,
          churnedUsers: churnedUsersPath,
          mrr: mrrPath,
          cash: cashPath,
          arr: arrPath,
          burn: burnPath,
          runway: runwayPath,
          macroIndex: macroPath,
          fundsRaised: fundsRaisedPath,
          valuation: valuationPath
        });
      }

      runOutcomes.push({
        defaultMonth,
        terminalCash: cashPath[cashPath.length - 1] ?? cash,
        terminalArr: arrPath[arrPath.length - 1] ?? arr,
        maxDrawdownCash,
        maxBurnRate
      });
    }

    const monthlyAggregates = cashByMonth.map((cashVals, idx) => ({
      month: idx + 1,
      users: quantileSet(usersByMonth[idx]),
      newUsers: quantileSet(newUsersByMonth[idx]),
      churnedUsers: quantileSet(churnedUsersByMonth[idx]),
      mrr: quantileSet(mrrByMonth[idx]),
      cash: quantileSet(cashVals),
      arr: quantileSet(arrByMonth[idx]),
      burn: quantileSet(burnByMonth[idx]),
      runway: quantileSet(runwayByMonth[idx]),
      cac: quantileSet(cacByMonth[idx]),
      fixedCosts: quantileSet(fixedCostByMonthAgg[idx]),
      payrollCosts: quantileSet(payrollByMonthAgg[idx]),
      variableCosts: quantileSet(variableCostByMonthAgg[idx]),
      totalCosts: quantileSet(totalCostByMonthAgg[idx]),
      fundsRaised: quantileSet(fundsRaisedByMonth[idx]),
      macroIndex: quantileSet(macroByMonth[idx]),
      growthRate: quantileSet(growthByMonth[idx]),
      churnRate: quantileSet(churnByMonth[idx]),
      defaultProbabilityCumulative: defaultMonthCounts.slice(0, idx + 1).reduce((a, b) => a + b, 0) / nRuns
    }));

    const defaultProbabilityByHorizon = defaultFlags.reduce((a, b) => a + b, 0) / nRuns;

    const scenarioResult: ScenarioResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      warnings: anyJitter ? ["Correlation matrix was adjusted with diagonal jitter for PSD stability."] : [],
      summary: {
        defaultProbabilityByHorizon,
        survivalProbability: 1 - defaultProbabilityByHorizon,
        medianArrAtHorizon: percentile(terminalArr, 0.5),
        terminalCashP5: percentile(terminalCash, 0.05),
        terminalCashP95: percentile(terminalCash, 0.95),
        milestoneProbabilities: request.model.milestones.map((milestone, idx) => ({
          type: milestone.type,
          month: milestone.month,
          threshold: milestone.threshold,
          probability: milestoneHits[idx] / nRuns
        }))
      },
      monthlyAggregates,
      defaultMonthDistribution: defaultMonthCounts.map((count, idx) => ({
        month: idx + 1,
        count,
        probability: count / nRuns
      })),
      terminalHistograms: {
        arr: buildHistogram(terminalArr, 24),
        cash: buildHistogram(terminalCash, 24)
      },
      fundraisingRoundOutcomes: Array.from(roundOutcomes.values()).map((round) => {
        const closeMonthDistribution = Array.from(round.closeMonthCounts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([month, count]) => ({
            month,
            count,
            probability: round.attempts > 0 ? count / round.attempts : 0
          }));

        return {
          roundId: round.roundId,
          roundName: round.roundName,
          attempts: round.attempts,
          successes: round.successes,
          successProbability: round.attempts > 0 ? round.successes / round.attempts : 0,
          closeMonthDistribution,
          amountRaisedHistogram: buildHistogram(round.amountsRaised, 16),
          valuationHistogram: buildHistogram(round.valuations, 16)
        };
      }),
      sensitivity: computeSensitivity(sensitivityInputs, defaultFlags, terminalArr, terminalCash),
      samplePaths,
      runOutcomes,
      narrative: ""
    };

    scenarioResult.narrative = generateNarrative(scenarioResult);
    results.push(scenarioResult);
  }

  return {
    runId,
    createdAt: new Date().toISOString(),
    results
  };
}
