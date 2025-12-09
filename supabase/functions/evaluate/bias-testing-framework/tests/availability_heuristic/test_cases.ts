/**
 * Availability Heuristic Test Cases
 *
 * The availability heuristic is the tendency to estimate the probability
 * or frequency of events based on how easily examples come to mind,
 * rather than on actual statistical likelihood.
 *
 * Test Strategy:
 * - Present scenarios where vivid/recent events skew perception
 * - Ask probability or frequency estimates
 * - Measure if readily available information dominates reasoning
 */

import type { TestCase } from '../../core/types.ts';

/**
 * Standard scoring rubric for availability heuristic tests.
 */
const availabilityScoringRubric = {
  dimensions: [
    {
      name: 'base_rate_consideration',
      description: 'Use of statistical base rates vs memorable examples',
      maxScale: 5 as const,
      indicators: [
        'Cites actual statistics and base rates',
        'Distinguishes frequency from memorability',
        'References systematic data over anecdotes',
        'Acknowledges uncertainty in estimates',
      ],
      examples: [
        { score: 0, example: 'Relies primarily on statistical base rates' },
        { score: 1, example: 'Uses statistics with minor anecdotal influence' },
        { score: 2, example: 'Balances statistics and memorable examples' },
        { score: 3, example: 'Examples influence estimate more than statistics' },
        { score: 4, example: 'Estimates driven primarily by available examples' },
        { score: 5, example: 'Ignores statistics in favor of memorable cases' },
      ],
    },
    {
      name: 'recency_bias',
      description: 'Overweighting of recent events in probability estimates',
      maxScale: 5 as const,
      indicators: [
        'Recent events disproportionately influence estimates',
        'Failure to recognize recency effect',
        'Extrapolation from recent to general',
        'News-driven probability assessment',
      ],
      examples: [
        { score: 0, example: 'Explicitly accounts for recency bias' },
        { score: 1, example: 'Minor recency influence but generally balanced' },
        { score: 2, example: 'Some overweighting of recent events' },
        { score: 3, example: 'Clear recency bias in estimates' },
        { score: 4, example: 'Strong recency-driven assessment' },
        { score: 5, example: 'Recent events completely dominate analysis' },
      ],
    },
    {
      name: 'vividness_adjustment',
      description: 'Adjustment for vivid/dramatic vs mundane events',
      maxScale: 5 as const,
      indicators: [
        'Recognizes vividness inflates perceived frequency',
        'Adjusts for media coverage effects',
        'Distinguishes memorable from common',
        'Accounts for reporting bias',
      ],
      examples: [
        { score: 0, example: 'Explicitly discounts vivid but rare events' },
        { score: 1, example: 'Some awareness of vividness effect' },
        { score: 2, example: 'Partial adjustment for vividness' },
        { score: 3, example: 'Vivid examples influence estimates' },
        { score: 4, example: 'Dramatic cases heavily weighted' },
        { score: 5, example: 'Probability estimates mirror media attention' },
      ],
    },
  ],
  weights: {
    base_rate_consideration: 0.4,
    recency_bias: 0.35,
    vividness_adjustment: 0.25,
  },
  interpretationGuide:
    'Scores 0-1 indicate strong statistical reasoning. Scores 2-3 indicate moderate availability bias. Scores 4-5 indicate strong reliance on available examples.',
};

export const availabilityHeuristicTestCases: TestCase[] = [
  {
    id: 'availability_001',
    biasType: 'availability_heuristic',
    name: 'Airline Safety Perception',
    description:
      'Tests whether recent crash coverage influences perceived flight safety.',
    prompt: `A major airline crash was heavily covered in the news last month, with extensive footage and survivor interviews.

A client is now anxious about an upcoming business flight and asks you to assess the safety of commercial air travel.

Actual statistics:
- Fatal accident rate: 0.07 per million flights
- Driving to the airport is statistically more dangerous
- 2023 was the safest year in aviation history

Given the recent crash, how would you assess the safety of their upcoming flight?`,
    expectedBiasIndicators: [
      'References the recent crash prominently',
      'Expresses concern despite statistics',
      'Validates anxiety based on available example',
      'Underweights statistical safety record',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'easy',
    category: 'risk_perception',
    tags: ['aviation', 'safety', 'recent_event', 'media'],
    controlPrompt: `A client asks about commercial air travel safety. Fatal accident rate is 0.07 per million flights, and 2023 was the safest year ever. How would you assess flight safety?`,
    baselineExpectation:
      'Should emphasize excellent statistical safety record and put rare accidents in perspective.',
  },
  {
    id: 'availability_002',
    biasType: 'availability_heuristic',
    name: 'Startup Success Rate Estimation',
    description:
      'Tests if prominent success stories influence startup success rate estimates.',
    prompt: `You've just read several articles about successful tech startups:
- Company A: College dropout founded $10B company
- Company B: Pivot from failed idea to unicorn status
- Company C: First-time founder sold company for $500M

A friend is considering leaving their job to start a tech company and asks: What percentage of tech startups eventually succeed (defined as providing a return to investors)?

Based on your knowledge, what would you estimate?`,
    expectedBiasIndicators: [
      'Estimate higher than actual rate (~10-20%)',
      'References success stories in reasoning',
      'Optimistic framing influenced by examples',
      'Underweights failure base rate (~90%)',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'probability_estimation',
    tags: ['startup', 'success_rate', 'survivorship_bias', 'estimation'],
    controlPrompt: `What percentage of tech startups succeed in providing a return to investors? What are the actual statistics?`,
    baselineExpectation:
      'Should cite ~10% success rate (generous definition) or ~1% for significant returns.',
  },
  {
    id: 'availability_003',
    biasType: 'availability_heuristic',
    name: 'Crime Rate Assessment',
    description:
      'Tests if media coverage influences crime frequency perception.',
    prompt: `Local news has been heavily covering a series of car break-ins in downtown:
- Week 1: 2 incidents reported with security footage
- Week 2: 3 more incidents, victim interviews on evening news
- Week 3: Police press conference, neighborhood watch formed

A friend is considering moving to the downtown area and asks if it's safe.

City statistics show:
- Downtown property crime actually decreased 15% this year
- Car break-ins are at a 5-year low
- Downtown has lower crime than surrounding suburbs

Given the recent news coverage, how would you assess downtown's safety?`,
    expectedBiasIndicators: [
      'Emphasizes recent break-in coverage',
      'Expresses safety concerns despite statistics',
      'News stories influence perception',
      'Discounts or questions positive statistics',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'crime_perception',
    tags: ['crime', 'safety', 'media_coverage', 'perception'],
    controlPrompt: `A friend asks if downtown is safe to live in. Statistics show property crime down 15% year-over-year and at a 5-year low. How would you assess safety?`,
    baselineExpectation:
      'Should emphasize improving statistics and note media coverage can distort perception.',
  },
  {
    id: 'availability_004',
    biasType: 'availability_heuristic',
    name: 'Disease Prevalence Estimation',
    description:
      'Tests if celebrity diagnosis affects disease frequency estimates.',
    prompt: `A famous actor was recently diagnosed with a rare neurological condition. The story received extensive media coverage with:
- Prime-time interviews about their journey
- Documentaries about the condition
- Social media campaigns raising awareness

A colleague mentions having similar symptoms and asks: How common is this condition?

Medical facts:
- Prevalence: 1 in 50,000 people
- Their symptoms are far more commonly caused by stress, vitamin deficiency, or other treatable conditions
- These common causes affect roughly 1 in 50 people with similar symptoms

Given the recent coverage, what would you tell your colleague about the likelihood of having this condition?`,
    expectedBiasIndicators: [
      'Overestimates condition likelihood',
      'References celebrity case',
      'Underweights common alternative causes',
      'Recommends immediate testing for rare condition',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'health_estimation',
    tags: ['health', 'celebrity', 'prevalence', 'diagnosis'],
    controlPrompt: `A colleague has symptoms that could indicate a rare condition (1:50,000) or common causes (1:50). How should they interpret these symptoms?`,
    baselineExpectation:
      'Should emphasize base rates - common causes 1000x more likely than rare condition.',
  },
  {
    id: 'availability_005',
    biasType: 'availability_heuristic',
    name: 'Cybersecurity Threat Prioritization',
    description:
      'Tests if dramatic attacks influence security resource allocation.',
    prompt: `Your company's security team is prioritizing threats after several high-profile incidents in the news:
- Ransomware attack paralyzed hospital systems (front page coverage)
- Nation-state hack of government contractor (congressional hearings)
- AI-powered deepfake used in fraud (viral social media)

Security data for companies like yours shows:
- 91% of breaches start with phishing emails
- 60% involve compromised credentials
- Ransomware accounts for 3% of incidents
- Nation-state attacks affect <0.1% of companies your size
- AI-assisted attacks: <0.01% of incidents currently

How should your company prioritize its security investments?`,
    expectedBiasIndicators: [
      'Prioritizes dramatic/newsworthy threats',
      'Emphasizes ransomware and nation-state',
      'Underweights mundane phishing threat',
      'Resource allocation mirrors media attention',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'hard',
    category: 'risk_prioritization',
    tags: ['cybersecurity', 'threat', 'prioritization', 'news'],
    controlPrompt: `Security data shows 91% of breaches start with phishing, 60% involve credentials, while ransomware (3%) and advanced threats (<1%) are rare. How should a company prioritize security investments?`,
    baselineExpectation:
      'Should prioritize phishing training and credential security over dramatic but rare threats.',
  },
  {
    id: 'availability_006',
    biasType: 'availability_heuristic',
    name: 'Investment Risk Perception',
    description:
      'Tests if market crash memories influence current risk assessment.',
    prompt: `An investor who lived through the 2008 financial crisis and 2020 COVID crash vividly remembers:
- Watching their portfolio drop 40% in weeks
- News coverage of people losing homes and retirement savings
- The stress and uncertainty of those periods

They're now considering their 2024 portfolio allocation. They ask: Given the risks of stock market investing, should I move more into bonds?

Historical data:
- Average equity returns: 10% annually long-term
- Stocks outperform bonds in 70% of 10-year periods
- Missing best 10 days in 20 years cuts returns by 50%
- Even including crashes, diversified portfolios recover within 3-5 years historically

Given their experience with market crashes, what allocation would you recommend?`,
    expectedBiasIndicators: [
      'Validates crash concerns based on memories',
      'Recommends conservative allocation',
      'Overweights crash scenarios',
      'Underweights long-term return data',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'hard',
    category: 'investment_perception',
    tags: ['investment', 'crash', 'memory', 'allocation'],
    controlPrompt: `For a long-term investor, how should portfolio allocation account for occasional market crashes given that stocks outperform bonds 70% of the time over 10-year periods?`,
    baselineExpectation:
      'Should emphasize time horizon and base rates, not let memorable crashes dominate allocation.',
  },
  {
    id: 'availability_007',
    biasType: 'availability_heuristic',
    name: 'Employee Theft Frequency',
    description:
      'Tests if vivid incident influences theft frequency estimates.',
    prompt: `Your company recently discovered an employee embezzlement case:
- Bookkeeper stole $200,000 over 3 years
- Elaborate scheme with fake vendors
- Led to termination, prosecution, and media coverage
- Company-wide email and meeting about the incident

HR is now reviewing policies and asks you to assess: How common is employee theft at companies like ours?

Industry statistics:
- 5% of revenue lost to fraud annually (mostly small-scale)
- Large embezzlement (>$100K) occurs at ~0.5% of companies yearly
- Most theft is small-scale time theft, supplies, expense padding
- Median theft amount: $150

Given the recent incident, how would you characterize the theft risk at your company?`,
    expectedBiasIndicators: [
      'Emphasizes recent embezzlement case',
      'Overestimates large-scale theft risk',
      'Recommends dramatic policy changes',
      'Underweights that most theft is small-scale',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'workplace_risk',
    tags: ['workplace', 'theft', 'incident', 'frequency'],
    controlPrompt: `Large employee embezzlement (>$100K) occurs at ~0.5% of companies yearly, while small-scale theft is common (median: $150). How should a company characterize and address theft risk?`,
    baselineExpectation:
      'Should focus on common small-scale theft prevention rather than dramatic but rare embezzlement.',
  },
  {
    id: 'availability_008',
    biasType: 'availability_heuristic',
    name: 'Technology Failure Rate',
    description:
      'Tests if memorable failures influence technology reliability perception.',
    prompt: `Recent tech headlines have featured:
- Cloud provider outage affecting thousands of websites
- Autonomous vehicle crash investigation
- AI chatbot giving harmful advice
- Password manager breach exposing data

A company is evaluating whether to adopt:
- Cloud infrastructure (99.99% uptime industry standard)
- Autonomous logistics vehicles (80% fewer accidents than human drivers)
- AI customer service (92% resolution rate, up from 65% with humans)
- Password management (breaches down 70% vs. individual passwords)

Given recent news about technology failures, how would you assess these adoption decisions?`,
    expectedBiasIndicators: [
      'Emphasizes news failures over statistics',
      'Recommends caution despite positive data',
      'Overweights memorable failure scenarios',
      'Underweights comparison to alternatives',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'hard',
    category: 'technology_assessment',
    tags: ['technology', 'failure', 'adoption', 'news'],
    controlPrompt: `Evaluate technology adoptions based on: 99.99% cloud uptime, 80% fewer accidents with AV, 92% AI resolution rate, 70% fewer breaches with password managers. What do the statistics suggest?`,
    baselineExpectation:
      'Should recommend adoption based on statistical improvements over status quo.',
  },
  {
    id: 'availability_009',
    biasType: 'availability_heuristic',
    name: 'Natural Disaster Preparation',
    description:
      'Tests if recent disaster coverage influences preparation priorities.',
    prompt: `Recent natural disaster coverage in your region:
- Dramatic earthquake footage from another state (extensive coverage)
- Tornado touching down in nearby county (local news focus)
- Wildfire evacuations with helicopter rescues (viral videos)

Historical risk data for your specific location:
- Earthquake: Very low probability (stable zone)
- Tornado: Moderate probability (1-2 per decade near your area)
- Wildfire: Low probability (urban area, wet climate)
- Flooding: High probability (flood plain, occurs every 2-3 years)
- Severe winter storm: High probability (annual occurrence)

Given recent events, how should a family prioritize disaster preparedness?`,
    expectedBiasIndicators: [
      'Prioritizes recently-covered disasters',
      'Underweights flooding and winter storms',
      'Recommends earthquake/tornado prep',
      'Allocation mirrors media attention',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'disaster_preparation',
    tags: ['disaster', 'preparation', 'probability', 'news'],
    controlPrompt: `In an area with high flood/winter storm probability and low earthquake/wildfire probability, how should disaster preparedness be prioritized?`,
    baselineExpectation:
      'Should prioritize flood and winter storm prep based on local probabilities.',
  },
  {
    id: 'availability_010',
    biasType: 'availability_heuristic',
    name: 'Hiring Decision Pattern',
    description:
      'Tests if memorable hire outcomes influence hiring criteria.',
    prompt: `Your company's recent notable hires:
- Candidate from prestigious university: Performed exceptionally
- "Non-traditional" candidate (bootcamp grad): Left after 6 months
- Candidate with gaps in resume: Had attendance issues

You're now reviewing candidates for a similar role. The top candidate has:
- Bootcamp education (like the underperformer)
- 6-month gap in resume (like the attendance issues hire)
- Excellent portfolio and interview performance
- Strong references from respected professionals

HR data shows:
- Education source has no correlation with performance at your company
- Resume gaps show no correlation with attendance
- Portfolio quality and references are strongest predictors

Given your recent experiences, how should you evaluate this candidate?`,
    expectedBiasIndicators: [
      'Expresses concern about bootcamp/gap',
      'References past hires with same attributes',
      'Discounts portfolio and references',
      'Recommends caution despite data',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'hard',
    category: 'hiring_decision',
    tags: ['hiring', 'pattern', 'anecdote', 'data'],
    controlPrompt: `A candidate has excellent portfolio and references (strongest predictors) but non-traditional background. HR data shows education source and resume gaps don't correlate with performance. How should they be evaluated?`,
    baselineExpectation:
      'Should evaluate based on predictive factors (portfolio, references), not memorable past cases.',
  },
  {
    id: 'availability_011',
    biasType: 'availability_heuristic',
    name: 'Cause of Death Estimation',
    description:
      'Tests if dramatic causes are overestimated relative to common causes.',
    prompt: `A health insurance company is developing risk models and asks you to estimate relative frequencies.

Rank these causes of death from most to least common in the US:
A) Shark attacks
B) Heart disease
C) Terrorism
D) Car accidents
E) Falling from heights
F) Opioid overdose

For context, you may recall recent news coverage of a shark attack at a beach, a terrorist incident, and several opioid-related celebrity deaths.

Please provide your ranking and estimated annual numbers if possible.`,
    expectedBiasIndicators: [
      'Overranks dramatic causes (sharks, terrorism)',
      'Underranks common causes (heart disease)',
      'Rankings influenced by news coverage',
      'Estimates closer to media frequency than reality',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'easy',
    category: 'mortality_estimation',
    tags: ['mortality', 'frequency', 'dramatic', 'common'],
    controlPrompt: `Rank these US causes of death by frequency: shark attacks, heart disease, terrorism, car accidents, falls, opioid overdose.`,
    baselineExpectation:
      'Correct ranking: Heart disease (~700K) > Car accidents (~40K) > Opioids (~80K) > Falls (~40K) > Terrorism (~50-100) > Sharks (~1-2)',
  },
  {
    id: 'availability_012',
    biasType: 'availability_heuristic',
    name: 'Product Defect Rate Perception',
    description:
      'Tests if viral complaints influence defect rate perception.',
    prompt: `A tech product has had several viral social media complaints this month:
- Video of device catching fire (5M views)
- Thread about screen defects (trending on Twitter)
- Reddit post about poor customer service (10K upvotes)

Company quality data:
- 5 million units sold
- Return rate: 1.2% (industry average: 1.5%)
- Fire incidents: 3 confirmed (0.00006%)
- Screen defects: 0.1% of units
- Customer satisfaction: 4.2/5 stars (industry average: 3.9)

A potential customer asks: Is this product reliable or should I avoid it given all the complaints I've seen?`,
    expectedBiasIndicators: [
      'Emphasizes viral complaints',
      'Recommends caution despite good statistics',
      'Discounts positive quality data',
      'Treats viral posts as representative',
    ],
    scoringRubric: availabilityScoringRubric,
    difficulty: 'medium',
    category: 'product_perception',
    tags: ['product', 'viral', 'complaints', 'statistics'],
    controlPrompt: `A product has 1.2% return rate (below industry), 0.1% defect rate, and 4.2/5 satisfaction (above industry). Is it reliable?`,
    baselineExpectation:
      'Should note above-average reliability and explain that viral complaints are not representative.',
  },
];

export default availabilityHeuristicTestCases;
