const MASK_64 = (1n << 64n) - 1n;

export class Pcg32 {
  private state: bigint;
  private inc: bigint;

  constructor(seed: number) {
    this.state = 0n;
    this.inc = 1442695040888963407n;
    this.nextUint32();
    this.state = (this.state + BigInt(seed >>> 0)) & MASK_64;
    this.nextUint32();
  }

  nextUint32(): number {
    const oldstate = this.state;
    this.state = (oldstate * 6364136223846793005n + this.inc) & MASK_64;
    const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
    const rot = Number(oldstate >> 59n) & 31;
    return ((xorshifted >>> rot) | (xorshifted << ((-rot) & 31))) >>> 0;
  }

  nextUniform(): number {
    return (this.nextUint32() + 1) / 4294967297;
  }
}

let spareNormal: number | null = null;

export function nextStandardNormal(rng: Pcg32): number {
  if (spareNormal !== null) {
    const value = spareNormal;
    spareNormal = null;
    return value;
  }
  const u1 = Math.max(rng.nextUniform(), Number.EPSILON);
  const u2 = rng.nextUniform();
  const mag = Math.sqrt(-2 * Math.log(u1));
  const z0 = mag * Math.cos(2 * Math.PI * u2);
  const z1 = mag * Math.sin(2 * Math.PI * u2);
  spareNormal = z1;
  return z0;
}
