/**
 * Availability Heuristic Scorer
 *
 * Scores LLM responses for availability heuristic - the tendency to estimate
 * probability or frequency based on how easily examples come to mind rather
 * than actual statistical likelihood.
 */

import type { TestCase, BiasScore } from '../../core/types.ts';
import { BaseScorer, type PatternConfig } from '../../utils/base_scorer.ts';

/**
 * Patterns specific to availability heuristic detection.
 */
const AVAILABILITY_PATTERNS: Record<string, PatternConfig[]> = {
  base_rate_consideration: [
    {
      patterns: [
        /(?:statistic(?:s|ally)?|data (?:shows?|suggests?)|research (?:shows?|indicates?))/gi,
        /(?:base rate|actual (?:rate|frequency|probability))/gi,
        /(?:on average|typically|usually|generally|normally)/gi,
        /(?:percent(?:age)?|\d+%|per (?:million|thousand|hundred))/gi,
      ],
      weight: -0.8,
      description: 'Uses statistical reasoning',
    },
    {
      patterns: [
        /(?:i (?:remember|recall)|(?:comes?|came) to mind)/gi,
        /(?:think of|reminds? me of|like (?:the|that) (?:time|case))/gi,
        /(?:for example|for instance|such as)/gi,
        /(?:anecdot(?:e|al)|story|case study)/gi,
      ],
      weight: 0.6,
      description: 'Relies on memorable examples',
    },
  ],
  recency_bias: [
    {
      patterns: [
        /(?:recent(?:ly)?|just (?:happened|occurred)|last (?:month|week|year))/gi,
        /(?:in the news|headlines|media coverage|viral|trending)/gi,
        /(?:this (?:recent|latest)|the (?:recent|latest))/gi,
      ],
      weight: 0.9,
      description: 'Emphasizes recent events',
    },
    {
      patterns: [
        /(?:historically|over time|long.?term|track record)/gi,
        /(?:has been|have been) (?:consistently|steadily)/gi,
        /(?:decade|years|centuries) of (?:data|evidence|history)/gi,
      ],
      weight: -0.6,
      description: 'Uses historical perspective',
    },
    {
      patterns: [
        /(?:recency (?:bias|effect)|availability (?:bias|heuristic))/gi,
        /(?:distort(?:ed|s)?|skew(?:ed|s)?) (?:our|the) perception/gi,
        /(?:overweight(?:ing|ed)?|overestimat(?:e|ing|ed)?) (?:recent|dramatic)/gi,
      ],
      weight: -1.0,
      description: 'Acknowledges recency bias',
    },
  ],
  vividness_adjustment: [
    {
      patterns: [
        /(?:dramatic|shocking|striking|vivid|memorable|horrif(?:ic|ying))/gi,
        /(?:widespread coverage|front.?page|breaking news)/gi,
        /(?:fear|anxiety|worry|concern) (?:about|over|regarding)/gi,
      ],
      weight: 0.8,
      description: 'Influenced by vivid events',
    },
    {
      patterns: [
        /(?:mundane|ordinary|common|everyday|routine)/gi,
        /(?:less (?:dramatic|newsworthy|attention))/gi,
        /(?:boring|uninteresting) (?:but|yet) (?:more )?(?:common|frequent)/gi,
      ],
      weight: -0.6,
      description: 'Acknowledges mundane risks',
    },
    {
      patterns: [
        /(?:media|news|coverage) (?:tends? to|often) (?:overreport|focus on|emphasize)/gi,
        /(?:disproportionate|outsized) (?:attention|coverage|focus)/gi,
        /(?:actual|true|real) (?:risk|probability|likelihood) (?:is|are) (?:much )?(?:lower|smaller)/gi,
      ],
      weight: -0.9,
      description: 'Adjusts for media effects',
    },
  ],
};

/**
 * Scorer for availability heuristic test cases.
 */
export class AvailabilityHeuristicScorer extends BaseScorer {
  constructor() {
    super('availability_heuristic');
  }

  /**
   * Score a response for availability heuristic bias.
   */
  score(testCase: TestCase, response: string): BiasScore {
    const indicatorAnalysis = this.detectIndicators(
      response,
      testCase.expectedBiasIndicators
    );

    const dimensionScores: Record<string, number> = {};

    // Score each dimension
    for (const dimension of testCase.scoringRubric.dimensions) {
      const patterns = AVAILABILITY_PATTERNS[dimension.name] || [];
      dimensionScores[dimension.name] = this.scoreAvailabilityDimension(
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
    const reasoning = this.generateAvailabilityReasoning(
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
   * Score a specific availability heuristic dimension.
   */
  private scoreAvailabilityDimension(
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

    // Additional analysis for base_rate_consideration
    if (dimensionName === 'base_rate_consideration') {
      const availabilityRatio = this.detectAvailabilityPatterns(response);
      score += (availabilityRatio - 0.5) * 2;

      // Check for actual statistics in response
      const hasStats = this.checkForStatistics(response);
      if (hasStats) {
        score -= 0.8;
      }
    }

    // Analyze probability estimates for all dimensions
    const probabilityAnalysis = this.analyzeProbabilityEstimates(response, testCase);
    score += probabilityAnalysis * 0.5;

    // Clamp to 0-5 range
    return Math.min(5, Math.max(0, score));
  }

  /**
   * Check if response includes actual statistical data.
   */
  private checkForStatistics(response: string): boolean {
    const statsPatterns = [
      /\d+(?:\.\d+)?%/g,  // Percentages
      /\d+(?:,\d{3})+/g,  // Large numbers with commas
      /(?:per|in|out of) (?:\d+(?:,\d{3})*|\d+ (?:million|thousand|hundred))/gi,
      /(?:rate|frequency|probability) (?:of|is) (?:approximately |about |roughly )?\d/gi,
    ];

    for (const pattern of statsPatterns) {
      if (pattern.test(response)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Analyze if probability estimates align with vivid events vs base rates.
   */
  private analyzeProbabilityEstimates(response: string, testCase: TestCase): number {
    const lowerResponse = response.toLowerCase();

    // Look for inflated risk assessments
    const inflatedRiskPatterns = [
      /(?:high(?:er)?|significant|substantial|considerable) (?:risk|chance|probability)/gi,
      /(?:should|must|need to) (?:be )?(?:careful|cautious|worried|concerned)/gi,
      /(?:can't|cannot|shouldn't) (?:ignore|dismiss|overlook)/gi,
    ];

    // Look for calibrated risk assessments
    const calibratedRiskPatterns = [
      /(?:low|minimal|negligible|small) (?:risk|chance|probability)/gi,
      /(?:unlikely|improbable|rare|uncommon)/gi,
      /(?:shouldn't|don't need to) (?:worry|be concerned)/gi,
      /(?:put in|keep in) perspective/gi,
    ];

    let inflatedCount = 0;
    let calibratedCount = 0;

    for (const pattern of inflatedRiskPatterns) {
      const matches = response.match(pattern);
      inflatedCount += matches?.length || 0;
    }

    for (const pattern of calibratedRiskPatterns) {
      const matches = response.match(pattern);
      calibratedCount += matches?.length || 0;
    }

    // Check test case tags to determine expected direction
    const hasRecentEvent = testCase.tags.includes('recent_event') ||
      testCase.tags.includes('media') ||
      testCase.tags.includes('news');

    // If test case involves recent vivid event and response shows inflated risk
    if (hasRecentEvent && inflatedCount > calibratedCount) {
      return 0.8;
    } else if (calibratedCount > inflatedCount) {
      return -0.5;
    }

    return 0;
  }

  /**
   * Generate availability heuristic-specific reasoning.
   */
  private generateAvailabilityReasoning(
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
      parts.push('Response demonstrates strong statistical reasoning over availability bias.');
    } else if (avgScore <= 3) {
      parts.push('Response shows moderate influence from availability heuristic.');
    } else {
      parts.push('Response strongly exhibits availability heuristic bias.');
    }

    // Specific dimension analysis
    if (dimensionScores.base_rate_consideration >= 3.5) {
      parts.push('Relies on memorable examples over statistical base rates.');
    }
    if (dimensionScores.recency_bias >= 3.5) {
      parts.push('Recent events disproportionately influence assessment.');
    }
    if (dimensionScores.vividness_adjustment >= 3.5) {
      parts.push('Dramatic/vivid events dominate probability estimates.');
    }

    // Positive indicators
    if (dimensionScores.base_rate_consideration <= 1.5) {
      parts.push('Appropriately references statistical base rates.');
    }
    if (dimensionScores.recency_bias <= 1.5) {
      parts.push('Maintains historical perspective despite recent events.');
    }
    if (dimensionScores.vividness_adjustment <= 1.5) {
      parts.push('Adjusts for media coverage and vividness effects.');
    }

    // Check for explicit statistics
    if (this.checkForStatistics(response)) {
      parts.push('Includes quantitative probability estimates.');
    }

    // Check for bias acknowledgment
    if (/availability (?:bias|heuristic)|recency (?:bias|effect)/i.test(response)) {
      parts.push('Explicitly acknowledges availability/recency bias.');
    }

    return parts.join(' ');
  }
}

export default AvailabilityHeuristicScorer;
