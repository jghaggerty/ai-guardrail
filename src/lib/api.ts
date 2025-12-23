import {
  HeuristicFinding,
  Recommendation,
  BaselineData,
  EvaluationRun,
  EvaluationConfig,
  HeuristicType,
  SeverityLevel,
  ZoneStatus,
  EvidenceStorageType,
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
  evidence_reference_id?: string | null;
  evidence_storage_type?: EvidenceStorageType | null;
  determinism_mode?: string | null;
  seed_value?: number | null;
  iterations_run?: number | null;
  achieved_level?: string | null;
  parameters_used?: Record<string, number | undefined> | null;
  confidence_intervals?: Record<string, unknown> | null;
  per_iteration_results?: Array<Record<string, unknown>> | null;
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

interface ApiReproPackFields {
  repro_pack_id?: string;
  repro_pack_hash?: string;
  signature?: string;
  signing_authority?: string;
  created_at?: string;
  repro_pack_created_at?: string;
}

interface FullEvaluationResponse {
  evaluation: ApiEvaluationResponse;
  findings: ApiHeuristicFinding[];
  recommendations: ApiRecommendation[];
  trends: ApiTrendResponse;
  signature?: string;
  signing_authority?: string;
  repro_pack_created_at?: string;
  repro_pack_id?: string;
  repro_pack_hash?: string;
}

interface ReproPackRecord {
  id: string;
  content_hash?: string | null;
  signature?: string | null;
  signing_authority?: string | null;
  created_at?: string | null;
  repro_pack_content?: Record<string, unknown> | null;
}

export interface ReproPackVerificationResult {
  valid: boolean;
  message?: string;
  customerEvidenceId?: string;
  evidenceUrl?: string;
  signingAuthority?: string;
  hashMatches?: boolean;
  signatureValid?: boolean;
  expectedHash?: string;
  computedHash?: string;
  legacyHash?: string;
  replayInstructions?: Record<string, unknown>;
  verificationSource?: 'stored' | 'uploaded';
}

export interface ReproPackDetails {
  id: string;
  hash?: string;
  contentHash?: string;
  signature?: string;
  signingAuthority?: string;
  createdAt?: string;
  content?: Record<string, unknown>;
}

export interface VerifyReproPackPayload {
  reproPackId?: string;
  packContent?: Record<string, unknown>;
  signature?: string;
  expectedHash?: string;
  signingAuthority?: string;
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

// Map backend heuristic type to frontend type (now 1:1 mapping)
function mapBackendHeuristicType(backendType: string): HeuristicType {
  const validTypes: HeuristicType[] = ['anchoring', 'loss_aversion', 'sunk_cost', 'confirmation_bias', 'availability_heuristic'];
  if (validTypes.includes(backendType as HeuristicType)) {
    return backendType as HeuristicType;
  }
  return 'anchoring'; // fallback for unknown types
}

// Map frontend heuristic type to backend type (now 1:1 mapping)
function mapFrontendHeuristicType(frontendType: HeuristicType): string {
  return frontendType;
}

// Get human-readable name for heuristic type
function getHeuristicName(type: HeuristicType): string {
  const nameMap: Record<HeuristicType, string> = {
    anchoring: 'Anchoring Bias',
    loss_aversion: 'Loss Aversion',
    sunk_cost: 'Sunk Cost Fallacy',
    confirmation_bias: 'Confirmation Bias',
    availability_heuristic: 'Availability Heuristic',
  };
  return nameMap[type];
}

function truncateHash(hash?: string | null, length: number = 12): string | undefined {
  if (!hash) return undefined;
  return hash.slice(0, length);
}

function mapReproPackMetadata(fields: ApiReproPackFields) {
  return {
    reproPackId: fields.repro_pack_id,
    reproPackHash: fields.repro_pack_hash,
    signature: fields.signature,
    signingAuthority: fields.signing_authority,
    reproPackCreatedAt: fields.repro_pack_created_at
      ? new Date(fields.repro_pack_created_at)
      : fields.created_at
        ? new Date(fields.created_at)
        : undefined,
  };
}

function mapReproPackRecord(record?: ReproPackRecord | null) {
  if (!record) return undefined;

  return {
    reproPackId: record.id,
    reproPackHash: truncateHash(record.content_hash),
    signature: record.signature || undefined,
    signingAuthority: record.signing_authority || undefined,
    reproPackCreatedAt: record.created_at ? new Date(record.created_at) : undefined,
  };
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
 *
 * Note: The backend starts the evaluation asynchronously and returns immediately.
 * This helper waits until the evaluation is completed (or failed) and then
 * loads the full results from the database.
 */
export async function runFullEvaluation(
  config: EvaluationConfig,
  onProgress?: (progress: number, message: string) => void
): Promise<EvaluationRun> {
  onProgress?.(10, 'Creating evaluation...');

  const deterministicConfig = {
    enabled: false,
    level: 'adaptive' as const,
    adaptiveIterations: true,
    minIterations: undefined,
    maxIterations: undefined,
    stabilityThreshold: undefined,
    fixedIterations: undefined,
    allowNonDeterministicFallback: true,
    ...(config.deterministic ?? {}),
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // Get the session for auth
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new ApiError(401, 'Authentication required. Please sign in.');
  }

  onProgress?.(30, 'Starting diagnostic analysis...');

  // Call the backend function (starts async evaluation)
  const { data, error } = await supabase.functions.invoke<
    FullEvaluationResponse | { evaluation: ApiEvaluationResponse; message?: string }
  >('evaluate', {
    body: {
      ai_system_name: config.systemName,
      heuristic_types: config.selectedHeuristics.map(mapFrontendHeuristicType),
      iteration_count: config.iterations,
      deterministic: {
        enabled: deterministicConfig.enabled,
        level: deterministicConfig.level,
        adaptive_iterations: deterministicConfig.adaptiveIterations,
        min_iterations: deterministicConfig.minIterations,
        max_iterations: deterministicConfig.maxIterations,
        stability_threshold: deterministicConfig.stabilityThreshold,
        fixed_iterations: deterministicConfig.fixedIterations,
        allow_nondeterministic_fallback: deterministicConfig.allowNonDeterministicFallback ?? true,
      },
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new ApiError(500, error.message || 'Evaluation failed');
  }

  if (!data) {
    throw new ApiError(500, 'No data returned from evaluation');
  }

  // Back-compat: if backend returns the full evaluation payload synchronously
  if ('findings' in data && Array.isArray((data as FullEvaluationResponse).findings)) {
    const full = data as FullEvaluationResponse;

    onProgress?.(80, 'Processing results...');

    const findings = full.findings.map(transformHeuristicFinding);
    const recommendations = full.recommendations.map(transformRecommendation);
    const reproPackMetadata = mapReproPackMetadata({
      repro_pack_id: full.repro_pack_id,
      repro_pack_hash: full.repro_pack_hash,
      signature: full.signature,
      signing_authority: full.signing_authority,
      repro_pack_created_at: full.repro_pack_created_at,
    });

    const baselineData = await fetchHistoricalBaselineData(config.systemName);

    onProgress?.(100, 'Analysis complete');

    return {
      id: full.evaluation.id,
      config: {
        ...config,
        deterministic: deterministicConfig,
      },
      status: full.evaluation.status === 'completed' ? 'completed' : 'failed',
      progress: 100,
      findings,
      recommendations,
      timestamp: new Date(full.evaluation.created_at),
      overallScore: full.evaluation.overall_score || 0,
      baselineComparison: baselineData,
      evidenceReferenceId: full.evaluation.evidence_reference_id || undefined,
      evidenceStorageType: full.evaluation.evidence_storage_type || undefined,
      determinismMode: full.evaluation.determinism_mode || undefined,
      seedValue: full.evaluation.seed_value || undefined,
      iterationsRun: full.evaluation.iterations_run || undefined,
      achievedLevel: full.evaluation.achieved_level || undefined,
      parametersUsed: full.evaluation.parameters_used || undefined,
      confidenceIntervals: full.evaluation.confidence_intervals || undefined,
      perIterationResults: full.evaluation.per_iteration_results || undefined,
      ...reproPackMetadata,
    };
  }

  // Normal path: async start response
  const started = data as { evaluation: ApiEvaluationResponse; message?: string };
  const evaluationId = started?.evaluation?.id;

  if (!evaluationId) {
    console.error('Unexpected evaluation start response:', data);
    throw new ApiError(500, 'Unexpected response when starting evaluation');
  }

  onProgress?.(35, 'Evaluation started. Waiting for completion...');

  const timeoutMs = 10 * 60 * 1000; // 10 minutes
  const pollIntervalMs = 1500;
  const startedAt = Date.now();

  while (true) {
    const { data: statusRow, error: statusError } = await supabase
      .from('evaluations')
      .select('status')
      .eq('id', evaluationId)
      .maybeSingle();

    if (statusError) {
      console.warn('Failed to read evaluation status, retrying:', statusError);
    } else if (!statusRow) {
      throw new ApiError(404, 'Evaluation not found');
    } else if (statusRow.status === 'completed') {
      break;
    } else if (statusRow.status === 'failed') {
      // Try to surface the latest progress message as the failure reason
      const { data: progressRow } = await supabase
        .from('evaluation_progress')
        .select('message')
        .eq('evaluation_id', evaluationId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      throw new ApiError(500, progressRow?.message || 'Evaluation failed');
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new ApiError(
        504,
        'Evaluation is taking longer than expected and is still running. Please keep the page open; results will appear when complete.'
      );
    }

    await sleep(pollIntervalMs);
  }

  onProgress?.(80, 'Loading results...');

  const completedRun = await loadEvaluationDetails(evaluationId);

  onProgress?.(100, 'Analysis complete');

  return {
    ...completedRun,
    config: {
      ...completedRun.config,
      deterministic: deterministicConfig,
    },
  };
}

/**
 * Check if user is authenticated
 */
export async function checkAuth(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Fetch historical baseline data for longitudinal chart
 * Returns actual evaluation scores over time for a given AI system
 */
async function fetchHistoricalBaselineData(aiSystemName: string): Promise<BaselineData[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('created_at, overall_score, zone_status')
    .eq('ai_system_name', aiSystemName)
    .eq('status', 'completed')
    .not('overall_score', 'is', null)
    .order('created_at', { ascending: true })
    .limit(30);

  if (error || !data) {
    console.error('Error fetching baseline data:', error);
    return [];
  }

  return data.map(e => ({
    timestamp: new Date(e.created_at),
    score: 100 - (e.overall_score || 0), // Convert bias score to performance score (lower bias = higher performance)
    zone: (e.zone_status as ZoneStatus) || 'green',
  }));
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
  evidenceReferenceId?: string | null;
  evidenceStorageType?: EvidenceStorageType | null;
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
    evidenceReferenceId: undefined,
    evidenceStorageType: undefined,
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

  // Repro pack metadata is not yet available (table doesn't exist)
  const reproPackMetadata: ApiReproPackFields = {};

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

  // Fetch real historical evaluations for baseline comparison
  const baselineData = await fetchHistoricalBaselineData(evaluation.ai_system_name);

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
    evidenceReferenceId: undefined,
    evidenceStorageType: undefined,
    determinismMode: undefined,
    seedValue: undefined,
    iterationsRun: undefined,
    achievedLevel: undefined,
    parametersUsed: undefined,
    confidenceIntervals: undefined,
    perIterationResults: undefined,
    ...reproPackMetadata,
  };
}

// ============================================================================
// REPRO PACK API (Placeholder - table not yet created)
// ============================================================================

/**
 * Fetch stored repro pack metadata and content for download
 * Note: This is a placeholder until the repro_packs table is created
 */
export async function fetchReproPack(_reproPackId: string): Promise<ReproPackDetails> {
  throw new ApiError(501, 'Repro pack functionality not yet implemented');
}

/**
 * Verify repro pack signature via Edge Function
 * Note: This is a placeholder until the repro_packs table is created
 */
export async function verifyReproPackSignature(
  _params: VerifyReproPackPayload | string
): Promise<ReproPackVerificationResult> {
  throw new ApiError(501, 'Repro pack verification not yet implemented');
}

// ============================================================================
// EVIDENCE COLLECTION CONFIGURATION API (Placeholder - table not yet created)
// ============================================================================

/**
 * Evidence collection configuration type
 */
export interface EvidenceCollectionConfig {
  id: string;
  team_id: string;
  storage_type: 's3' | 'splunk' | 'elk';
  is_enabled: boolean;
  configuration: Record<string, unknown>;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch evidence collection configuration for the current user's team
 * Note: This is a placeholder until the evidence_collection_configs table is created
 */
export async function fetchEvidenceCollectionConfig(): Promise<EvidenceCollectionConfig | null> {
  // Return null - table doesn't exist yet
  return null;
}

/**
 * Save or update evidence collection configuration
 * Note: This is a placeholder until the evidence_collection_configs table is created
 */
export async function saveEvidenceCollectionConfig(
  _config: Partial<EvidenceCollectionConfig> & {
    storage_type: 's3' | 'splunk' | 'elk';
    is_enabled: boolean;
    configuration: Record<string, unknown>;
  }
): Promise<EvidenceCollectionConfig> {
  throw new ApiError(501, 'Evidence collection configuration not yet implemented');
}

/**
 * Test connection to evidence storage system
 * Note: This is a placeholder until the evidence_collection_configs table is created
 */
export async function testEvidenceConnection(_configId: string): Promise<{ success: boolean; message: string }> {
  throw new ApiError(501, 'Evidence collection connection test not yet implemented');
}
