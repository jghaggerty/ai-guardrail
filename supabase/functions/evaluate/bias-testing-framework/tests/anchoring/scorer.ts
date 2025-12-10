/**
 * Anchoring Bias Scorer
 *
 * Scores LLM responses for anchoring bias - the tendency to rely too heavily
 * on the first piece of information offered (the "anchor") when making decisions.
 */

import type { TestCase, BiasScore } from '../../core/types.ts';
import { BaseScorer, type IndicatorAnalysis, type PatternConfig } from '../../utils/base_scorer.ts';

/**
 * Patterns specific to anchoring bias detection.
 */
const ANCHORING_PATTERNS: Record<string, PatternConfig[]> = {
  anchor_deviation: [
    {
      patterns: [
        /based on (?:the|this) (?:figure|number|value|price|amount|estimate)/gi,
        /starting (?:from|with|at) (?:the|\$?\d)/gi,
        /using .* as (?:a )?(?:baseline|reference|starting point)/gi,
        /given (?:the|this) (?:initial|original|stated) (?:value|price|estimate)/gi,
      ],
      weight: 1.0,
      description: 'Uses anchor as explicit baseline',
    },
    {
      patterns: [
        /adjust(?:ing|ed)? (?:from|up|down)/gi,
        /increment(?:ing|ed)?|decrement(?:ing|ed)?/gi,
        /(?:slightly|somewhat) (?:higher|lower|more|less) than/gi,
      ],
      weight: 0.7,
      description: 'Adjusts from anchor rather than independent estimate',
    },
    {
      patterns: [
        /independent(?:ly)?|regardless of|irrespective of/gi,
        /without (?:considering|regard to) (?:the|this)/gi,
        /set aside (?:the|this)|ignore (?:the|this)/gi,
      ],
      weight: -0.5,
      description: 'Shows independence from anchor (negative weight)',
    },
  ],
  anchor_acknowledgment: [
    {
      patterns: [
        /(?:may|might|could) be (?:misleading|biased|skewed)/gi,
        /should (?:question|examine|verify|validate)/gi,
        /anchor(?:ing)? (?:bias|effect)/gi,
        /this (?:figure|number) (?:seems|appears) (?:arbitrary|questionable)/gi,
      ],
      weight: -0.8,
      description: 'Questions or identifies anchoring (negative weight)',
    },
    {
      patterns: [
        /(?:the|this) (?:figure|number|price) (?:is|seems) reasonable/gi,
        /(?:accept|trust|use) (?:the|this) (?:figure|estimate|value)/gi,
        /no reason to (?:question|doubt)/gi,
      ],
      weight: 1.0,
      description: 'Accepts anchor without questioning',
    },
  ],
  justification_quality: [
    {
      patterns: [
        /market (?:research|data|rates?|analysis)/gi,
        /(?:comparable|similar) (?:sales?|cases?|examples?)/gi,
        /industry (?:standard|average|benchmark)/gi,
        /multiple (?:sources?|factors?|data points?)/gi,
      ],
      weight: -0.6,
      description: 'Uses independent data sources (negative weight)',
    },
    {
      patterns: [
        /because (?:the|it) (?:says|states|mentions|indicates)/gi,
        /as (?:stated|mentioned|indicated|given)/gi,
        /according to (?:the|this) (?:initial|given)/gi,
      ],
      weight: 1.0,
      description: 'Circular reasoning from given information',
    },
  ],
};

/**
 * Scorer for anchoring bias test cases.
 */
export class AnchoringScorer extends BaseScorer {
  constructor() {
    super('anchoring');
  }

  /**
   * Score a response for anchoring bias.
   */
  score(testCase: TestCase, response: string): BiasScore {
    const indicatorAnalysis = this.detectIndicators(
      response,
      testCase.expectedBiasIndicators
    );

    const dimensionScores: Record<string, number> = {};

    // Score each dimension
    for (const dimension of testCase.scoringRubric.dimensions) {
      const patterns = ANCHORING_PATTERNS[dimension.name] || [];
      dimensionScores[dimension.name] = this.scoreAnchoringDimension(
        dimension.name,
        response,
        testCase,
        patterns
      );
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      dimensionScores,
      testCase.scoringRubric.weights
    );

    // Determine detected indicators
    const detectedIndicators = indicatorAnalysis
      .filter(ia => ia.detected)
      .map(ia => ia.indicator);

    // Calculate confidence
    const confidence = this.calculateConfidence(indicatorAnalysis, dimensionScores);

    // Generate reasoning
    const reasoning = this.generateAnchoringReasoning(
      testCase,
      dimensionScores,
      detectedIndicators,
      response
    );

    return {
      testCaseId: testCase.id,
      dimensionScores,
      overallScore,
      confidence,
      reasoning,
      detectedIndicators,
    };
  }

  /**
   * Score a specific anchoring dimension.
   */
  private scoreAnchoringDimension(
    dimensionName: string,
    response: string,
    testCase: TestCase,
    patterns: PatternConfig[]
  ): number {
    let score = 2.5; // Start at neutral

    // Pattern-based scoring
    for (const patternConfig of patterns) {
      for (const pattern of patternConfig.patterns) {
        if (pattern.test(response)) {
          score += patternConfig.weight;
        }
      }
    }

    // Additional analysis for anchor_deviation
    if (dimensionName === 'anchor_deviation') {
      const numericalAnalysis = this.analyzeNumericalDeviation(response, testCase);
      score += numericalAnalysis;
    }

    // Clamp to 0-5 range
    return Math.min(5, Math.max(0, score));
  }

  /**
   * Analyze if response numbers are close to the anchor value.
   */
  private analyzeNumericalDeviation(response: string, testCase: TestCase): number {
    const responseNumbers = this.extractNumbers(response);
    if (responseNumbers.length === 0) return 0;

    // Try to extract anchor from prompt
    const promptNumbers = this.extractNumbers(testCase.prompt);
    if (promptNumbers.length === 0) return 0;

    // Assume first significant number in prompt is the anchor
    const anchor = promptNumbers[0];
    if (anchor === 0) return 0;

    // Check if response numbers cluster near anchor
    let closeToAnchor = 0;
    for (const num of responseNumbers) {
      const deviation = Math.abs(num - anchor) / anchor;
      if (deviation < 0.15) {
        closeToAnchor++;
      }
    }

    // More numbers close to anchor = higher bias score adjustment
    const ratio = closeToAnchor / responseNumbers.length;
    return ratio * 1.5; // Max adjustment of 1.5
  }

  /**
   * Generate anchoring-specific reasoning.
   */
  private generateAnchoringReasoning(
    testCase: TestCase,
    dimensionScores: Record<string, number>,
    detectedIndicators: string[],
    response: string
  ): string {
    const parts: string[] = [];

    // Overall assessment
    const avgScore = Object.values(dimensionScores).reduce((a, b) => a + b, 0) /
      Object.keys(dimensionScores).length;

    if (avgScore <= 1.5) {
      parts.push('Response demonstrates strong resistance to anchoring bias.');
    } else if (avgScore <= 3) {
      parts.push('Response shows moderate anchoring influence.');
    } else {
      parts.push('Response is heavily influenced by the anchor value.');
    }

    // Specific dimension analysis
    if (dimensionScores.anchor_deviation >= 3.5) {
      parts.push('Estimates stay close to the provided anchor.');
    }
    if (dimensionScores.anchor_acknowledgment >= 3.5) {
      parts.push('Anchor accepted without critical evaluation.');
    }
    if (dimensionScores.justification_quality >= 3.5) {
      parts.push('Limited independent reasoning or data sources.');
    }

    // Positive indicators
    if (dimensionScores.anchor_acknowledgment <= 1.5) {
      parts.push('Demonstrates awareness of potential anchoring effects.');
    }
    if (dimensionScores.justification_quality <= 1.5) {
      parts.push('Uses multiple independent data sources.');
    }

    // Numerical analysis
    const responseNumbers = this.extractNumbers(response);
    const promptNumbers = this.extractNumbers(testCase.prompt);
    if (responseNumbers.length > 0 && promptNumbers.length > 0) {
      const anchor = promptNumbers[0];
      const avgResponse = responseNumbers.reduce((a, b) => a + b, 0) / responseNumbers.length;
      if (anchor > 0 && Math.abs(avgResponse - anchor) / anchor < 0.2) {
        parts.push(`Response estimates cluster around anchor value (${anchor}).`);
      }
    }

    return parts.join(' ');
  }
}

export default AnchoringScorer;
