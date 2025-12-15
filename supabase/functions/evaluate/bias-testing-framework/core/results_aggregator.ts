/**
 * Results Aggregator for Cognitive Bias Testing Framework
 *
 * Provides advanced aggregation, analysis, and reporting functionality
 * for bias test results across multiple iterations and bias types.
 */

import type {
  BiasType,
  TestResult,
  AggregatedResults,
  TestReport,
  IResultsAggregator,
  ConsistencyLevel,
} from './types.ts';

import {
  calculateMean,
  calculateStdDeviation,
  calculateConfidenceInterval95,
  calculateConsistency,
  calculateMin,
  calculateMax,
  calculateMedian,
  calculatePercentile,
  calculateIQR,
  detectOutliers,
  interpretBiasScore,
  calculateEffectSize,
  interpretEffectSize,
  calculateWeightedMean,
} from '../utils/statistics.ts';

/**
 * Severity levels for bias scores.
 */
export type SeverityLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'severe';

/**
 * Detailed analysis result for a single test case.
 */
export interface DetailedAnalysis {
  testCaseId: string;
  biasType: BiasType;
  severity: SeverityLevel;
  percentile: number;
  isOutlier: boolean;
  dimensionBreakdown: {
    name: string;
    score: number;
    contribution: number;
  }[];
  recommendations: string[];
}

/**
 * Comparison result between two test groups.
 */
export interface ComparisonResult {
  group1Label: string;
  group2Label: string;
  group1Mean: number;
  group2Mean: number;
  effectSize: number;
  effectInterpretation: string;
  significantDifference: boolean;
  summary: string;
}

/**
 * Main Results Aggregator implementation.
 */
export class ResultsAggregator implements IResultsAggregator {
  /**
   * Aggregate a set of test results into summary statistics.
   */
  aggregate(results: TestResult[], iterationStats: AggregatedResults['iterationStats'] = []): AggregatedResults {
    if (results.length === 0) {
      throw new Error('Cannot aggregate empty results');
    }

    const testCaseId = results[0].testCaseId;
    const biasType = this.extractBiasType(testCaseId);

    // Extract overall scores
    const overallScores = results.map((r) => r.overallBiasScore);

    // Aggregate dimension scores
    const dimensionNames = Object.keys(results[0].biasScores);
    const dimensionScores: Record<string, { mean: number; stdDev: number; min: number; max: number }> = {};

    for (const dimName of dimensionNames) {
      const dimScores = results.map((r) => r.biasScores[dimName] || 0);
      dimensionScores[dimName] = {
        mean: this.round(calculateMean(dimScores)),
        stdDev: this.round(calculateStdDeviation(dimScores)),
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
      meanBiasScore: this.round(meanScore),
      stdDeviation: this.round(stdDev),
      minScore: calculateMin(overallScores),
      maxScore: calculateMax(overallScores),
      confidenceInterval95: [this.round(ci95[0]), this.round(ci95[1])],
      consistency,
      iterationStats,
      interpretation: interpretBiasScore(meanScore, biasType),
      dimensionScores,
      rawResults: results,
    };
  }

  /**
   * Summarize results by bias type.
   */
  summarizeByBiasType(
    results: AggregatedResults[]
  ): Record<BiasType, { testCount: number; meanScore: number; stdDev: number }> {
    const summary: Record<string, { testCount: number; meanScore: number; stdDev: number }> = {};

    // Group by bias type
    const byBiasType: Record<string, AggregatedResults[]> = {};
    for (const result of results) {
      if (!byBiasType[result.biasType]) {
        byBiasType[result.biasType] = [];
      }
      byBiasType[result.biasType].push(result);
    }

    // Calculate summary for each type
    for (const [biasType, typeResults] of Object.entries(byBiasType)) {
      const scores = typeResults.map((r) => r.meanBiasScore);
      summary[biasType] = {
        testCount: typeResults.length,
        meanScore: this.round(calculateMean(scores)),
        stdDev: this.round(calculateStdDeviation(scores)),
      };
    }

    return summary as Record<BiasType, { testCount: number; meanScore: number; stdDev: number }>;
  }

  /**
   * Calculate overall findings from aggregated results.
   */
  calculateOverallFindings(
    results: AggregatedResults[]
  ): TestReport['overallFindings'] {
    if (results.length === 0) {
      return {
        mostProblematicBias: 'anchoring',
        leastProblematicBias: 'anchoring',
        overallBiasScore: 0,
        confidence: 0,
        recommendations: ['No test results available'],
      };
    }

    const summary = this.summarizeByBiasType(results);
    const allScores = results.map((r) => r.meanBiasScore);

    // Find most and least problematic bias types
    const sortedTypes = Object.entries(summary)
      .sort((a, b) => b[1].meanScore - a[1].meanScore);

    const mostProblematic = sortedTypes[0]?.[0] as BiasType || 'anchoring';
    const leastProblematic = sortedTypes[sortedTypes.length - 1]?.[0] as BiasType || 'anchoring';

    // Calculate overall score and confidence
    const overallScore = calculateMean(allScores);
    const avgConfidence = calculateMean(
      results.flatMap((r) => r.rawResults.map((rr) => rr.confidence))
    );

    // Generate recommendations
    const recommendations = this.generateOverallRecommendations(summary, results);

    return {
      mostProblematicBias: mostProblematic,
      leastProblematicBias: leastProblematic,
      overallBiasScore: this.round(overallScore),
      confidence: this.round(avgConfidence),
      recommendations,
    };
  }

  /**
   * Get detailed analysis for each test case.
   */
  getDetailedAnalysis(results: AggregatedResults[]): DetailedAnalysis[] {
    const allScores = results.map((r) => r.meanBiasScore);
    const analysis: DetailedAnalysis[] = [];

    for (const result of results) {
      // Calculate percentile
      const sortedScores = [...allScores].sort((a, b) => a - b);
      const percentileIndex = sortedScores.filter((s) => s <= result.meanBiasScore).length;
      const percentile = (percentileIndex / sortedScores.length) * 100;

      // Check if outlier
      const outlierIndices = detectOutliers(allScores);
      const resultIndex = results.indexOf(result);
      const isOutlier = outlierIndices.includes(resultIndex);

      // Calculate dimension contributions
      const dimensionBreakdown = Object.entries(result.dimensionScores).map(([name, data]) => ({
        name,
        score: data.mean,
        contribution: data.mean / (result.meanBiasScore || 1),
      }));

      // Generate test-specific recommendations
      const recommendations = this.generateTestRecommendations(result);

      analysis.push({
        testCaseId: result.testCaseId,
        biasType: result.biasType,
        severity: this.getSeverityLevel(result.meanBiasScore),
        percentile: this.round(percentile),
        isOutlier,
        dimensionBreakdown,
        recommendations,
      });
    }

    return analysis;
  }

  /**
   * Compare two groups of results (e.g., before/after intervention).
   */
  compareGroups(
    group1: AggregatedResults[],
    group1Label: string,
    group2: AggregatedResults[],
    group2Label: string
  ): ComparisonResult {
    const scores1 = group1.map((r) => r.meanBiasScore);
    const scores2 = group2.map((r) => r.meanBiasScore);

    const mean1 = calculateMean(scores1);
    const mean2 = calculateMean(scores2);
    const effectSize = calculateEffectSize(scores1, scores2);
    const effectInterpretation = interpretEffectSize(effectSize);

    // Significant if effect size is medium or larger
    const significantDifference = Math.abs(effectSize) >= 0.5;

    const direction = mean1 > mean2 ? 'lower' : 'higher';
    const summary = significantDifference
      ? `${group2Label} shows ${effectInterpretation} ${direction} bias than ${group1Label} (d=${this.round(effectSize)})`
      : `No significant difference between ${group1Label} and ${group2Label}`;

    return {
      group1Label,
      group2Label,
      group1Mean: this.round(mean1),
      group2Mean: this.round(mean2),
      effectSize: this.round(effectSize),
      effectInterpretation,
      significantDifference,
      summary,
    };
  }

  /**
   * Calculate weighted aggregate across different bias types.
   */
  calculateWeightedAggregate(
    results: AggregatedResults[],
    weights: Partial<Record<BiasType, number>>
  ): number {
    const scores: number[] = [];
    const weightValues: number[] = [];

    for (const result of results) {
      const weight = weights[result.biasType] ?? 1;
      scores.push(result.meanBiasScore);
      weightValues.push(weight);
    }

    return this.round(calculateWeightedMean(scores, weightValues));
  }

  /**
   * Get trend analysis across iterations.
   */
  getIterationTrend(result: AggregatedResults): {
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number;
  } {
    const scores = result.rawResults.map((r) => r.overallBiasScore);

    if (scores.length < 3) {
      return { trend: 'stable', trendStrength: 0 };
    }

    // Simple linear regression
    const n = scores.length;
    const sumX = (n * (n + 1)) / 2;
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, y, i) => sum + (i + 1) * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const trendStrength = Math.abs(slope);

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (slope > 0.1) {
      trend = 'increasing';
    } else if (slope < -0.1) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return { trend, trendStrength: this.round(trendStrength) };
  }

  /**
   * Generate consistency report.
   */
  generateConsistencyReport(results: AggregatedResults[]): {
    overallConsistency: ConsistencyLevel;
    consistentTests: string[];
    inconsistentTests: string[];
    recommendation: string;
  } {
    const consistentTests: string[] = [];
    const inconsistentTests: string[] = [];

    for (const result of results) {
      if (result.consistency === 'high') {
        consistentTests.push(result.testCaseId);
      } else if (result.consistency === 'low') {
        inconsistentTests.push(result.testCaseId);
      }
    }

    const consistencyScores = results.map((r) => {
      switch (r.consistency) {
        case 'high': return 3;
        case 'medium': return 2;
        case 'low': return 1;
        default: return 2;
      }
    });

    const avgConsistency = calculateMean(consistencyScores);
    let overallConsistency: ConsistencyLevel;
    if (avgConsistency >= 2.5) {
      overallConsistency = 'high';
    } else if (avgConsistency >= 1.5) {
      overallConsistency = 'medium';
    } else {
      overallConsistency = 'low';
    }

    let recommendation: string;
    if (inconsistentTests.length > results.length * 0.3) {
      recommendation = 'High variability detected. Consider increasing iteration count for more reliable results.';
    } else if (inconsistentTests.length > 0) {
      recommendation = `${inconsistentTests.length} tests show inconsistent results. Review test case design or increase iterations.`;
    } else {
      recommendation = 'Results are consistent across iterations. Current iteration count appears sufficient.';
    }

    return {
      overallConsistency,
      consistentTests,
      inconsistentTests,
      recommendation,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private extractBiasType(testCaseId: string): BiasType {
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

  private getSeverityLevel(score: number): SeverityLevel {
    if (score < 1) return 'minimal';
    if (score < 2) return 'low';
    if (score < 3) return 'moderate';
    if (score < 4) return 'high';
    return 'severe';
  }

  private round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private generateTestRecommendations(result: AggregatedResults): string[] {
    const recommendations: string[] = [];
    const severity = this.getSeverityLevel(result.meanBiasScore);

    // Bias-type specific recommendations
    const biasRecommendations: Record<BiasType, string[]> = {
      anchoring: [
        'Implement multi-perspective prompting',
        'Add anchor-blind evaluation phases',
        'Randomize information presentation order',
      ],
      loss_aversion: [
        'Normalize gain/loss framing in prompts',
        'Implement risk-neutral scoring',
        'Add explicit loss aversion detection',
      ],
      confirmation_bias: [
        'Implement adversarial evidence search',
        'Add belief revision tracking',
        'Use blind evidence evaluation',
      ],
      sunk_cost_fallacy: [
        'Implement forward-looking decision framework',
        'Add sunk cost filter to prompts',
        'Use incremental value analysis',
      ],
      availability_heuristic: [
        'Incorporate base rate priming',
        'Implement recency weighting correction',
        'Use frequency-based sampling',
      ],
    };

    if (severity === 'high' || severity === 'severe') {
      recommendations.push(...biasRecommendations[result.biasType].slice(0, 2));
    } else if (severity === 'moderate') {
      recommendations.push(biasRecommendations[result.biasType][0]);
    }

    if (result.consistency === 'low') {
      recommendations.push('Increase test iterations for more reliable scoring');
    }

    return recommendations;
  }

  private generateOverallRecommendations(
    summary: Record<string, { testCount: number; meanScore: number; stdDev: number }>,
    results: AggregatedResults[]
  ): string[] {
    const recommendations: string[] = [];

    // Sort by mean score
    const sortedTypes = Object.entries(summary)
      .sort((a, b) => b[1].meanScore - a[1].meanScore);

    // Add recommendations for high-scoring bias types
    for (const [biasType, data] of sortedTypes) {
      if (data.meanScore >= 3) {
        recommendations.push(
          `Priority: Address ${biasType.replace(/_/g, ' ')} (score: ${data.meanScore})`
        );
      } else if (data.meanScore >= 2 && recommendations.length < 3) {
        recommendations.push(
          `Consider: Monitor ${biasType.replace(/_/g, ' ')} (score: ${data.meanScore})`
        );
      }
    }

    // Add consistency recommendation if needed
    const lowConsistencyCount = results.filter((r) => r.consistency === 'low').length;
    if (lowConsistencyCount > results.length * 0.2) {
      recommendations.push('Increase iteration count for more reliable measurements');
    }

    if (recommendations.length === 0) {
      recommendations.push('All bias types within acceptable ranges');
    }

    return recommendations;
  }
}

export default ResultsAggregator;
