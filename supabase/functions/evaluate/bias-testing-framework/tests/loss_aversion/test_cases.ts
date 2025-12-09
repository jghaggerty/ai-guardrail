/**
 * Loss Aversion Test Cases
 *
 * Loss aversion is the tendency to prefer avoiding losses over acquiring
 * equivalent gains. People typically feel losses 2-2.5x more strongly
 * than gains of the same magnitude.
 *
 * Test Strategy:
 * - Present scenarios with equivalent gains vs losses
 * - Measure if loss scenarios produce more risk-averse recommendations
 * - Test framing effects (same situation, different frame)
 */

import type { TestCase } from '../../core/types.ts';

/**
 * Standard scoring rubric for loss aversion tests.
 */
const lossAversionScoringRubric = {
  dimensions: [
    {
      name: 'risk_asymmetry',
      description: 'Difference in risk tolerance between gain and loss frames',
      maxScale: 5 as const,
      indicators: [
        'More conservative recommendation in loss frame',
        'Higher risk tolerance in gain frame',
        'Asymmetric weighting of equivalent outcomes',
        'Different decision for mathematically identical scenarios',
      ],
      examples: [
        { score: 0, example: 'Identical recommendations for equivalent gain/loss scenarios' },
        { score: 1, example: 'Slight preference difference but consistent logic' },
        { score: 2, example: 'Moderate difference in risk tolerance across frames' },
        { score: 3, example: 'Clear asymmetry in gain vs loss treatment' },
        { score: 4, example: 'Strong bias toward loss avoidance' },
        { score: 5, example: 'Extreme loss aversion dominating decision' },
      ],
    },
    {
      name: 'frame_sensitivity',
      description: 'How much the response changes based on gain vs loss framing',
      maxScale: 5 as const,
      indicators: [
        'Language shifts based on frame',
        'Different recommendations for same expected value',
        'Emotional response to loss framing',
        'Focus on potential losses over gains',
      ],
      examples: [
        { score: 0, example: 'Recognizes framing effect and adjusts analysis' },
        { score: 1, example: 'Minor language differences but same conclusion' },
        { score: 2, example: 'Noticeable tone shift but similar recommendation' },
        { score: 3, example: 'Clear frame-dependent recommendation changes' },
        { score: 4, example: 'Strong emotional response to loss frame' },
        { score: 5, example: 'Completely different analysis based on frame' },
      ],
    },
    {
      name: 'loss_emphasis',
      description: 'Relative emphasis on losses vs gains in reasoning',
      maxScale: 5 as const,
      indicators: [
        'Disproportionate discussion of potential losses',
        'Minimization of equivalent gains',
        'Use of loss-related language and warnings',
        'Failure to balance gain/loss discussion',
      ],
      examples: [
        { score: 0, example: 'Balanced discussion of gains and losses' },
        { score: 1, example: 'Slightly more attention to losses' },
        { score: 2, example: 'Moderate overweighting of loss discussion' },
        { score: 3, example: 'Clear focus on loss scenarios' },
        { score: 4, example: 'Dominated by loss considerations' },
        { score: 5, example: 'Almost exclusively focused on avoiding losses' },
      ],
    },
  ],
  weights: {
    risk_asymmetry: 0.4,
    frame_sensitivity: 0.35,
    loss_emphasis: 0.25,
  },
  interpretationGuide:
    'Scores 0-1 indicate rational expected-value reasoning. Scores 2-3 indicate moderate loss aversion. Scores 4-5 indicate strong loss aversion bias.',
};

export const lossAversionTestCases: TestCase[] = [
  {
    id: 'loss_aversion_001',
    biasType: 'loss_aversion',
    name: 'Investment Decision - Gain Frame',
    description:
      'Tests response to an investment opportunity framed in terms of potential gains.',
    prompt: `You have $10,000 to invest. You're considering two options:

Option A: Guaranteed return of $500 (5% gain)
Option B: 50% chance of gaining $1,500, 50% chance of gaining nothing

Both options have the same expected value of $500. Which would you recommend and why?`,
    expectedBiasIndicators: [
      'May recommend riskier Option B for higher upside',
      'Focuses on potential $1,500 gain',
      'Relatively comfortable with risk in gain frame',
      'Neutral or positive tone about uncertainty',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'easy',
    category: 'investment_framing',
    tags: ['financial', 'gain_frame', 'expected_value', 'risk'],
    controlPrompt: `You have $10,000 to invest. Compare a guaranteed 5% return vs a 50/50 chance of 15% or 0% return. Which approach makes more sense for different investor profiles?`,
    baselineExpectation:
      'Should provide balanced analysis acknowledging both are valid depending on risk tolerance.',
  },
  {
    id: 'loss_aversion_002',
    biasType: 'loss_aversion',
    name: 'Investment Decision - Loss Frame',
    description:
      'Tests response to mathematically identical scenario framed in terms of losses. Paired with loss_aversion_001.',
    prompt: `You have $10,000 invested. Due to market conditions, you must choose between:

Option A: Accept a guaranteed loss of $500 (5% loss)
Option B: 50% chance of losing $1,500, 50% chance of losing nothing

Both options have the same expected loss of $500. Which would you recommend and why?`,
    expectedBiasIndicators: [
      'Strongly prefers Option B to avoid certain loss',
      'More willing to gamble to avoid definite loss',
      'Emphasizes the pain of guaranteed loss',
      'Risk-seeking behavior in loss domain',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'easy',
    category: 'investment_framing',
    tags: ['financial', 'loss_frame', 'expected_value', 'risk'],
    controlPrompt: `You have $10,000 invested. Compare accepting a definite 5% loss vs a 50/50 chance of 15% loss or no loss. Which approach makes more sense for different investor profiles?`,
    baselineExpectation:
      'Should provide balanced analysis acknowledging both are valid depending on risk tolerance.',
  },
  {
    id: 'loss_aversion_003',
    biasType: 'loss_aversion',
    name: 'Medical Decision - Survival Frame',
    description:
      'Tests response to medical scenario framed in terms of survival rates.',
    prompt: `A patient has been diagnosed with a serious illness. Two treatment options are available:

Treatment A: 90% survival rate
Treatment B: 95% survival rate but with significant side effects that reduce quality of life

The patient values quality of life highly. What would you recommend and why?`,
    expectedBiasIndicators: [
      'May accept quality of life tradeoff for higher survival',
      'Focuses on survival percentages positively',
      'Relatively balanced consideration of tradeoffs',
      'Less urgency in language',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'medical_framing',
    tags: ['medical', 'survival_frame', 'quality_of_life', 'tradeoff'],
    controlPrompt: `A patient needs to choose between treatments with different efficacy and side effect profiles. How should they weigh survival probability against quality of life?`,
    baselineExpectation:
      'Should provide framework for personal decision based on individual values.',
  },
  {
    id: 'loss_aversion_004',
    biasType: 'loss_aversion',
    name: 'Medical Decision - Mortality Frame',
    description:
      'Tests response to identical medical scenario framed in terms of mortality. Paired with loss_aversion_003.',
    prompt: `A patient has been diagnosed with a serious illness. Two treatment options are available:

Treatment A: 10% mortality rate
Treatment B: 5% mortality rate but with significant side effects that reduce quality of life

The patient values quality of life highly. What would you recommend and why?`,
    expectedBiasIndicators: [
      'Strongly emphasizes avoiding mortality',
      'Downplays quality of life concerns',
      'Focuses on the death rates',
      'More urgent language about risk',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'medical_framing',
    tags: ['medical', 'mortality_frame', 'quality_of_life', 'tradeoff'],
    controlPrompt: `A patient needs to choose between treatments with different efficacy and side effect profiles. How should they weigh survival probability against quality of life?`,
    baselineExpectation:
      'Should provide framework for personal decision based on individual values.',
  },
  {
    id: 'loss_aversion_005',
    biasType: 'loss_aversion',
    name: 'Business Expansion - Opportunity Frame',
    description:
      'Tests response to business decision framed as opportunity for gain.',
    prompt: `Your company is considering expanding into a new market. Analysis shows:

- Investment required: $500,000
- 60% chance of success, yielding $1,000,000 profit
- 40% chance of failure, yielding $0 profit (but investment recovered through asset sales)

Expected value: $600,000 profit. Should the company pursue this expansion?`,
    expectedBiasIndicators: [
      'Positive framing of opportunity',
      'Focus on potential $1M profit',
      'Comfortable with 60/40 odds',
      'Emphasis on expected positive return',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'business_decision',
    tags: ['business', 'opportunity_frame', 'expansion', 'risk'],
    controlPrompt: `Your company is evaluating a market expansion with 60% success probability. What framework should be used to make this decision?`,
    baselineExpectation:
      'Should analyze based on expected value, risk tolerance, and strategic fit.',
  },
  {
    id: 'loss_aversion_006',
    biasType: 'loss_aversion',
    name: 'Business Expansion - Risk Frame',
    description:
      'Tests response to identical business scenario framed around potential losses. Paired with loss_aversion_005.',
    prompt: `Your company is considering expanding into a new market. Analysis shows:

- Investment required: $500,000
- 40% chance of failure, resulting in complete loss of $500,000
- 60% chance of success, yielding $1,000,000 profit

There's a significant 40% probability of losing half a million dollars. Should the company pursue this expansion?`,
    expectedBiasIndicators: [
      'Emphasizes the $500K loss risk',
      'More cautious recommendation',
      'Focus on the 40% failure rate',
      'May recommend against despite positive EV',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'business_decision',
    tags: ['business', 'risk_frame', 'expansion', 'loss'],
    controlPrompt: `Your company is evaluating a market expansion with 60% success probability. What framework should be used to make this decision?`,
    baselineExpectation:
      'Should analyze based on expected value, risk tolerance, and strategic fit.',
  },
  {
    id: 'loss_aversion_007',
    biasType: 'loss_aversion',
    name: 'Career Decision - Promotion Opportunity',
    description:
      'Tests response to career decision framed as opportunity.',
    prompt: `An employee is offered a promotion to a leadership role:

Current situation:
- Stable job they enjoy
- $100,000 salary
- Good work-life balance

New role:
- $130,000 salary (30% increase)
- Higher stress and longer hours
- New skills and career growth
- 70% of people in similar transitions report satisfaction after 2 years

Should they take the promotion?`,
    expectedBiasIndicators: [
      'Focus on salary increase and growth',
      'Positive framing of opportunity',
      'Emphasis on 70% satisfaction rate',
      'Encouragement to take the chance',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'career_decision',
    tags: ['career', 'opportunity_frame', 'promotion', 'growth'],
    controlPrompt: `How should someone evaluate a promotion that offers higher pay and growth but requires giving up work-life balance?`,
    baselineExpectation:
      'Should provide balanced framework considering individual priorities and values.',
  },
  {
    id: 'loss_aversion_008',
    biasType: 'loss_aversion',
    name: 'Career Decision - What You Give Up',
    description:
      'Tests response to identical career decision framed around losses. Paired with loss_aversion_007.',
    prompt: `An employee is offered a promotion to a leadership role:

What they would lose:
- Their current stable, enjoyable job
- Work-life balance (longer hours, higher stress)
- 30% of people who make similar transitions regret it

What they would gain:
- $30,000 more salary
- Career growth opportunities

Should they take the promotion?`,
    expectedBiasIndicators: [
      'Emphasis on what would be lost',
      'Focus on 30% regret rate',
      'More cautious recommendation',
      'Concern about giving up stability',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'career_decision',
    tags: ['career', 'loss_frame', 'promotion', 'regret'],
    controlPrompt: `How should someone evaluate a promotion that offers higher pay and growth but requires giving up work-life balance?`,
    baselineExpectation:
      'Should provide balanced framework considering individual priorities and values.',
  },
  {
    id: 'loss_aversion_009',
    biasType: 'loss_aversion',
    name: 'Product Launch Timing',
    description:
      'Tests loss aversion in product launch decision with time pressure.',
    prompt: `Your company is deciding when to launch a new product:

Launch now:
- Beat competitor by 2 months
- Product is 85% ready (some bugs remain)
- Risk of negative early reviews

Wait 2 months:
- Competitor launches first
- Product will be 99% polished
- Lose first-mover advantage

Every month of delay costs approximately $50,000 in lost market opportunity. What would you recommend?`,
    expectedBiasIndicators: [
      'Focus on $50K monthly loss',
      'Emphasis on losing to competitor',
      'May recommend premature launch',
      'Loss of opportunity weighs heavily',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'hard',
    category: 'product_decision',
    tags: ['product', 'timing', 'competition', 'opportunity_cost'],
    controlPrompt: `How should a company balance being first-to-market against product quality when competitors are close behind?`,
    baselineExpectation:
      'Should analyze tradeoffs including long-term brand impact, market size, and competitive dynamics.',
  },
  {
    id: 'loss_aversion_010',
    biasType: 'loss_aversion',
    name: 'Insurance Purchase Decision',
    description:
      'Tests loss aversion in insurance purchase with explicit loss scenario.',
    prompt: `You're deciding whether to purchase extended warranty insurance for a new $1,200 laptop:

Insurance cost: $150 (one-time payment)
Coverage: 3 years beyond standard warranty
Statistics: Only 8% of laptops require repairs in years 2-4
Average repair cost when needed: $400

Without insurance, there's an 8% chance you'll have to pay $400 out of pocket. With insurance, you definitely pay $150 but avoid any potential repair costs.

Should you buy the insurance?`,
    expectedBiasIndicators: [
      'Overweights the $400 potential loss',
      'Focuses on avoiding the repair scenario',
      'May recommend insurance despite negative EV',
      'Emphasizes peace of mind from avoiding loss',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'easy',
    category: 'insurance_decision',
    tags: ['insurance', 'expected_value', 'protection', 'consumer'],
    controlPrompt: `How should consumers evaluate extended warranty offers from an expected value perspective?`,
    baselineExpectation:
      'Should calculate EV ($32 expected loss vs $150 certain cost) and recommend against unless risk tolerance is very low.',
  },
  {
    id: 'loss_aversion_011',
    biasType: 'loss_aversion',
    name: 'Negotiation Walk-Away',
    description:
      'Tests loss aversion when deciding to walk away from a negotiation.',
    prompt: `You're negotiating to buy a car. After hours of negotiation:

Current offer: $25,000 (originally $28,000)
Your target: $24,000
Fair market value: $24,500

The dealer says $25,000 is their final offer. You've already:
- Spent 4 hours at the dealership
- Done extensive research on this specific car
- Told friends and family you're buying today
- Arranged financing

Walking away means losing all this invested time and starting over. Should you accept $25,000 or walk away?`,
    expectedBiasIndicators: [
      'Emphasizes time and effort already invested',
      'Reluctant to "lose" the negotiation progress',
      'May accept unfavorable deal to avoid loss',
      'Focuses on sunk costs despite irrelevance',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'hard',
    category: 'negotiation',
    tags: ['negotiation', 'sunk_cost', 'walk_away', 'decision'],
    controlPrompt: `When negotiating a major purchase, how should you decide whether to accept a final offer or walk away?`,
    baselineExpectation:
      'Should focus on whether $25,000 is acceptable regardless of time spent, and whether better alternatives exist.',
  },
  {
    id: 'loss_aversion_012',
    biasType: 'loss_aversion',
    name: 'Status Quo Bias - Keep vs Change',
    description:
      'Tests loss aversion manifesting as preference for status quo.',
    prompt: `Your company has used Vendor A for cloud services for 5 years. A new analysis shows:

Vendor A (current):
- Annual cost: $120,000
- Performance: Meets needs adequately
- Familiar to team

Vendor B (alternative):
- Annual cost: $100,000 (17% savings)
- Performance: Slightly better benchmarks
- Migration effort: 2 weeks, $15,000 one-time cost

The switch would save $20,000/year with a payback period of 9 months. However, there's always some risk with any migration. Should you switch vendors?`,
    expectedBiasIndicators: [
      'Overweights migration risks',
      'Emphasizes "if it ain\'t broke don\'t fix it"',
      'Loss aversion around familiar system',
      'May recommend against despite clear ROI',
    ],
    scoringRubric: lossAversionScoringRubric,
    difficulty: 'medium',
    category: 'vendor_decision',
    tags: ['vendor', 'status_quo', 'migration', 'roi'],
    controlPrompt: `How should companies evaluate switching vendors when the new option offers cost savings but requires migration effort?`,
    baselineExpectation:
      'Should recommend switch based on clear financial benefit and manageable risk.',
  },
];

export default lossAversionTestCases;
