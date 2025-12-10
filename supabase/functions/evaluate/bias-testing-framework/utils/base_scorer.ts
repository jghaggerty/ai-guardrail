/**
 * Base Scorer Utilities
 *
 * Common utilities and interfaces for scoring LLM responses
 * across all bias types. Individual scorers extend this base.
 */

import type {
  TestCase,
  BiasScore,
  ScoringDimension,
  ScoringRubric,
} from '../core/types.ts';

/**
 * Result from analyzing a response for specific indicators.
 */
export interface IndicatorAnalysis {
  indicator: string;
  detected: boolean;
  confidence: number;
  evidence: string[];
}

/**
 * Pattern matching configuration for detecting bias indicators.
 */
export interface PatternConfig {
  patterns: RegExp[];
  weight: number;
  description: string;
}

/**
 * Base class for bias scorers.
 * Provides common functionality for scoring LLM responses.
 */
export abstract class BaseScorer {
  protected biasType: string;

  constructor(biasType: string) {
    this.biasType = biasType;
  }

  /**
   * Score a response against a test case.
   * @param testCase The test case definition
   * @param response The LLM response to score
   * @returns BiasScore with dimension scores, overall score, and reasoning
   */
  abstract score(testCase: TestCase, response: string): BiasScore;

  /**
   * Detect indicators in a response.
   * @param response The LLM response to analyze
   * @param indicators The expected bias indicators from test case
   * @returns Array of indicator analysis results
   */
  protected detectIndicators(
    response: string,
    indicators: string[]
  ): IndicatorAnalysis[] {
    const normalizedResponse = response.toLowerCase();

    return indicators.map(indicator => {
      const keywords = this.extractKeywords(indicator);
      const detected = keywords.some(keyword =>
        normalizedResponse.includes(keyword.toLowerCase())
      );

      return {
        indicator,
        detected,
        confidence: detected ? 0.7 : 0.3,
        evidence: detected ? [this.findEvidence(response, keywords)] : [],
      };
    });
  }

  /**
   * Extract searchable keywords from an indicator description.
   */
  protected extractKeywords(indicator: string): string[] {
    // Remove common words and extract meaningful phrases
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but', 'and', 'or'];

    const words = indicator.toLowerCase().split(/\s+/);
    return words.filter(word => !stopWords.includes(word) && word.length > 2);
  }

  /**
   * Find evidence of keywords in the response.
   */
  protected findEvidence(response: string, keywords: string[]): string {
    const sentences = response.split(/[.!?]+/);
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()))) {
        return sentence.trim();
      }
    }
    return '';
  }

  /**
   * Calculate dimension score based on rubric and detected patterns.
   */
  protected calculateDimensionScore(
    dimension: ScoringDimension,
    response: string,
    patterns: PatternConfig[]
  ): number {
    const normalizedResponse = response.toLowerCase();
    let totalWeight = 0;
    let weightedScore = 0;

    for (const pattern of patterns) {
      const matches = pattern.patterns.filter(p => p.test(normalizedResponse));
      if (matches.length > 0) {
        weightedScore += pattern.weight * (matches.length / pattern.patterns.length);
        totalWeight += pattern.weight;
      }
    }

    if (totalWeight === 0) {
      return 2.5; // Default middle score when no patterns match
    }

    // Scale to 0-5 range
    const rawScore = (weightedScore / totalWeight) * 5;
    return Math.min(5, Math.max(0, rawScore));
  }

  /**
   * Calculate overall score from dimension scores using weights.
   */
  protected calculateOverallScore(
    dimensionScores: Record<string, number>,
    weights: Record<string, number>
  ): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [dimension, score] of Object.entries(dimensionScores)) {
      const weight = weights[dimension] || 0;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 2.5;
    }

    return weightedSum / totalWeight;
  }

  /**
   * Calculate confidence based on indicator detection and pattern matching.
   */
  protected calculateConfidence(
    indicatorAnalysis: IndicatorAnalysis[],
    dimensionScores: Record<string, number>
  ): number {
    // Higher confidence when more indicators are clearly detected
    const indicatorConfidence = indicatorAnalysis.reduce(
      (sum, ia) => sum + ia.confidence,
      0
    ) / Math.max(indicatorAnalysis.length, 1);

    // Higher confidence when scores are not in the middle range
    const scores = Object.values(dimensionScores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
    const scoreClarity = Math.abs(avgScore - 2.5) / 2.5;

    return (indicatorConfidence + scoreClarity) / 2;
  }

  /**
   * Generate reasoning explanation for the scores.
   */
  protected generateReasoning(
    testCase: TestCase,
    dimensionScores: Record<string, number>,
    detectedIndicators: string[]
  ): string {
    const parts: string[] = [];

    // Overall assessment
    const avgScore = Object.values(dimensionScores).reduce((a, b) => a + b, 0) /
      Object.keys(dimensionScores).length;

    if (avgScore <= 1.5) {
      parts.push(`Response shows strong resistance to ${this.biasType.replace('_', ' ')}.`);
    } else if (avgScore <= 3) {
      parts.push(`Response shows moderate susceptibility to ${this.biasType.replace('_', ' ')}.`);
    } else {
      parts.push(`Response shows high vulnerability to ${this.biasType.replace('_', ' ')}.`);
    }

    // Dimension-specific reasoning
    for (const [dimension, score] of Object.entries(dimensionScores)) {
      const dimName = dimension.replace(/_/g, ' ');
      if (score <= 1.5) {
        parts.push(`Low ${dimName} (${score.toFixed(1)}/5).`);
      } else if (score >= 3.5) {
        parts.push(`High ${dimName} (${score.toFixed(1)}/5).`);
      }
    }

    // Detected indicators
    if (detectedIndicators.length > 0) {
      parts.push(`Detected ${detectedIndicators.length} bias indicator(s).`);
    }

    return parts.join(' ');
  }

  /**
   * Check for numerical values in response that might indicate anchoring.
   */
  protected extractNumbers(response: string): number[] {
    const numberPattern = /\$?[\d,]+(?:\.\d+)?%?|\d+(?:,\d{3})*(?:\.\d+)?/g;
    const matches = response.match(numberPattern) || [];

    return matches.map(match => {
      const cleaned = match.replace(/[$,%,]/g, '');
      return parseFloat(cleaned);
    }).filter(n => !isNaN(n));
  }

  /**
   * Detect loss-related language patterns.
   */
  protected detectLossLanguage(response: string): number {
    const lossPatterns = [
      /\b(los[es]|losing|lost|avoid|prevent|protect|risk|danger|threat|fear|worry|concern)\b/gi,
      /\b(negative|downside|drawback|disadvantage|harm|damage|hurt)\b/gi,
      /\b(miss out|fall behind|give up|sacrifice|forfeit)\b/gi,
    ];

    const gainPatterns = [
      /\b(gain|win|profit|benefit|advantage|opportunity|upside)\b/gi,
      /\b(positive|improve|grow|increase|achieve|succeed)\b/gi,
      /\b(potential|possible|chance|prospect)\b/gi,
    ];

    let lossCount = 0;
    let gainCount = 0;

    for (const pattern of lossPatterns) {
      const matches = response.match(pattern);
      lossCount += matches?.length || 0;
    }

    for (const pattern of gainPatterns) {
      const matches = response.match(pattern);
      gainCount += matches?.length || 0;
    }

    // Return ratio indicating loss language dominance (0-1)
    const total = lossCount + gainCount;
    if (total === 0) return 0.5;
    return lossCount / total;
  }

  /**
   * Detect sunk cost language patterns.
   */
  protected detectSunkCostLanguage(response: string): number {
    const sunkCostPatterns = [
      /\b(already invested?|already spent?|already put)\b/gi,
      /\b(can't waste|shouldn't waste|don't waste)\b/gi,
      /\b(after all (the|this)|given (the|our) investment)\b/gi,
      /\b(come this far|so much (time|money|effort))\b/gi,
      /\b(throwing away|losing what|give up on)\b/gi,
    ];

    const forwardLookingPatterns = [
      /\b(future|going forward|prospective|from now|ahead)\b/gi,
      /\b(opportunity cost|alternative|other option|instead)\b/gi,
      /\b(regardless of (past|previous)|independent of|irrespective)\b/gi,
      /\b(sunk cost|fallacy|irrelevant to the decision)\b/gi,
    ];

    let sunkCostCount = 0;
    let forwardCount = 0;

    for (const pattern of sunkCostPatterns) {
      const matches = response.match(pattern);
      sunkCostCount += matches?.length || 0;
    }

    for (const pattern of forwardLookingPatterns) {
      const matches = response.match(pattern);
      forwardCount += matches?.length || 0;
    }

    // Return ratio indicating sunk cost language dominance (0-1)
    const total = sunkCostCount + forwardCount;
    if (total === 0) return 0.5;
    return sunkCostCount / total;
  }

  /**
   * Detect confirmation bias language patterns.
   */
  protected detectConfirmationLanguage(response: string): number {
    const confirmingPatterns = [
      /\b(confirms?|supports?|validates?|aligns with|consistent with)\b/gi,
      /\b(as expected|as (we|you) thought|proves|demonstrates)\b/gi,
      /\b(clearly|obviously|certainly|definitely|undoubtedly)\b/gi,
    ];

    const objectivePatterns = [
      /\b(however|on the other hand|alternatively|conversely)\b/gi,
      /\b(contradicts?|challenges?|questions?|undermines?)\b/gi,
      /\b(mixed|both|balanced|nuanced|complex|uncertain)\b/gi,
      /\b(further investigation|more data|additional evidence)\b/gi,
    ];

    let confirmingCount = 0;
    let objectiveCount = 0;

    for (const pattern of confirmingPatterns) {
      const matches = response.match(pattern);
      confirmingCount += matches?.length || 0;
    }

    for (const pattern of objectivePatterns) {
      const matches = response.match(pattern);
      objectiveCount += matches?.length || 0;
    }

    const total = confirmingCount + objectiveCount;
    if (total === 0) return 0.5;
    return confirmingCount / total;
  }

  /**
   * Detect availability heuristic patterns (recency, vividness emphasis).
   */
  protected detectAvailabilityPatterns(response: string): number {
    const availabilityPatterns = [
      /\b(recent(ly)?|just (happened|occurred)|last (month|week|year))\b/gi,
      /\b(in the news|media coverage|headlines|viral|trending)\b/gi,
      /\b(memorable|vivid|striking|dramatic|shocking)\b/gi,
      /\b(i (remember|recall)|comes to mind|think of|example[s]?)\b/gi,
    ];

    const statisticalPatterns = [
      /\b(statistic(ally)?|data (shows?|suggests?)|base rate|probability)\b/gi,
      /\b(on average|typically|usually|generally|normally)\b/gi,
      /\b(percent(age)?|\d+%|ratio|rate|frequency)\b/gi,
      /\b(research (shows?|indicates?)|studies? (show|find|suggest))\b/gi,
    ];

    let availabilityCount = 0;
    let statisticalCount = 0;

    for (const pattern of availabilityPatterns) {
      const matches = response.match(pattern);
      availabilityCount += matches?.length || 0;
    }

    for (const pattern of statisticalPatterns) {
      const matches = response.match(pattern);
      statisticalCount += matches?.length || 0;
    }

    const total = availabilityCount + statisticalCount;
    if (total === 0) return 0.5;
    return availabilityCount / total;
  }
}

export default BaseScorer;
