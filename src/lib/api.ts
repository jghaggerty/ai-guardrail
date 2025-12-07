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

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// API Response Types (matching backend schemas)
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

interface ApiExecutionResponse {
  evaluation_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overall_score: number | null;
  zone_status: ZoneStatus | null;
  findings_count: number;
  message: string;
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
  evaluation_id: string;
  data_points: ApiTrendDataPoint[];
  current_zone: ZoneStatus;
  drift_alert: boolean;
  drift_message: string | null;
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

/**
 * Get the current Supabase session access token.
 * Returns null if no session exists.
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Helper function for making API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get the auth token from Supabase session
  const token = await getAuthToken();

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if token exists
  if (token) {
    (defaultHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();

    // Handle 401 Unauthorized - session may have expired
    if (response.status === 401) {
      throw new ApiError(401, 'Authentication required. Please sign in again.');
    }

    throw new ApiError(response.status, errorBody || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Map backend heuristic type to frontend type
function mapBackendHeuristicType(backendType: string): HeuristicType {
  const typeMap: Record<string, HeuristicType> = {
    anchoring: 'anchoring',
    loss_aversion: 'loss_aversion',
    sunk_cost: 'sunk_cost',
    confirmation_bias: 'confirmation',
    // availability_heuristic is not in frontend types, map to closest
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
    confidence: Math.round(api.confidence_level * 100), // Convert 0-1 to 0-100
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

// API Functions

/**
 * Create a new evaluation
 */
export async function createEvaluation(config: EvaluationConfig): Promise<string> {
  const response = await apiRequest<ApiEvaluationResponse>('/api/evaluations', {
    method: 'POST',
    body: JSON.stringify({
      ai_system_name: config.systemName,
      heuristic_types: config.selectedHeuristics.map(mapFrontendHeuristicType),
      iteration_count: config.iterations,
    }),
  });
  return response.id;
}

/**
 * Execute an evaluation (run the analysis)
 */
export async function executeEvaluation(evaluationId: string): Promise<ApiExecutionResponse> {
  return apiRequest<ApiExecutionResponse>(`/api/evaluations/${evaluationId}/execute`, {
    method: 'POST',
  });
}

/**
 * Get evaluation details
 */
export async function getEvaluation(evaluationId: string): Promise<ApiEvaluationResponse> {
  return apiRequest<ApiEvaluationResponse>(`/api/evaluations/${evaluationId}`);
}

/**
 * Get heuristic findings for an evaluation
 */
export async function getHeuristicFindings(evaluationId: string): Promise<HeuristicFinding[]> {
  const findings = await apiRequest<ApiHeuristicFinding[]>(
    `/api/evaluations/${evaluationId}/heuristics`
  );
  return findings.map(transformHeuristicFinding);
}

/**
 * Get recommendations for an evaluation
 */
export async function getRecommendations(
  evaluationId: string,
  mode: 'technical' | 'simplified' = 'technical'
): Promise<Recommendation[]> {
  const recommendations = await apiRequest<ApiRecommendation[]>(
    `/api/evaluations/${evaluationId}/recommendations?mode=${mode}`
  );
  return recommendations.map(transformRecommendation);
}

/**
 * Get trend data for an evaluation
 */
export async function getTrendData(evaluationId: string): Promise<{
  baselineData: BaselineData[];
  currentZone: ZoneStatus;
  driftAlert: boolean;
  driftMessage: string | null;
}> {
  const response = await apiRequest<ApiTrendResponse>(
    `/api/evaluations/${evaluationId}/trends`
  );
  return {
    baselineData: transformTrendData(response.data_points),
    currentZone: response.current_zone,
    driftAlert: response.drift_alert,
    driftMessage: response.drift_message,
  };
}

/**
 * Run a complete evaluation and return all results
 * This orchestrates creating, executing, and fetching all results
 */
export async function runFullEvaluation(
  config: EvaluationConfig,
  onProgress?: (progress: number, message: string) => void
): Promise<EvaluationRun> {
  // Step 1: Create evaluation
  onProgress?.(10, 'Creating evaluation...');
  const evaluationId = await createEvaluation(config);

  // Step 2: Execute evaluation
  onProgress?.(30, 'Running diagnostic analysis...');
  const executionResult = await executeEvaluation(evaluationId);

  if (executionResult.status === 'failed') {
    throw new Error('Evaluation execution failed');
  }

  // Step 3: Fetch all results in parallel
  onProgress?.(60, 'Fetching results...');
  const [evaluation, findings, recommendations, trendData] = await Promise.all([
    getEvaluation(evaluationId),
    getHeuristicFindings(evaluationId),
    getRecommendations(evaluationId),
    getTrendData(evaluationId),
  ]);

  onProgress?.(100, 'Analysis complete');

  // Transform to EvaluationRun
  return {
    id: evaluation.id,
    config,
    status: evaluation.status === 'completed' ? 'completed' : 'failed',
    progress: 100,
    findings,
    recommendations,
    timestamp: new Date(evaluation.created_at),
    overallScore: evaluation.overall_score || 0,
    baselineComparison: trendData.baselineData,
  };
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await apiRequest<{ status: string }>('/health');
    return true;
  } catch {
    return false;
  }
}
