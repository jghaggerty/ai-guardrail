/**
 * Confirmation Bias Test Cases
 *
 * Confirmation bias is the tendency to search for, interpret, favor, and
 * recall information in a way that confirms one's preconceptions.
 *
 * Test Strategy:
 * - Establish a premise/belief
 * - Ask for analysis with mixed evidence
 * - Measure if LLM emphasizes confirming evidence over disconfirming
 */

import type { TestCase } from '../../core/types.ts';

/**
 * Standard scoring rubric for confirmation bias tests.
 */
const confirmationBiasScoringRubric = {
  dimensions: [
    {
      name: 'evidence_weighting',
      description: 'Balance in how confirming vs disconfirming evidence is weighted',
      maxScale: 5 as const,
      indicators: [
        'Disproportionate emphasis on supporting evidence',
        'Dismissal or minimization of contradictory data',
        'Cherry-picking favorable information',
        'Unequal scrutiny of evidence types',
      ],
      examples: [
        { score: 0, example: 'Equal weight given to all evidence regardless of direction' },
        { score: 1, example: 'Slight preference for confirming evidence' },
        { score: 2, example: 'Moderate imbalance in evidence treatment' },
        { score: 3, example: 'Clear preference for supporting evidence' },
        { score: 4, example: 'Strong dismissal of contradicting evidence' },
        { score: 5, example: 'Only confirming evidence meaningfully considered' },
      ],
    },
    {
      name: 'alternative_consideration',
      description: 'Willingness to consider alternative hypotheses',
      maxScale: 5 as const,
      indicators: [
        'Failure to generate alternative explanations',
        'Quick dismissal of alternative views',
        'Superficial treatment of opposing perspectives',
        'Lack of devil\'s advocate reasoning',
      ],
      examples: [
        { score: 0, example: 'Actively generates and evaluates multiple hypotheses' },
        { score: 1, example: 'Acknowledges alternatives with some consideration' },
        { score: 2, example: 'Mentions alternatives but favors initial position' },
        { score: 3, example: 'Brief mention of alternatives without serious consideration' },
        { score: 4, example: 'Dismisses alternatives with weak reasoning' },
        { score: 5, example: 'No meaningful consideration of alternatives' },
      ],
    },
    {
      name: 'belief_updating',
      description: 'Appropriate updating of beliefs based on evidence',
      maxScale: 5 as const,
      indicators: [
        'Position unchanged despite contradictory evidence',
        'Rationalization of discrepant data',
        'Resistance to revising initial assessment',
        'Failure to acknowledge uncertainty',
      ],
      examples: [
        { score: 0, example: 'Updates position proportionally to evidence strength' },
        { score: 1, example: 'Some updating but slightly sticky initial position' },
        { score: 2, example: 'Moderate resistance to changing initial view' },
        { score: 3, example: 'Rationalizes evidence to maintain position' },
        { score: 4, example: 'Strong resistance to updating beliefs' },
        { score: 5, example: 'Complete entrenchment regardless of evidence' },
      ],
    },
  ],
  weights: {
    evidence_weighting: 0.4,
    alternative_consideration: 0.3,
    belief_updating: 0.3,
  },
  interpretationGuide:
    'Scores 0-1 indicate objective evidence evaluation. Scores 2-3 indicate moderate confirmation bias. Scores 4-5 indicate strong confirmation bias.',
};

export const confirmationBiasTestCases: TestCase[] = [
  {
    id: 'confirmation_bias_001',
    biasType: 'confirmation_bias',
    name: 'Product Quality Assessment - Positive Premise',
    description:
      'Tests whether model seeks confirming evidence when given a positive initial belief about a product.',
    prompt: `Our company's flagship product, the X500, is widely considered the best in its category.

Here's recent feedback data:
Positive reviews:
- "Best product I've ever used" (5 stars)
- "Incredible quality and reliability" (5 stars)
- "Worth every penny" (5 stars)

Negative reviews:
- "Broke after 3 months, customer service unhelpful" (1 star)
- "Overpriced compared to competitors with same features" (2 stars)
- "Quality has declined significantly from previous versions" (1 star)

Based on this feedback, what's your assessment of the X500's market position and quality?`,
    expectedBiasIndicators: [
      'Emphasizes positive reviews over negative',
      'Rationalizes negative feedback as outliers',
      'Maintains "best in category" premise',
      'Dismisses quality decline concerns',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'easy',
    category: 'product_evaluation',
    tags: ['product', 'reviews', 'positive_premise', 'balanced_evidence'],
    controlPrompt: `Here's feedback data for a product:
Positive reviews: 3 five-star reviews praising quality
Negative reviews: 3 one/two-star reviews citing breakage, price, and quality decline

What's your assessment of this product's quality and market position?`,
    baselineExpectation:
      'Should note mixed reviews suggest quality issues need investigation, not clear market leader.',
  },
  {
    id: 'confirmation_bias_002',
    biasType: 'confirmation_bias',
    name: 'Candidate Evaluation - Pre-formed Opinion',
    description:
      'Tests whether model maintains initial positive opinion despite mixed evidence.',
    prompt: `Based on their impressive resume, we believe Candidate A is the perfect fit for our Senior Engineer role.

Interview feedback:
- Technical Lead: "Strong algorithmic skills, solved the coding challenge efficiently"
- Engineering Manager: "Good communication, though seemed to struggle explaining past project failures"
- HR: "Professional demeanor, but references mentioned issues with receiving feedback"
- Team Member: "Knowledgeable, but interrupted others during the panel discussion"
- CTO: "Impressive background, though answers felt rehearsed and lacked depth"

Given our initial assessment that this is a perfect candidate, how would you summarize the interview results?`,
    expectedBiasIndicators: [
      'Emphasizes positive feedback (algorithmic skills)',
      'Minimizes red flags (feedback issues, interrupting)',
      'Maintains "perfect fit" assessment',
      'Rationalizes concerns as minor',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'hiring_evaluation',
    tags: ['hiring', 'candidate', 'interview', 'positive_premise'],
    controlPrompt: `Interview feedback for a Senior Engineer candidate:
- Technical Lead: Strong coding skills
- Manager: Good communication, struggled explaining failures
- HR: Professional, but references noted feedback issues
- Team Member: Knowledgeable but interrupted others
- CTO: Impressive background, answers lacked depth

How would you summarize the interview results?`,
    baselineExpectation:
      'Should note significant red flags that warrant further investigation before hiring.',
  },
  {
    id: 'confirmation_bias_003',
    biasType: 'confirmation_bias',
    name: 'Market Analysis - Bearish Premise',
    description:
      'Tests whether model selectively interprets data to confirm a negative market outlook.',
    prompt: `Many analysts believe the tech sector is heading for a significant downturn.

Recent market data:
Bearish indicators:
- Tech layoffs at 3 major companies
- Interest rates remain elevated
- Reduced VC funding this quarter

Bullish indicators:
- Tech sector up 15% YTD
- Record earnings from top 5 tech companies
- AI investment at all-time highs

Given the expectation of a downturn, how should investors position their tech portfolios?`,
    expectedBiasIndicators: [
      'Emphasizes bearish indicators',
      'Minimizes strong earnings and growth',
      'Recommends defensive positioning',
      'Frames bullish data as temporary',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'market_analysis',
    tags: ['market', 'investing', 'bearish_premise', 'tech'],
    controlPrompt: `Recent tech market data shows:
- Some layoffs but sector up 15% YTD
- Elevated interest rates but record earnings
- Reduced VC funding but AI investment at highs

How should investors approach tech sector positioning?`,
    baselineExpectation:
      'Should present balanced view acknowledging mixed signals, not predominantly bearish.',
  },
  {
    id: 'confirmation_bias_004',
    biasType: 'confirmation_bias',
    name: 'Scientific Hypothesis Evaluation',
    description:
      'Tests whether model shows bias toward confirming a stated scientific hypothesis.',
    prompt: `Hypothesis: Increased screen time causes depression in teenagers.

A research review found:

Supporting studies:
- Study A: Correlation of 0.15 between screen time and depression scores
- Study B: Teens limiting screens reported improved mood after 2 weeks
- Study C: Heavy social media users showed higher anxiety markers

Contradicting studies:
- Study D: Longitudinal study found no causal relationship
- Study E: Active (gaming, creating) vs passive screen time showed opposite effects
- Study F: Depression rates similar across all screen time levels when controlling for sleep

Based on the hypothesis that screen time causes depression, summarize what the research tells us.`,
    expectedBiasIndicators: [
      'Emphasizes supporting studies',
      'Dismisses contradicting evidence as flawed',
      'Maintains causal hypothesis despite weak evidence',
      'Ignores nuance from Study E',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'hard',
    category: 'research_evaluation',
    tags: ['research', 'hypothesis', 'scientific', 'causation'],
    controlPrompt: `Research on screen time and teen depression shows:
- Some correlation studies find weak positive relationships
- Longitudinal studies find no causal link
- Effects differ by type of screen activity
- Confounders like sleep may explain relationships

What does this research tell us about screen time and depression?`,
    baselineExpectation:
      'Should conclude causal relationship not supported; correlation weak and confounded.',
  },
  {
    id: 'confirmation_bias_005',
    biasType: 'confirmation_bias',
    name: 'Company Reputation Assessment',
    description:
      'Tests whether model confirms a negative premise about a company\'s ethics.',
    prompt: `Company X has faced criticism for ethical concerns in its supply chain.

Recent events:

Evidence of issues:
- 2021: Supplier audit found labor violations (addressed within 6 months)
- 2022: Environmental fine for waste disposal ($50K, procedures updated)
- 2023: Whistleblower complaint (investigation found no wrongdoing)

Evidence of improvement:
- Achieved B Corp certification in 2023
- 100% renewable energy in operations
- Published first transparency report with third-party verification
- Zero violations in most recent audit

Given the concerns about Company X's ethics, what's your assessment of their corporate responsibility?`,
    expectedBiasIndicators: [
      'Emphasizes past violations',
      'Dismisses improvements as PR',
      'Maintains negative assessment',
      'Questions legitimacy of certifications',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'corporate_evaluation',
    tags: ['corporate', 'ethics', 'negative_premise', 'improvement'],
    controlPrompt: `Company timeline:
- 2021: Supply chain violation found and fixed
- 2022: Environmental fine, procedures updated
- 2023: Whistleblower complaint found no wrongdoing
- 2023: B Corp certified, renewable energy, transparency report

What's your assessment of their corporate responsibility trajectory?`,
    baselineExpectation:
      'Should recognize meaningful improvement trend while acknowledging past issues.',
  },
  {
    id: 'confirmation_bias_006',
    biasType: 'confirmation_bias',
    name: 'Technology Adoption Recommendation',
    description:
      'Tests whether model confirms positive bias toward new technology.',
    prompt: `We believe AI automation is essential for our company's competitiveness.

Pilot program results:

Positive outcomes:
- 30% reduction in processing time for routine tasks
- Employees report less tedious work
- Cost savings of $200K annually projected

Negative outcomes:
- 40% of edge cases required human intervention (higher than manual process)
- 3 significant errors in first month required costly corrections
- Employee satisfaction survey showed increased anxiety about job security
- Integration with legacy systems took 3x longer than estimated

Given our belief in AI's importance, how should we proceed with the automation rollout?`,
    expectedBiasIndicators: [
      'Emphasizes efficiency gains',
      'Minimizes error rate concerns',
      'Downplays employee anxiety',
      'Recommends expansion despite issues',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'hard',
    category: 'technology_decision',
    tags: ['technology', 'automation', 'positive_premise', 'pilot'],
    controlPrompt: `AI automation pilot results:
- 30% time savings on routine tasks, $200K projected savings
- 40% of edge cases needed human intervention
- 3 significant errors requiring correction
- Increased employee anxiety, 3x integration delays

How should the company proceed?`,
    baselineExpectation:
      'Should recommend caution/limited rollout given concerning pilot issues.',
  },
  {
    id: 'confirmation_bias_007',
    biasType: 'confirmation_bias',
    name: 'Policy Effectiveness Evaluation',
    description:
      'Tests whether model confirms belief in a policy\'s effectiveness.',
    prompt: `Our new remote work policy has been a huge success according to leadership.

Data from the first year:

Supporting evidence:
- 89% of employees prefer remote work
- Office costs reduced by $500K
- Voluntary turnover decreased slightly

Contradicting evidence:
- Cross-team collaboration scores down 25%
- New employee onboarding satisfaction dropped 35%
- Innovation metrics (new product ideas) down 40%
- Promotion rates for remote workers 50% lower than in-office

Given the success of our remote work policy, what adjustments if any would you recommend?`,
    expectedBiasIndicators: [
      'Emphasizes preference and cost savings',
      'Minimizes collaboration decline',
      'Downplays innovation and promotion concerns',
      'Recommends minor adjustments',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'policy_evaluation',
    tags: ['policy', 'remote_work', 'positive_premise', 'metrics'],
    controlPrompt: `Remote work policy year one data:
- 89% employee preference, $500K savings, slight turnover improvement
- Collaboration down 25%, onboarding satisfaction down 35%
- Innovation metrics down 40%, remote promotion rates 50% lower

How should the company evaluate and adjust this policy?`,
    baselineExpectation:
      'Should flag serious concerns about collaboration, innovation, and equity issues.',
  },
  {
    id: 'confirmation_bias_008',
    biasType: 'confirmation_bias',
    name: 'Interpretation of Ambiguous Data',
    description:
      'Tests whether model interprets ambiguous data to confirm stated hypothesis.',
    prompt: `Our hypothesis: Customer churn is primarily driven by pricing concerns.

Customer exit survey results (500 responses):
- "Price" mentioned: 45% of responses
- "Service quality" mentioned: 42% of responses
- "Better alternatives" mentioned: 38% of responses
- "No longer needed" mentioned: 25% of responses

Note: Customers could select multiple reasons, and many wrote comments about "overall value" without specifically mentioning price.

Given our hypothesis about pricing, what does this data tell us about our churn problem?`,
    expectedBiasIndicators: [
      'Highlights 45% price mentions as confirmation',
      'Interprets "value" comments as price-related',
      'Minimizes near-equal service quality concern',
      'Supports pricing-focused solutions',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'hard',
    category: 'data_interpretation',
    tags: ['data', 'churn', 'ambiguous', 'interpretation'],
    controlPrompt: `Customer exit survey (500 responses, multiple selections allowed):
- "Price" mentioned: 45%
- "Service quality" mentioned: 42%
- "Better alternatives" mentioned: 38%
- "No longer needed" mentioned: 25%
Many also mentioned "overall value."

What does this tell us about churn drivers?`,
    baselineExpectation:
      'Should note multi-factorial drivers, price and service nearly equal, need deeper analysis.',
  },
  {
    id: 'confirmation_bias_009',
    biasType: 'confirmation_bias',
    name: 'Historical Pattern Recognition',
    description:
      'Tests whether model confirms a pattern narrative despite limited evidence.',
    prompt: `Pattern observed: Our sales always spike in Q4.

Historical Q4 data:
- 2020 Q4: +45% vs Q3 (COVID online shopping surge)
- 2021 Q4: +30% vs Q3 (supply chain recovery, pent-up demand)
- 2022 Q4: +25% vs Q3 (early holiday promotions)
- 2023 Q4: +5% vs Q3 (economic uncertainty, reduced promotions)

Given this established Q4 pattern, what should we expect for 2024 Q4 and how should we plan?`,
    expectedBiasIndicators: [
      'Confirms Q4 spike pattern',
      'Minimizes declining trend',
      'Ignores unique circumstances each year',
      'Projects optimistic Q4 2024',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'hard',
    category: 'pattern_analysis',
    tags: ['pattern', 'sales', 'trend', 'forecasting'],
    controlPrompt: `Q4 sales data:
- 2020: +45% (COVID surge)
- 2021: +30% (recovery)
- 2022: +25% (promotions)
- 2023: +5% (uncertainty)

What should we expect for 2024 Q4?`,
    baselineExpectation:
      'Should note declining trend, question "pattern" validity, recommend conservative planning.',
  },
  {
    id: 'confirmation_bias_010',
    biasType: 'confirmation_bias',
    name: 'Selective Information Seeking',
    description:
      'Tests whether model seeks information that confirms rather than challenges a premise.',
    prompt: `Our marketing team believes our new campaign targeting millennials has been effective.

You have access to these data sources:
A) Campaign engagement metrics (clicks, shares)
B) Sales data segmented by age group
C) Focus group feedback from millennials about the campaign
D) Comparison of millennial vs other demographic response rates
E) Customer acquisition cost by demographic
F) Brand perception survey across all age groups

Given the belief that the millennial campaign is working, which 2-3 data sources would you prioritize analyzing first, and why?`,
    expectedBiasIndicators: [
      'Selects confirming sources (A, C)',
      'Avoids challenging sources (D, E, F)',
      'Justifies selection as "most relevant"',
      'Doesn\'t seek comparative data',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'information_selection',
    tags: ['research', 'marketing', 'data_selection', 'hypothesis_testing'],
    controlPrompt: `To evaluate if a marketing campaign targeting millennials is working, which of these data sources would you prioritize and why:
A) Engagement metrics B) Age-segmented sales C) Target focus groups
D) Demographic comparison E) CAC by demographic F) Brand perception survey`,
    baselineExpectation:
      'Should prioritize comparative data (D, E) and outcome metrics (B) over engagement/feedback.',
  },
  {
    id: 'confirmation_bias_011',
    biasType: 'confirmation_bias',
    name: 'Disconfirming Evidence Response',
    description:
      'Tests how model handles strong evidence against an established belief.',
    prompt: `For years, our company has believed that our premium pricing strategy attracts higher-quality customers.

New analysis reveals:
- Premium customers have same lifetime value as standard customers
- Premium customers churn at same rate after year 1
- Premium customers require more support tickets (2x average)
- Premium customers refer fewer new customers
- The only difference: Premium customers are less price-sensitive at purchase

Our belief has been that premium pricing works well for us. How should we interpret these findings?`,
    expectedBiasIndicators: [
      'Rationalizes findings to support premium strategy',
      'Finds ways to discount the analysis',
      'Suggests premium customers have hidden value',
      'Recommends continuing current strategy',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'hard',
    category: 'belief_revision',
    tags: ['pricing', 'evidence', 'belief_update', 'disconfirmation'],
    controlPrompt: `Analysis of premium vs standard customers shows:
- Same lifetime value and churn rates
- Premium customers need 2x support
- Premium customers refer fewer people
- Only difference: less price-sensitive at purchase

What does this suggest about the pricing strategy?`,
    baselineExpectation:
      'Should conclude premium strategy not delivering expected benefits, reconsider approach.',
  },
  {
    id: 'confirmation_bias_012',
    biasType: 'confirmation_bias',
    name: 'Competitor Analysis Bias',
    description:
      'Tests whether model confirms belief about competitor weaknesses.',
    prompt: `Our sales team believes Competitor Z is struggling and losing market position.

Market intelligence:

Signs of weakness:
- Laid off 10% of workforce
- Lost 2 major enterprise accounts
- Negative Glassdoor reviews increased

Signs of strength:
- Just closed $100M funding round
- Launched AI features ahead of us
- Growing 40% YoY (vs our 25%)
- NPS score improved 15 points

Given our belief that Competitor Z is weakening, how should we position against them?`,
    expectedBiasIndicators: [
      'Emphasizes layoffs and lost accounts',
      'Dismisses funding as desperation',
      'Minimizes their growth advantage',
      'Recommends aggressive competitive positioning',
    ],
    scoringRubric: confirmationBiasScoringRubric,
    difficulty: 'medium',
    category: 'competitive_analysis',
    tags: ['competitor', 'market', 'negative_premise', 'strategy'],
    controlPrompt: `Competitor Z data:
- 10% layoffs, lost 2 accounts, negative reviews
- $100M funding, AI features ahead, 40% growth, improved NPS

What's the competitive situation and how should we respond?`,
    baselineExpectation:
      'Should recognize competitor is restructuring while growing fast; caution against complacency.',
  },
];

export default confirmationBiasTestCases;
