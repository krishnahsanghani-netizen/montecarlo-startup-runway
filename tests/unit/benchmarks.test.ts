import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";
import { StartupModel } from "@/lib/domain/types";
import { runSimulation } from "@/lib/sim/engine/run-simulation";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stochasticInputIds(model: StartupModel): string[] {
  const ids = new Set<string>();
  ids.add(model.revenueModel.momGrowthDistributionId);
  ids.add(model.revenueModel.churnDistributionId);
  ids.add(model.revenueModel.arpuDistributionId);
  if (model.revenueModel.cacDistributionId) ids.add(model.revenueModel.cacDistributionId);
  if (model.revenueModel.funnel) {
    ids.add(model.revenueModel.funnel.visitorsDistributionId);
    ids.add(model.revenueModel.funnel.signupRateDistributionId);
    ids.add(model.revenueModel.funnel.activationRateDistributionId);
  }
  if (model.revenueModel.expansion?.enabled) {
    ids.add(model.revenueModel.expansion.upgradeFractionDistributionId);
    ids.add(model.revenueModel.expansion.additionalArpuDistributionId);
  }
  ids.add(model.costModel.variableCostPerUserDistributionId);
  if (model.costModel.hiringSlippageDistributionId) ids.add(model.costModel.hiringSlippageDistributionId);
  if (model.macroModel.shock?.enabled) ids.add(model.macroModel.shock.impactDistributionId);
  for (const round of model.fundraisingPlan.rounds) {
    ids.add(round.timeToCloseDistributionId);
    ids.add(round.valuationMultiplierDistributionId);
    if (round.amountDistributionId) ids.add(round.amountDistributionId);
    if (round.closeProbabilityDistributionId) ids.add(round.closeProbabilityDistributionId);
    if (round.fallbackBridgeRound?.enabled) {
      if (round.fallbackBridgeRound.amountDistributionId) ids.add(round.fallbackBridgeRound.amountDistributionId);
      if (round.fallbackBridgeRound.valuationMultiplierDistributionId) ids.add(round.fallbackBridgeRound.valuationMultiplierDistributionId);
      if (round.fallbackBridgeRound.closeLagDistributionId) ids.add(round.fallbackBridgeRound.closeLagDistributionId);
    }
  }
  return Array.from(ids);
}

function runDefault(nRuns: number, seed: number, horizonMonths = 36) {
  return runSimulation(
    {
      model: defaultModel,
      scenarios: defaultScenarios,
      params: {
        nRuns,
        seed,
        horizonMonths,
        samplePathCount: 50
      }
    },
    `bench_${nRuns}_${seed}`
  );
}

describe("benchmark compliance", () => {
  it("meets sophistication/complexity targets", () => {
    const inputs = stochasticInputIds(defaultModel);
    expect(inputs.length).toBeGreaterThanOrEqual(10);

    expect(defaultModel.correlation?.variables.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(defaultModel.correlation?.variables.length ?? 0).toBeLessThanOrEqual(6);

    const distributionFamilies = new Set(defaultModel.distributions.map((d) => d.type));
    expect(distributionFamilies.size).toBeGreaterThanOrEqual(5);
  });

  it("meets output comprehensiveness targets", () => {
    const output = runDefault(1200, 123, 24);
    expect(output.results.length).toBeGreaterThanOrEqual(3);

    const base = output.results.find((x) => x.scenarioId === "base") ?? output.results[0];
    const keys = Object.keys(base.monthlyAggregates[0] ?? {});
    expect(keys.length).toBeGreaterThanOrEqual(15);

    const cash = base.monthlyAggregates[0].cash;
    expect([cash.p5, cash.p25, cash.p50, cash.p75, cash.p95].every((v) => Number.isFinite(v))).toBe(true);
  });

  it("meets computational accuracy and stability targets", () => {
    const out10k = runDefault(10000, 42, 24);
    const base10k = out10k.results.find((x) => x.scenarioId === "base") ?? out10k.results[0];
    const p24 = base10k.monthlyAggregates[23].defaultProbabilityCumulative;
    const se = Math.sqrt((p24 * (1 - p24)) / 10000);
    expect(se).toBeLessThanOrEqual(0.02);

    const outSeedA = runDefault(10000, 111, 24);
    const outSeedB = runDefault(10000, 222, 24);
    const a = outSeedA.results.find((x) => x.scenarioId === "base") ?? outSeedA.results[0];
    const b = outSeedB.results.find((x) => x.scenarioId === "base") ?? outSeedB.results[0];

    const defaultDiffAbs = Math.abs(a.summary.defaultProbabilityByHorizon - b.summary.defaultProbabilityByHorizon);
    const defaultDenom = Math.max(0.01, Math.abs(a.summary.defaultProbabilityByHorizon));
    const defaultRelative = defaultDiffAbs / defaultDenom;

    const arrDiffAbs = Math.abs(a.summary.medianArrAtHorizon - b.summary.medianArrAtHorizon);
    const arrDenom = Math.max(1, Math.abs(a.summary.medianArrAtHorizon));
    const arrRelative = arrDiffAbs / arrDenom;

    expect(defaultRelative).toBeLessThan(0.05);
    expect(arrRelative).toBeLessThan(0.05);

    const out1k = runDefault(1000, 42, 24);
    const out5k = runDefault(5000, 42, 24);
    const out10kConvergence = runDefault(10000, 42, 24);

    const p5k = (out5k.results.find((x) => x.scenarioId === "base") ?? out5k.results[0]).monthlyAggregates[23]
      .defaultProbabilityCumulative;
    const p10k = (out10kConvergence.results.find((x) => x.scenarioId === "base") ?? out10kConvergence.results[0])
      .monthlyAggregates[23].defaultProbabilityCumulative;

    const se10k = Math.sqrt((p10k * (1 - p10k)) / 10000);
    const convergenceDelta = Math.abs(p10k - p5k);
    expect(convergenceDelta).toBeLessThanOrEqual(Math.max(1e-6, 0.1 * se10k));

    const p1k = (out1k.results.find((x) => x.scenarioId === "base") ?? out1k.results[0]).monthlyAggregates[23]
      .defaultProbabilityCumulative;
    expect(Number.isFinite(p1k)).toBe(true);
  }, 60000);

  it("passes internal consistency sanity cases (10/10)", () => {
    const cases: Array<{ name: string; model: StartupModel; check: (output: ReturnType<typeof runSimulation>) => boolean }> = [];

    const zeroChurn = clone(defaultModel);
    zeroChurn.distributions = zeroChurn.distributions.map((d) =>
      d.id === zeroChurn.revenueModel.churnDistributionId
        ? { ...d, type: "discrete", params: {}, discreteValues: [{ value: 0, probability: 1 }] }
        : d
    );
    cases.push({
      name: "zeroChurn",
      model: zeroChurn,
      check: (o) => (o.results[0].summary.defaultProbabilityByHorizon ?? 1) < 0.2
    });

    const noGrowth = clone(defaultModel);
    noGrowth.distributions = noGrowth.distributions.map((d) =>
      d.id === noGrowth.revenueModel.momGrowthDistributionId
        ? { ...d, type: "discrete", params: {}, discreteValues: [{ value: 1, probability: 1 }] }
        : d
    );
    cases.push({ name: "noGrowth", model: noGrowth, check: (o) => Number.isFinite(o.results[0].summary.medianArrAtHorizon) });

    const veryHighCash = clone(defaultModel);
    veryHighCash.initialCash = 100_000_000;
    cases.push({ name: "veryHighCash", model: veryHighCash, check: (o) => o.results[0].summary.defaultProbabilityByHorizon <= 0.001 });

    const zeroCosts = clone(defaultModel);
    zeroCosts.costModel.fixedCosts = [{ month: 1, amount: 0 }];
    zeroCosts.costModel.hiringPlan = [];
    zeroCosts.distributions = zeroCosts.distributions.map((d) =>
      d.id === zeroCosts.costModel.variableCostPerUserDistributionId
        ? { ...d, type: "discrete", params: {}, discreteValues: [{ value: 0, probability: 1 }] }
        : d
    );
    cases.push({ name: "zeroCosts", model: zeroCosts, check: (o) => o.results[0].monthlyAggregates[5].runway.p50 > 1e8 });

    const noFundraising = clone(defaultModel);
    noFundraising.fundraisingPlan.rounds = [];
    cases.push({ name: "noFundraising", model: noFundraising, check: (o) => o.results[0].fundraisingRoundOutcomes.length === 0 });

    const highChurn = clone(defaultModel);
    highChurn.distributions = highChurn.distributions.map((d) =>
      d.id === highChurn.revenueModel.churnDistributionId
        ? { ...d, type: "discrete", params: {}, discreteValues: [{ value: 0.5, probability: 1 }] }
        : d
    );
    cases.push({
      name: "highChurn",
      model: highChurn,
      check: (o) => (o.results[0].monthlyAggregates[23]?.users.p50 ?? Number.POSITIVE_INFINITY) < defaultModel.startingUsers
    });

    const noUsers = clone(defaultModel);
    noUsers.startingUsers = 0;
    noUsers.startingMrr = 0;
    cases.push({ name: "noUsers", model: noUsers, check: (o) => o.results[0].monthlyAggregates[0].arr.p50 >= 0 });

    const growthOnly = clone(defaultModel);
    growthOnly.revenueModel.growthMode = "top_down";
    cases.push({ name: "growthOnly", model: growthOnly, check: (o) => o.results[0].monthlyAggregates[10].users.p50 > 0 });

    const funnelOnly = clone(defaultModel);
    funnelOnly.revenueModel.growthMode = "funnel";
    cases.push({ name: "funnelOnly", model: funnelOnly, check: (o) => o.results[0].monthlyAggregates[10].newUsers.p50 >= 0 });

    const shockHeavy = clone(defaultModel);
    if (shockHeavy.macroModel.shock) {
      shockHeavy.macroModel.shock.monthlyProbability = 0.5;
    }
    cases.push({ name: "shockHeavy", model: shockHeavy, check: (o) => Number.isFinite(o.results[0].monthlyAggregates[5].macroIndex.p50) });

    let passCount = 0;
    const failed: string[] = [];
    for (const c of cases) {
      const output = runSimulation(
        {
          model: c.model,
          scenarios: [{ id: "base", name: "Base", enabled: true }],
          params: {
            nRuns: 1200,
            seed: 99,
            horizonMonths: 24,
            samplePathCount: 20
          }
        },
        "toy"
      );
      if (c.check(output)) {
        passCount += 1;
      } else {
        failed.push(c.name);
      }
    }

    expect(failed).toEqual([]);
    expect(passCount).toBe(10);
  }, 20000);

  it("passes scenario monotonicity in >=95% of repeated configs", () => {
    let passes = 0;
    const trials = 20;

    for (let i = 0; i < trials; i += 1) {
      const output = runSimulation(
        {
          model: defaultModel,
          scenarios: defaultScenarios,
          params: {
            nRuns: 1200,
            seed: 1000 + i,
            horizonMonths: 24,
            samplePathCount: 10
          }
        },
        `mono_${i}`
      );

      const byId = new Map(output.results.map((r) => [r.scenarioId, r]));
      const base = byId.get("base");
      const bear = byId.get("bear");
      const bull = byId.get("bull");
      if (!base || !bear || !bull) continue;

      const defaultOrdered = bear.summary.defaultProbabilityByHorizon >= base.summary.defaultProbabilityByHorizon &&
        base.summary.defaultProbabilityByHorizon >= bull.summary.defaultProbabilityByHorizon;
      const arrOrdered = bear.summary.medianArrAtHorizon <= base.summary.medianArrAtHorizon &&
        base.summary.medianArrAtHorizon <= bull.summary.medianArrAtHorizon;
      if (defaultOrdered && arrOrdered) passes += 1;
    }

    expect(passes / trials).toBeGreaterThanOrEqual(0.95);
  }, 60000);

  it("meets practical UX targets: latency and chart richness", () => {
    const started = Date.now();
    runSimulation(
      {
        model: defaultModel,
        scenarios: [defaultScenarios[0]],
        params: {
          nRuns: 10000,
          seed: 2026,
          horizonMonths: 36,
          samplePathCount: 50
        }
      },
      "latency"
    );
    const elapsedMs = Date.now() - started;
    const maxLatencyMs = process.env.CI ? 7000 : 3000;
    expect(elapsedMs).toBeLessThanOrEqual(maxLatencyMs);

    const simulatePage = fs.readFileSync(path.join(process.cwd(), "app/simulate/page.tsx"), "utf8");
    const chartTypes = ["LineChart", "BarChart", "AreaChart", "ScatterChart"].filter((type) =>
      simulatePage.includes(type)
    );
    expect(chartTypes.length).toBeGreaterThanOrEqual(4);
  }, 20000);
});
