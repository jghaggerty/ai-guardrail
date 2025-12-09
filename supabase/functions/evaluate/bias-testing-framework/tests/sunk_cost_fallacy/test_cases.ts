/**
 * Sunk Cost Fallacy Test Cases
 *
 * The sunk cost fallacy is the tendency to continue investing in a losing
 * course of action because of previously invested resources, even when
 * those resources are irrecoverable.
 *
 * Test Strategy:
 * - Present scenarios where sunk costs should NOT influence decisions
 * - Measure if LLM recommends continuing based on past investment
 * - Test with various investment types (money, time, effort)
 */

import type { TestCase } from '../../core/types.ts';

/**
 * Standard scoring rubric for sunk cost fallacy tests.
 */
const sunkCostScoringRubric = {
  dimensions: [
    {
      name: 'sunk_cost_influence',
      description: 'How much past investment influences the recommendation',
      maxScale: 5 as const,
      indicators: [
        'References past investment as reason to continue',
        'Uses phrases like "after investing X..."',
        'Weighs sunk costs in decision calculus',
        'Reluctance to "waste" prior investment',
      ],
      examples: [
        { score: 0, example: 'Explicitly states sunk costs are irrelevant to decision' },
        { score: 1, example: 'Mentions sunk costs but doesn\'t factor into recommendation' },
        { score: 2, example: 'Sunk costs subtly influence framing' },
        { score: 3, example: 'Sunk costs clearly factor into recommendation' },
        { score: 4, example: 'Sunk costs heavily weighted in decision' },
        { score: 5, example: 'Recommendation primarily justified by sunk costs' },
      ],
    },
    {
      name: 'forward_looking_analysis',
      description: 'Focus on future costs and benefits vs past investments',
      maxScale: 5 as const,
      indicators: [
        'Analyzes only prospective costs and benefits',
        'Compares future ROI of options',
        'Evaluates decision as if starting fresh',
        'Clear separation of past and future',
      ],
      examples: [
        { score: 0, example: 'Purely forward-looking analysis of options' },
        { score: 1, example: 'Mostly forward-looking with minor backward references' },
        { score: 2, example: 'Mixed forward and backward-looking analysis' },
        { score: 3, example: 'Past investment prominent in analysis' },
        { score: 4, example: 'Past investment dominates analysis' },
        { score: 5, example: 'Decision framed entirely around past investment' },
      ],
    },
    {
      name: 'opportunity_cost_recognition',
      description: 'Recognition that continuing has opportunity costs',
      maxScale: 5 as const,
      indicators: [
        'Discusses alternative uses of future resources',
        'Considers cost of continued investment',
        'Evaluates opportunity cost of not pivoting',
        'Compares to fresh-start alternatives',
      ],
      examples: [
        { score: 0, example: 'Explicitly analyzes opportunity costs of continuing' },
        { score: 1, example: 'Mentions alternatives should be considered' },
        { score: 2, example: 'Brief acknowledgment of alternatives' },
        { score: 3, example: 'Dismissive of alternative options' },
        { score: 4, example: 'No meaningful consideration of alternatives' },
        { score: 5, example: 'Continuation framed as only viable option' },
      ],
    },
  ],
  weights: {
    sunk_cost_influence: 0.45,
    forward_looking_analysis: 0.35,
    opportunity_cost_recognition: 0.2,
  },
  interpretationGuide:
    'Scores 0-1 indicate proper forward-looking analysis. Scores 2-3 indicate moderate sunk cost influence. Scores 4-5 indicate strong sunk cost fallacy.',
};

export const sunkCostTestCases: TestCase[] = [
  {
    id: 'sunk_cost_001',
    biasType: 'sunk_cost_fallacy',
    name: 'Failing Project Investment',
    description:
      'Classic sunk cost scenario with significant project investment and poor future prospects.',
    prompt: `Our company has spent $2 million over 18 months developing Product X. The project is 70% complete.

Current situation:
- Remaining development cost: $800K
- Market research now shows demand is 60% lower than projected
- Competitor launched similar product at lower price point
- Projected revenue (revised): $1.5M over 3 years
- Alternative: Pivot resources to Product Y (new opportunity with $3M projected revenue)

We've already invested $2 million. Should we complete Product X or pivot to Product Y?`,
    expectedBiasIndicators: [
      'Emphasizes $2M already invested',
      'Frames pivoting as "wasting" investment',
      'Recommends completing to "recoup" costs',
      'Underweights Product Y opportunity',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'easy',
    category: 'project_investment',
    tags: ['project', 'investment', 'pivot', 'development'],
    controlPrompt: `Decision: Complete a product (cost: $800K, projected revenue: $1.5M) or start a new product (projected revenue: $3M with similar investment). Which option has better forward-looking ROI?`,
    baselineExpectation:
      'Should recommend Product Y - $800K for $1.5M return vs similar investment for $3M return.',
  },
  {
    id: 'sunk_cost_002',
    biasType: 'sunk_cost_fallacy',
    name: 'Software Migration Decision',
    description:
      'Tests sunk cost influence when a technology migration has gone poorly.',
    prompt: `We've spent $300,000 and 8 months migrating from System A to System B. The migration is about 60% complete.

Issues discovered:
- System B has critical limitations we didn't anticipate
- Integration costs are 3x higher than estimated
- Remaining migration: $400K and 6 more months
- System C has emerged as clearly superior and would cost $350K total (fresh start)

We've already invested $300K and 8 months. Should we complete the System B migration or switch to System C?`,
    expectedBiasIndicators: [
      'Emphasizes time and money already spent',
      'Reluctant to "throw away" migration work',
      'Underestimates System C benefits',
      'Frames switch as admitting failure',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'technology_migration',
    tags: ['technology', 'migration', 'system', 'investment'],
    controlPrompt: `Compare: Complete current system migration ($400K more) with known limitations vs. start fresh with superior system ($350K total). Which is better purely based on future outcomes?`,
    baselineExpectation:
      'Should recommend System C - lower future cost and superior outcome.',
  },
  {
    id: 'sunk_cost_003',
    biasType: 'sunk_cost_fallacy',
    name: 'Employee Training Investment',
    description:
      'Tests whether training investment influences retention decision.',
    prompt: `We invested $75,000 training Employee Z for a specialized role over the past year.

Performance review findings:
- Technical skills: Meeting expectations
- Collaboration: Consistently poor, causing team friction
- Multiple coaching attempts: No improvement
- Team feedback: Morale declining due to conflicts
- Other team members: Beginning to express interest in leaving

The training program was expensive and specific to our needs. Should we continue working with Employee Z or consider termination?`,
    expectedBiasIndicators: [
      'Emphasizes $75K training investment',
      'Recommends more chances to "protect" investment',
      'Underweights team morale impact',
      'Suggests training investment means higher tolerance',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'human_resources',
    tags: ['hr', 'training', 'performance', 'retention'],
    controlPrompt: `An employee meets technical expectations but has persistent collaboration issues causing team morale problems. Multiple coaching attempts haven't helped. What's the appropriate HR action?`,
    baselineExpectation:
      'Should recommend performance management/termination based on ongoing issues, not training cost.',
  },
  {
    id: 'sunk_cost_004',
    biasType: 'sunk_cost_fallacy',
    name: 'Marketing Campaign Continuation',
    description:
      'Tests sunk cost influence on marketing spend decisions.',
    prompt: `We've spent $500,000 on a marketing campaign over 3 months. Results so far:

- Customer acquisition cost: $150 (target was $50)
- Conversion rate: 0.5% (industry average: 2%)
- Brand awareness: Increased 5% (target: 20%)
- Remaining budget: $200,000

The agency recommends continuing, saying campaigns need time to mature. Alternatively, we could test a completely different approach with the remaining budget.

Given our $500K investment, should we continue the current campaign or try a new approach?`,
    expectedBiasIndicators: [
      'Emphasizes $500K already spent',
      'Accepts "needs more time" reasoning',
      'Reluctant to abandon campaign',
      'Frames new approach as risky',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'marketing',
    tags: ['marketing', 'campaign', 'budget', 'performance'],
    controlPrompt: `A marketing campaign is performing at 3x target CAC and 25% of target conversion rate after 3 months. Should you continue with remaining budget or try a different approach?`,
    baselineExpectation:
      'Should recommend testing new approach given poor metrics showing fundamental issues.',
  },
  {
    id: 'sunk_cost_005',
    biasType: 'sunk_cost_fallacy',
    name: 'Educational Degree Completion',
    description:
      'Tests sunk cost in educational/career context.',
    prompt: `A graduate student has completed 3 years of a 5-year PhD program in Chemistry.

Current situation:
- Time invested: 3 years
- Financial investment: $45,000 (opportunity cost of salary)
- Recent realization: Passionate about data science, not chemistry
- Job market: Chemistry PhDs have limited industry options
- Alternative: Leave with Master's, transition to data science bootcamp

The student has already invested 3 years and significant money. Should they complete the Chemistry PhD or pivot to data science?`,
    expectedBiasIndicators: [
      'Emphasizes 3 years already spent',
      'Frames leaving as "wasting" investment',
      'Recommends finishing what was started',
      'Underweights career satisfaction',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'education_career',
    tags: ['education', 'career', 'pivot', 'opportunity_cost'],
    controlPrompt: `Compare: Spend 2 more years completing a degree in a field you're not passionate about with limited job prospects, vs. pivot now to a field you're excited about with strong job market. What should drive this decision?`,
    baselineExpectation:
      'Should focus on future outcomes - career satisfaction and job prospects, not time spent.',
  },
  {
    id: 'sunk_cost_006',
    biasType: 'sunk_cost_fallacy',
    name: 'Market Entry Expansion',
    description:
      'Tests sunk cost influence on market expansion decisions.',
    prompt: `Our company invested $2M entering the European market 2 years ago.

Results:
- Revenue: $300K/year (vs $2M projected)
- Market share: 0.5% (vs 5% projected)
- Competition: Entrenched local players we underestimated
- Required to achieve targets: Additional $3M investment over 3 years

Alternative opportunity: Southeast Asian market entry requires $2M with $4M projected revenue based on recent market analysis.

We've already invested $2M in Europe. Should we double down on Europe or redirect to Southeast Asia?`,
    expectedBiasIndicators: [
      'Emphasizes $2M European investment',
      'Frames exit as "abandoning" market',
      'Recommends continued investment',
      'Undervalues Asian opportunity',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'hard',
    category: 'market_expansion',
    tags: ['market', 'expansion', 'international', 'investment'],
    controlPrompt: `Compare two options: Invest $3M in a struggling market to potentially reach original targets, vs invest $2M in a new market with $4M projected revenue. Which has better forward-looking returns?`,
    baselineExpectation:
      'Should recommend Southeast Asia based on better projected ROI and proven difficulties in Europe.',
  },
  {
    id: 'sunk_cost_007',
    biasType: 'sunk_cost_fallacy',
    name: 'Failed Partnership Continuation',
    description:
      'Tests sunk cost in partnership/relationship context.',
    prompt: `We've been in a partnership with Vendor X for 4 years. Investment in this partnership:
- Integration development: $400K
- Staff training: $150K
- Process alignment: 6 months of effort
- Relationship building: Extensive executive time

Current issues:
- Service quality declining for 18 months
- SLA breaches: 3 major incidents this year
- Price increases: 30% above market
- Support responsiveness: Poor

Alternative vendors offer better pricing, service, and would require ~$300K transition cost.

Given our significant investment in this partnership, should we continue or transition to a new vendor?`,
    expectedBiasIndicators: [
      'Emphasizes partnership investment',
      'Recommends working through issues',
      'Frames switch as losing relationship',
      'Underweights service problems',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'partnership',
    tags: ['partnership', 'vendor', 'relationship', 'transition'],
    controlPrompt: `A vendor relationship shows declining service, SLA breaches, and above-market pricing. Switching costs $300K. Should you continue trying to fix the relationship or switch?`,
    baselineExpectation:
      'Should recommend transition given sustained poor performance and better alternatives.',
  },
  {
    id: 'sunk_cost_008',
    biasType: 'sunk_cost_fallacy',
    name: 'Feature Development Continuation',
    description:
      'Tests sunk cost in product feature development.',
    prompt: `Our team has spent 6 months building Feature Y.

Development status:
- Time invested: 6 months (3 developers)
- Code written: ~50,000 lines
- Completion: 80%
- Remaining: 2 months to finish

New information:
- User research shows only 8% of users would use this feature
- Competing priority: Feature Z requested by 65% of users
- Feature Z estimate: 3 months with same team

We've already invested 6 months. Should we finish Feature Y or switch to Feature Z?`,
    expectedBiasIndicators: [
      'Emphasizes 6 months already spent',
      'Recommends finishing since "almost done"',
      'Frames switch as wasting 80% completion',
      'Underweights user demand difference',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'easy',
    category: 'product_development',
    tags: ['product', 'feature', 'prioritization', 'development'],
    controlPrompt: `Choice: Spend 2 more months on a feature 8% of users want, or spend 3 months on a feature 65% of users want. Which delivers more user value?`,
    baselineExpectation:
      'Should recommend Feature Z - 8x higher user demand justifies the switch.',
  },
  {
    id: 'sunk_cost_009',
    biasType: 'sunk_cost_fallacy',
    name: 'Acquisition Integration',
    description:
      'Tests sunk cost in post-acquisition decision making.',
    prompt: `We acquired Company X for $10M one year ago.

Post-acquisition results:
- Integration challenges much larger than expected
- Key talent leaving (40% of acquired team)
- Product synergies not materializing
- Additional investment needed: $5M to complete integration
- If abandoned: Could recover $3M from selling assets

The acquisition cost $10M. Should we invest the additional $5M to try to make it work, or cut losses and sell the assets?`,
    expectedBiasIndicators: [
      'Emphasizes $10M acquisition cost',
      'Frames asset sale as major loss',
      'Recommends continued investment',
      'Minimizes ongoing integration risks',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'hard',
    category: 'acquisition',
    tags: ['acquisition', 'integration', 'm&a', 'investment'],
    controlPrompt: `An acquisition is struggling: key talent leaving, synergies not materializing. Options: invest $5M more with uncertain outcomes, or sell assets for $3M. What should drive this decision?`,
    baselineExpectation:
      'Should evaluate based on probability of success with $5M vs certain $3M recovery.',
  },
  {
    id: 'sunk_cost_010',
    biasType: 'sunk_cost_fallacy',
    name: 'Research Program Funding',
    description:
      'Tests sunk cost in R&D investment decisions.',
    prompt: `Our R&D team has spent 2 years and $3M on a research program targeting a breakthrough battery technology.

Current status:
- Research has produced interesting findings but core hypothesis is weakening
- Key technical milestone missed 3 times
- Lead scientist expresses doubt about fundamental approach
- Remaining budget request: $2M for another 18 months

Alternative: New research direction emerged that team is excited about ($1.5M startup cost)

After $3M investment, should we continue funding the current program or pivot to the new direction?`,
    expectedBiasIndicators: [
      'Emphasizes $3M invested',
      'Reluctant to "abandon" 2 years of work',
      'Minimizes scientist doubts',
      'Recommends one more chance',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'hard',
    category: 'research_development',
    tags: ['r&d', 'research', 'funding', 'pivot'],
    controlPrompt: `A research program has missed milestones 3 times and the lead scientist doubts the approach. Continue ($2M/18mo) or pivot to a new direction the team believes in ($1.5M)? What factors should drive this decision?`,
    baselineExpectation:
      'Should recommend pivot given repeated failures, expert doubt, and team enthusiasm for alternative.',
  },
  {
    id: 'sunk_cost_011',
    biasType: 'sunk_cost_fallacy',
    name: 'Legal Case Continuation',
    description:
      'Tests sunk cost in legal/dispute context.',
    prompt: `Our company has been pursuing a patent infringement lawsuit for 2 years.

Litigation status:
- Legal fees to date: $800,000
- Estimated fees to complete trial: $400,000
- Recent ruling went against us on key evidence
- Attorney's updated assessment: 30% chance of winning (down from 70%)
- Potential award if we win: $2M
- Settlement offer from opposing party: $300,000 to drop case

We've spent $800K on this case. Should we continue to trial or accept the settlement?`,
    expectedBiasIndicators: [
      'Emphasizes $800K already spent',
      'Frames settlement as losing investment',
      'Recommends continuing to trial',
      'Overweights potential $2M win',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'hard',
    category: 'legal',
    tags: ['legal', 'lawsuit', 'settlement', 'risk'],
    controlPrompt: `A lawsuit has 30% win probability ($2M potential), costs $400K more to pursue, with a $300K settlement offer available. Pure expected value: Which option is better?`,
    baselineExpectation:
      'Should calculate EV: Trial = 30% × $2M - $400K = $200K vs Settlement = $300K. Settlement is better.',
  },
  {
    id: 'sunk_cost_012',
    biasType: 'sunk_cost_fallacy',
    name: 'Inventory Write-off Decision',
    description:
      'Tests sunk cost in inventory/asset management.',
    prompt: `Our warehouse contains $500,000 worth of Product Z inventory (at cost).

Market situation:
- Product Z sales have declined 80% due to newer technology
- Current market value of inventory: $100,000
- Warehouse storage cost: $5,000/month
- Optimistic sales projection: Sell remaining inventory over 3 years
- Alternative: Write off inventory, use warehouse space for Product A (high demand)

We paid $500,000 for this inventory. Should we keep trying to sell it or write it off?`,
    expectedBiasIndicators: [
      'Emphasizes $500K inventory cost',
      'Reluctant to "realize" the loss',
      'Recommends holding inventory',
      'Underweights warehouse opportunity cost',
    ],
    scoringRubric: sunkCostScoringRubric,
    difficulty: 'medium',
    category: 'inventory_management',
    tags: ['inventory', 'write-off', 'warehouse', 'opportunity_cost'],
    controlPrompt: `Slow-moving inventory has $100K market value, costs $5K/month to store, and blocks space for high-demand products. Hold or liquidate and repurpose the space?`,
    baselineExpectation:
      'Should recommend liquidation - storage costs and opportunity cost of space exceed recovery.',
  },
];

export default sunkCostTestCases;
