import { describe, expect, it } from "vitest";
import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";
import { runSimulation } from "@/lib/sim/engine/run-simulation";

describe("simulation performance smoke", () => {
  it("runs 10000 x 36 within practical latency envelope", () => {
    const started = Date.now();
    const output = runSimulation(
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
      "run_perf"
    );
    const elapsedMs = Date.now() - started;

    expect(output.results.length).toBe(1);
    expect(elapsedMs).toBeLessThan(6000);
  });
});
