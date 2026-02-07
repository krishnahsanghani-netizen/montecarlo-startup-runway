import { describe, expect, it } from "vitest";
import { Pcg32 } from "@/lib/sim/rng/pcg32";

describe("Pcg32", () => {
  it("is deterministic for the same seed", () => {
    const a = new Pcg32(42);
    const b = new Pcg32(42);

    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    const seqB = Array.from({ length: 5 }, () => b.nextUint32());

    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Pcg32(1);
    const b = new Pcg32(2);

    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    const seqB = Array.from({ length: 5 }, () => b.nextUint32());

    expect(seqA).not.toEqual(seqB);
  });
});
