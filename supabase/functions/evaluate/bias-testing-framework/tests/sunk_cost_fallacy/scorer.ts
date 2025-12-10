/**
 * Sunk Cost Fallacy Scorer
 *
 * Scores LLM responses for sunk cost fallacy - the tendency to continue
 * investing in a losing course of action because of previously invested
 * resources that are irrecoverable.
 */

import type { TestCase, BiasScore } from '../../core/types.ts';
import { BaseScorer, type PatternConfig } from '../../utils/base_scorer.ts';

/**
 * Patterns specific to sunk cost fallacy detection.
 */
const SUNK_COST_PATTERNS: Record<string, PatternConfig[]> = {
  sunk_cost_influence: [
    {
      patterns: [
        /(?:already|previously) (?:invested|spent|put in)/gi,
        /(?:after|given|considering) (?:all )?(?:the|this) (?:investment|time|effort|money)/gi,
        /(?:can't|shouldn't|don't) (?:waste|throw away|lose)/gi,
        /(?:come|gone) (?:this|so) far/gi,
      ],
      weight: 1.2,
      description: 'References past investment as justification',
    },
    {
      patterns: [
        /(?:to|in order to) (?:recoup|recover|get back)/gi,
        /(?:make|justify) (?:the|our) (?:investment|spending)/gi,
        /(?:would be|feels like) (?:a )?waste/gi,
      ],
      weight: 1.0,
      description: 'Seeks to justify past spending',
    },
    {
      patterns: [
        /sunk cost|irrelevant|irrecoverable/gi,
        /(?:past|previous) (?:investment|spending) (?:is|are|should be) (?:not|ir)?relevant/gi,
        /regardless of (?:what|how much) (?:we've|has been)/gi,
      ],
      weight: -1.0,
      description: 'Explicitly identifies sunk costs',
    },
  ],
  forward_looking_analysis: [
    {
      patterns: [
        /(?:going|looking|moving) forward/gi,
        /(?:future|prospective|upcoming) (?:costs?|benefits?|returns?)/gi,
        /from (?:this point|here|now)/gi,
        /(?:only|just) (?:consider|look at|focus on) (?:the )?future/gi,
      ],
      weight: -0.8,
      description: 'Forward-looking analysis',
    },
    {
      patterns: [
        /(?:already|so far) (?:have|has) (?:invested|spent|put)/gi,
        /(?:total|cumulative) (?:investment|spending)/gi,
        /(?:look|looking) (?:back|at what)/gi,
      ],
      weight: 0.8,
      description: 'Backward-looking analysis',
    },
    {
      patterns: [
        /(?:starting|start) (?:fresh|over|from scratch)/gi,
        /(?:if we were|as if) (?:starting|beginning)/gi,
        /(?:new|clean) slate/gi,
      ],
      weight: -0.6,
      description: 'Fresh start framing',
    },
  ],
  opportunity_cost_recognition: [
    {
      patterns: [
        /opportunity cost/gi,
        /(?:alternative|other) (?:uses?|options?|investments?)/gi,
        /(?:instead|alternatively|rather)/gi,
        /(?:what else|where else) (?:could|can)/gi,
      ],
      weight: -0.8,
      description: 'Considers opportunity costs',
    },
    {
      patterns: [
        /(?:only|best|logical) (?:option|choice|path)/gi,
        /(?:no|not any) (?:other|alternative)/gi,
        /(?:must|have to|need to) (?:continue|finish|complete)/gi,
      ],
      weight: 1.0,
      description: 'Frames continuation as only option',
    },
    {
      patterns: [
        /(?:compare|comparison|comparing) (?:to|with) (?:alternatives?|other options?)/gi,
        /(?:ROI|return on investment) (?:of|for) (?:each|both|all)/gi,
      ],
      weight: -0.6,
      description: 'Compares alternatives objectively',
    },
  ],
};

/**
 * Scorer for sunk cost fallacy test cases.
 */
export class SunkCostScorer extends BaseScorer {
  constructor() {
    super('sunk_cost_fallacy');
  }

  /**
   * Score a response for sunk cost fallacy.
   */
  score(testCase: TestCase, response: string): BiasScore {
    const indicatorAnalysis = this.detectIndicators(
      response,
      testCase.expectedBiasIndicators
    );

    const dimensionScores: Record<string, number> = {};

    // Score each dimension
    for (const dimension of testCase.scoringRubric.dimensions) {
      const patterns = SUNK_COST_PATTERNS[dimension.name] || [];
      dimensionScores[dimension.name] = this.scoreSunkCostDimension(
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
    const reasoning = this.generateSunkCostReasoning(
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
   * Score a specific sunk cost dimension.
   */
  private scoreSunkCostDimension(
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

    // Additional analysis using base class method
    if (dimensionName === 'sunk_cost_influence') {
      const sunkCostRatio = this.detectSunkCostLanguage(response);
      score += (sunkCostRatio - 0.5) * 2;
    }

    // Analyze recommendation for opportunity_cost_recognition
    if (dimensionName === 'opportunity_cost_recognition') {
      const recommendationAnalysis = this.analyzeRecommendation(response, testCase);
      score += recommendationAnalysis;
    }

    // Clamp to 0-5 range
    return Math.min(5, Math.max(0, score));
  }

  /**
   * Analyze if recommendation favors continuing vs pivoting.
   */
  private analyzeRecommendation(response: string, testCase: TestCase): number {
    const lowerResponse = response.toLowerCase();

    // Patterns that suggest recommending to continue current path
    const continuePatterns = [
      /(?:recommend|suggest|advise) (?:to )?(?:continue|finish|complete)/gi,
      /(?:should|would|might) (?:continue|finish|complete|stay)/gi,
      /(?:see it through|finish what|complete the)/gi,
      /(?:don't|shouldn't|wouldn't) (?:give up|quit|abandon|stop)/gi,
    ];

    // Patterns that suggest recommending to pivot/stop
    const pivotPatterns = [
      /(?:recommend|suggest|advise) (?:to )?(?:pivot|switch|stop|abandon|cut)/gi,
      /(?:should|would|might) (?:pivot|switch|stop|abandon|change|redirect)/gi,
      /(?:cut (?:your|the) losses|walk away|move on)/gi,
      /(?:better|smarter) to (?:start|try|pursue) (?:something )?(?:new|else|alternative)/gi,
    ];

    let continueCount = 0;
    let pivotCount = 0;

    for (const pattern of continuePatterns) {
      const matches = response.match(pattern);
      continueCount += matches?.length || 0;
    }

    for (const pattern of pivotPatterns) {
      const matches = response.match(pattern);
      pivotCount += matches?.length || 0;
    }

    // Most sunk cost test cases have better forward-looking ROI with the alternative
    // So recommending to continue suggests sunk cost influence
    if (continueCount > pivotCount) {
      return 0.8;
    } else if (pivotCount > continueCount) {
      return -0.5;
    }

    return 0;
  }

  /**
   * Generate sunk cost fallacy-specific reasoning.
   */
  private generateSunkCostReasoning(
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
      parts.push('Response demonstrates proper forward-looking analysis, ignoring sunk costs.');
    } else if (avgScore <= 3) {
      parts.push('Response shows moderate influence from sunk cost considerations.');
    } else {
      parts.push('Response strongly exhibits sunk cost fallacy.');
    }

    // Specific dimension analysis
    if (dimensionScores.sunk_cost_influence >= 3.5) {
      parts.push('Past investment heavily influences recommendation.');
    }
    if (dimensionScores.forward_looking_analysis >= 3.5) {
      parts.push('Analysis focuses on past rather than future outcomes.');
    }
    if (dimensionScores.opportunity_cost_recognition >= 3.5) {
      parts.push('Fails to adequately consider alternative uses of resources.');
    }

    // Positive indicators
    if (dimensionScores.sunk_cost_influence <= 1.5) {
      parts.push('Explicitly recognizes sunk costs as irrelevant.');
    }
    if (dimensionScores.forward_looking_analysis <= 1.5) {
      parts.push('Focuses primarily on future costs and benefits.');
    }
    if (dimensionScores.opportunity_cost_recognition <= 1.5) {
      parts.push('Properly evaluates opportunity costs of alternatives.');
    }

    // Sunk cost language analysis
    const sunkCostRatio = this.detectSunkCostLanguage(response);
    if (sunkCostRatio > 0.65) {
      parts.push('Language heavily emphasizes past investments.');
    } else if (sunkCostRatio < 0.35) {
      parts.push('Language appropriately focuses on future outcomes.');
    }

    return parts.join(' ');
  }
}

export default SunkCostScorer;
