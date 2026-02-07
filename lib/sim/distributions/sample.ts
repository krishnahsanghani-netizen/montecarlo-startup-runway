import { DistributionDefinition } from "@/lib/domain/types";
import { Pcg32, nextStandardNormal } from "@/lib/sim/rng/pcg32";

function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function inverseNormalCdfApprox(p: number): number {
  // Acklam approximation, enough for simulation inputs
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const plow = 0.02425;
  const phigh = 1 - plow;

  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function sampleGamma(shape: number, rng: Pcg32): number {
  if (shape < 1) {
    const u = rng.nextUniform();
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const z = nextStandardNormal(rng);
    const u = rng.nextUniform();
    const v = Math.pow(1 + c * z, 3);
    if (v <= 0) continue;
    if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
      return d * v;
    }
  }
}

function sampleBeta(alpha: number, beta: number, rng: Pcg32): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  return x / (x + y);
}

export function sampleDistribution(def: DistributionDefinition, rng: Pcg32, uniformOverride?: number): number {
  const p = uniformOverride ?? rng.nextUniform();
  let value = 0;

  switch (def.type) {
    case "normal": {
      const mu = def.params.mean ?? 0;
      const sigma = def.params.std ?? 1;
      value = mu + sigma * inverseNormalCdfApprox(p);
      break;
    }
    case "lognormal": {
      const logMean = def.params.logMean ?? 0;
      const logStd = def.params.logStd ?? 1;
      value = Math.exp(logMean + logStd * inverseNormalCdfApprox(p));
      break;
    }
    case "beta": {
      const alpha = def.params.alpha ?? 2;
      const beta = def.params.beta ?? 2;
      const min = def.params.min ?? 0;
      const max = def.params.max ?? 1;
      value = min + (max - min) * sampleBeta(alpha, beta, rng);
      break;
    }
    case "triangular": {
      const min = def.params.min ?? 0;
      const mode = def.params.mode ?? 0.5;
      const max = def.params.max ?? 1;
      const f = (mode - min) / (max - min);
      value = p < f ? min + Math.sqrt(p * (max - min) * (mode - min)) : max - Math.sqrt((1 - p) * (max - min) * (max - mode));
      break;
    }
    case "uniform": {
      const min = def.params.min ?? 0;
      const max = def.params.max ?? 1;
      value = min + (max - min) * p;
      break;
    }
    case "discrete": {
      const entries = def.discreteValues ?? [];
      let cumulative = 0;
      value = entries.length > 0 ? entries[entries.length - 1].value : 0;
      for (const entry of entries) {
        cumulative += entry.probability;
        if (p <= cumulative) {
          value = entry.value;
          break;
        }
      }
      break;
    }
    default:
      value = 0;
  }

  return clamp(value, def.clampMin, def.clampMax);
}
