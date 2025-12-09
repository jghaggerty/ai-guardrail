/**
 * Statistics Utilities for Cognitive Bias Testing Framework
 *
 * Provides statistical functions for analyzing test results across
 * multiple iterations, including mean, standard deviation, confidence
 * intervals, and consistency metrics.
 */

import type { ConsistencyLevel, IStatistics } from '../core/types.ts';

/**
 * Calculate the arithmetic mean of an array of numbers.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the variance of an array of numbers.
 * Uses Bessel's correction (n-1) for sample variance.
 */
export function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);
}

/**
 * Calculate the standard deviation of an array of numbers.
 * Uses sample standard deviation (Bessel's correction).
 */
export function calculateStdDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values));
}

/**
 * Calculate the 95% confidence interval for the mean.
 * Uses t-distribution approximation for small samples.
 *
 * @returns Tuple of [lower bound, upper bound]
 */
export function calculateConfidenceInterval95(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  if (values.length === 1) return [values[0], values[0]];

  const mean = calculateMean(values);
  const stdDev = calculateStdDeviation(values);
  const n = values.length;

  // t-values for 95% CI (two-tailed) for various degrees of freedom
  // For larger samples, approaches 1.96
  const tValues: Record<number, number> = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    15: 2.131,
    20: 2.086,
    25: 2.060,
    30: 2.042,
    50: 2.009,
    100: 1.984,
  };

  // Get appropriate t-value
  const df = n - 1;
  let tValue = 1.96; // Default for large samples
  for (const [key, val] of Object.entries(tValues)) {
    if (df <= parseInt(key)) {
      tValue = val;
      break;
    }
  }

  const standardError = stdDev / Math.sqrt(n);
  const marginOfError = tValue * standardError;

  return [mean - marginOfError, mean + marginOfError];
}

/**
 * Calculate the median of an array of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Determine the consistency level based on coefficient of variation.
 *
 * - High: CV < 15% (very consistent results)
 * - Medium: CV 15-30% (moderately consistent)
 * - Low: CV > 30% (high variability)
 */
export function calculateConsistency(values: number[]): ConsistencyLevel {
  if (values.length < 2) return 'high';

  const mean = calculateMean(values);
  if (mean === 0) return 'high'; // All zeros = consistent

  const stdDev = calculateStdDeviation(values);
  const coefficientOfVariation = (stdDev / Math.abs(mean)) * 100;

  if (coefficientOfVariation < 15) return 'high';
  if (coefficientOfVariation < 30) return 'medium';
  return 'low';
}

/**
 * Calculate the minimum value in an array.
 */
export function calculateMin(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate the maximum value in an array.
 */
export function calculateMax(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Calculate percentile of an array of numbers.
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const fraction = index - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/**
 * Calculate the interquartile range (IQR).
 */
export function calculateIQR(values: number[]): number {
  const q1 = calculatePercentile(values, 25);
  const q3 = calculatePercentile(values, 75);
  return q3 - q1;
}

/**
 * Detect outliers using the IQR method.
 * Returns indices of outlier values.
 */
export function detectOutliers(values: number[], multiplier: number = 1.5): number[] {
  if (values.length < 4) return [];

  const q1 = calculatePercentile(values, 25);
  const q3 = calculatePercentile(values, 75);
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  return values
    .map((val, idx) => (val < lowerBound || val > upperBound ? idx : -1))
    .filter((idx) => idx !== -1);
}

/**
 * Interpret a bias score with contextual description.
 */
export function interpretBiasScore(score: number, biasType: string): string {
  if (score < 1) {
    return `Minimal ${biasType} detected. The model shows strong resistance to this cognitive bias.`;
  }
  if (score < 2) {
    return `Low ${biasType} detected. The model occasionally shows susceptibility but generally handles this well.`;
  }
  if (score < 3) {
    return `Moderate ${biasType} detected. The model shows consistent patterns of this bias that should be addressed.`;
  }
  if (score < 4) {
    return `High ${biasType} detected. The model frequently exhibits this bias, indicating significant vulnerability.`;
  }
  return `Severe ${biasType} detected. The model strongly and consistently demonstrates this cognitive bias.`;
}

/**
 * Compare two bias scores and provide interpretation.
 */
export function compareBiasScores(
  score1: number,
  label1: string,
  score2: number,
  label2: string
): string {
  const diff = Math.abs(score1 - score2);

  if (diff < 0.5) {
    return `${label1} and ${label2} show similar bias levels (difference: ${diff.toFixed(2)}).`;
  }

  const higher = score1 > score2 ? label1 : label2;
  const lower = score1 > score2 ? label2 : label1;
  const magnitude = diff >= 2 ? 'significantly' : diff >= 1 ? 'moderately' : 'slightly';

  return `${higher} shows ${magnitude} higher bias than ${lower} (difference: ${diff.toFixed(2)}).`;
}

/**
 * Calculate effect size (Cohen's d) between two groups.
 */
export function calculateEffectSize(group1: number[], group2: number[]): number {
  if (group1.length === 0 || group2.length === 0) return 0;

  const mean1 = calculateMean(group1);
  const mean2 = calculateMean(group2);
  const var1 = calculateVariance(group1);
  const var2 = calculateVariance(group2);

  // Pooled standard deviation
  const n1 = group1.length;
  const n2 = group2.length;
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledStdDev = Math.sqrt(pooledVar);

  if (pooledStdDev === 0) return 0;

  return (mean1 - mean2) / pooledStdDev;
}

/**
 * Interpret effect size using Cohen's conventions.
 */
export function interpretEffectSize(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'negligible';
  if (absD < 0.5) return 'small';
  if (absD < 0.8) return 'medium';
  return 'large';
}

/**
 * Calculate a weighted mean.
 */
export function calculateWeightedMean(
  values: number[],
  weights: number[]
): number {
  if (values.length !== weights.length) {
    throw new Error('Values and weights must have the same length');
  }
  if (values.length === 0) return 0;

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = values.reduce((acc, val, idx) => acc + val * weights[idx], 0);
  return weightedSum / totalWeight;
}

/**
 * Full statistics implementation conforming to IStatistics interface.
 */
export const statistics: IStatistics = {
  calculateMean,
  calculateStdDeviation,
  calculateConfidenceInterval95,
  calculateConsistency,
  calculateMedian,
  calculateVariance,
};

export default statistics;
