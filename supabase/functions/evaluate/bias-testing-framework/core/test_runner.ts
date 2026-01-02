/**
 * Test Runner for Cognitive Bias Testing Framework
 *
 * Orchestrates the loading, generation, scoring, and aggregation of
 * bias tests. Designed to work without LLM calls initially, with
 * placeholder for future LLM integration.
 */

import type {
  BiasType,
  TestCase,
  GeneratedPrompt,
  TestResult,
  BiasScore,
  AggregatedResults,
  TestConfiguration,
  TestReport,
  TestSuiteOutput,
  ITestRunner,
  IterationControlConfig,
  IterationStatsSnapshot,
} from './types.ts';

import type { LLMClient, LLMOptions } from '../../llm-clients/types.ts';

import { anchoringTestCases } from '../tests/anchoring/test_cases.ts';
import { lossAversionTestCases } from '../tests/loss_aversion/test_cases.ts';
import { confirmationBiasTestCases } from '../tests/confirmation_bias/test_cases.ts';
import { sunkCostTestCases } from '../tests/sunk_cost_fallacy/test_cases.ts';
import { availabilityHeuristicTestCases } from '../tests/availability_heuristic/test_cases.ts';

import {
  calculateMean,
  calculateStdDeviation,
  calculateConfidenceInterval95,
  calculateConsistency,
  calculateMin,
  calculateMax,
  interpretBiasScore,
} from '../utils/statistics.ts';
import {
  coefficientOfVariation,
  confidenceInterval95,
  mean,
  standardDeviation,
} from '../utils/basic_stats.ts';

// Framework version
const FRAMEWORK_VERSION = '1.0.0';

/**
 * Seeded random number generator for reproducibility.
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Test case registry mapping bias types to their test cases.
 */
const TEST_CASE_REGISTRY: Record<BiasType, TestCase[]> = {
  anchoring: anchoringTestCases,
  loss_aversion: lossAversionTestCases,
  confirmation_bias: confirmationBiasTestCases,
  sunk_cost_fallacy: sunkCostTestCases,
  availability_heuristic: availabilityHeuristicTestCases,
};

/**
 * Main TestRunner implementation.
 */
export class TestRunner implements ITestRunner {
  private config: TestConfiguration;
  private rng: SeededRandom;
  private llmClient?: LLMClient;
  private llmOptions?: LLMOptions;

  constructor(config: TestConfiguration, llmClient?: LLMClient, llmOptions?: LLMOptions) {
    this.config = config;
    this.rng = new SeededRandom(config.randomSeed ?? Date.now());
    this.llmClient = llmClient;
    this.llmOptions = llmOptions;
  }

  /**
   * Set the LLM client for real API calls.
   */
  setLLMClient(client: LLMClient, options?: LLMOptions): void {
    this.llmClient = client;
    this.llmOptions = options;
  }

  private resolveIterationControl(): IterationControlConfig {
    const defaults: IterationControlConfig = {
      adaptive: true,
      minIterations: Math.min(5, this.config.testIterations),
      maxIterations: this.config.testIterations,
      fixedIterations: this.config.testIterations,
      cvThreshold: 0.05,
    };

    const provided: Partial<IterationControlConfig> = this.config.iterationControl ?? {};
    const merged: IterationControlConfig = {
      ...defaults,
      ...provided,
      minIterations: Math.max(1, provided.minIterations ?? defaults.minIterations),
      maxIterations: Math.max(provided.maxIterations ?? defaults.maxIterations, provided.minIterations ?? defaults.minIterations),
      fixedIterations: provided.fixedIterations ?? defaults.fixedIterations,
    };

    if (merged.maxIterations < merged.minIterations) {
      merged.maxIterations = merged.minIterations;
    }

    return merged;
  }

  private buildIterationSnapshot(
    iteration: number,
    scores: number[]
  ): IterationStatsSnapshot {
    const meanScore = mean(scores);
    const sd = standardDeviation(scores);
    const ci = confidenceInterval95(scores);
    const cv = coefficientOfVariation(scores);

    return {
      iteration,
      mean: Math.round(meanScore * 100) / 100,
      stdDev: Math.round(sd * 100) / 100,
      confidenceInterval95: [
        Math.round(ci[0] * 100) / 100,
        Math.round(ci[1] * 100) / 100,
      ],
      coefficientOfVariation: Math.round(cv * 10000) / 10000,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Load test cases for specified bias types.
   */
  async loadTestCases(biasTypes: BiasType[]): Promise<TestCase[]> {
    const allTestCases: TestCase[] = [];

    for (const biasType of biasTypes) {
      const testCases = TEST_CASE_REGISTRY[biasType] || [];
      allTestCases.push(...testCases);
    }

    // Filter by difficulty if specified
    const filtered = allTestCases.filter((tc) =>
      this.config.difficulty.includes(tc.difficulty)
    );

    // Filter by tags if specified
    if (this.config.tags && this.config.tags.length > 0) {
      return filtered.filter((tc) =>
        tc.tags.some((tag) => this.config.tags!.includes(tag))
      );
    }

    // Filter by categories if specified
    if (this.config.categories && this.config.categories.length > 0) {
      return filtered.filter((tc) =>
        this.config.categories!.includes(tc.category)
      );
    }

    return filtered;
  }

  /**
   * Generate prompts for all test cases across all iterations.
   */
  async generatePrompts(
    testCases: TestCase[],
    testIterations: number,
    randomSeed?: number
  ): Promise<GeneratedPrompt[]> {
    const prompts: GeneratedPrompt[] = [];
    const rng = randomSeed !== undefined ? new SeededRandom(randomSeed) : this.rng;

    for (const testCase of testCases) {
      for (let iteration = 1; iteration <= testIterations; iteration++) {
        const prompt = this.generatePromptForIteration(testCase, iteration, rng);
        prompts.push(prompt);
      }
    }

    return prompts;
  }

  /**
   * Generate a single prompt for a specific iteration.
   */
  private generatePromptForIteration(
    testCase: TestCase,
    iteration: number,
    rng: SeededRandom
  ): GeneratedPrompt {
    let promptText = testCase.prompt;
    const appliedVariables: Record<string, string | number> = {};

    // Apply variable substitutions if present
    if (testCase.promptVariables) {
      for (const [key, value] of Object.entries(testCase.promptVariables)) {
        let resolvedValue: string | number;

        if (Array.isArray(value)) {
          // Pick from array based on iteration or random
          const index = (iteration - 1) % value.length;
          resolvedValue = value[index];
        } else {
          resolvedValue = value;
        }

        appliedVariables[key] = resolvedValue;
        promptText = promptText.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
          String(resolvedValue)
        );
      }
    }

    return {
      testCaseId: testCase.id,
      iteration,
      prompt: promptText,
      controlPrompt: testCase.controlPrompt,
      metadata: {
        biasType: testCase.biasType,
        category: testCase.category,
        difficulty: testCase.difficulty,
        tags: testCase.tags,
      },
      appliedVariables:
        Object.keys(appliedVariables).length > 0 ? appliedVariables : undefined,
    };
  }

  /**
   * Generate a response for testing purposes.
   * Uses real LLM client if available, otherwise falls back to mock responses.
   */
  async generateMockResponse(
    testCase: TestCase,
    iteration: number
  ): Promise<string> {
    // Use real LLM client if available
    if (this.llmClient) {
      try {
        const prompt = this.buildPromptForTestCase(testCase, iteration);
        const response = await this.llmClient.generateCompletion(prompt, {
          ...this.llmOptions,
          maxTokens: this.llmOptions?.maxTokens ?? 1024,
        });
        return response.content;
      } catch (error) {
        console.error(`LLM call failed for ${testCase.id}, iteration ${iteration}:`, error);
        throw error;
      }
    }

    // Fallback to mock responses for testing/simulator mode
    const mockResponses = [
      `Based on my analysis, I would recommend considering the following factors...`,
      `Looking at this objectively, the key considerations are...`,
      `Given the information provided, my assessment is...`,
    ];

    const index = (iteration - 1) % mockResponses.length;
    return mockResponses[index] + ` [Mock response for ${testCase.id}, iteration ${iteration}]`;
  }

  /**
   * Build the prompt to send to the LLM for a given test case.
   */
  private buildPromptForTestCase(testCase: TestCase, iteration: number): string {
    // Use the test case's prompt template with any variable substitutions
    let prompt = testCase.prompt;

    // Substitute variables if present
    if (testCase.promptVariables) {
      for (const [key, value] of Object.entries(testCase.promptVariables)) {
        const placeholder = `{{${key}}}`;
        prompt = prompt.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    // Add iteration context for deterministic seeding if enabled
    if (this.llmOptions?.seed !== undefined) {
      // The seed is already set in llmOptions, no need to modify prompt
    }

    return prompt;
  }

  /**
   * Score a response for bias.
   * This uses a structured scoring approach based on the rubric.
   */
  async scoreResponse(
    testCase: TestCase,
    response: string
  ): Promise<BiasScore> {
    const rubric = testCase.scoringRubric;
    const dimensionScores: Record<string, number> = {};
    const detectedIndicators: string[] = [];

    // Score each dimension
    for (const dimension of rubric.dimensions) {
      // Check for bias indicators in response
      let indicatorCount = 0;
      for (const indicator of dimension.indicators) {
        // Simple heuristic: check if response patterns match indicators
        // In production, this would use more sophisticated NLP or LLM-based scoring
        const indicatorTerms = indicator.toLowerCase().split(' ');
        const responseTerms = response.toLowerCase();

        if (indicatorTerms.some((term) => responseTerms.includes(term))) {
          indicatorCount++;
          detectedIndicators.push(indicator);
        }
      }

      // Calculate dimension score based on indicator matches
      const maxIndicators = dimension.indicators.length;
      const indicatorRatio = maxIndicators > 0 ? indicatorCount / maxIndicators : 0;
      dimensionScores[dimension.name] = Math.round(indicatorRatio * dimension.maxScale * 10) / 10;
    }

    // Calculate weighted overall score
    let overallScore = 0;
    for (const [dimName, score] of Object.entries(dimensionScores)) {
      const weight = rubric.weights[dimName] || 0;
      overallScore += score * weight;
    }
    overallScore = Math.round(overallScore * 10) / 10;

    // Calculate confidence based on response length and indicator detection
    const confidence = Math.min(0.95, 0.5 + (response.length / 1000) * 0.2 + (detectedIndicators.length / 10) * 0.25);

    return {
      testCaseId: testCase.id,
      dimensionScores,
      overallScore,
      confidence: Math.round(confidence * 100) / 100,
      reasoning: `Scored based on ${detectedIndicators.length} detected indicators across ${rubric.dimensions.length} dimensions.`,
      detectedIndicators,
    };
  }

  /**
   * Aggregate results across multiple iterations.
   */
  async aggregateResults(
    results: TestResult[],
    iterationStats: IterationStatsSnapshot[] = []
  ): Promise<AggregatedResults> {
    if (results.length === 0) {
      throw new Error('Cannot aggregate empty results');
    }

    const testCaseId = results[0].testCaseId;
    const biasType = this.getBiasTypeFromTestCaseId(testCaseId);

    // Extract overall scores
    const overallScores = results.map((r) => r.overallBiasScore);

    // Aggregate dimension scores
    const dimensionNames = Object.keys(results[0].biasScores);
    const dimensionScores: Record<string, { mean: number; stdDev: number; min: number; max: number }> = {};

    for (const dimName of dimensionNames) {
      const dimScores = results.map((r) => r.biasScores[dimName]);
      dimensionScores[dimName] = {
        mean: calculateMean(dimScores),
        stdDev: calculateStdDeviation(dimScores),
        min: calculateMin(dimScores),
        max: calculateMax(dimScores),
      };
    }

    const meanScore = calculateMean(overallScores);
    const stdDev = calculateStdDeviation(overallScores);
    const consistency = calculateConsistency(overallScores);
    const ci95 = calculateConfidenceInterval95(overallScores);

    return {
      testCaseId,
      biasType,
      iterations: results.length,
      meanBiasScore: Math.round(meanScore * 100) / 100,
      stdDeviation: Math.round(stdDev * 100) / 100,
      minScore: calculateMin(overallScores),
      maxScore: calculateMax(overallScores),
      confidenceInterval95: [
        Math.round(ci95[0] * 100) / 100,
        Math.round(ci95[1] * 100) / 100,
      ],
      consistency,
      iterationStats,
      interpretation: interpretBiasScore(meanScore, biasType),
      dimensionScores,
      rawResults: results,
    };
  }

  /**
   * Generate the final test report.
   */
  async generateReport(
    results: AggregatedResults[],
    config: TestConfiguration
  ): Promise<TestReport> {
    // Calculate summary by bias type
    const summaryByBiasType: TestReport['summaryByBiasType'] = {} as TestReport['summaryByBiasType'];

    for (const biasType of config.biasTypes) {
      const biasResults = results.filter((r) => r.biasType === biasType);

      if (biasResults.length === 0) continue;

      const scores = biasResults.map((r) => r.meanBiasScore);
      const meanScore = calculateMean(scores);
      const stdDev = calculateStdDeviation(scores);

      const sortedByScore = [...biasResults].sort((a, b) => b.meanBiasScore - a.meanBiasScore);

      summaryByBiasType[biasType] = {
        testCount: biasResults.length,
        meanScore: Math.round(meanScore * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        highestBias: sortedByScore[0]?.testCaseId || 'N/A',
        lowestBias: sortedByScore[sortedByScore.length - 1]?.testCaseId || 'N/A',
      };
    }

    // Calculate overall findings
    const allScores = results.map((r) => r.meanBiasScore);
    const overallMean = calculateMean(allScores);

    const biasTypeScores = Object.entries(summaryByBiasType).map(([type, data]) => ({
      type: type as BiasType,
      score: data.meanScore,
    }));

    const sortedBiasTypes = biasTypeScores.sort((a, b) => b.score - a.score);

    const recommendations = this.generateRecommendations(results, summaryByBiasType);

    return {
      metadata: {
        reportId: crypto.randomUUID ? crypto.randomUUID() : `report-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        totalTests: results.length,
        totalIterations: results.reduce((sum, r) => sum + r.iterations, 0),
        configuration: config,
      },
      summaryByBiasType,
      detailedResults: results,
      overallFindings: {
        mostProblematicBias: sortedBiasTypes[0]?.type || 'anchoring',
        leastProblematicBias: sortedBiasTypes[sortedBiasTypes.length - 1]?.type || 'anchoring',
        overallBiasScore: Math.round(overallMean * 100) / 100,
        confidence: 0.85, // Placeholder confidence
        recommendations,
      },
    };
  }

  /**
   * Generate the complete test suite output ready for execution.
   */
  async generateTestSuiteOutput(): Promise<TestSuiteOutput> {
    const testCases = await this.loadTestCases(this.config.biasTypes);
    const prompts = await this.generatePrompts(testCases, this.config.testIterations);

    // Group prompts by test case
    const testCaseWithPrompts = testCases.map((tc) => ({
      testCase: tc,
      prompts: prompts.filter((p) => p.testCaseId === tc.id),
    }));

    return {
      metadata: {
        frameworkVersion: FRAMEWORK_VERSION,
        generatedAt: new Date().toISOString(),
        configuration: {
          biasTypes: this.config.biasTypes,
          testIterations: this.config.testIterations,
          totalTestCases: testCases.length,
          difficulty: this.config.difficulty,
        },
      },
      testSuite: testCaseWithPrompts,
      readyForExecution: true,
    };
  }

  /**
   * Run a complete evaluation (with mock responses for now).
   */
  async runEvaluation(): Promise<TestReport> {
    const iterationControl = this.resolveIterationControl();
    const testCases = await this.loadTestCases(this.config.biasTypes);
    const aggregatedResults: AggregatedResults[] = [];

    for (const testCase of testCases) {
      const testCaseResults: TestResult[] = [];
      const iterationSnapshots: IterationStatsSnapshot[] = [];

      const maxIterations = iterationControl.adaptive
        ? iterationControl.maxIterations
        : iterationControl.fixedIterations ?? iterationControl.maxIterations;
      const minIterations = iterationControl.adaptive
        ? iterationControl.minIterations
        : maxIterations;

      for (let iteration = 1; iteration <= maxIterations; iteration++) {
        const response = await this.generateMockResponse(testCase, iteration);
        const biasScore = await this.scoreResponse(testCase, response);

        const result: TestResult = {
          testCaseId: testCase.id,
          iterationNumber: iteration,
          rawResponse: response,
          biasScores: biasScore.dimensionScores,
          overallBiasScore: biasScore.overallScore,
          confidence: biasScore.confidence,
          timestamp: new Date().toISOString(),
          scoringReasoning: biasScore.reasoning,
        };

        testCaseResults.push(result);

        const scoresSoFar = testCaseResults.map((r) => r.overallBiasScore);
        const snapshot = this.buildIterationSnapshot(iteration, scoresSoFar);
        iterationSnapshots.push(snapshot);

        if (iterationControl.adaptive && iteration >= minIterations) {
          if (snapshot.coefficientOfVariation <= iterationControl.cvThreshold) {
            break;
          }
        }
      }

      const aggregated = await this.aggregateResults(testCaseResults, iterationSnapshots);
      aggregatedResults.push(aggregated);
    }

    return this.generateReport(aggregatedResults, this.config);
  }

  /**
   * Get bias type from test case ID.
   */
  private getBiasTypeFromTestCaseId(testCaseId: string): BiasType {
    const prefix = testCaseId.split('_').slice(0, -1).join('_');
    const mapping: Record<string, BiasType> = {
      anchoring: 'anchoring',
      loss_aversion: 'loss_aversion',
      confirmation_bias: 'confirmation_bias',
      sunk_cost: 'sunk_cost_fallacy',
      availability: 'availability_heuristic',
    };
    return mapping[prefix] || 'anchoring';
  }

  /**
   * Generate recommendations based on results.
   */
  private generateRecommendations(
    results: AggregatedResults[],
    summaryByBiasType: TestReport['summaryByBiasType']
  ): string[] {
    const recommendations: string[] = [];

    // Sort bias types by severity
    const sortedBiasTypes = Object.entries(summaryByBiasType)
      .sort((a, b) => b[1].meanScore - a[1].meanScore);

    for (const [biasType, data] of sortedBiasTypes) {
      if (data.meanScore >= 3) {
        recommendations.push(
          `High ${biasType.replace('_', ' ')} detected (score: ${data.meanScore}). ` +
          `Implement targeted mitigation strategies.`
        );
      } else if (data.meanScore >= 2) {
        recommendations.push(
          `Moderate ${biasType.replace('_', ' ')} detected (score: ${data.meanScore}). ` +
          `Consider adding bias-aware prompting techniques.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Overall bias levels are within acceptable ranges. Continue monitoring.');
    }

    return recommendations;
  }
}

export default TestRunner;
