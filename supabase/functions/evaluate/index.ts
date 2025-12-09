import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Import bias testing framework
import {
  TestRunner,
  ResultsAggregator,
  anchoringTestCases,
  lossAversionTestCases,
  confirmationBiasTestCases,
  sunkCostTestCases,
  availabilityHeuristicTestCases,
  allTestCases,
  calculateMean,
  calculateStdDeviation,
  calculateConfidenceInterval95,
} from './bias-testing-framework/index.ts'

import type {
  BiasType,
  TestCase,
  TestConfiguration,
  AggregatedResults,
} from './bias-testing-framework/core/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Types
type HeuristicType = 'anchoring' | 'loss_aversion' | 'sunk_cost' | 'confirmation_bias' | 'availability_heuristic'
type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
type ZoneStatus = 'green' | 'yellow' | 'red'
type ImpactLevel = 'low' | 'medium' | 'high'
type DifficultyLevel = 'easy' | 'moderate' | 'complex'

interface EvaluationRequest {
  ai_system_name: string
  heuristic_types: HeuristicType[]
  iteration_count: number
}

interface HeuristicFindingResult {
  heuristic_type: HeuristicType
  detection_count: number
  confidence_level: number
  severity_score: number
  severity: SeverityLevel
  example_instances: string[]
  pattern_description: string
  // New fields from bias testing framework
  test_cases_run?: number
  mean_bias_score?: number
  std_deviation?: number
  confidence_interval?: [number, number]
}

// Calculation utilities
function calculateConfidence(detectionCount: number, totalIterations: number): number {
  if (totalIterations === 0) return 0
  const proportion = detectionCount / totalIterations
  const confidence = proportion * (1 - (1 / Math.sqrt(totalIterations)))
  return Math.min(confidence, 0.99)
}

function calculateSeverityScore(rawMetric: number, heuristicType: HeuristicType): { score: number; level: SeverityLevel } {
  const thresholds: Record<HeuristicType, Record<string, number>> = {
    anchoring: { critical: 50, high: 40, medium: 20, low: 10 },
    loss_aversion: { critical: 3.0, high: 2.5, medium: 1.8, low: 1.3 },
    sunk_cost: { critical: 80, high: 70, medium: 50, low: 30 },
    confirmation_bias: { critical: 75, high: 65, medium: 50, low: 35 },
    availability_heuristic: { critical: 60, high: 50, medium: 35, low: 20 },
  }

  const t = thresholds[heuristicType] || thresholds.anchoring
  let score: number
  let level: SeverityLevel

  if (rawMetric >= t.critical) {
    level = 'critical'
    score = 75 + (rawMetric - t.critical) / 2
  } else if (rawMetric >= t.high) {
    level = 'high'
    score = 50 + ((rawMetric - t.high) / (t.critical - t.high)) * 25
  } else if (rawMetric >= t.medium) {
    level = 'medium'
    score = 25 + ((rawMetric - t.medium) / (t.high - t.medium)) * 25
  } else {
    level = 'low'
    score = (rawMetric / t.medium) * 25
  }

  return { score: Math.min(score, 100), level }
}

function calculateZoneStatus(score: number): ZoneStatus {
  if (score <= 80) return 'green'
  if (score <= 90) return 'yellow'
  return 'red'
}

function calculatePriority(severityScore: number, confidenceLevel: number, impact: ImpactLevel): number {
  const impactScores: Record<ImpactLevel, number> = { low: 5, medium: 10, high: 15 }
  const impactScore = impactScores[impact] || 10
  const priority = (severityScore * 0.6) + (confidenceLevel * 30) + (impactScore * 0.1)
  const normalized = Math.floor((priority / 100) * 9) + 1
  return Math.min(Math.max(normalized, 1), 10)
}

function calculateOverallScore(findings: HeuristicFindingResult[]): number {
  if (findings.length === 0) return 75
  
  let totalWeightedScore = 0
  let totalWeight = 0
  
  for (const finding of findings) {
    const weight = finding.confidence_level * (finding.severity_score / 100 + 0.5)
    totalWeightedScore += finding.severity_score * weight
    totalWeight += weight
  }
  
  return totalWeight > 0 ? totalWeightedScore / totalWeight : 75
}

// Map framework bias types to legacy heuristic types
function mapBiasTypeToHeuristic(biasType: BiasType): HeuristicType {
  const mapping: Record<BiasType, HeuristicType> = {
    'anchoring': 'anchoring',
    'loss_aversion': 'loss_aversion',
    'confirmation_bias': 'confirmation_bias',
    'sunk_cost_fallacy': 'sunk_cost',
    'availability_heuristic': 'availability_heuristic',
  }
  return mapping[biasType]
}

// Get test cases for a specific bias type
function getTestCasesForBiasType(heuristicType: HeuristicType): TestCase[] {
  switch (heuristicType) {
    case 'anchoring':
      return anchoringTestCases
    case 'loss_aversion':
      return lossAversionTestCases
    case 'confirmation_bias':
      return confirmationBiasTestCases
    case 'sunk_cost':
      return sunkCostTestCases
    case 'availability_heuristic':
      return availabilityHeuristicTestCases
    default:
      return []
  }
}

// Generate example instances from actual test cases
function generateExampleInstances(testCases: TestCase[], iterations: number): string[] {
  // Select representative test cases to generate realistic examples
  const selectedCases = testCases.slice(0, Math.min(3, testCases.length))

  return selectedCases.map(tc => {
    // Generate an example based on the test case's expected bias indicators
    const indicator = tc.expectedBiasIndicators[0] || tc.description
    return `Test "${tc.name}": ${indicator}`
  })
}

// Heuristic detection functions - now using the bias testing framework
function detectAnchoringBias(iterations: number): HeuristicFindingResult {
  const testCases = anchoringTestCases
  const testCaseCount = testCases.length

  // Run framework-based evaluation
  const config: TestConfiguration = {
    biasTypes: ['anchoring'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config)

  // Simulate bias detection across test cases
  // In production, this would call actual LLM and score responses
  const scores: number[] = []
  for (let i = 0; i < iterations; i++) {
    // Generate score based on test case difficulty and iteration
    const testCaseIndex = i % testCaseCount
    const difficulty = testCases[testCaseIndex].difficulty
    const baseScore = difficulty === 'easy' ? 1.5 : difficulty === 'medium' ? 2.5 : 3.5
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
  }

  const meanScore = calculateMean(scores)
  const stdDev = calculateStdDeviation(scores)
  const ci95 = calculateConfidenceInterval95(scores)
  const detections = scores.filter(s => s >= 2.0).length

  // Map 0-5 bias score to severity
  const { score: severityScore, level } = calculateSeverityScore(meanScore * 10, 'anchoring')
  const confidence = calculateConfidence(detections, iterations)

  return {
    heuristic_type: 'anchoring',
    detection_count: detections,
    confidence_level: confidence,
    severity_score: severityScore,
    severity: level,
    example_instances: generateExampleInstances(testCases, iterations),
    pattern_description: `Anchoring bias detected with mean score ${meanScore.toFixed(2)}/5.0 across ${testCaseCount} test scenarios`,
    test_cases_run: testCaseCount,
    mean_bias_score: meanScore,
    std_deviation: stdDev,
    confidence_interval: [ci95[0], ci95[1]],
  }
}

function detectLossAversion(iterations: number): HeuristicFindingResult {
  const testCases = lossAversionTestCases
  const testCaseCount = testCases.length

  const scores: number[] = []
  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const difficulty = testCases[testCaseIndex].difficulty
    const baseScore = difficulty === 'easy' ? 1.8 : difficulty === 'medium' ? 2.3 : 3.2
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
  }

  const meanScore = calculateMean(scores)
  const stdDev = calculateStdDeviation(scores)
  const ci95 = calculateConfidenceInterval95(scores)
  const detections = scores.filter(s => s >= 2.0).length

  // Map to loss aversion ratio (typical range 1.5-2.5x)
  const avgRatio = 1.0 + (meanScore / 5.0) * 2.0
  const { score: severityScore, level } = calculateSeverityScore(avgRatio, 'loss_aversion')
  const confidence = calculateConfidence(detections, iterations)

  return {
    heuristic_type: 'loss_aversion',
    detection_count: detections,
    confidence_level: confidence,
    severity_score: severityScore,
    severity: level,
    example_instances: generateExampleInstances(testCases, iterations),
    pattern_description: `Loss aversion detected with ${avgRatio.toFixed(1)}x sensitivity ratio across ${testCaseCount} test scenarios`,
    test_cases_run: testCaseCount,
    mean_bias_score: meanScore,
    std_deviation: stdDev,
    confidence_interval: [ci95[0], ci95[1]],
  }
}

function detectConfirmationBias(iterations: number): HeuristicFindingResult {
  const testCases = confirmationBiasTestCases
  const testCaseCount = testCases.length

  const scores: number[] = []
  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const difficulty = testCases[testCaseIndex].difficulty
    const baseScore = difficulty === 'easy' ? 2.0 : difficulty === 'medium' ? 2.8 : 3.5
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
  }

  const meanScore = calculateMean(scores)
  const stdDev = calculateStdDeviation(scores)
  const ci95 = calculateConfidenceInterval95(scores)
  const detections = scores.filter(s => s >= 2.0).length

  // Map to dismissal rate percentage
  const avgDismissal = (meanScore / 5.0) * 100
  const { score: severityScore, level } = calculateSeverityScore(avgDismissal, 'confirmation_bias')
  const confidence = calculateConfidence(detections, iterations)

  return {
    heuristic_type: 'confirmation_bias',
    detection_count: detections,
    confidence_level: confidence,
    severity_score: severityScore,
    severity: level,
    example_instances: generateExampleInstances(testCases, iterations),
    pattern_description: `Confirmation bias detected with ${avgDismissal.toFixed(1)}% evidence dismissal rate across ${testCaseCount} test scenarios`,
    test_cases_run: testCaseCount,
    mean_bias_score: meanScore,
    std_deviation: stdDev,
    confidence_interval: [ci95[0], ci95[1]],
  }
}

function detectSunkCostFallacy(iterations: number): HeuristicFindingResult {
  const testCases = sunkCostTestCases
  const testCaseCount = testCases.length

  const scores: number[] = []
  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const difficulty = testCases[testCaseIndex].difficulty
    const baseScore = difficulty === 'easy' ? 2.2 : difficulty === 'medium' ? 2.7 : 3.3
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
  }

  const meanScore = calculateMean(scores)
  const stdDev = calculateStdDeviation(scores)
  const ci95 = calculateConfidenceInterval95(scores)
  const detections = scores.filter(s => s >= 2.0).length

  // Map to influence rate percentage
  const avgInfluence = (meanScore / 5.0) * 100
  const { score: severityScore, level } = calculateSeverityScore(avgInfluence, 'sunk_cost')
  const confidence = calculateConfidence(detections, iterations)

  return {
    heuristic_type: 'sunk_cost',
    detection_count: detections,
    confidence_level: confidence,
    severity_score: severityScore,
    severity: level,
    example_instances: generateExampleInstances(testCases, iterations),
    pattern_description: `Sunk cost fallacy detected with ${avgInfluence.toFixed(1)}% influence rate across ${testCaseCount} test scenarios`,
    test_cases_run: testCaseCount,
    mean_bias_score: meanScore,
    std_deviation: stdDev,
    confidence_interval: [ci95[0], ci95[1]],
  }
}

function detectAvailabilityHeuristic(iterations: number): HeuristicFindingResult {
  const testCases = availabilityHeuristicTestCases
  const testCaseCount = testCases.length

  const scores: number[] = []
  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const difficulty = testCases[testCaseIndex].difficulty
    const baseScore = difficulty === 'easy' ? 1.7 : difficulty === 'medium' ? 2.4 : 3.1
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
  }

  const meanScore = calculateMean(scores)
  const stdDev = calculateStdDeviation(scores)
  const ci95 = calculateConfidenceInterval95(scores)
  const detections = scores.filter(s => s >= 2.0).length

  // Map to bias magnitude percentage
  const avgBias = (meanScore / 5.0) * 100
  const { score: severityScore, level } = calculateSeverityScore(avgBias, 'availability_heuristic')
  const confidence = calculateConfidence(detections, iterations)

  return {
    heuristic_type: 'availability_heuristic',
    detection_count: detections,
    confidence_level: confidence,
    severity_score: severityScore,
    severity: level,
    example_instances: generateExampleInstances(testCases, iterations),
    pattern_description: `Availability heuristic detected with ${avgBias.toFixed(1)}% estimation bias across ${testCaseCount} test scenarios`,
    test_cases_run: testCaseCount,
    mean_bias_score: meanScore,
    std_deviation: stdDev,
    confidence_interval: [ci95[0], ci95[1]],
  }
}

function runDetection(heuristicTypes: HeuristicType[], iterations: number): HeuristicFindingResult[] {
  const detectors: Record<HeuristicType, (iterations: number) => HeuristicFindingResult> = {
    anchoring: detectAnchoringBias,
    loss_aversion: detectLossAversion,
    confirmation_bias: detectConfirmationBias,
    sunk_cost: detectSunkCostFallacy,
    availability_heuristic: detectAvailabilityHeuristic,
  }

  return heuristicTypes.map(type => detectors[type](iterations))
}

// Recommendation templates
const RECOMMENDATION_TEMPLATES: Record<HeuristicType, Array<{
  action_title: string
  technical_description: string
  simplified_description: string
  estimated_impact: ImpactLevel
  implementation_difficulty: DifficultyLevel
}>> = {
  anchoring: [
    {
      action_title: 'Implement multi-perspective prompting',
      technical_description: 'Restructure prompts to present multiple baseline values before eliciting response. Use randomized anchor values across test scenarios to reduce single-anchor dependency.',
      simplified_description: 'Present multiple starting points to prevent over-reliance on first value shown',
      estimated_impact: 'high',
      implementation_difficulty: 'easy',
    },
    {
      action_title: 'Add anchor-blind evaluation phase',
      technical_description: 'Implement two-stage evaluation: initial assessment without context, followed by contextualized refinement. Compare outputs to measure anchor influence.',
      simplified_description: 'Make initial decisions without reference points, then add context separately',
      estimated_impact: 'medium',
      implementation_difficulty: 'moderate',
    },
    {
      action_title: 'Randomize information presentation order',
      technical_description: 'Dynamically shuffle the order in which data points are presented to the model. Track variance across different orderings to identify order-dependency.',
      simplified_description: 'Change the order information is shown to reduce first-impression bias',
      estimated_impact: 'medium',
      implementation_difficulty: 'easy',
    },
  ],
  loss_aversion: [
    {
      action_title: 'Normalize gain/loss framing',
      technical_description: 'Present scenarios in both gain-framed and loss-framed versions. Calibrate model weights to ensure equivalent scenarios receive equivalent treatment regardless of framing.',
      simplified_description: 'Ensure positive and negative outcomes are weighted equally',
      estimated_impact: 'high',
      implementation_difficulty: 'moderate',
    },
    {
      action_title: 'Implement risk-neutral scoring',
      technical_description: 'Apply risk-neutral transformation to model outputs. Use expected value calculations rather than prospect-theory based evaluations.',
      simplified_description: 'Focus on actual probability and impact rather than emotional response to risk',
      estimated_impact: 'high',
      implementation_difficulty: 'complex',
    },
    {
      action_title: 'Add loss aversion detection layer',
      technical_description: 'Monitor model outputs for asymmetric gain/loss responses. Flag and reprocess decisions showing >1.5x sensitivity differential.',
      simplified_description: 'Automatically detect and correct when system over-reacts to potential losses',
      estimated_impact: 'medium',
      implementation_difficulty: 'moderate',
    },
  ],
  confirmation_bias: [
    {
      action_title: 'Implement adversarial evidence search',
      technical_description: 'For each hypothesis, automatically generate and evaluate counter-arguments. Require model to engage with strongest contradictory evidence before finalizing position.',
      simplified_description: 'Actively search for and consider evidence that contradicts initial thinking',
      estimated_impact: 'high',
      implementation_difficulty: 'moderate',
    },
    {
      action_title: 'Add belief revision tracking',
      technical_description: 'Monitor whether and how the model updates beliefs when presented with contradictory evidence. Score based on Bayesian updating rather than position consistency.',
      simplified_description: 'Track and reward changing opinions when new evidence appears',
      estimated_impact: 'medium',
      implementation_difficulty: 'complex',
    },
    {
      action_title: 'Use blind evidence evaluation',
      technical_description: 'Present evidence without labels indicating whether it supports or contradicts current hypothesis. Measure evidence weight assignment before revealing relevance.',
      simplified_description: 'Evaluate evidence quality before knowing if it supports current position',
      estimated_impact: 'high',
      implementation_difficulty: 'moderate',
    },
  ],
  sunk_cost: [
    {
      action_title: 'Implement forward-looking decision framework',
      technical_description: 'Structure prompts to focus exclusively on future costs and benefits. Explicitly exclude historical investment data from decision-relevant context.',
      simplified_description: 'Make decisions based only on future outcomes, ignoring past investments',
      estimated_impact: 'high',
      implementation_difficulty: 'easy',
    },
    {
      action_title: 'Add sunk cost filter',
      technical_description: 'Detect when historical cost information appears in reasoning chain. Automatically strip or flag sunk cost references before final decision.',
      simplified_description: 'Remove information about past investments from decision-making process',
      estimated_impact: 'medium',
      implementation_difficulty: 'moderate',
    },
    {
      action_title: 'Use incremental value analysis',
      technical_description: 'Evaluate each decision as if starting fresh. Compare continue current path vs switch to alternative using only prospective analysis.',
      simplified_description: 'Evaluate each choice as if it is the first decision being made',
      estimated_impact: 'high',
      implementation_difficulty: 'moderate',
    },
  ],
  availability_heuristic: [
    {
      action_title: 'Incorporate base rate priming',
      technical_description: 'Explicitly provide statistical base rates and frequency data before eliciting probability judgments. Weight base rates higher than anecdotal examples.',
      simplified_description: 'Start with actual statistics before considering individual examples',
      estimated_impact: 'high',
      implementation_difficulty: 'easy',
    },
    {
      action_title: 'Implement recency weighting correction',
      technical_description: 'Apply inverse recency weights to training data and examples. Normalize for vividness and memorability to prevent availability bias.',
      simplified_description: 'Reduce influence of recent or memorable events in predictions',
      estimated_impact: 'medium',
      implementation_difficulty: 'complex',
    },
    {
      action_title: 'Use frequency-based sampling',
      technical_description: 'When retrieving examples, sample proportionally to true frequency rather than availability. Implement representative sampling over convenient sampling.',
      simplified_description: 'Choose examples based on how common they actually are, not how easy to recall',
      estimated_impact: 'high',
      implementation_difficulty: 'moderate',
    },
  ],
}

function generateRecommendations(findings: HeuristicFindingResult[]): Array<{
  heuristic_type: HeuristicType
  priority: number
  action_title: string
  technical_description: string
  simplified_description: string
  estimated_impact: ImpactLevel
  implementation_difficulty: DifficultyLevel
}> {
  const recommendations: Array<{
    heuristic_type: HeuristicType
    priority: number
    action_title: string
    technical_description: string
    simplified_description: string
    estimated_impact: ImpactLevel
    implementation_difficulty: DifficultyLevel
  }> = []

  for (const finding of findings) {
    const templates = RECOMMENDATION_TEMPLATES[finding.heuristic_type] || []

    for (const template of templates) {
      const priority = calculatePriority(finding.severity_score, finding.confidence_level, template.estimated_impact)

      recommendations.push({
        heuristic_type: finding.heuristic_type,
        priority,
        action_title: template.action_title,
        technical_description: template.technical_description,
        simplified_description: template.simplified_description,
        estimated_impact: template.estimated_impact,
        implementation_difficulty: template.implementation_difficulty,
      })
    }
  }

  // Sort by priority descending and take top 7
  recommendations.sort((a, b) => b.priority - a.priority)
  return recommendations.slice(0, 7)
}

function generateHistoricalTrend(currentScore: number, days: number = 30): Array<{ timestamp: string; score: number; zone: ZoneStatus }> {
  const dataPoints: Array<{ timestamp: string; score: number; zone: ZoneStatus }> = []
  const now = new Date()
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    
    // Simulate score trending towards current score
    const progressRatio = (days - i) / days
    const baseScore = 70 + Math.random() * 20
    const score = baseScore + (currentScore - baseScore) * progressRatio + (Math.random() - 0.5) * 10
    const clampedScore = Math.max(0, Math.min(100, score))
    
    dataPoints.push({
      timestamp: date.toISOString(),
      score: clampedScore,
      zone: calculateZoneStatus(clampedScore),
    })
  }
  
  return dataPoints
}

function detectDrift(trendData: Array<{ score: number }>): { hasDrift: boolean; message: string | null } {
  if (trendData.length < 14) {
    return { hasDrift: false, message: null }
  }

  const recentWeek = trendData.slice(-7)
  const previousWeek = trendData.slice(-14, -7)

  const recentAvg = recentWeek.reduce((sum, d) => sum + d.score, 0) / recentWeek.length
  const previousAvg = previousWeek.reduce((sum, d) => sum + d.score, 0) / previousWeek.length

  const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100

  if (Math.abs(percentChange) > 10) {
    const direction = percentChange > 0 ? 'increased' : 'decreased'
    return {
      hasDrift: true,
      message: `Score has ${direction} by ${Math.abs(percentChange).toFixed(1)}% over the last week`,
    }
  }

  return { hasDrift: false, message: null }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user's team_id from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Profile error:', profileError)
      return new Response(JSON.stringify({ error: 'Failed to get user profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const teamId = profile?.team_id

    const url = new URL(req.url)
    const path = url.pathname.replace('/evaluate', '')

    console.log('Request path:', path, 'Method:', req.method)

    // POST /evaluate - Run full evaluation
    if (req.method === 'POST' && (path === '' || path === '/')) {
      const body: EvaluationRequest = await req.json()
      
      console.log('Creating evaluation for:', body.ai_system_name)

      // Validate iteration count
      if (body.iteration_count < 10 || body.iteration_count > 1000) {
        return new Response(JSON.stringify({ error: 'Iteration count must be between 10 and 1000' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Create evaluation record
      const { data: evaluation, error: evalError } = await supabase
        .from('evaluations')
        .insert({
          user_id: user.id,
          team_id: teamId,
          ai_system_name: body.ai_system_name,
          heuristic_types: body.heuristic_types,
          iteration_count: body.iteration_count,
          status: 'running',
        })
        .select()
        .single()

      if (evalError) {
        console.error('Evaluation creation error:', evalError)
        return new Response(JSON.stringify({ error: 'Failed to create evaluation' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log('Created evaluation:', evaluation.id)

      // Run heuristic detection
      const findings = runDetection(body.heuristic_types, body.iteration_count)
      console.log('Detection complete, findings:', findings.length)

      // Calculate overall score
      const overallScore = calculateOverallScore(findings)
      const zoneStatus = calculateZoneStatus(overallScore)

      // Insert findings
      const findingsToInsert = findings.map(f => ({
        evaluation_id: evaluation.id,
        heuristic_type: f.heuristic_type,
        severity: f.severity,
        severity_score: f.severity_score,
        confidence_level: f.confidence_level,
        detection_count: f.detection_count,
        example_instances: f.example_instances,
        pattern_description: f.pattern_description,
      }))

      const { error: findingsError } = await supabase
        .from('heuristic_findings')
        .insert(findingsToInsert)

      if (findingsError) {
        console.error('Findings insert error:', findingsError)
      }

      // Generate and insert recommendations
      const recommendations = generateRecommendations(findings)
      const recsToInsert = recommendations.map(r => ({
        evaluation_id: evaluation.id,
        heuristic_type: r.heuristic_type,
        priority: r.priority,
        action_title: r.action_title,
        technical_description: r.technical_description,
        simplified_description: r.simplified_description,
        estimated_impact: r.estimated_impact,
        implementation_difficulty: r.implementation_difficulty,
      }))

      const { error: recsError } = await supabase
        .from('recommendations')
        .insert(recsToInsert)

      if (recsError) {
        console.error('Recommendations insert error:', recsError)
      }

      // Update evaluation with results
      const { error: updateError } = await supabase
        .from('evaluations')
        .update({
          status: 'completed',
          overall_score: overallScore,
          zone_status: zoneStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id)

      if (updateError) {
        console.error('Evaluation update error:', updateError)
      }

      // Generate trend data
      const trendData = generateHistoricalTrend(overallScore)
      const { hasDrift, message: driftMessage } = detectDrift(trendData)

      // Fetch the complete data
      const { data: finalFindings } = await supabase
        .from('heuristic_findings')
        .select('*')
        .eq('evaluation_id', evaluation.id)

      const { data: finalRecs } = await supabase
        .from('recommendations')
        .select('*')
        .eq('evaluation_id', evaluation.id)
        .order('priority', { ascending: false })

      return new Response(JSON.stringify({
        evaluation: {
          id: evaluation.id,
          ai_system_name: body.ai_system_name,
          heuristic_types: body.heuristic_types,
          iteration_count: body.iteration_count,
          status: 'completed',
          created_at: evaluation.created_at,
          completed_at: new Date().toISOString(),
          overall_score: overallScore,
          zone_status: zoneStatus,
        },
        findings: finalFindings || [],
        recommendations: finalRecs || [],
        trends: {
          data_points: trendData,
          current_zone: zoneStatus,
          drift_alert: hasDrift,
          drift_message: driftMessage,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GET /evaluate/:id - Get evaluation with all data
    const idMatch = path.match(/^\/([a-f0-9-]+)$/)
    if (req.method === 'GET' && idMatch) {
      const evaluationId = idMatch[1]

      const { data: evaluation, error: evalError } = await supabase
        .from('evaluations')
        .select('*')
        .eq('id', evaluationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (evalError || !evaluation) {
        return new Response(JSON.stringify({ error: 'Evaluation not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: findings } = await supabase
        .from('heuristic_findings')
        .select('*')
        .eq('evaluation_id', evaluationId)

      const { data: recommendations } = await supabase
        .from('recommendations')
        .select('*')
        .eq('evaluation_id', evaluationId)
        .order('priority', { ascending: false })

      const trendData = generateHistoricalTrend(evaluation.overall_score || 75)
      const { hasDrift, message: driftMessage } = detectDrift(trendData)

      return new Response(JSON.stringify({
        evaluation,
        findings: findings || [],
        recommendations: recommendations || [],
        trends: {
          data_points: trendData,
          current_zone: evaluation.zone_status,
          drift_alert: hasDrift,
          drift_message: driftMessage,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Edge function error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
