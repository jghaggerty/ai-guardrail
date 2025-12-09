/**
 * Cognitive Bias Testing Framework for LLMs
 *
 * A comprehensive framework for evaluating large language models
 * for cognitive biases using structured behavioral tests.
 *
 * @version 1.0.0
 */

// Core types
export * from './core/types.ts';

// Test runner
export { TestRunner } from './core/test_runner.ts';
export type { ITestRunner } from './core/types.ts';

// Results aggregator
export { ResultsAggregator } from './core/results_aggregator.ts';
export type { DetailedAnalysis, ComparisonResult, SeverityLevel } from './core/results_aggregator.ts';

// Statistics utilities
export {
  calculateMean,
  calculateStdDeviation,
  calculateConfidenceInterval95,
  calculateConsistency,
  calculateMedian,
  calculateVariance,
  calculateMin,
  calculateMax,
  calculatePercentile,
  calculateIQR,
  detectOutliers,
  interpretBiasScore,
  compareBiasScores,
  calculateEffectSize,
  interpretEffectSize,
  calculateWeightedMean,
  statistics,
} from './utils/statistics.ts';

// Validators
export {
  validateBiasType,
  validateDifficulty,
  validateScoringRubric,
  validateTestCaseId,
  validateTestCase,
  validateTestConfiguration,
  validateTestResult,
  validateGeneratedPrompt,
  validateTestCaseCollection,
} from './utils/validators.ts';
export type { ValidationResult } from './utils/validators.ts';

// Test cases by bias type
export { anchoringTestCases } from './tests/anchoring/test_cases.ts';
export { lossAversionTestCases } from './tests/loss_aversion/test_cases.ts';
export { confirmationBiasTestCases } from './tests/confirmation_bias/test_cases.ts';
export { sunkCostTestCases } from './tests/sunk_cost_fallacy/test_cases.ts';
export { availabilityHeuristicTestCases } from './tests/availability_heuristic/test_cases.ts';

// Re-export all test cases as a single collection
import { anchoringTestCases } from './tests/anchoring/test_cases.ts';
import { lossAversionTestCases } from './tests/loss_aversion/test_cases.ts';
import { confirmationBiasTestCases } from './tests/confirmation_bias/test_cases.ts';
import { sunkCostTestCases } from './tests/sunk_cost_fallacy/test_cases.ts';
import { availabilityHeuristicTestCases } from './tests/availability_heuristic/test_cases.ts';

export const allTestCases = [
  ...anchoringTestCases,
  ...lossAversionTestCases,
  ...confirmationBiasTestCases,
  ...sunkCostTestCases,
  ...availabilityHeuristicTestCases,
];

// Framework metadata
export const FRAMEWORK_VERSION = '1.0.0';
export const SUPPORTED_BIAS_TYPES = [
  'anchoring',
  'loss_aversion',
  'confirmation_bias',
  'sunk_cost_fallacy',
  'availability_heuristic',
] as const;

/**
 * Create a new TestRunner with the given configuration.
 */
import { TestRunner } from './core/test_runner.ts';
import type { TestConfiguration, DEFAULT_CONFIG } from './core/types.ts';

export function createTestRunner(config?: Partial<TestConfiguration>): TestRunner {
  const defaultConfig: TestConfiguration = {
    biasTypes: ['anchoring', 'loss_aversion', 'confirmation_bias', 'sunk_cost_fallacy', 'availability_heuristic'],
    testIterations: 5,
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
    runControlPrompts: true,
    maxConcurrency: 5,
  };

  return new TestRunner({ ...defaultConfig, ...config });
}

/**
 * Quick helper to count test cases by bias type.
 */
export function getTestCaseCounts(): Record<string, number> {
  return {
    anchoring: anchoringTestCases.length,
    loss_aversion: lossAversionTestCases.length,
    confirmation_bias: confirmationBiasTestCases.length,
    sunk_cost_fallacy: sunkCostTestCases.length,
    availability_heuristic: availabilityHeuristicTestCases.length,
    total: allTestCases.length,
  };
}
