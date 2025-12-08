import {
  HeuristicFinding,
  Recommendation,
  BaselineData,
  EvaluationRun,
  EvaluationConfig,
  HeuristicType,
  SeverityLevel,
  ZoneStatus,
} from '@/types/bias';
import { supabase } from '@/integrations/supabase/client';

// API Response Types (matching edge function response)
interface ApiEvaluationResponse {
  id: string;
  ai_system_name: string;
  heuristic_types: string[];
  iteration_count: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  overall_score: number | null;
  zone_status: ZoneStatus | null;
}

interface ApiHeuristicFinding {
  id: string;
  evaluation_id: string;
  heuristic_type: string;
  severity: SeverityLevel;
  severity_score: number;
  confidence_level: number;
  detection_count: number;
  example_instances: string[];
  pattern_description: string;
  created_at: string;
}

interface ApiRecommendation {
  id: string;
  evaluation_id: string;
  heuristic_type: string;
  priority: number;
  action_title: string;
  technical_description: string;
  simplified_description: string;
  estimated_impact: 'low' | 'medium' | 'high';
  implementation_difficulty: 'easy' | 'moderate' | 'complex';
  created_at: string;
}

interface ApiTrendDataPoint {
  timestamp: string;
  score: number;
  zone: ZoneStatus;
}

interface ApiTrendResponse {
  data_points: ApiTrendDataPoint[];
  current_zone: ZoneStatus;
  drift_alert: boolean;
  drift_message: string | null;
}

interface FullEvaluationResponse {
  evaluation: ApiEvaluationResponse;
  findings: ApiHeuristicFinding[];
  recommendations: ApiRecommendation[];
  trends: ApiTrendResponse;
}

// Error class for API errors
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Map backend heuristic type to frontend type
function mapBackendHeuristicType(backendType: string): HeuristicType {
  const typeMap: Record<string, HeuristicType> = {
    anchoring: 'anchoring',
    loss_aversion: 'loss_aversion',
    sunk_cost: 'sunk_cost',
    confirmation_bias: 'confirmation',
    availability_heuristic: 'anchoring', // Map to closest frontend type
  };
  return typeMap[backendType] || 'anchoring';
}

// Map frontend heuristic type to backend type
function mapFrontendHeuristicType(frontendType: HeuristicType): string {
  const typeMap: Record<HeuristicType, string> = {
    anchoring: 'anchoring',
    loss_aversion: 'loss_aversion',
    sunk_cost: 'sunk_cost',
    confirmation: 'confirmation_bias',
  };
  return typeMap[frontendType];
}

// Get human-readable name for heuristic type
function getHeuristicName(type: HeuristicType): string {
  const nameMap: Record<HeuristicType, string> = {
    anchoring: 'Anchoring Bias',
    loss_aversion: 'Loss Aversion',
    sunk_cost: 'Sunk Cost Fallacy',
    confirmation: 'Confirmation Bias',
  };
  return nameMap[type];
}

// Transform API heuristic finding to frontend type
function transformHeuristicFinding(api: ApiHeuristicFinding): HeuristicFinding {
  const type = mapBackendHeuristicType(api.heuristic_type);
  return {
    id: api.id,
    type,
    name: getHeuristicName(type),
    severity: api.severity,
    confidence: Math.round(api.confidence_level * 100),
    description: api.pattern_description,
    examples: api.example_instances,
    impact: `Detected ${api.detection_count} instances with ${api.severity} severity impact on decision-making processes.`,
    detectedAt: new Date(api.created_at),
  };
}

// Map priority number to priority level
function mapPriorityToLevel(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= 7) return 'high';
  if (priority >= 4) return 'medium';
  return 'low';
}

// Map implementation difficulty
function mapDifficulty(difficulty: string): 'low' | 'medium' | 'high' {
  const difficultyMap: Record<string, 'low' | 'medium' | 'high'> = {
    easy: 'low',
    moderate: 'medium',
    complex: 'high',
  };
  return difficultyMap[difficulty] || 'medium';
}

// Transform API recommendation to frontend type
function transformRecommendation(api: ApiRecommendation): Recommendation {
  return {
    id: api.id,
    priority: mapPriorityToLevel(api.priority),
    title: api.action_title,
    description: api.technical_description,
    action: api.simplified_description,
    estimatedImpact: `${api.estimated_impact} impact improvement expected`,
    implementationComplexity: mapDifficulty(api.implementation_difficulty),
    relatedHeuristic: mapBackendHeuristicType(api.heuristic_type),
  };
}

// Transform API trend data to frontend baseline data
function transformTrendData(dataPoints: ApiTrendDataPoint[]): BaselineData[] {
  return dataPoints.map((point) => ({
    timestamp: new Date(point.timestamp),
    score: point.score,
    zone: point.zone,
  }));
}

/**
 * Run a complete evaluation using the Edge Function
 */
export async function runFullEvaluation(
  config: EvaluationConfig,
  onProgress?: (progress: number, message: string) => void
): Promise<EvaluationRun> {
  onProgress?.(10, 'Creating evaluation...');

  // Get the session for auth
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new ApiError(401, 'Authentication required. Please sign in.');
  }

  onProgress?.(30, 'Running diagnostic analysis...');

  // Call the edge function
  const { data, error } = await supabase.functions.invoke<FullEvaluationResponse>('evaluate', {
    body: {
      ai_system_name: config.systemName,
      heuristic_types: config.selectedHeuristics.map(mapFrontendHeuristicType),
      iteration_count: config.iterations,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new ApiError(500, error.message || 'Evaluation failed');
  }

  if (!data) {
    throw new ApiError(500, 'No data returned from evaluation');
  }

  onProgress?.(80, 'Processing results...');

  // Transform the response
  const findings = data.findings.map(transformHeuristicFinding);
  const recommendations = data.recommendations.map(transformRecommendation);
  const baselineData = transformTrendData(data.trends.data_points);

  onProgress?.(100, 'Analysis complete');

  return {
    id: data.evaluation.id,
    config,
    status: data.evaluation.status === 'completed' ? 'completed' : 'failed',
    progress: 100,
    findings,
    recommendations,
    timestamp: new Date(data.evaluation.created_at),
    overallScore: data.evaluation.overall_score || 0,
    baselineComparison: baselineData,
  };
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

// Historical evaluation summary type
export interface HistoricalEvaluation {
  id: string;
  aiSystemName: string;
  createdAt: string;
  completedAt: string | null;
  overallScore: number | null;
  zoneStatus: string | null;
  status: string;
  heuristicTypes: string[];
  iterationCount: number;
}

/**
 * Fetch historical evaluations for the current user's team
 */
export async function fetchHistoricalEvaluations(): Promise<HistoricalEvaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching evaluations:', error);
    throw new ApiError(500, 'Failed to fetch historical evaluations');
  }

  return (data || []).map(e => ({
    id: e.id,
    aiSystemName: e.ai_system_name,
    createdAt: e.created_at,
    completedAt: e.completed_at,
    overallScore: e.overall_score,
    zoneStatus: e.zone_status,
    status: e.status,
    heuristicTypes: e.heuristic_types as string[],
    iterationCount: e.iteration_count,
  }));
}

/**
 * Load full evaluation details by ID
 */
export async function loadEvaluationDetails(evaluationId: string): Promise<EvaluationRun> {
  // Fetch evaluation
  const { data: evaluation, error: evalError } = await supabase
    .from('evaluations')
    .select('*')
    .eq('id', evaluationId)
    .single();

  if (evalError || !evaluation) {
    throw new ApiError(404, 'Evaluation not found');
  }

  // Fetch findings
  const { data: findings, error: findingsError } = await supabase
    .from('heuristic_findings')
    .select('*')
    .eq('evaluation_id', evaluationId);

  if (findingsError) {
    console.error('Error fetching findings:', findingsError);
  }

  // Fetch recommendations
  const { data: recommendations, error: recsError } = await supabase
    .from('recommendations')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .order('priority', { ascending: false });

  if (recsError) {
    console.error('Error fetching recommendations:', recsError);
  }

  // Transform findings
  const transformedFindings = (findings || []).map(f => {
    const type = mapBackendHeuristicType(f.heuristic_type);
    return {
      id: f.id,
      type,
      name: getHeuristicName(type),
      severity: f.severity as SeverityLevel,
      confidence: Math.round(f.confidence_level * 100),
      description: f.pattern_description,
      examples: f.example_instances as string[],
      impact: `Detected ${f.detection_count} instances with ${f.severity} severity impact on decision-making processes.`,
      detectedAt: new Date(f.created_at),
    };
  });

  // Transform recommendations
  const transformedRecs = (recommendations || []).map(r => ({
    id: r.id,
    priority: mapPriorityToLevel(r.priority),
    title: r.action_title,
    description: r.technical_description,
    action: r.simplified_description,
    estimatedImpact: `${r.estimated_impact} impact improvement expected`,
    implementationComplexity: mapDifficulty(r.implementation_difficulty),
    relatedHeuristic: mapBackendHeuristicType(r.heuristic_type),
  }));

  // Generate baseline comparison data (mock for historical - could be enhanced)
  const baselineData: BaselineData[] = [];

  return {
    id: evaluation.id,
    config: {
      selectedHeuristics: (evaluation.heuristic_types as string[]).map(t => mapBackendHeuristicType(t)),
      iterations: evaluation.iteration_count,
      systemName: evaluation.ai_system_name,
    },
    status: evaluation.status as 'pending' | 'running' | 'completed' | 'failed',
    progress: 100,
    findings: transformedFindings,
    recommendations: transformedRecs,
    timestamp: new Date(evaluation.created_at),
    overallScore: evaluation.overall_score || 0,
    baselineComparison: baselineData,
  };
}
