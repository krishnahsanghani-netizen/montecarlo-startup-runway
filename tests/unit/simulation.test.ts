import { describe, expect, it } from "vitest";
import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";
import { runSimulation } from "@/lib/sim/engine/run-simulation";

describe("runSimulation", () => {
  it("returns scenario results with milestone probabilities", () => {
    const output = runSimulation(
      {
        model: defaultModel,
        scenarios: [defaultScenarios[0]],
        params: {
          nRuns: 200,
          seed: 123,
          horizonMonths: 24,
          samplePathCount: 20
        }
      },
      "run_test"
    );

    expect(output.results.length).toBe(1);
    const result = output.results[0];
    expect(result.summary.defaultProbabilityByHorizon).toBeGreaterThanOrEqual(0);
    expect(result.summary.defaultProbabilityByHorizon).toBeLessThanOrEqual(1);
    expect(result.summary.milestoneProbabilities.length).toBe(defaultModel.milestones.length);
    expect(result.monthlyAggregates[0].burn.p50).toBeGreaterThanOrEqual(0);
  });
});
