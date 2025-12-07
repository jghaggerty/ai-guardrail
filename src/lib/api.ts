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
