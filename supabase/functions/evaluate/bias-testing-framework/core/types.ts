/**
 * Core Types for Cognitive Bias Testing Framework
 *
 * This module defines all TypeScript interfaces used throughout the
 * bias testing framework for evaluating LLMs.
 */

// ============================================================================
// ENUMS & BASIC TYPES
// ============================================================================

export type BiasType =
  | 'anchoring'
  | 'loss_aversion'
  | 'confirmation_bias'
  | 'sunk_cost_fallacy'
  | 'availability_heuristic';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type ConsistencyLevel = 'high' | 'medium' | 'low';
export type ImpactLevel = 'low' | 'medium' | 'high';

export interface IterationControlConfig {
  adaptive: boolean;
  minIterations: number;
  maxIterations: number;
  fixedIterations?: number;
  cvThreshold: number;
}

// ============================================================================
// SCORING TYPES
// ============================================================================

/**
 * A single dimension along which bias is measured.
 * Each test case can have multiple scoring dimensions.
 */
export interface ScoringDimension {
  /** Unique name for this dimension */
  name: string;
  /** Description of what this dimension measures */
  description: string;
  /** Maximum score on the 0-5 scale (5 = strong bias) */
  maxScale: 0 | 1 | 2 | 3 | 4 | 5;
  /** Specific indicators that suggest this bias dimension is present */
  indicators: string[];
  /** Example responses at different score levels */
  examples: {
    score: number;
    example: string;
  }[];
}

/**
 * Complete scoring rubric for a test case.
 * Defines how to evaluate LLM responses for bias.
 */
export interface ScoringRubric {
  /** List of dimensions to evaluate */
  dimensions: ScoringDimension[];
  /** Weight assigned to each dimension (must sum to 1.0) */
  weights: Record<string, number>;
  /** Human-readable guide for interpreting overall scores */
  interpretationGuide: string;
}

// ============================================================================
// TEST CASE TYPES
// ============================================================================

/**
 * A single test case designed to detect a specific cognitive bias.
 */
export interface TestCase {
  /** Unique identifier (e.g., 'anchoring_001') */
  id: string;
  /** Type of bias this test targets */
  biasType: BiasType;
  /** Human-readable test name */
  name: string;
  /** Detailed description of what bias this tests and why */
  description: string;
  /** The prompt template to send to LLM (may contain {{placeholders}}) */
  prompt: string;
  /** Variables that can be substituted in the prompt template */
  promptVariables?: Record<string, string | number | string[]>;
  /** Patterns in responses that would indicate this bias */
  expectedBiasIndicators: string[];
  /** How to score the response */
  scoringRubric: ScoringRubric;
  /** Difficulty level for filtering */
  difficulty: Difficulty;
  /** Specific category within the bias type */
  category: string;
  /** Tags for filtering and grouping */
  tags: string[];
  /** Control prompt without bias trigger (for comparison) */
  controlPrompt?: string;
  /** Expected baseline response characteristics */
  baselineExpectation?: string;
}

/**
 * A prompt generated from a test case, ready to send to an LLM.
 */
export interface GeneratedPrompt {
  /** Reference to the source test case */
  testCaseId: string;
  /** Which iteration this is (1-indexed) */
  iteration: number;
  /** The actual prompt string to send */
  prompt: string;
  /** Optional control prompt for comparison */
  controlPrompt?: string;
  /** Metadata for tracking and analysis */
  metadata: {
    biasType: BiasType;
    category: string;
    difficulty: Difficulty;
    tags: string[];
  };
  /** Variables used in this specific prompt instance */
  appliedVariables?: Record<string, string | number>;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result from a single test iteration (before aggregation).
 */
export interface TestResult {
  /** Reference to the source test case */
  testCaseId: string;
  /** Which iteration this result is from */
  iterationNumber: number;
  /** Raw response from the LLM (filled when LLM is called) */
  rawResponse: string;
  /** Scores for each dimension */
  biasScores: Record<string, number>;
  /** Weighted overall bias score (0-5) */
  overallBiasScore: number;
  /** Confidence in the scoring (0-1) */
  confidence: number;
  /** When this test was run */
  timestamp: string;
  /** Optional reasoning for the scores */
  scoringReasoning?: string;
  /** Response from control prompt (if applicable) */
  controlResponse?: string;
  /** Comparison between test and control responses */
  controlComparison?: {
    testScore: number;
    controlScore: number;
    differential: number;
  };
}

/**
 * Aggregated results across all iterations of a test case.
 */
export interface AggregatedResults {
  /** Reference to the source test case */
  testCaseId: string;
  /** Bias type for grouping */
  biasType: BiasType;
  /** Number of iterations completed */
  iterations: number;
  /** Statistical measures */
  meanBiasScore: number;
  stdDeviation: number;
  minScore: number;
  maxScore: number;
  /** 95% confidence interval for the mean */
  confidenceInterval95: [number, number];
  /** How consistent were the scores across iterations */
  consistency: ConsistencyLevel;
  /** Running statistics across iterations for traceability */
  iterationStats: IterationStatsSnapshot[];
  /** Human-readable interpretation of results */
  interpretation: string;
  /** Per-dimension aggregated scores */
  dimensionScores: Record<string, {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  }>;
  /** All individual results for detailed analysis */
  rawResults: TestResult[];
}

export interface IterationStatsSnapshot {
  iteration: number;
  mean: number;
  stdDev: number;
  confidenceInterval95: [number, number];
  coefficientOfVariation: number;
  timestamp: string;
}

/**
 * Bias score from scoring a single response.
 */
export interface BiasScore {
  /** Reference to the source test case */
  testCaseId: string;
  /** Scores for each dimension (0-5 scale) */
  dimensionScores: Record<string, number>;
  /** Weighted overall score */
  overallScore: number;
  /** Confidence in the scoring (0-1) */
  confidence: number;
  /** Explanation of how scores were determined */
  reasoning: string;
  /** Detected bias indicators found in the response */
  detectedIndicators: string[];
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * User-configurable settings for running tests.
 */
export interface TestConfiguration {
  /** Which bias types to test */
  biasTypes: BiasType[];
  /** Number of iterations per test case */
  testIterations: number;
  /** Optional adaptive iteration settings */
  iterationControl?: IterationControlConfig;
  /** Filter tests by difficulty */
  difficulty: Difficulty[];
  /** Random seed for reproducibility (optional) */
  randomSeed?: number;
  /** Output format for results */
  outputFormat: 'json' | 'csv' | 'html';
  /** Optional filter by tags */
  tags?: string[];
  /** Optional filter by categories */
  categories?: string[];
  /** Whether to run control prompts */
  runControlPrompts?: boolean;
  /** Maximum concurrent tests (for future LLM integration) */
  maxConcurrency?: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: TestConfiguration = {
  biasTypes: ['anchoring', 'loss_aversion', 'confirmation_bias', 'sunk_cost_fallacy', 'availability_heuristic'],
  testIterations: 5,
  difficulty: ['easy', 'medium', 'hard'],
  outputFormat: 'json',
  runControlPrompts: true,
  maxConcurrency: 5,
};

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Complete test suite output ready for execution.
 */
export interface TestSuiteOutput {
  /** Framework metadata */
  metadata: {
    frameworkVersion: string;
    generatedAt: string;
    configuration: {
      biasTypes: BiasType[];
      testIterations: number;
      totalTestCases: number;
      difficulty: Difficulty[];
    };
  };
  /** All test cases with generated prompts */
  testSuite: TestCaseWithPrompts[];
  /** Flag indicating readiness */
  readyForExecution: boolean;
}

/**
 * A test case bundled with its generated prompts.
 */
export interface TestCaseWithPrompts {
  /** The test case definition */
  testCase: TestCase;
  /** Generated prompts for all iterations */
  prompts: GeneratedPrompt[];
}

/**
 * Complete test report after execution.
 */
export interface TestReport {
  /** Report metadata */
  metadata: {
    reportId: string;
    generatedAt: string;
    totalTests: number;
    totalIterations: number;
    configuration: TestConfiguration;
    executionTime?: number;
  };
  /** Summary statistics by bias type */
  summaryByBiasType: Record<BiasType, {
    testCount: number;
    meanScore: number;
    stdDev: number;
    highestBias: string;
    lowestBias: string;
  }>;
  /** Detailed results for each test case */
  detailedResults: AggregatedResults[];
  /** Overall findings and recommendations */
  overallFindings: {
    mostProblematicBias: BiasType;
    leastProblematicBias: BiasType;
    overallBiasScore: number;
    confidence: number;
    recommendations: string[];
  };
}

// ============================================================================
// FRAMEWORK INTERFACES
// ============================================================================

/**
 * Interface for the main test runner.
 */
export interface ITestRunner {
  /** Load test cases for specific bias types */
  loadTestCases(biasTypes: BiasType[]): Promise<TestCase[]>;

  /** Generate all prompts based on configuration */
  generatePrompts(
    testCases: TestCase[],
    testIterations: number,
    randomSeed?: number
  ): Promise<GeneratedPrompt[]>;

  /** Generate a mock response for testing (placeholder for LLM) */
  generateMockResponse(
    testCase: TestCase,
    iteration: number
  ): Promise<string>;

  /** Score a response for bias */
  scoreResponse(
    testCase: TestCase,
    response: string
  ): Promise<BiasScore>;

  /** Aggregate results across iterations */
  aggregateResults(
    results: TestResult[],
    iterationStats?: IterationStatsSnapshot[]
  ): Promise<AggregatedResults>;

  /** Generate final report */
  generateReport(
    results: AggregatedResults[],
    config: TestConfiguration
  ): Promise<TestReport>;
}

/**
 * Interface for the results aggregator.
 */
export interface IResultsAggregator {
  /** Aggregate a set of test results */
  aggregate(results: TestResult[], iterationStats?: IterationStatsSnapshot[]): AggregatedResults;

  /** Generate summary by bias type */
  summarizeByBiasType(
    results: AggregatedResults[]
  ): Record<BiasType, { testCount: number; meanScore: number; stdDev: number }>;

  /** Calculate overall findings */
  calculateOverallFindings(
    results: AggregatedResults[]
  ): TestReport['overallFindings'];
}

/**
 * Interface for statistics utilities.
 */
export interface IStatistics {
  calculateMean(values: number[]): number;
  calculateStdDeviation(values: number[]): number;
  calculateConfidenceInterval95(values: number[]): [number, number];
  calculateConsistency(values: number[]): ConsistencyLevel;
  calculateMedian(values: number[]): number;
  calculateVariance(values: number[]): number;
}
