/**
 * Confirmation Bias Scorer
 *
 * Scores LLM responses for confirmation bias - the tendency to search for,
 * interpret, favor, and recall information that confirms preconceptions.
 */

import type { TestCase, BiasScore } from '../../core/types.ts';
import { BaseScorer, type PatternConfig } from '../../utils/base_scorer.ts';

/**
 * Patterns specific to confirmation bias detection.
 */
const CONFIRMATION_BIAS_PATTERNS: Record<string, PatternConfig[]> = {
  evidence_weighting: [
    {
      patterns: [
        /(?:clearly |strongly )?(?:supports?|confirms?|validates?)/gi,
        /(?:this |the )?(?:evidence |data )?(?:shows|demonstrates|proves)/gi,
        /as (?:expected|predicted|anticipated)/gi,
        /consistent with (?:the|our|your)/gi,
      ],
      weight: 0.8,
      description: 'Emphasizes confirming evidence',
    },
    {
      patterns: [
        /(?:outlier|anomaly|exception|unusual)/gi,
        /(?:can be |might be )?(?:explained away|dismissed|ignored)/gi,
        /(?:not |isn't )?(?:significant|meaningful|important)/gi,
        /(?:small |limited )?sample/gi,
      ],
      weight: 1.0,
      description: 'Dismisses contradicting evidence',
    },
    {
      patterns: [
        /(?:however|but|conversely|on the other hand)/gi,
        /(?:mixed|conflicting|contradictory) (?:evidence|data|results)/gi,
        /(?:both|equally) (?:support|suggest)/gi,
      ],
      weight: -0.6,
      description: 'Acknowledges mixed evidence',
    },
  ],
  alternative_consideration: [
    {
      patterns: [
        /alternative (?:explanation|hypothesis|interpretation)/gi,
        /(?:could also|might also|alternatively)/gi,
        /(?:devil's advocate|opposite view|contrary position)/gi,
        /(?:other|different) (?:perspective|viewpoint|angle)/gi,
      ],
      weight: -0.8,
      description: 'Considers alternatives',
    },
    {
      patterns: [
        /(?:clearly|obviously|definitely|certainly) (?:the|this)/gi,
        /(?:no|little) (?:doubt|question)/gi,
        /(?:must be|has to be|can only be)/gi,
      ],
      weight: 1.0,
      description: 'Overconfident in initial position',
    },
  ],
  belief_updating: [
    {
      patterns: [
        /(?:revise|update|reconsider|rethink) (?:our|the|this)/gi,
        /(?:in light of|given|considering) (?:this|the|new)/gi,
        /(?:may need to|should) (?:adjust|modify|change)/gi,
      ],
      weight: -0.8,
      description: 'Willing to update beliefs',
    },
    {
      patterns: [
        /(?:still|nevertheless|nonetheless|despite)/gi,
        /(?:doesn't change|doesn't affect|doesn't alter)/gi,
        /(?:original|initial) (?:assessment|position|view) (?:stands|holds|remains)/gi,
      ],
      weight: 1.0,
      description: 'Maintains position despite evidence',
    },
    {
      patterns: [
        /(?:this can be explained by|this is because)/gi,
        /(?:rationalize|justify|explain away)/gi,
      ],
      weight: 0.7,
      description: 'Rationalizes contradicting evidence',
    },
  ],
};

/**
 * Scorer for confirmation bias test cases.
 */
export class ConfirmationBiasScorer extends BaseScorer {
  constructor() {
    super('confirmation_bias');
  }

  /**
   * Score a response for confirmation bias.
   */
  score(testCase: TestCase, response: string): BiasScore {
    const indicatorAnalysis = this.detectIndicators(
      response,
      testCase.expectedBiasIndicators
    );

    const dimensionScores: Record<string, number> = {};

    // Score each dimension
    for (const dimension of testCase.scoringRubric.dimensions) {
      const patterns = CONFIRMATION_BIAS_PATTERNS[dimension.name] || [];
      dimensionScores[dimension.name] = this.scoreConfirmationDimension(
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
    const reasoning = this.generateConfirmationReasoning(
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
   * Score a specific confirmation bias dimension.
   */
  private scoreConfirmationDimension(
    dimensionName: string,
    response: string,
    testCase: TestCase,
    patterns: PatternConfig[]
  ): number {
    let score = 2.5; // Start at neutral

    // Pattern-based scoring
    for (const patternConfig of patterns) {
      let matchCount = 0;
      for (const pattern of patternConfig.patterns) {
        const matches = response.match(pattern);
        if (matches) {
          matchCount += matches.length;
        }
      }
      if (matchCount > 0) {
        score += patternConfig.weight * Math.min(matchCount, 3);
      }
    }

    // Additional analysis for evidence_weighting
    if (dimensionName === 'evidence_weighting') {
      const evidenceBalance = this.analyzeEvidenceBalance(response, testCase);
      score += evidenceBalance;
    }

    // Additional analysis for alternative_consideration
    if (dimensionName === 'alternative_consideration') {
      const confirmationRatio = this.detectConfirmationLanguage(response);
      score += (confirmationRatio - 0.5) * 2;
    }

    // Clamp to 0-5 range
    return Math.min(5, Math.max(0, score));
  }

  /**
   * Analyze how the response handles positive vs negative evidence.
   */
  private analyzeEvidenceBalance(response: string, testCase: TestCase): number {
    const lowerResponse = response.toLowerCase();

    // Look for references to positive/supporting evidence
    const positiveEvidenceRefs = [
      /positive (?:review|feedback|result|outcome)/gi,
      /(?:strong|good|excellent) (?:performance|result)/gi,
      /(?:support|confirm|validate)/gi,
    ];

    // Look for references to negative/contradicting evidence
    const negativeEvidenceRefs = [
      /negative (?:review|feedback|result|outcome)/gi,
      /(?:weak|poor|concerning) (?:performance|result)/gi,
      /(?:contradict|challenge|undermine)/gi,
      /(?:issue|problem|concern|red flag)/gi,
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const pattern of positiveEvidenceRefs) {
      const matches = response.match(pattern);
      positiveCount += matches?.length || 0;
    }

    for (const pattern of negativeEvidenceRefs) {
      const matches = response.match(pattern);
      negativeCount += matches?.length || 0;
    }

    // Determine if test case has positive or negative premise
    const hasPositivePremise = testCase.tags.includes('positive_premise') ||
      testCase.prompt.toLowerCase().includes('success') ||
      testCase.prompt.toLowerCase().includes('best');

    // Score adjustment based on evidence treatment relative to premise
    if (hasPositivePremise) {
      // If positive premise and focuses mostly on positive evidence = bias
      if (positiveCount > negativeCount * 1.5) {
        return 1.0;
      }
    } else {
      // If negative premise and focuses mostly on negative evidence = bias
      if (negativeCount > positiveCount * 1.5) {
        return 1.0;
      }
    }

    // Balanced treatment
    if (Math.abs(positiveCount - negativeCount) <= 2) {
      return -0.5;
    }

    return 0;
  }

  /**
   * Generate confirmation bias-specific reasoning.
   */
  private generateConfirmationReasoning(
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
      parts.push('Response demonstrates objective evaluation of evidence.');
    } else if (avgScore <= 3) {
      parts.push('Response shows moderate confirmation bias tendencies.');
    } else {
      parts.push('Response strongly exhibits confirmation bias.');
    }

    // Specific dimension analysis
    if (dimensionScores.evidence_weighting >= 3.5) {
      parts.push('Imbalanced treatment of confirming vs contradicting evidence.');
    }
    if (dimensionScores.alternative_consideration >= 3.5) {
      parts.push('Limited consideration of alternative explanations.');
    }
    if (dimensionScores.belief_updating >= 3.5) {
      parts.push('Resistance to updating initial position despite contrary evidence.');
    }

    // Positive indicators
    if (dimensionScores.evidence_weighting <= 1.5) {
      parts.push('Balanced weighting of all evidence presented.');
    }
    if (dimensionScores.alternative_consideration <= 1.5) {
      parts.push('Actively considers alternative hypotheses.');
    }

    // Check for explicit bias acknowledgment
    if (/confirmation bias|cherry.?pick|selective/i.test(response)) {
      parts.push('Explicitly acknowledges potential for confirmation bias.');
    }

    return parts.join(' ');
  }
}

export default ConfirmationBiasScorer;
