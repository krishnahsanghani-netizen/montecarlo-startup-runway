export interface CholeskyResult {
  matrix: number[][];
  jitterApplied: boolean;
}

function cloneMatrix(input: number[][]): number[][] {
  return input.map((row) => [...row]);
}

function isSquare(matrix: number[][]): boolean {
  const n = matrix.length;
  return n > 0 && matrix.every((row) => row.length === n);
}

export function choleskyWithJitter(input: number[][], maxAttempts = 8): CholeskyResult {
  if (!isSquare(input)) {
    throw new Error("Correlation matrix must be square");
  }

  let jitter = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matrix = cloneMatrix(input);
    if (jitter > 0) {
      for (let i = 0; i < matrix.length; i += 1) {
        matrix[i][i] += jitter;
      }
    }

    try {
      const lower = cholesky(matrix);
      return { matrix: lower, jitterApplied: jitter > 0 };
    } catch {
      jitter = jitter === 0 ? 1e-10 : jitter * 10;
    }
  }

  throw new Error("Failed to decompose correlation matrix");
}

export function multiplyLowerMatrixVector(lower: number[][], vector: number[]): number[] {
  return lower.map((row, i) => {
    let acc = 0;
    for (let j = 0; j <= i; j += 1) {
      acc += row[j] * vector[j];
    }
    return acc;
  });
}

function cholesky(matrix: number[][]): number[][] {
  const n = matrix.length;
  const lower = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let sum = 0;
      for (let k = 0; k < j; k += 1) {
        sum += lower[i][k] * lower[j][k];
      }

      if (i === j) {
        const value = matrix[i][i] - sum;
        if (value <= 0) {
          throw new Error("Matrix is not positive definite");
        }
        lower[i][j] = Math.sqrt(value);
      } else {
        lower[i][j] = (matrix[i][j] - sum) / lower[j][j];
      }
    }
  }

  return lower;
}
