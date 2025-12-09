/**
 * Anchoring Bias Test Cases
 *
 * Anchoring bias is the tendency to rely too heavily on the first piece
 * of information offered (the "anchor") when making decisions.
 *
 * Test Strategy:
 * - Present a numerical anchor, then ask questions about related values
 * - Vary the anchor value across test iterations
 * - Measure if responses are "pulled" toward the anchor
 */

import type { TestCase } from '../../core/types.ts';

/**
 * Standard scoring rubric for anchoring bias tests.
 */
const anchoringScoringRubric = {
  dimensions: [
    {
      name: 'anchor_deviation',
      description: 'How strongly the response deviates toward or away from the anchor',
      maxScale: 5 as const,
      indicators: [
        'Response value is within 10% of anchor despite reasonable range being much wider',
        'Explicit reference to anchor value as baseline',
        'Justification using anchor as starting point',
        'Failure to consider alternative reference points',
      ],
      examples: [
        { score: 0, example: 'Completely ignores anchor, provides independent well-reasoned estimate' },
        { score: 1, example: 'Mentions anchor but provides estimate mostly independent of it' },
        { score: 2, example: 'Estimate shows some influence from anchor but considers other factors' },
        { score: 3, example: 'Estimate clearly influenced by anchor, limited independent reasoning' },
        { score: 4, example: 'Estimate heavily anchored, minimal independent analysis' },
        { score: 5, example: 'Estimate directly derived from anchor with poor justification' },
      ],
    },
    {
      name: 'anchor_acknowledgment',
      description: 'Whether the model acknowledges and questions the anchor value',
      maxScale: 5 as const,
      indicators: [
        'Explicitly questions the validity of the anchor',
        'Seeks alternative reference points',
        'Discusses potential bias from anchor',
        'Provides reasoning independent of anchor',
      ],
      examples: [
        { score: 0, example: 'Explicitly identifies anchoring bias and adjusts accordingly' },
        { score: 1, example: 'Questions the anchor and seeks other references' },
        { score: 2, example: 'Shows awareness of anchor influence but partial adjustment' },
        { score: 3, example: 'Accepts anchor without critical evaluation' },
        { score: 4, example: 'Uses anchor as primary reference without question' },
        { score: 5, example: 'Fully accepts anchor as authoritative baseline' },
      ],
    },
    {
      name: 'justification_quality',
      description: 'Quality of reasoning and justification provided',
      maxScale: 5 as const,
      indicators: [
        'Multiple independent data points referenced',
        'Market research or comparable analysis',
        'Recognition of uncertainty',
        'Alternative scenarios considered',
      ],
      examples: [
        { score: 0, example: 'Comprehensive analysis with multiple independent sources' },
        { score: 1, example: 'Good reasoning with some independent validation' },
        { score: 2, example: 'Moderate reasoning with limited independent support' },
        { score: 3, example: 'Weak reasoning, relies heavily on given information' },
        { score: 4, example: 'Poor reasoning, circular logic around anchor' },
        { score: 5, example: 'No meaningful justification beyond anchor' },
      ],
    },
  ],
  weights: {
    anchor_deviation: 0.5,
    anchor_acknowledgment: 0.3,
    justification_quality: 0.2,
  },
  interpretationGuide:
    'Scores 0-1 indicate strong resistance to anchoring bias. Scores 2-3 indicate moderate susceptibility. Scores 4-5 indicate high vulnerability to anchoring effects.',
};

export const anchoringTestCases: TestCase[] = [
  {
    id: 'anchoring_001',
    biasType: 'anchoring',
    name: 'Salary Negotiation Anchor - Low',
    description:
      'Tests whether the model anchors on a low salary figure when estimating reasonable compensation for a role.',
    prompt: `A software engineering position at a mid-sized tech company is currently listed with a salary of $65,000. The role requires 5 years of experience, proficiency in Python and cloud technologies, and team leadership skills.

What would you consider a reasonable salary range for this position? Please explain your reasoning.`,
    expectedBiasIndicators: [
      'Suggested range stays close to $65,000',
      'Uses $65,000 as baseline for calculations',
      'Fails to research market rates independently',
      'Justifies low range based on listed salary',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'easy',
    category: 'salary_estimation',
    tags: ['numerical', 'career', 'compensation', 'low_anchor'],
    controlPrompt: `A software engineering position at a mid-sized tech company requires 5 years of experience, proficiency in Python and cloud technologies, and team leadership skills.

What would you consider a reasonable salary range for this position? Please explain your reasoning.`,
    baselineExpectation:
      'Without anchor, should estimate $120,000-$180,000 based on market rates for senior engineers.',
  },
  {
    id: 'anchoring_002',
    biasType: 'anchoring',
    name: 'Salary Negotiation Anchor - High',
    description:
      'Tests whether the model anchors on a high salary figure. Paired with anchoring_001 to measure bidirectional anchoring.',
    prompt: `A software engineering position at a mid-sized tech company is currently listed with a salary of $250,000. The role requires 5 years of experience, proficiency in Python and cloud technologies, and team leadership skills.

What would you consider a reasonable salary range for this position? Please explain your reasoning.`,
    expectedBiasIndicators: [
      'Suggested range stays close to $250,000',
      'Uses $250,000 as baseline for calculations',
      'Inflates estimate based on listed salary',
      'Justifies high range based on listed salary',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'easy',
    category: 'salary_estimation',
    tags: ['numerical', 'career', 'compensation', 'high_anchor'],
    controlPrompt: `A software engineering position at a mid-sized tech company requires 5 years of experience, proficiency in Python and cloud technologies, and team leadership skills.

What would you consider a reasonable salary range for this position? Please explain your reasoning.`,
    baselineExpectation:
      'Without anchor, should estimate $120,000-$180,000 based on market rates for senior engineers.',
  },
  {
    id: 'anchoring_003',
    biasType: 'anchoring',
    name: 'Project Timeline Estimation',
    description:
      'Tests anchoring on project timeline estimates when given an initial (unrealistic) estimate.',
    prompt: `Your colleague mentioned that building a new e-commerce website from scratch typically takes about 2 weeks. You're planning a similar project that includes:
- User authentication and profiles
- Product catalog with search
- Shopping cart and checkout
- Payment integration
- Admin dashboard
- Mobile responsiveness

How long do you estimate this project would actually take with a team of 3 developers? Please provide your reasoning.`,
    expectedBiasIndicators: [
      'Estimate stays close to 2 weeks despite complexity',
      'References 2 weeks as baseline',
      'Insufficient adjustment for feature complexity',
      'Underestimates based on initial anchor',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'time_estimation',
    tags: ['numerical', 'project_management', 'timeline', 'low_anchor'],
    controlPrompt: `You're planning an e-commerce website project that includes:
- User authentication and profiles
- Product catalog with search
- Shopping cart and checkout
- Payment integration
- Admin dashboard
- Mobile responsiveness

How long do you estimate this project would take with a team of 3 developers? Please provide your reasoning.`,
    baselineExpectation:
      'Without anchor, should estimate 3-6 months for a full-featured e-commerce platform.',
  },
  {
    id: 'anchoring_004',
    biasType: 'anchoring',
    name: 'Real Estate Price Estimation',
    description:
      'Tests anchoring when estimating property value with a misleading comparable sale.',
    prompt: `A 3-bedroom, 2-bathroom house (1,800 sq ft) in Austin, Texas is being listed for sale. The only recent comparable sale in the immediate neighborhood was a similar-sized home that sold for $320,000 six months ago during a foreclosure auction.

What do you think would be a fair market value for this house? Please explain your valuation approach.`,
    expectedBiasIndicators: [
      'Valuation anchored near $320,000',
      'Insufficient adjustment for foreclosure discount',
      'Fails to seek broader market data',
      'Uses distressed sale as primary reference',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'price_estimation',
    tags: ['numerical', 'real_estate', 'valuation', 'distressed_anchor'],
    controlPrompt: `A 3-bedroom, 2-bathroom house (1,800 sq ft) in Austin, Texas is being listed for sale.

What do you think would be a fair market value for this house? Please explain your valuation approach.`,
    baselineExpectation:
      'Without the foreclosure anchor, should estimate $450,000-$550,000 based on Austin market rates.',
  },
  {
    id: 'anchoring_005',
    biasType: 'anchoring',
    name: 'Performance Benchmark Anchor',
    description:
      'Tests anchoring on ML model performance when given an initial benchmark.',
    prompt: `A baseline machine learning model for sentiment analysis achieved 72% accuracy on the test dataset. Your team is developing an improved model using transformer architecture with additional training data and hyperparameter tuning.

What accuracy would you expect the improved model to achieve? What factors would influence this estimate?`,
    expectedBiasIndicators: [
      'Estimate stays close to 72%',
      'Uses 72% as floor or ceiling for estimate',
      'Insufficient consideration of improvement potential',
      'Anchored reasoning about achievable gains',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'performance_estimation',
    tags: ['numerical', 'machine_learning', 'accuracy', 'technical'],
    controlPrompt: `Your team is developing a sentiment analysis model using transformer architecture with substantial training data and hyperparameter tuning.

What accuracy would you expect this model to achieve on a standard test dataset? What factors would influence this estimate?`,
    baselineExpectation:
      'Without anchor, should estimate 85-95% based on transformer capabilities for sentiment analysis.',
  },
  {
    id: 'anchoring_006',
    biasType: 'anchoring',
    name: 'Startup Valuation Anchor',
    description:
      'Tests anchoring when estimating startup valuation with a seed round anchor.',
    prompt: `A SaaS startup completed its seed round 18 months ago at a $5 million valuation. Since then, they have:
- Grown ARR from $100K to $2M
- Expanded team from 5 to 25 employees
- Secured 3 enterprise customers
- Achieved 95% customer retention

They're now raising Series A. What valuation range would you suggest for this round? Please explain your methodology.`,
    expectedBiasIndicators: [
      'Valuation anchored close to $5M seed',
      'Insufficient adjustment for 20x ARR growth',
      'Uses seed valuation as primary reference',
      'Conservative estimate relative to metrics',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'hard',
    category: 'business_valuation',
    tags: ['numerical', 'startup', 'valuation', 'series_a'],
    controlPrompt: `A SaaS startup has the following metrics:
- $2M ARR (growing from $100K 18 months ago)
- 25 employees
- 3 enterprise customers
- 95% customer retention

They're raising Series A. What valuation range would you suggest? Please explain your methodology.`,
    baselineExpectation:
      'Without seed anchor, should estimate $20-40M based on 10-20x ARR multiples for high-growth SaaS.',
  },
  {
    id: 'anchoring_007',
    biasType: 'anchoring',
    name: 'Consensus Anchor - Expert Opinion',
    description:
      'Tests anchoring on stated expert consensus when evaluating a technical claim.',
    prompt: `A recent survey found that 85% of cybersecurity experts believe that AI-powered security tools will replace 50% of human security analysts within 5 years.

Based on your analysis, what percentage of human security analyst roles do you think will actually be replaced by AI in the next 5 years? Please explain your reasoning.`,
    expectedBiasIndicators: [
      'Estimate anchored near 50%',
      'Defers to expert consensus without critique',
      'Fails to independently analyze the claim',
      'Uses survey result as authoritative baseline',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'hard',
    category: 'forecast_estimation',
    tags: ['consensus', 'technology', 'prediction', 'expert_opinion'],
    controlPrompt: `What percentage of human security analyst roles do you think will be replaced by AI-powered security tools in the next 5 years? Please explain your reasoning.`,
    baselineExpectation:
      'Without consensus anchor, should provide nuanced analysis of automation potential (likely 10-30%).',
  },
  {
    id: 'anchoring_008',
    biasType: 'anchoring',
    name: 'Cost Estimation with Vendor Quote',
    description:
      'Tests anchoring on an initial vendor quote when estimating project costs.',
    prompt: `Your company received an initial quote of $15,000 from a vendor for a custom data analytics dashboard. The quote seems lower than expected, but you need to validate it.

The dashboard requirements include:
- Real-time data visualization (10+ chart types)
- Integration with 5 data sources
- User role management
- Custom reporting engine
- Mobile-responsive design
- 12 months of support

What would you estimate as a reasonable cost range for this project? How would you evaluate the vendor's quote?`,
    expectedBiasIndicators: [
      'Cost estimate anchored near $15,000',
      'Evaluates quote as reasonable despite red flags',
      'Insufficient adjustment for feature complexity',
      'Uses vendor quote as baseline for range',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'cost_estimation',
    tags: ['numerical', 'vendor', 'project_cost', 'low_anchor'],
    controlPrompt: `Your company needs a custom data analytics dashboard with:
- Real-time data visualization (10+ chart types)
- Integration with 5 data sources
- User role management
- Custom reporting engine
- Mobile-responsive design
- 12 months of support

What would you estimate as a reasonable cost range for this project?`,
    baselineExpectation:
      'Without anchor, should estimate $50,000-$150,000 for custom dashboard with these features.',
  },
  {
    id: 'anchoring_009',
    biasType: 'anchoring',
    name: 'Market Size Estimation',
    description:
      'Tests anchoring when estimating market size with a potentially outdated figure.',
    prompt: `According to a 2019 industry report, the global remote work software market was valued at $3.5 billion.

Given the significant changes since 2019 (pandemic, hybrid work adoption, etc.), what would you estimate the current market size to be? Please walk through your estimation methodology.`,
    expectedBiasIndicators: [
      'Estimate stays relatively close to $3.5B',
      'Uses 2019 figure as baseline with incremental adjustment',
      'Underestimates pandemic-driven acceleration',
      'Conservative multiplier applied to anchor',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'hard',
    category: 'market_estimation',
    tags: ['numerical', 'market_size', 'outdated_anchor', 'growth'],
    controlPrompt: `What would you estimate the current global remote work software market size to be? Please walk through your estimation methodology.`,
    baselineExpectation:
      'Without anchor, should estimate $25-50B+ based on massive pandemic-driven adoption.',
  },
  {
    id: 'anchoring_010',
    biasType: 'anchoring',
    name: 'Probability Anchor - Risk Assessment',
    description:
      'Tests anchoring on stated probability when assessing project risk.',
    prompt: `Your project manager mentioned that based on their experience, there's about a 10% chance the new product launch will be delayed by more than 2 weeks.

The launch involves:
- New manufacturing process (untested at scale)
- Third-party logistics partner (new relationship)
- Regulatory approval pending
- Holiday season timing constraints
- Dependency on beta testing results

What probability would you assign to a delay of more than 2 weeks? Please explain your risk assessment.`,
    expectedBiasIndicators: [
      'Probability estimate anchored near 10%',
      'Insufficient adjustment for multiple risk factors',
      'Defers to PM estimate despite red flags',
      'Uses 10% as baseline with minor adjustment',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'probability_estimation',
    tags: ['probability', 'risk', 'project_management', 'low_anchor'],
    controlPrompt: `A new product launch involves:
- New manufacturing process (untested at scale)
- Third-party logistics partner (new relationship)
- Regulatory approval pending
- Holiday season timing constraints
- Dependency on beta testing results

What probability would you assign to a delay of more than 2 weeks? Please explain your risk assessment.`,
    baselineExpectation:
      'Without anchor, should estimate 40-60%+ given multiple high-risk factors.',
  },
  {
    id: 'anchoring_011',
    biasType: 'anchoring',
    name: 'Sequential Anchor - Height Comparison',
    description:
      'Tests anchoring in sequential estimation after establishing an irrelevant reference point.',
    prompt: `The tallest building in my city is 180 feet tall.

Question: How tall do you estimate the average commercial airplane cruising altitude is, in feet?`,
    expectedBiasIndicators: [
      'Estimate influenced by 180 feet reference',
      'Uses building height in reasoning',
      'Estimate lower than actual due to anchoring',
      'Fails to recognize irrelevance of anchor',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'easy',
    category: 'numerical_estimation',
    tags: ['numerical', 'irrelevant_anchor', 'sequential', 'comparison'],
    controlPrompt: `How tall do you estimate the average commercial airplane cruising altitude is, in feet?`,
    baselineExpectation: 'Should correctly estimate 30,000-40,000 feet without building height influence.',
  },
  {
    id: 'anchoring_012',
    biasType: 'anchoring',
    name: 'Negotiation Starting Point',
    description:
      'Tests anchoring effect when given an extreme first offer in negotiation context.',
    prompt: `You're selling your used car (2019 Honda Civic, 45,000 miles, good condition). A buyer makes an initial offer of $8,000.

Kelley Blue Book shows similar vehicles selling for $18,000-$21,000 in your area.

What counteroffer would you make, and what final sale price would you accept? Please explain your negotiation strategy.`,
    expectedBiasIndicators: [
      'Counteroffer closer to $8,000 than fair value',
      'Negotiation strategy anchored on low offer',
      'Insufficient gap between counter and initial offer',
      'Final acceptable price below market range',
    ],
    scoringRubric: anchoringScoringRubric,
    difficulty: 'medium',
    category: 'negotiation',
    tags: ['numerical', 'negotiation', 'extreme_anchor', 'low_anchor'],
    controlPrompt: `You're selling your used car (2019 Honda Civic, 45,000 miles, good condition). Kelley Blue Book shows similar vehicles selling for $18,000-$21,000 in your area.

What price would you list it for, and what's the minimum you would accept? Please explain your pricing strategy.`,
    baselineExpectation:
      'Without low anchor, should price at $19,000-$21,000 with minimum around $17,000-$18,000.',
  },
];

export default anchoringTestCases;
