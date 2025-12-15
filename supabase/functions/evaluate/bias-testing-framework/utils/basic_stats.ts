/**
 * Lightweight statistics helpers for iteration control.
 */

/** Calculate the arithmetic mean of a list of numbers. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

/** Sample variance with Bessel's correction. */
export function variance(values: number[]): number {
  if (values.length < 2) return 0
  const avg = mean(values)
  const squaredDiffs = values.map(value => Math.pow(value - avg, 2))
  return squaredDiffs.reduce((acc, value) => acc + value, 0) / (values.length - 1)
}

/** Sample standard deviation. */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values))
}

/** Coefficient of variation (as a decimal), returns 0 when mean is 0. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const avg = mean(values)
  if (avg === 0) return 0
  return standardDeviation(values) / Math.abs(avg)
}

/**
 * 95% confidence interval for the mean using t-distribution critical values
 * for small sample sizes and the normal approximation for larger n.
 */
export function confidenceInterval95(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0]
  if (values.length === 1) return [values[0], values[0]]

  const avg = mean(values)
  const sd = standardDeviation(values)
  const n = values.length
  const df = n - 1

  const tCritical = getTCritical(df)
  const marginOfError = tCritical * (sd / Math.sqrt(n))

  return [avg - marginOfError, avg + marginOfError]
}

function getTCritical(df: number): number {
  if (df <= 1) return 12.706
  if (df === 2) return 4.303
  if (df === 3) return 3.182
  if (df === 4) return 2.776
  if (df === 5) return 2.571
  if (df === 6) return 2.447
  if (df === 7) return 2.365
  if (df === 8) return 2.306
  if (df === 9) return 2.262
  if (df === 10) return 2.228
  if (df <= 15) return 2.131
  if (df <= 20) return 2.086
  if (df <= 25) return 2.06
  if (df <= 30) return 2.042
  if (df <= 50) return 2.009
  if (df <= 100) return 1.984
  return 1.96
}
