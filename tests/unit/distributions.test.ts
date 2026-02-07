import { describe, expect, it } from "vitest";
import { sampleDistribution } from "@/lib/sim/distributions/sample";
import { Pcg32 } from "@/lib/sim/rng/pcg32";

describe("sampleDistribution", () => {
  it("applies clamps", () => {
    const rng = new Pcg32(42);
    const value = sampleDistribution(
      {
        id: "n",
        name: "clamped",
        type: "normal",
        params: { mean: 100, std: 50 },
        clampMin: 90,
        clampMax: 95
      },
      rng,
      0.999
    );

    expect(value).toBeGreaterThanOrEqual(90);
    expect(value).toBeLessThanOrEqual(95);
  });
});
