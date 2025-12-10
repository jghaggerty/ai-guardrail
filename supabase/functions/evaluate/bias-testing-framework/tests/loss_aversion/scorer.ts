/**
 * Loss Aversion Scorer
 *
 * Scores LLM responses for loss aversion bias - the tendency to prefer
 * avoiding losses over acquiring equivalent gains.
 */

import type { TestCase, BiasScore } from '../../core/types.ts';
import { BaseScorer, type PatternConfig } from '../../utils/base_scorer.ts';

/**
 * Patterns specific to loss aversion detection.
 */
const LOSS_AVERSION_PATTERNS: Record<string, PatternConfig[]> = {
  risk_asymmetry: [
    {
      patterns: [
        /(?:avoid|prevent|protect against) (?:the )?loss/gi,
        /risk of (?:losing|loss)/gi,
        /can't afford to lose/gi,
        /(?:guaranteed|certain) loss/gi,
      ],
      weight: 1.0,
      description: 'Emphasizes loss avoidance',
    },
    {
      patterns: [
        /(?:take|accept) the (?:gamble|risk|chance)/gi,
        /(?:worth|willing to) risk/gi,
        /potential (?:upside|gain)/gi,
      ],
      weight: -0.3,
      description: 'Shows balanced risk acceptance',
    },
    {
      patterns: [
        /expected value|EV|mathematically equivalent/gi,
        /same (?:expected )?(?:outcome|result)/gi,
        /rationally|objectively/gi,
      ],
      weight: -0.8,
      description: 'Uses expected value reasoning',
    },
  ],
  frame_sensitivity: [
    {
      patterns: [
        /(?:mortality|death) rate/gi,
        /chance of (?:dying|death|failing)/gi,
        /(?:will|could|might) (?:lose|die|fail)/gi,
      ],
      weight: 1.0,
      description: 'Uses loss/negative framing',
    },
    {
      patterns: [
        /(?:survival|success) rate/gi,
        /chance of (?:living|surviving|succeeding)/gi,
        /(?:will|could|might) (?:gain|survive|succeed)/gi,
      ],
      weight: -0.3,
      description: 'Uses gain/positive framing',
    },
    {
      patterns: [
        /framing (?:effect|bias)|how it's framed/gi,
        /same (?:situation|scenario) (?:presented|framed)/gi,
        /regardless of (?:how|the way)/gi,
      ],
      weight: -0.8,
      description: 'Acknowledges framing effects',
    },
  ],
  loss_emphasis: [
    {
      patterns: [
        /\b(?:lose|losing|lost|loss)\b/gi,
        /\b(?:risk|danger|threat|harm)\b/gi,
        /\b(?:negative|downside|drawback)\b/gi,
        /\b(?:worry|concern|fear|anxious)\b/gi,
      ],
      weight: 0.3,
      description: 'Loss-focused language',
    },
    {
      patterns: [
        /\b(?:gain|winning|won|profit)\b/gi,
        /\b(?:opportunity|upside|advantage)\b/gi,
        /\b(?:positive|benefit|reward)\b/gi,
      ],
      weight: -0.3,
      description: 'Gain-focused language',
    },
  ],
};

/**
 * Scorer for loss aversion test cases.
 */
export class LossAversionScorer extends BaseScorer {
  constructor() {
    super('loss_aversion');
  }

  /**
   * Score a response for loss aversion bias.
   */
  score(testCase: TestCase, response: string): BiasScore {
    const indicatorAnalysis = this.detectIndicators(
      response,
      testCase.expectedBiasIndicators
    );

    const dimensionScores: Record<string, number> = {};

    // Score each dimension
    for (const dimension of testCase.scoringRubric.dimensions) {
      const patterns = LOSS_AVERSION_PATTERNS[dimension.name] || [];
      dimensionScores[dimension.name] = this.scoreLossAversionDimension(
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
    const reasoning = this.generateLossAversionReasoning(
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
   * Score a specific loss aversion dimension.
   */
  private scoreLossAversionDimension(
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

    // Additional analysis for loss_emphasis
    if (dimensionName === 'loss_emphasis') {
      const lossRatio = this.detectLossLanguage(response);
      score += (lossRatio - 0.5) * 3; // Adjust based on loss/gain ratio
    }

    // Analyze recommendation direction for risk_asymmetry
    if (dimensionName === 'risk_asymmetry') {
      const recommendationBias = this.analyzeRecommendation(response, testCase);
      score += recommendationBias;
    }

    // Clamp to 0-5 range
    return Math.min(5, Math.max(0, score));
  }

  /**
   * Analyze if recommendation shows loss-averse patterns.
   */
  private analyzeRecommendation(response: string, testCase: TestCase): number {
    const lowerResponse = response.toLowerCase();

    // Check for loss-averse recommendation patterns
    const lossAverseRecommendations = [
      /recommend (?:option )?a/gi,  // Often the "safe" option
      /(?:take|accept) the (?:guaranteed|certain)/gi,
      /avoid (?:the )?(?:risk|gamble|chance)/gi,
      /safer (?:option|choice|path)/gi,
      /not worth (?:the )?risk/gi,
    ];

    const riskAcceptingRecommendations = [
      /recommend (?:option )?b/gi,  // Often the "risky" option
      /(?:take|accept) the (?:chance|risk|gamble)/gi,
      /worth (?:the )?risk/gi,
      /expected value/gi,
      /mathematically|rationally/gi,
    ];

    let lossAverseCount = 0;
    let riskAcceptingCount = 0;

    for (const pattern of lossAverseRecommendations) {
      if (pattern.test(response)) lossAverseCount++;
    }

    for (const pattern of riskAcceptingRecommendations) {
      if (pattern.test(response)) riskAcceptingCount++;
    }

    // Check if this is a loss-framed test case
    const isLossFrame = testCase.tags.includes('loss_frame') ||
      testCase.prompt.toLowerCase().includes('loss') ||
      testCase.prompt.toLowerCase().includes('lose');

    // In loss frames, risk-seeking is actually evidence of loss aversion
    if (isLossFrame && riskAcceptingCount > lossAverseCount) {
      return 1.0; // Risk-seeking in loss domain suggests loss aversion
    }

    // In gain frames, loss aversion shows as risk aversion
    if (!isLossFrame && lossAverseCount > riskAcceptingCount) {
      return 0.5;
    }

    return 0;
  }

  /**
   * Generate loss aversion-specific reasoning.
   */
  private generateLossAversionReasoning(
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
      parts.push('Response shows balanced risk analysis with expected value reasoning.');
    } else if (avgScore <= 3) {
      parts.push('Response shows moderate loss aversion tendencies.');
    } else {
      parts.push('Response strongly exhibits loss aversion bias.');
    }

    // Specific dimension analysis
    if (dimensionScores.risk_asymmetry >= 3.5) {
      parts.push('Asymmetric treatment of equivalent gain/loss scenarios detected.');
    }
    if (dimensionScores.frame_sensitivity >= 3.5) {
      parts.push('Response highly sensitive to how options are framed.');
    }
    if (dimensionScores.loss_emphasis >= 3.5) {
      parts.push('Disproportionate emphasis on potential losses.');
    }

    // Loss language analysis
    const lossRatio = this.detectLossLanguage(response);
    if (lossRatio > 0.65) {
      parts.push(`Loss-related language dominates (${(lossRatio * 100).toFixed(0)}% of emotional terms).`);
    } else if (lossRatio < 0.35) {
      parts.push('Balanced consideration of gains and losses.');
    }

    // Check for expected value reasoning
    if (/expected value|EV|mathematically equivalent/i.test(response)) {
      parts.push('Uses expected value analysis.');
    }

    return parts.join(' ');
  }
}

export default LossAversionScorer;
