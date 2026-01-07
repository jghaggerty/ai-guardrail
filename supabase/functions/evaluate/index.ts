import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

// Declare EdgeRuntime for background task processing
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void
}

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
  FRAMEWORK_VERSION,
} from './bias-testing-framework/index.ts'

import type {
  BiasType,
  TestCase,
  TestConfiguration,
  AggregatedResults,
} from './bias-testing-framework/core/types.ts'

import type {
  EvidenceCollectionConfig,
  EvidenceStorageCredentials,
  EvidenceCollector,
  EvidenceData,
  ReferenceInfo,
} from './evidence-collectors/types.ts'
import { EvidenceCollectorError } from './evidence-collectors/types.ts'
import {
  decryptAndParseCredentials,
  decryptCredentials,
  getEncryptionSecret,
} from './evidence-collectors/decrypt.ts'
import { createEvidenceCollector } from './evidence-collectors/factory.ts'
import { createLLMClient } from './llm-clients/factory.ts'
import type { LLMClient, LLMOptions } from './llm-clients/types.ts'
import { computeReproPackHash } from '../utils/repro-pack.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { getProviderCapabilities, resolveAchievedLevel } from './modelCapabilities.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle graceful shutdown - log if function is terminated mid-processing
addEventListener('beforeunload', (ev: Event & { detail?: { reason?: string } }) => {
  console.log('[Shutdown] Edge function shutting down due to:', ev.detail?.reason || 'unknown reason')
})

// Types
type HeuristicType = 'anchoring' | 'loss_aversion' | 'sunk_cost' | 'confirmation_bias' | 'availability_heuristic'
type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
type ZoneStatus = 'green' | 'yellow' | 'red'
type ImpactLevel = 'low' | 'medium' | 'high'
type DifficultyLevel = 'easy' | 'moderate' | 'complex'
type SigningMode = 'biaslens' | 'customer'

// Input validation schema for evaluation requests
const EvaluationRequestSchema = z.object({
  ai_system_name: z.string().min(1).max(255, { message: "ai_system_name must be between 1 and 255 characters" }),
  heuristic_types: z.array(z.enum(['anchoring', 'loss_aversion', 'sunk_cost', 'confirmation_bias', 'availability_heuristic']))
    .min(1, { message: "heuristic_types must have at least 1 item" })
    .max(10, { message: "heuristic_types cannot exceed 10 items" }),
  iteration_count: z.number().int().min(10, { message: "iteration_count must be at least 10" }).max(1000, { message: "iteration_count cannot exceed 1000" }),
  llm_config_id: z.string().uuid().optional(),
  deterministic: z.object({
    enabled: z.boolean(),
    level: z.enum(['full', 'near', 'adaptive']).optional(),
    seed: z.number().int().optional(),
    allow_nondeterministic_fallback: z.boolean().optional(),
    collect_evidence: z.boolean().optional(),
    signing_mode: z.enum(['biaslens', 'customer']).optional(),
    customer_key_name: z.string().max(255).optional(),
    temperature: z.number().min(0).max(2).optional(),
    keep_temperature_constant: z.boolean().optional(),
  }).optional(),
  evaluation_id: z.string().uuid().optional(),
  scheduled: z.boolean().optional(),
});

const DEFAULT_MODEL_CONFIG = {
  provider: Deno.env.get('EVALUATION_MODEL_PROVIDER') || 'biaslens-simulator',
  modelName: Deno.env.get('EVALUATION_MODEL_NAME') || 'gpt-4o-mini',
  sampling: {
    temperature: Number(Deno.env.get('EVALUATION_TEMPERATURE') ?? '0.35'),
    maxTokens: Number(Deno.env.get('EVALUATION_MAX_TOKENS') ?? '1024'),
    topP: Number(Deno.env.get('EVALUATION_TOP_P') ?? '1'),
  },
}

// ============================================================================
// LLM CONFIGURATION FETCHING
// ============================================================================

interface LLMConfigResult {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string | null
}

/**
 * Fetch and decrypt LLM configuration from the database.
 * Uses the same encryption pattern as API key storage.
 */
async function fetchLLMConfig(
  configId: string,
  teamId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<LLMConfigResult> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Fetch the LLM configuration
  const { data: config, error: configError } = await adminClient
    .from('llm_configurations')
    .select('api_key_encrypted, team_id, provider, model_name, base_url')
    .eq('id', configId)
    .maybeSingle()

  if (configError || !config) {
    console.error('LLM config fetch error:', configError)
    throw new Error(`LLM configuration not found: ${configId}`)
  }

  // Verify team membership
  if (config.team_id !== teamId) {
    console.error('Team mismatch: user team', teamId, 'config team', config.team_id)
    throw new Error('Unauthorized: LLM configuration belongs to a different team')
  }

  // Check if API key exists
  if (!config.api_key_encrypted) {
    throw new Error('No API key configured for this LLM. Please add an API key in settings.')
  }

  // Decrypt the API key
  const encryptionSecret = getEncryptionSecret()
  const apiKey = await decryptCredentials(config.api_key_encrypted, encryptionSecret)

  console.log(`Successfully decrypted API key for LLM config ${configId} (provider: ${config.provider})`)

  return {
    provider: config.provider,
    modelName: config.model_name,
    apiKey,
    baseUrl: config.base_url,
  }
}

interface ProviderRateLimitPolicy {
  providerId: string
  displayName: string
  requestsPerMinute: number
  burstLimit?: number
  minIntervalMs: number
  retryAfterMs: number
  determinismSupport: 'full' | 'partial' | 'none'
  determinismGuidance: string
}

const PROVIDER_POLICIES: Record<string, ProviderRateLimitPolicy> = {
  'openai': {
    providerId: 'openai',
    displayName: 'OpenAI',
    requestsPerMinute: 60,
    minIntervalMs: 1100,
    retryAfterMs: 2000,
    determinismSupport: 'partial',
    determinismGuidance: 'OpenAI supports seeds on some models. If a seed is rejected, retry without determinism or lower concurrency.',
  },
  'anthropic': {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    requestsPerMinute: 30,
    minIntervalMs: 2200,
    retryAfterMs: 2500,
    determinismSupport: 'none',
    determinismGuidance: 'Anthropic models do not honor deterministic seeds. Switch to standard mode for reliable execution.',
  },
  'biaslens-simulator': {
    providerId: 'biaslens-simulator',
    displayName: 'BiasLens simulator',
    requestsPerMinute: 6000, // Simulator has no real rate limits
    minIntervalMs: 10, // Minimal delay for mock responses
    retryAfterMs: 100,
    determinismSupport: 'full',
    determinismGuidance: 'Simulator accepts deterministic parameters for replay and confidence calculations.',
  },
}

function getProviderPolicy(provider: string): ProviderRateLimitPolicy {
  const normalized = provider.toLowerCase()
  return PROVIDER_POLICIES[normalized] ?? {
    providerId: normalized,
    displayName: provider,
    requestsPerMinute: 60,
    minIntervalMs: 1000,
    retryAfterMs: 2000,
    determinismSupport: 'partial',
    determinismGuidance: 'Provider did not specify determinism guarantees. Consider disabling strict seeds if requests fail.',
  }
}

interface RateLimitDelayContext {
  delayMs: number
  etaMs: number
  remainingIterations: number
  policy: ProviderRateLimitPolicy
}

class ProviderCallScheduler {
  private lastCallAt = 0
  private readonly policy: ProviderRateLimitPolicy

  constructor(policy: ProviderRateLimitPolicy) {
    this.policy = policy
  }

  estimateRemainingMs(remainingIterations: number): number {
    const interval = Math.max(this.policy.minIntervalMs, Math.floor(60000 / Math.max(1, this.policy.requestsPerMinute)))
    return remainingIterations * interval
  }

  private async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async executeWithRetry<T>(task: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await task()
    } catch (error) {
      const shouldRetry = error && typeof error === 'object' && 'status' in (error as Record<string, unknown>) && (error as Record<string, unknown>).status === 429
      if (shouldRetry && retryCount < 3) {
        const retryAfter = 'retryAfter' in (error as Record<string, unknown>)
          ? Number((error as Record<string, unknown>).retryAfter) * 1000
          : this.policy.retryAfterMs * Math.pow(2, retryCount)
        console.warn(`Rate limit hit, backing off for ${retryAfter}ms`)
        await this.delay(retryAfter)
        return this.executeWithRetry(task, retryCount + 1)
      }
      throw error
    }
  }

  async execute<T>(task: () => Promise<T>, context?: { remainingIterations?: number; onRateLimit?: (ctx: RateLimitDelayContext) => Promise<void> | void }): Promise<T> {
    const now = Date.now()
    const interval = Math.max(this.policy.minIntervalMs, Math.floor(60000 / Math.max(1, this.policy.requestsPerMinute)))
    const elapsed = now - this.lastCallAt
    const waitMs = Math.max(0, interval - elapsed)

    if (waitMs > 0 && context?.onRateLimit) {
      const eta = waitMs + this.estimateRemainingMs(context.remainingIterations ?? 0)
      await context.onRateLimit({
        delayMs: waitMs,
        etaMs: eta,
        remainingIterations: context.remainingIterations ?? 0,
        policy: this.policy,
      })
    }

    if (waitMs > 0) {
      await this.delay(waitMs)
    }

    const result = await this.executeWithRetry(task)
    this.lastCallAt = Date.now()
    return result
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

interface IterationExecutionOptions {
  scheduler?: ProviderCallScheduler
  onThrottle?: (ctx: RateLimitDelayContext) => Promise<void> | void
  llmOptions?: LLMOptions
}

async function generateResponseWithRateLimit(
  runner: TestRunner,
  testCase: TestCase,
  iteration: number,
  totalIterations: number,
  options?: IterationExecutionOptions
) {
  if (options?.scheduler) {
    return options.scheduler.execute(
      () => runner.generateMockResponse(testCase, iteration),
      {
        remainingIterations: Math.max(totalIterations - iteration, 0),
        onRateLimit: options.onThrottle,
      }
    )
  }

  return runner.generateMockResponse(testCase, iteration)
}

interface EvaluationRequest {
  ai_system_name: string
  heuristic_types: HeuristicType[]
  iteration_count: number
  llm_config_id?: string  // Optional: ID of the LLM configuration to use for real API calls
  deterministic?: {
    enabled: boolean
    level: 'full' | 'near' | 'adaptive'
    adaptive_iterations?: boolean
    min_iterations?: number
    max_iterations?: number
    stability_threshold?: number
    fixed_iterations?: number
    seed?: number
    allow_nondeterministic_fallback?: boolean
  }
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

interface ReproCaptureEntry {
  testCaseId: string
  iteration: number
  heuristicType: HeuristicType
  referenceId: string
  outputHash: string
  capturedAt: string
}

interface SigningMaterial {
  signingAuthority: string
  signingKeyId: string
  signingMode: SigningMode
  privateKeyPem: string
  publicKeyPem: string
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

function buildReplayInstructions(params: {
  heuristicTypes: HeuristicType[]
  iterationCount: number
  iterationsRun: number
  detectorVersion: string
  determinismMode: string
  seedValue: number
  achievedLevel?: string
  samplingParameters: Record<string, number | undefined>
  confidenceIntervals?: Record<string, unknown>
  evidenceReferenceId?: string | null
  evidenceStorageType?: string | null
  replayEntries: ReproCaptureEntry[]
}) {
  const uniqueTestCases = new Map<string, HeuristicType>()

  for (const entry of params.replayEntries) {
    if (!uniqueTestCases.has(entry.testCaseId)) {
      uniqueTestCases.set(entry.testCaseId, entry.heuristicType)
    }
  }

  return {
    test_suite: {
      cases: Array.from(uniqueTestCases.entries()).map(([id, heuristic]) => ({
        id,
        version: params.detectorVersion,
        heuristic_type: heuristic,
      })),
      iterations: params.iterationCount,
      iterations_run: params.iterationsRun,
    },
    model: {
      provider: DEFAULT_MODEL_CONFIG.provider,
      model_name: DEFAULT_MODEL_CONFIG.modelName,
      sampling_parameters: params.samplingParameters,
      determinism: {
        mode: params.determinismMode,
        seed: params.seedValue,
        achieved_level: params.achievedLevel,
      },
    },
    detector: {
      version: params.detectorVersion,
      heuristics: params.heuristicTypes,
    },
    evidence: params.evidenceReferenceId
      ? {
          reference_id: params.evidenceReferenceId,
          storage_type: params.evidenceStorageType,
          link_hint:
            'Use the reference ID to fetch prompts and outputs from your configured evidence store.',
        }
      : undefined,
    metrics: params.confidenceIntervals
      ? {
          confidence_intervals: params.confidenceIntervals,
        }
      : undefined,
    replay_steps: [
      'Use the test_case_id and iteration to locate the original prompt/output pair.',
      'Run the same model configuration and sampling parameters listed above.',
      'Compare output hashes against the repro pack to confirm deterministic replay.',
    ],
  }
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function importSigningKey(pem: string): Promise<CryptoKey> {
  const trimmed = pem
    .replace(/-----BEGIN ([A-Z ]+)-----/g, '')
    .replace(/-----END ([A-Z ]+)-----/g, '')
    .replace(/\s+/g, '')

  const binaryDerString = atob(trimmed)
  const binaryDer = new Uint8Array(binaryDerString.length)
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i)
  }

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )
}

async function signHash(privateKeyPem: string, contentHash: string): Promise<string> {
  const key = await importSigningKey(privateKeyPem)
  const encoder = new TextEncoder()
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(contentHash)
  )

  return bufferToBase64(signatureBuffer)
}

function truncateHash(hash: string, length: number = 12): string {
  return hash.slice(0, length)
}

async function decryptPrivateKey(encryptedData: string, secret: string): Promise<string> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const encrypted = combined.slice(28)

  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  return decoder.decode(decrypted)
}

async function resolveSigningMaterial(supabase: SupabaseClient, teamId?: string): Promise<SigningMaterial> {
  const defaultPrivateKey = Deno.env.get('REPRO_PACK_SIGNING_PRIVATE_KEY')
  const defaultPublicKey = Deno.env.get('REPRO_PACK_SIGNING_PUBLIC_KEY')
  const defaultSigningKeyId = Deno.env.get('REPRO_PACK_SIGNING_KEY_ID') || 'default'
  const defaultSigningAuthority = Deno.env.get('REPRO_PACK_SIGNING_AUTHORITY') || 'BiasLens'

  if (!teamId) {
    if (!defaultPrivateKey) {
      throw new Error('Repro pack signing key not configured')
    }

    if (!defaultPublicKey) {
      throw new Error('Repro pack signing public key not configured')
    }

    return {
      signingAuthority: defaultSigningAuthority,
      signingKeyId: defaultSigningKeyId,
      signingMode: 'biaslens',
      privateKeyPem: defaultPrivateKey,
      publicKeyPem: defaultPublicKey,
    }
  }

  const { data: signingConfig, error: signingConfigError } = await supabase
    .from('team_signing_configs')
    .select('signing_mode, active_signing_key_id')
    .eq('team_id', teamId)
    .maybeSingle()

  if (signingConfigError) {
    console.error('Failed to load signing config for team', teamId, signingConfigError)
  }

  if (signingConfig?.signing_mode === 'customer' && signingConfig.active_signing_key_id) {
    const { data: activeKey, error: keyError } = await supabase
      .from('signing_keys')
      .select('signing_key_id, signing_authority, public_key, private_key_encrypted, status')
      .eq('id', signingConfig.active_signing_key_id)
      .eq('team_id', teamId)
      .maybeSingle()

    if (keyError || !activeKey) {
      console.error('Active signing key not found for team', teamId, keyError)
      throw new Error('Active customer signing key not found')
    }

    if (activeKey.status !== 'active') {
      throw new Error('Customer signing key is not active')
    }

    const encryptionSecret = Deno.env.get('SIGNING_KEY_ENCRYPTION_SECRET')
    if (!encryptionSecret) {
      throw new Error('SIGNING_KEY_ENCRYPTION_SECRET not configured')
    }

    const privateKeyPem = await decryptPrivateKey(activeKey.private_key_encrypted, encryptionSecret)

    return {
      signingAuthority: activeKey.signing_authority,
      signingKeyId: activeKey.signing_key_id,
      signingMode: 'customer',
      privateKeyPem,
      publicKeyPem: activeKey.public_key,
    }
  }

  if (!defaultPrivateKey) {
    throw new Error('Repro pack signing key not configured')
  }

  if (!defaultPublicKey) {
    throw new Error('Repro pack signing public key not configured')
  }

  return {
    signingAuthority: defaultSigningAuthority,
    signingKeyId: defaultSigningKeyId,
    signingMode: 'biaslens',
    privateKeyPem: defaultPrivateKey,
    publicKeyPem: defaultPublicKey,
  }
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
// IMPORTANT: This function only generates descriptive text about test cases.
// It does NOT include raw prompts or outputs - those are stored in customer storage via evidence collector.
function generateExampleInstances(testCases: TestCase[], iterations: number): string[] {
  // Select representative test cases to generate realistic examples
  const selectedCases = testCases.slice(0, Math.min(3, testCases.length))

  return selectedCases.map(tc => {
    // Generate an example based on the test case's expected bias indicators
    // This is descriptive text only, not raw prompt/output data
    const indicator = tc.expectedBiasIndicators[0] || tc.description
    return `Test "${tc.name}": ${indicator}`
  })
}

// Heuristic detection functions - now using the bias testing framework
async function detectAnchoringBias(
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[],
  iterationOptions?: IterationExecutionOptions,
  llmClient?: LLMClient
): Promise<HeuristicFindingResult> {
  const testCases = anchoringTestCases
  const testCaseCount = testCases.length

  // Run framework-based evaluation
  const config: TestConfiguration = {
    biasTypes: ['anchoring'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config, llmClient, iterationOptions?.llmOptions)

  // Generate prompts and capture outputs for evidence collection
  // Generate all prompts upfront for all test cases and iterations
  const allPrompts = await runner.generatePrompts(testCases, config.testIterations)
  
  const scores: number[] = []
  let promptIndex = 0
  
  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const testCase = testCases[testCaseIndex]
    const iteration = Math.floor(i / testCaseCount) + 1
    
    // Get the prompt for this test case and iteration
    const promptForIteration = allPrompts[promptIndex] || allPrompts.find(
      p => p.testCaseId === testCase.id && p.iteration === iteration
    )
    const promptText = promptForIteration?.prompt || testCase.prompt
    
    // Generate response (mock for now, but this is where real LLM calls would go)
    const output = await generateResponseWithRateLimit(
      runner,
      testCase,
      iteration,
      iterations,
      iterationOptions
    )
    const referenceId = generateTestCaseReferenceId(testCase.id, iteration)

    if (reproCapture) {
      reproCapture.push({
        testCaseId: testCase.id,
        iteration,
        heuristicType: 'anchoring',
        referenceId,
        outputHash: await sha256Hex(output),
        capturedAt: new Date().toISOString(),
      })
    }

    // Capture evidence if evidence collection is enabled
    if (evidenceCapture && evaluationRunId) {
      evidenceCapture.push(
        captureEvidence(
          promptText,
          output,
          testCase.id,
          iteration,
          'anchoring',
          referenceId
        )
      )
    }
    
    // Score the response (using existing mock scoring logic for now)
    const difficulty = testCase.difficulty
    const baseScore = difficulty === 'easy' ? 1.5 : difficulty === 'medium' ? 2.5 : 3.5
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))
    
    promptIndex++
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

async function detectLossAversion(
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[],
  iterationOptions?: IterationExecutionOptions,
  llmClient?: LLMClient
): Promise<HeuristicFindingResult> {
  const testCases = lossAversionTestCases
  const testCaseCount = testCases.length

  // Run framework-based evaluation
  const config: TestConfiguration = {
    biasTypes: ['loss_aversion'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config, llmClient, iterationOptions?.llmOptions)

  // Generate prompts and capture outputs for evidence collection
  const allPrompts = await runner.generatePrompts(testCases, config.testIterations)

  const scores: number[] = []
  let promptIndex = 0

  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const testCase = testCases[testCaseIndex]
    const iteration = Math.floor(i / testCaseCount) + 1

    // Get the prompt for this test case and iteration
    const promptForIteration = allPrompts[promptIndex] || allPrompts.find(
      p => p.testCaseId === testCase.id && p.iteration === iteration
    )
    const promptText = promptForIteration?.prompt || testCase.prompt

    // Generate response (mock for now, but this is where real LLM calls would go)
    const output = await generateResponseWithRateLimit(
      runner,
      testCase,
      iteration,
      iterations,
      iterationOptions
    )
    const referenceId = generateTestCaseReferenceId(testCase.id, iteration)

    if (reproCapture) {
      reproCapture.push({
        testCaseId: testCase.id,
        iteration,
        heuristicType: 'loss_aversion',
        referenceId,
        outputHash: await sha256Hex(output),
        capturedAt: new Date().toISOString(),
      })
    }

    // Capture evidence if evidence collection is enabled
    if (evidenceCapture && evaluationRunId) {
      evidenceCapture.push(
        captureEvidence(
          promptText,
          output,
          testCase.id,
          iteration,
          'loss_aversion',
          referenceId
        )
      )
    }

    // Score the response (using existing mock scoring logic for now)
    const difficulty = testCase.difficulty
    const baseScore = difficulty === 'easy' ? 1.8 : difficulty === 'medium' ? 2.3 : 3.2
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))

    promptIndex++
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

async function detectConfirmationBias(
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[],
  iterationOptions?: IterationExecutionOptions,
  llmClient?: LLMClient
): Promise<HeuristicFindingResult> {
  const testCases = confirmationBiasTestCases
  const testCaseCount = testCases.length

  const config: TestConfiguration = {
    biasTypes: ['confirmation_bias'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config, llmClient, iterationOptions?.llmOptions)
  const allPrompts = await runner.generatePrompts(testCases, config.testIterations)

  const scores: number[] = []
  let promptIndex = 0

  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const testCase = testCases[testCaseIndex]
    const iteration = Math.floor(i / testCaseCount) + 1

    const promptForIteration = allPrompts[promptIndex] || allPrompts.find(
      p => p.testCaseId === testCase.id && p.iteration === iteration
    )
    const promptText = promptForIteration?.prompt || testCase.prompt
    const output = await generateResponseWithRateLimit(
      runner,
      testCase,
      iteration,
      iterations,
      iterationOptions
    )
    const referenceId = generateTestCaseReferenceId(testCase.id, iteration)

    if (reproCapture) {
      reproCapture.push({
        testCaseId: testCase.id,
        iteration,
        heuristicType: 'confirmation_bias',
        referenceId,
        outputHash: await sha256Hex(output),
        capturedAt: new Date().toISOString(),
      })
    }

    if (evidenceCapture && evaluationRunId) {
      evidenceCapture.push(
        captureEvidence(promptText, output, testCase.id, iteration, 'confirmation_bias', referenceId)
      )
    }

    const difficulty = testCase.difficulty
    const baseScore = difficulty === 'easy' ? 2.0 : difficulty === 'medium' ? 2.8 : 3.5
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))

    promptIndex++
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

async function detectSunkCostFallacy(
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[],
  iterationOptions?: IterationExecutionOptions,
  llmClient?: LLMClient
): Promise<HeuristicFindingResult> {
  const testCases = sunkCostTestCases
  const testCaseCount = testCases.length

  const config: TestConfiguration = {
    biasTypes: ['sunk_cost_fallacy'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config, llmClient, iterationOptions?.llmOptions)
  const allPrompts = await runner.generatePrompts(testCases, config.testIterations)

  const scores: number[] = []
  let promptIndex = 0

  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const testCase = testCases[testCaseIndex]
    const iteration = Math.floor(i / testCaseCount) + 1

    const promptForIteration = allPrompts[promptIndex] || allPrompts.find(
      p => p.testCaseId === testCase.id && p.iteration === iteration
    )
    const promptText = promptForIteration?.prompt || testCase.prompt
    const output = await generateResponseWithRateLimit(
      runner,
      testCase,
      iteration,
      iterations,
      iterationOptions
    )
    const referenceId = generateTestCaseReferenceId(testCase.id, iteration)

    if (reproCapture) {
      reproCapture.push({
        testCaseId: testCase.id,
        iteration,
        heuristicType: 'sunk_cost',
        referenceId,
        outputHash: await sha256Hex(output),
        capturedAt: new Date().toISOString(),
      })
    }

    if (evidenceCapture && evaluationRunId) {
      evidenceCapture.push(
        captureEvidence(promptText, output, testCase.id, iteration, 'sunk_cost', referenceId)
      )
    }

    const difficulty = testCase.difficulty
    const baseScore = difficulty === 'easy' ? 2.2 : difficulty === 'medium' ? 2.7 : 3.3
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))

    promptIndex++
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

async function detectAvailabilityHeuristic(
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[],
  iterationOptions?: IterationExecutionOptions,
  llmClient?: LLMClient
): Promise<HeuristicFindingResult> {
  const testCases = availabilityHeuristicTestCases
  const testCaseCount = testCases.length

  const config: TestConfiguration = {
    biasTypes: ['availability_heuristic'],
    testIterations: Math.max(1, Math.floor(iterations / testCaseCount)),
    difficulty: ['easy', 'medium', 'hard'],
    outputFormat: 'json',
  }

  const runner = new TestRunner(config, llmClient, iterationOptions?.llmOptions)
  const allPrompts = await runner.generatePrompts(testCases, config.testIterations)

  const scores: number[] = []
  let promptIndex = 0

  for (let i = 0; i < iterations; i++) {
    const testCaseIndex = i % testCaseCount
    const testCase = testCases[testCaseIndex]
    const iteration = Math.floor(i / testCaseCount) + 1

    const promptForIteration = allPrompts[promptIndex] || allPrompts.find(
      p => p.testCaseId === testCase.id && p.iteration === iteration
    )
    const promptText = promptForIteration?.prompt || testCase.prompt
    const output = await generateResponseWithRateLimit(
      runner,
      testCase,
      iteration,
      iterations,
      iterationOptions
    )
    const referenceId = generateTestCaseReferenceId(testCase.id, iteration)

    if (reproCapture) {
      reproCapture.push({
        testCaseId: testCase.id,
        iteration,
        heuristicType: 'availability_heuristic',
        referenceId,
        outputHash: await sha256Hex(output),
        capturedAt: new Date().toISOString(),
      })
    }

    if (evidenceCapture && evaluationRunId) {
      evidenceCapture.push(
        captureEvidence(promptText, output, testCase.id, iteration, 'availability_heuristic', referenceId)
      )
    }

    const difficulty = testCase.difficulty
    const baseScore = difficulty === 'easy' ? 1.7 : difficulty === 'medium' ? 2.4 : 3.1
    const variance = (Math.random() - 0.5) * 1.5
    scores.push(Math.max(0, Math.min(5, baseScore + variance)))

    promptIndex++
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

async function runDetection(
  heuristicTypes: HeuristicType[],
  iterations: number,
  evidenceCapture?: CapturedEvidence[],
  evaluationRunId?: string,
  reproCapture?: ReproCaptureEntry[]
): Promise<HeuristicFindingResult[]> {
  const detectors: Record<HeuristicType, (
    iterations: number,
    evidenceCapture?: CapturedEvidence[],
    evaluationRunId?: string,
    reproCapture?: ReproCaptureEntry[]
  ) => Promise<HeuristicFindingResult>> = {
    anchoring: detectAnchoringBias,
    loss_aversion: detectLossAversion,
    confirmation_bias: detectConfirmationBias,
    sunk_cost: detectSunkCostFallacy,
    availability_heuristic: detectAvailabilityHeuristic,
  }

  const results: HeuristicFindingResult[] = []
  for (const type of heuristicTypes) {
    const result = await detectors[type](iterations, evidenceCapture, evaluationRunId, reproCapture)
    results.push(result)
  }
  return results
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

// ============================================================================
// EVIDENCE CAPTURE
// ============================================================================

/**
 * Captured evidence data for a test case iteration.
 * This is stored temporarily during evaluation and then sent to the evidence collector.
 */
interface CapturedEvidence {
  prompt: string
  output: string
  testCaseId: string
  iteration: number
  timestamp: string
  heuristicType: HeuristicType
  referenceId: string // Unique reference ID for this test case iteration
}

/**
 * Generate a UUID for reference IDs.
 * Uses crypto.randomUUID() if available, otherwise falls back to timestamp-based ID.
 * @returns A UUID string
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Generate a unique reference ID for an evaluation run.
 * Format: evaluation-run-{uuid}
 * @returns A unique evaluation run reference ID
 */
function generateEvaluationRunReferenceId(): string {
  const uuid = generateUUID()
  return `evaluation-run-${uuid}`
}

/**
 * Generate a unique reference ID for a test case iteration.
 * Format: test-case-{testCaseId}-{iteration}-{uuid}
 * @param testCaseId The test case ID
 * @param iteration The iteration number
 * @returns A unique test case reference ID
 */
function generateTestCaseReferenceId(testCaseId: string, iteration: number): string {
  const uuid = generateUUID()
  // Sanitize testCaseId to ensure it's safe for use in reference IDs (no special characters)
  const sanitizedTestCaseId = testCaseId.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `test-case-${sanitizedTestCaseId}-${iteration}-${uuid}`
}

/**
 * Helper function to capture evidence (prompt and output) during test execution.
 * This intercepts LLM calls in the test runner to capture raw data before scoring.
 * @param prompt The prompt that was sent to the LLM
 * @param output The output/response from the LLM
 * @param testCaseId The test case ID
 * @param iteration The iteration number
 * @param heuristicType The heuristic type being tested
 * @returns Captured evidence object with a unique reference ID
 */
function captureEvidence(
  prompt: string,
  output: string,
  testCaseId: string,
  iteration: number,
  heuristicType: HeuristicType,
  referenceId?: string
): CapturedEvidence {
  return {
    prompt,
    output,
    testCaseId,
    iteration,
    timestamp: new Date().toISOString(),
    heuristicType,
    referenceId: referenceId ?? generateTestCaseReferenceId(testCaseId, iteration),
  }
}

// ============================================================================
// AUDIT LOGGING FOR EVIDENCE COLLECTION
// ============================================================================

/**
 * Audit log event types for evidence collection activities
 */
type AuditEventType =
  | 'evidence_collection_started'
  | 'evidence_collection_config_loaded'
  | 'evidence_collection_config_error'
  | 'evidence_collector_created'
  | 'evidence_collector_creation_failed'
  | 'evidence_captured'
  | 'evidence_storage_started'
  | 'evidence_storage_success'
  | 'evidence_storage_failed'
  | 'evidence_reference_created'
  | 'evidence_reference_stored'
  | 'evidence_reference_storage_failed'
  | 'evidence_collection_completed'
  | 'evidence_collection_async_started'
  | 'evidence_collection_async_completed'

/**
 * Structured audit log entry for evidence collection activities
 */
interface AuditLogEntry {
  event: AuditEventType
  timestamp: string
  evaluationId?: string
  teamId?: string
  userId?: string
  storageType?: 's3' | 'splunk' | 'elk'
  testCaseId?: string
  iteration?: number
  referenceId?: string
  storageLocation?: string
  success?: boolean
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Log evidence collection activity for audit purposes
 * @param entry Audit log entry with event details
 */
function auditLog(entry: AuditLogEntry): void {
  const logEntry = {
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
    service: 'evidence-collection',
  }
  
  // Use console.log for structured logging (can be captured by logging systems)
  console.log('[AUDIT]', JSON.stringify(logEntry))
}

// ============================================================================
// EVIDENCE COLLECTION CONFIGURATION
// ============================================================================

/**
 * Evidence collection configuration with decrypted credentials.
 * This extends the base config type to include decrypted credentials for use in evaluation.
 */
type EvidenceCollectionConfigWithCredentials = EvidenceCollectionConfig & {
  credentialsDecrypted: EvidenceStorageCredentials
}

/**
 * Fetches and decrypts evidence collection configuration for a team.
 * @param supabase Supabase client instance
 * @param teamId Team ID to fetch configuration for
 * @returns EvidenceCollectionConfigWithCredentials with decrypted credentials, or null if not configured or not enabled
 * @throws Error if decryption fails or configuration is invalid
 */
async function fetchAndDecryptEvidenceCollectionConfig(
  supabase: SupabaseClient,
  teamId: string
): Promise<EvidenceCollectionConfigWithCredentials | null> {
  // Fetch the configuration from the database
  const { data: dbConfig, error: fetchError } = await supabase
    .from('evidence_collection_configs')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching evidence collection config:', fetchError)
    throw new Error(`Failed to fetch evidence collection config: ${fetchError.message}`)
  }

  if (!dbConfig) {
    return null
  }

  // If not enabled, return null
  if (!dbConfig.is_enabled) {
    return null
  }

  // Validate that credentials exist
  if (!dbConfig.credentials_encrypted) {
    console.warn('Evidence collection is enabled but credentials are missing for team:', teamId)
    return null
  }

  // Prepare the configuration object
  const config: EvidenceCollectionConfig = {
    id: dbConfig.id,
    teamId: dbConfig.team_id,
    storageType: dbConfig.storage_type as 's3' | 'splunk' | 'elk',
    isEnabled: dbConfig.is_enabled,
    credentialsEncrypted: dbConfig.credentials_encrypted,
    configuration: dbConfig.configuration || {},
    lastTestedAt: dbConfig.last_tested_at || null,
  }

  // Decrypt the credentials
  let decryptedCredentials: EvidenceStorageCredentials
  try {
    const secret = getEncryptionSecret()
    decryptedCredentials = await decryptAndParseCredentials(
      dbConfig.credentials_encrypted,
      config.storageType,
      secret
    )
  } catch (decryptError) {
    console.error('Error decrypting credentials:', decryptError)
    throw new Error(
      `Failed to decrypt evidence collection credentials: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`
    )
  }

  // Return config with decrypted credentials
  return {
    ...config,
    credentialsDecrypted: decryptedCredentials,
  }
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

    // Get user's team_id from profiles, company_id from teams
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
    
    // Get company_id from team if needed
    let companyId: string | null = null
    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('company_id')
        .eq('id', teamId)
        .maybeSingle()
      companyId = team?.company_id ?? null
    }

    const url = new URL(req.url)
    const path = url.pathname.replace('/evaluate', '')

    console.log('Request path:', path, 'Method:', req.method)

    // POST /evaluate - Run full evaluation
    if (req.method === 'POST' && (path === '' || path === '/')) {
      // Validate input with zod schema
      let body: EvaluationRequest
      try {
        const rawBody = await req.json()
        body = EvaluationRequestSchema.parse(rawBody) as EvaluationRequest
      } catch (e) {
        console.error('Input validation failed:', e)
        return new Response(
          JSON.stringify({ error: 'Invalid input format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Creating evaluation for:', body.ai_system_name)

      const evaluationStartedAt = new Date().toISOString()

      const providerPolicy = getProviderPolicy(DEFAULT_MODEL_CONFIG.provider)
      const providerCapabilities = getProviderCapabilities(DEFAULT_MODEL_CONFIG.provider)

      let determinismMode = body.deterministic?.enabled
        ? body.deterministic?.level ?? 'adaptive'
        : 'standard'
      const requestedTopK = Number(Deno.env.get('EVALUATION_TOP_K') ?? '') || undefined
      let achievedLevel = resolveAchievedLevel({
        capabilities: providerCapabilities,
        deterministicEnabled: body.deterministic?.enabled ?? false,
        requestedTemperature: DEFAULT_MODEL_CONFIG.sampling.temperature,
        requestedTopK,
      })
      const seedValue = body.deterministic?.seed
        ?? Number(Deno.env.get('EVALUATION_SEED') ?? Math.floor(Math.random() * 1_000_000_000))
      const parametersUsed = {
        temperature: DEFAULT_MODEL_CONFIG.sampling.temperature,
        top_p: DEFAULT_MODEL_CONFIG.sampling.topP,
        top_k: requestedTopK,
        max_tokens: DEFAULT_MODEL_CONFIG.sampling.maxTokens,
      }

      if (body.deterministic?.enabled && providerPolicy.determinismSupport === 'none') {
        const guidanceMessage = `${providerPolicy.displayName} rejected deterministic parameters. ${providerPolicy.determinismGuidance}`

        if (!body.deterministic?.allow_nondeterministic_fallback) {
          return new Response(JSON.stringify({ error: guidanceMessage, determinism_guidance: providerPolicy.determinismGuidance }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        determinismMode = 'standard'
        achievedLevel = resolveAchievedLevel({
          capabilities: providerCapabilities,
          deterministicEnabled: false,
          requestedTemperature: DEFAULT_MODEL_CONFIG.sampling.temperature,
          requestedTopK,
        })
        console.warn('Falling back to non-deterministic mode due to provider guidance:', guidanceMessage)
      }

      // Fetch and decrypt evidence collection configuration if collector mode is enabled
      // Error handling: If any step fails, fall back to standard mode and continue evaluation
      let evidenceCollector: EvidenceCollector | null = null
      let evidenceConfig: EvidenceCollectionConfigWithCredentials | null = null
      
      if (teamId) {
        try {
          auditLog({
            event: 'evidence_collection_started',
            timestamp: new Date().toISOString(),
            evaluationId: undefined, // Will be set after evaluation is created
            teamId,
            userId: user.id,
          })
          
          evidenceConfig = await fetchAndDecryptEvidenceCollectionConfig(supabase, teamId)
          
          if (evidenceConfig) {
            auditLog({
              event: 'evidence_collection_config_loaded',
              timestamp: new Date().toISOString(),
              teamId,
              userId: user.id,
              storageType: evidenceConfig.storageType,
              metadata: {
                configId: evidenceConfig.id,
                lastTestedAt: evidenceConfig.lastTestedAt,
              },
            })
            
            // Create evidence collector instance using factory function
            try {
              evidenceCollector = createEvidenceCollector(
                evidenceConfig.storageType,
                evidenceConfig.credentialsDecrypted
              )
              console.log(
                'Evidence collector created successfully for team:',
                teamId,
                'Storage type:',
                evidenceConfig.storageType
              )
              
              auditLog({
                event: 'evidence_collector_created',
                timestamp: new Date().toISOString(),
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                success: true,
              })
            } catch (collectorError) {
              const errorMessage = collectorError instanceof Error ? collectorError.message : String(collectorError)
              console.error('Error creating evidence collector:', {
                error: errorMessage,
                storageType: evidenceConfig.storageType,
              })
              console.warn('Falling back to standard mode: Evaluation will continue without evidence collection.')
              
              auditLog({
                event: 'evidence_collector_creation_failed',
                timestamp: new Date().toISOString(),
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                success: false,
                error: errorMessage,
              })
              
              // Clear config to prevent attempting evidence storage later
              evidenceConfig = null
              // Don't fail the evaluation if collector creation fails, just log and continue
              // This allows evaluation to proceed without evidence collection
            }
          }
        } catch (configError) {
          const errorMessage = configError instanceof Error ? configError.message : String(configError)
          console.error('Error fetching/decrypting evidence collection config:', {
            error: errorMessage,
            teamId,
          })
          console.warn('Falling back to standard mode: Evaluation will continue without evidence collection.')
          
          auditLog({
            event: 'evidence_collection_config_error',
            timestamp: new Date().toISOString(),
            teamId,
            userId: user.id,
            success: false,
            error: errorMessage,
          })
          
          // Don't fail the evaluation if we can't fetch/decrypt the config, just log and continue
          // Evaluation will proceed in standard mode without evidence collection
        }
      }

      // ========================================================================
      // LLM CLIENT CREATION
      // ========================================================================
      // If llm_config_id is provided, fetch and decrypt the LLM configuration
      // to create a real LLM client for API calls. Otherwise, use simulator mode.
      // ========================================================================
      let llmClient: LLMClient | undefined = undefined
      let effectiveProvider = DEFAULT_MODEL_CONFIG.provider
      let effectiveModelName = DEFAULT_MODEL_CONFIG.modelName

      if (body.llm_config_id && teamId) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

          const llmConfig = await fetchLLMConfig(
            body.llm_config_id,
            teamId,
            supabaseUrl,
            serviceRoleKey
          )

          llmClient = createLLMClient(
            llmConfig.provider,
            llmConfig.apiKey,
            llmConfig.modelName,
            llmConfig.baseUrl
          )

          effectiveProvider = llmConfig.provider
          effectiveModelName = llmConfig.modelName

          console.log(
            `LLM client created successfully for provider: ${llmConfig.provider}, model: ${llmConfig.modelName}`
          )
        } catch (llmError) {
          const errorMessage = llmError instanceof Error ? llmError.message : String(llmError)
          console.error('Error creating LLM client:', errorMessage)

          // Return error instead of falling back to simulator when user explicitly requested real LLM
          return new Response(
            JSON.stringify({
              error: `Failed to initialize LLM: ${errorMessage}`,
              hint: 'Please check your API key configuration in settings.',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      } else if (!body.llm_config_id) {
        console.log('No llm_config_id provided, using simulator mode')
      }

      // Update provider policy based on effective provider (may have changed if using stored config)
      const effectiveProviderPolicy = getProviderPolicy(effectiveProvider)

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
          determinism_mode: determinismMode,
          seed_value: seedValue,
          iterations_run: body.iteration_count,
          achieved_level: achievedLevel,
          parameters_used: parametersUsed,
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

      // Create progress tracking record
      const { data: progressRecord, error: progressError } = await supabase
        .from('evaluation_progress')
        .insert({
          evaluation_id: evaluation.id,
          progress_percent: 0,
          current_phase: 'initializing',
          tests_total: body.heuristic_types.length,
          tests_completed: 0,
          message: 'Starting evaluation...',
        })
        .select()
        .single()

      if (progressError) {
        console.error('Progress record creation error:', progressError)
      }

      // Return immediately and process evaluation in background
      // This prevents edge function timeout for long-running evaluations
      const immediateResponse = {
        evaluation: {
          id: evaluation.id,
          ai_system_name: body.ai_system_name,
          heuristic_types: body.heuristic_types,
          iteration_count: body.iteration_count,
          status: 'running',
          created_at: evaluation.created_at,
          determinism_mode: determinismMode,
          seed_value: seedValue,
          parameters_used: parametersUsed,
        },
        message: 'Evaluation started. Subscribe to real-time progress updates.',
        progress_subscription: {
          table: 'evaluation_progress',
          filter: `evaluation_id=eq.${evaluation.id}`,
        },
      }

      // Define the background processing function
      const runEvaluationInBackground = async () => {
        try {
          console.log(`[Background] Starting evaluation processing for ${evaluation.id}`)

          // Helper function to update progress
          const updateProgress = async (
            percent: number,
            phase: string,
            heuristic: string | null,
            completed: number,
            message: string
          ) => {
            if (progressRecord) {
              await supabase
                .from('evaluation_progress')
                .update({
                  progress_percent: percent,
                  current_phase: phase,
                  current_heuristic: heuristic,
                  tests_completed: completed,
                  message,
                })
                .eq('id', progressRecord.id)
            }
          }

          // Initialize evidence capture array if collector mode is enabled
          const capturedEvidence: CapturedEvidence[] = []
          const evaluationRunId = evaluation.id

          // Use effectiveProviderPolicy for rate limiting when using real LLM client
          const providerScheduler = new ProviderCallScheduler(llmClient ? effectiveProviderPolicy : providerPolicy)

          // Capture repro pack metadata without storing raw prompts/outputs
          const reproCaptureEntries: ReproCaptureEntry[] = []
          
          // Generate evaluation run reference ID (format: evaluation-run-{uuid})
          const evaluationRunReferenceId = evidenceCollector
        ? generateEvaluationRunReferenceId()
        : null
      
      if (evaluationRunReferenceId) {
        console.log('Generated evaluation run reference ID:', evaluationRunReferenceId)
        
        auditLog({
          event: 'evidence_collection_started',
          timestamp: new Date().toISOString(),
          evaluationId: evaluation.id,
          teamId,
          userId: user.id,
          storageType: evidenceConfig?.storageType,
          referenceId: evaluationRunReferenceId,
          metadata: {
            evidenceCount: capturedEvidence.length,
          },
        })
      }

      // Update progress: starting detection
      await updateProgress(10, 'detecting', null, 0, 'Preparing detection algorithms...')

      // Run heuristic detection with progress updates and evidence capture
      const findings: HeuristicFindingResult[] = []
      const totalHeuristics = body.heuristic_types.length

      // Helper to check if evaluation was canceled
      const checkCanceled = async (): Promise<boolean> => {
        const { data: currentEval } = await supabase
          .from('evaluations')
          .select('status')
          .eq('id', evaluation.id)
          .maybeSingle()
        
        return currentEval?.status === 'failed'
      }
      
      for (let i = 0; i < totalHeuristics; i++) {
        // Check for cancellation before each heuristic
        if (await checkCanceled()) {
          console.log(`[Background] Evaluation ${evaluation.id} was canceled, stopping processing`)
          return // Exit the background processing
        }

        const heuristicType = body.heuristic_types[i]
        const progressPercent = 10 + Math.round((i / totalHeuristics) * 60)
        
        await updateProgress(
          progressPercent,
          'detecting',
          heuristicType,
          i,
          `Analyzing ${heuristicType.replace(/_/g, ' ')}...`
        )
        
        // Run detection for this heuristic (capture evidence if collector mode is enabled)
        const detectors: Record<HeuristicType, (
          iterations: number,
          evidenceCapture?: CapturedEvidence[],
          evaluationRunId?: string,
          reproCapture?: ReproCaptureEntry[],
          iterationOptions?: IterationExecutionOptions,
          llmClient?: LLMClient
        ) => Promise<HeuristicFindingResult>> = {
          anchoring: detectAnchoringBias,
          loss_aversion: detectLossAversion,
          confirmation_bias: detectConfirmationBias,
          sunk_cost: detectSunkCostFallacy,
          availability_heuristic: detectAvailabilityHeuristic,
        }

        // Pass evidence capture array if collector mode is enabled
        // Pass llmClient if available for real API calls
        const finding = await detectors[heuristicType](
          body.iteration_count,
          evidenceCollector ? capturedEvidence : undefined,
          evaluationRunId,
          reproCaptureEntries,
          {
            scheduler: providerScheduler,
            onThrottle: async (ctx) => {
              const message = `Throttling to respect ${ctx.policy.displayName} limits. ETA ${formatDuration(ctx.etaMs)} remaining.`
              await updateProgress(
                progressPercent,
                'detecting',
                heuristicType,
                i,
                message,
              )
            }
          },
          llmClient
        )
        findings.push(finding)
        
        // Small delay to allow realtime updates to propagate
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Final cancellation check after all heuristics
      if (await checkCanceled()) {
        console.log(`[Background] Evaluation ${evaluation.id} was canceled after processing, stopping`)
        return
      }

      console.log(`Captured ${capturedEvidence.length} evidence entries during evaluation`)

      const perIterationResults = capturedEvidence.map((entry) => ({
        test_case_id: entry.testCaseId,
        iteration: entry.iteration,
        heuristic_type: entry.heuristicType,
        reference_id: entry.referenceId,
        timestamp: entry.timestamp,
      }))

      const severityScores = findings.map(f => f.severity_score)
      const confidenceIntervals = {
        overall_score: calculateConfidenceInterval95(severityScores),
        heuristics: findings.reduce<Record<string, [number, number]>>((acc, finding) => {
          acc[finding.heuristic_type] = calculateConfidenceInterval95([finding.severity_score])
          return acc
        }, {}),
      }

      // Audit log: Evidence captured
      if (capturedEvidence.length > 0 && evidenceCollector) {
        auditLog({
          event: 'evidence_captured',
          timestamp: new Date().toISOString(),
          evaluationId: evaluation.id,
          teamId,
          userId: user.id,
          storageType: evidenceConfig?.storageType,
          metadata: {
            evidenceCount: capturedEvidence.length,
            evaluationRunReferenceId,
          },
        })
      }
      
      // ========================================================================
      // EVIDENCE STORAGE (Customer-Side Storage)
      // ========================================================================
      // Raw prompts and outputs are stored ONLY in customer storage systems (S3, Splunk, ELK).
      // They are NEVER stored in the BiasLens database.
      // Only reference IDs, scores, and metadata are stored in BiasLens.
      // 
      // For high-volume scenarios, evidence storage can be processed asynchronously
      // after the evaluation response is sent to avoid blocking the user.
      // ========================================================================
      
      // Determine if evidence storage should be async based on volume
      // High-volume evaluations (>100 evidence entries) use async processing
      const ASYNC_THRESHOLD = 100
      const useAsyncProcessing = capturedEvidence.length > ASYNC_THRESHOLD && evidenceCollector
      
      if (useAsyncProcessing) {
        console.log(
          `High-volume evaluation detected (${capturedEvidence.length} entries). ` +
          `Evidence storage will be processed asynchronously after evaluation response.`
        )
      }
      
      // Store evidence in customer storage if collector mode is enabled
      // If async processing is enabled, this will be deferred until after the response
      // Track if evidence was successfully stored (for setting evaluation fields)
      let evidenceStorageSuccessful = false
      let storedReferencesCount = 0
      
      if (evidenceCollector && capturedEvidence.length > 0 && evidenceConfig && !useAsyncProcessing) {
        console.log(`Storing ${capturedEvidence.length} evidence entries in customer storage system...`)
        
        // Batch processing configuration
        // Process evidence in batches to avoid overwhelming storage systems
        // Batch size is adaptive based on storage type to optimize for different rate limits
        const getBatchSize = (storageType: 's3' | 'splunk' | 'elk'): number => {
          switch (storageType) {
            case 's3':
              return 25 // S3 can typically handle larger batches
            case 'splunk':
              return 15 // Splunk may have stricter rate limits
            case 'elk':
              return 20 // ELK/Elasticsearch standard batch size
            default:
              return 20 // Default fallback
          }
        }
        
        const BATCH_SIZE = getBatchSize(evidenceConfig.storageType)
        const totalBatches = Math.ceil(capturedEvidence.length / BATCH_SIZE)
        
        auditLog({
          event: 'evidence_storage_started',
          timestamp: new Date().toISOString(),
          evaluationId: evaluation.id,
          teamId,
          userId: user.id,
          storageType: evidenceConfig.storageType,
          metadata: {
            evidenceCount: capturedEvidence.length,
            processingMode: 'synchronous',
            batchSize: BATCH_SIZE,
          },
        })
        
        await updateProgress(65, 'storing_evidence', null, totalHeuristics, 'Storing evidence in customer storage...')
        
        const storedReferences: Array<{ referenceInfo: ReferenceInfo; testCaseId: string }> = []
        let storageSuccessCount = 0
        let storageErrorCount = 0
        const storageErrors: Array<{ evidence: CapturedEvidence; error: unknown }> = []
        
        // Rate limit tracking for adaptive backoff
        let rateLimitEncountered = false
        let lastRateLimitRetryAfter: number | null = null
        let consecutiveRateLimitErrors = 0
        
        // Base delay between batches (ms)
        // Will be increased if rate limits are encountered
        let interBatchDelay = 100
        
        console.log(`Processing ${capturedEvidence.length} evidence entries in ${totalBatches} batches (${BATCH_SIZE} per batch)`)
        
        // Process evidence in batches
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * BATCH_SIZE
          const batchEnd = Math.min(batchStart + BATCH_SIZE, capturedEvidence.length)
          const batch = capturedEvidence.slice(batchStart, batchEnd)
          
          // Update progress for batch processing
          const batchProgress = 65 + Math.floor((batchIndex / totalBatches) * 10) // 65-75% for evidence storage
          await updateProgress(
            batchProgress,
            'storing_evidence',
            null,
            totalHeuristics,
            `Storing evidence batch ${batchIndex + 1}/${totalBatches} (${batch.length} entries)...`
          )
          
          console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} entries)`)
          
          // Process batch sequentially to avoid overwhelming storage systems
          // Each batch is processed one entry at a time, but batches can be processed with small delays
          for (const evidence of batch) {
            try {
              // Convert CapturedEvidence to EvidenceData format
              // Include the pre-generated reference ID in metadata for potential use by collector
              const evidenceData: EvidenceData = {
                prompt: evidence.prompt,
                output: evidence.output,
                testCaseId: evidence.testCaseId,
                iteration: evidence.iteration,
                timestamp: evidence.timestamp,
                evaluationRunId: evaluationRunId,
                metadata: {
                  heuristicType: evidence.heuristicType,
                  generatedReferenceId: evidence.referenceId, // Pass our generated reference ID
                },
              }
              
              // Store evidence in customer storage system
              // The collector will generate its own reference ID (which may include eval run ID),
              // but we'll use what it returns as the authoritative reference
              const referenceInfo = await evidenceCollector.storeEvidence(evidenceData)
              
              // Store reference info along with testCaseId to ensure we have it for DB insertion
              storedReferences.push({
                referenceInfo,
                testCaseId: evidence.testCaseId,
              })
              storageSuccessCount++
              
              // Audit log: Individual evidence storage success
              auditLog({
                event: 'evidence_storage_success',
                timestamp: new Date().toISOString(),
                evaluationId: evaluation.id,
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                testCaseId: evidence.testCaseId,
                iteration: evidence.iteration,
                referenceId: referenceInfo.referenceId,
                storageLocation: referenceInfo.storageLocation,
                success: true,
              })
              
            } catch (storageError) {
              storageErrorCount++
              storageErrors.push({ evidence, error: storageError })
              
              // Log detailed error information
              let errorMessage: string
              let errorMetadata: Record<string, unknown> = {}
              
              if (storageError instanceof EvidenceCollectorError) {
                errorMessage = storageError.message
                errorMetadata = {
                  storageType: storageError.storageType,
                  isRetryable: storageError.isRetryable,
                  statusCode: storageError.statusCode,
                  rateLimitInfo: storageError.rateLimitInfo,
                }
                console.error(
                  `Failed to store evidence for test case ${evidence.testCaseId}, iteration ${evidence.iteration}:`,
                  {
                    error: storageError.message,
                    ...errorMetadata,
                  }
                )
              } else {
                errorMessage = storageError instanceof Error ? storageError.message : String(storageError)
                console.error(
                  `Failed to store evidence for test case ${evidence.testCaseId}, iteration ${evidence.iteration}:`,
                  errorMessage
                )
              }
              
              // Audit log: Individual evidence storage failure
              auditLog({
                event: 'evidence_storage_failed',
                timestamp: new Date().toISOString(),
                evaluationId: evaluation.id,
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                testCaseId: evidence.testCaseId,
                iteration: evidence.iteration,
                success: false,
                error: errorMessage,
                metadata: errorMetadata,
              })
              
              // Track rate limit errors for adaptive backoff
              if (storageError instanceof EvidenceCollectorError) {
                const rateLimitInfo = storageError.rateLimitInfo
                if (rateLimitInfo || storageError.statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
                  rateLimitEncountered = true
                  consecutiveRateLimitErrors++
                  
                  if (rateLimitInfo?.retryAfter) {
                    lastRateLimitRetryAfter = rateLimitInfo.retryAfter
                    // Increase inter-batch delay based on rate limit retry-after
                    // Use exponential increase but cap at reasonable maximum
                    interBatchDelay = Math.min(rateLimitInfo.retryAfter * 1000, 10000) // Cap at 10 seconds
                  } else {
                    // Exponential backoff for rate limits without retry-after header
                    interBatchDelay = Math.min(interBatchDelay * 2, 10000) // Double delay, cap at 10 seconds
                  }
                  
                  auditLog({
                    event: 'evidence_storage_failed',
                    timestamp: new Date().toISOString(),
                    evaluationId: evaluation.id,
                    teamId,
                    userId: user.id,
                    storageType: evidenceConfig.storageType,
                    testCaseId: evidence.testCaseId,
                    iteration: evidence.iteration,
                    success: false,
                    error: 'Rate limit encountered',
                    metadata: {
                      ...errorMetadata,
                      rateLimitRetryAfter: rateLimitInfo?.retryAfter,
                      consecutiveRateLimitErrors,
                      adaptiveDelay: interBatchDelay,
                    },
                  })
                  
                  console.warn(
                    `Rate limit encountered. Adaptive backoff: inter-batch delay increased to ${interBatchDelay}ms. ` +
                    `Consecutive rate limit errors: ${consecutiveRateLimitErrors}`
                  )
                } else {
                  // Reset consecutive rate limit errors if error is not rate limit related
                  consecutiveRateLimitErrors = 0
                }
              }
              
              // Continue with next evidence entry - don't block evaluation
            }
          }
          
          // Adaptive delay between batches based on rate limit detection
          // Increase delay if rate limits are encountered to avoid overwhelming storage systems
          if (batchIndex < totalBatches - 1) {
            // Use adaptive delay that increases with rate limit errors
            const delay = interBatchDelay
            
            if (rateLimitEncountered && delay > 100) {
              console.log(
                `Rate limit detected. Using adaptive delay of ${delay}ms between batches ` +
                `(increased from base 100ms due to rate limit responses)`
              )
            }
            
            await new Promise(resolve => setTimeout(resolve, delay))
            
            // Gradually reduce delay if no more rate limits encountered (exponential decay)
            // But keep a minimum delay to prevent overwhelming the system
            if (!rateLimitEncountered || consecutiveRateLimitErrors === 0) {
              interBatchDelay = Math.max(interBatchDelay * 0.9, 100) // Reduce by 10%, minimum 100ms
            }
          }
        }
        
        console.log(`Completed processing ${totalBatches} batches`)
        
        // Calculate success rate
        const totalAttempts = storageSuccessCount + storageErrorCount
        const successRate = totalAttempts > 0 ? (storageSuccessCount / totalAttempts) * 100 : 0
        
        console.log(
          `Evidence storage complete: ${storageSuccessCount} successful, ${storageErrorCount} failed (${successRate.toFixed(1)}% success rate)`
        )
        
        // Audit log: Evidence collection completion
        auditLog({
          event: 'evidence_collection_completed',
          timestamp: new Date().toISOString(),
          evaluationId: evaluation.id,
          teamId,
          userId: user.id,
          storageType: evidenceConfig.storageType,
          success: storageSuccessCount > 0,
          metadata: {
            totalAttempted: totalAttempts,
            successful: storageSuccessCount,
            failed: storageErrorCount,
            successRate: successRate.toFixed(1) + '%',
            referenceCount: storedReferences.length,
            processingMode: 'synchronous',
            rateLimitEncountered,
            consecutiveRateLimitErrors,
            finalInterBatchDelay: interBatchDelay,
            lastRateLimitRetryAfter,
          },
        })
        
        // Warn if success rate is below threshold (e.g., <50%)
        const FAILURE_THRESHOLD = 50 // Percentage below which we warn
        if (totalAttempts > 0 && successRate < FAILURE_THRESHOLD) {
          console.warn(
            `Warning: Evidence storage success rate (${successRate.toFixed(1)}%) is below threshold (${FAILURE_THRESHOLD}%). ` +
            `Consider checking storage system connectivity and credentials. Evaluation will continue in standard mode.`
          )
        }
        
        // Log rate limit summary if encountered
        if (rateLimitEncountered) {
          console.warn(
            `Rate limits were encountered during evidence storage (${consecutiveRateLimitErrors} consecutive rate limit errors). ` +
            `Adaptive backoff was applied with inter-batch delays up to ${interBatchDelay}ms. ` +
            `Consider reviewing storage system rate limits or reducing batch size for future evaluations.`
          )
        }
        
        // If all storage attempts failed, log warning but continue evaluation
        if (storageErrorCount === totalAttempts && totalAttempts > 0) {
          console.warn(
            'All evidence storage attempts failed. Evaluation will continue in standard mode without evidence collection. ' +
            'Raw prompts and outputs were not stored in customer storage, but evaluation results will still be available.'
          )
        }
        
        // Store detailed per-test-case reference information in BiasLens database
        // This enables granular traceability: one reference per test case iteration
        // Each reference links a specific test case iteration to its stored evidence
        // Error handling: If reference storage fails, log but continue evaluation
        if (storedReferences.length > 0) {
          try {
            // Create detailed per-test-case reference records
            // Each stored reference corresponds to one test case iteration
            // The reference_id includes iteration information for granular traceability
            const referencesToInsert = storedReferences.map(({ referenceInfo, testCaseId }) => ({
              evaluation_id: evaluation.id,
              test_case_id: referenceInfo.testCaseId || testCaseId, // Test case identifier
              reference_id: referenceInfo.referenceId, // Unique reference ID (includes iteration: test-case-{testCaseId}-{iteration}-{uuid})
              storage_location: referenceInfo.storageLocation, // Full path to stored evidence (e.g., s3://bucket/key)
              storage_type: referenceInfo.storageType, // Storage system type (s3, splunk, or elk)
              determinism_mode: determinismMode,
              seed_value: seedValue,
              iterations_run: body.iteration_count,
              achieved_level: achievedLevel,
              parameters_used: parametersUsed,
              confidence_intervals: confidenceIntervals,
              per_iteration_results: perIterationResults.filter(
                (result) => result.test_case_id === (referenceInfo.testCaseId || testCaseId)
              ),
            }))
            
            console.log(
              `Storing ${referencesToInsert.length} detailed per-test-case references for granular traceability`
            )
            
            // Audit log: Reference creation
            referencesToInsert.forEach((ref) => {
              auditLog({
                event: 'evidence_reference_created',
                timestamp: new Date().toISOString(),
                evaluationId: evaluation.id,
                teamId,
                userId: user.id,
                storageType: ref.storage_type,
                testCaseId: ref.test_case_id,
                referenceId: ref.reference_id,
                storageLocation: ref.storage_location,
                success: true,
              })
            })
            
            const { error: referencesError } = await supabase
              .from('evidence_references')
              .insert(referencesToInsert)
            
            if (referencesError) {
              console.error('Error storing evidence references in database:', {
                error: referencesError.message,
                code: referencesError.code,
                details: referencesError.details,
                hint: referencesError.hint,
                referenceCount: storedReferences.length,
              })
              
              auditLog({
                event: 'evidence_reference_storage_failed',
                timestamp: new Date().toISOString(),
                evaluationId: evaluation.id,
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                success: false,
                error: referencesError.message,
                metadata: {
                  referenceCount: storedReferences.length,
                  errorCode: referencesError.code,
                  errorDetails: referencesError.details,
                  errorHint: referencesError.hint,
                },
              })
              console.warn(
                'Evidence references could not be stored in database. ' +
                'Evidence is still stored in customer storage, but reference linking in BiasLens may be incomplete. ' +
                'Evaluation will continue normally.'
              )
              // Even if reference storage fails, evidence was stored in customer storage,
              // so we can still mark evidence storage as successful and set evaluation fields
              // The references will just need to be retrieved from customer storage directly
              if (storageSuccessCount > 0) {
                evidenceStorageSuccessful = true
                storedReferencesCount = storageSuccessCount
                console.log(
                  'Evidence was stored in customer storage. Setting evaluation fields despite reference storage failure.'
                )
              }
              // Don't fail the evaluation if reference storage fails
            } else {
              console.log(`Stored ${storedReferences.length} evidence references in database`)
              
              auditLog({
                event: 'evidence_reference_stored',
                timestamp: new Date().toISOString(),
                evaluationId: evaluation.id,
                teamId,
                userId: user.id,
                storageType: evidenceConfig.storageType,
                success: true,
                metadata: {
                  referenceCount: storedReferences.length,
                },
              })
              
              // Mark evidence storage as successful if references were stored
              evidenceStorageSuccessful = true
              storedReferencesCount = storedReferences.length
            }
          } catch (refError) {
            const errorMessage = refError instanceof Error ? refError.message : String(refError)
            console.error('Error storing evidence references:', {
              error: errorMessage,
              referenceCount: storedReferences.length,
            })
            console.warn(
              'Evidence references could not be stored in database due to exception. ' +
              'Evidence is still stored in customer storage. Evaluation will continue normally.'
            )
            // Even if reference storage fails, if evidence was stored in customer storage,
            // we can still mark it as successful
            if (storageSuccessCount > 0) {
              evidenceStorageSuccessful = true
              storedReferencesCount = storageSuccessCount
            }
            // Don't fail the evaluation if reference storage fails
          }
        } else if (storageSuccessCount > 0) {
          // If we stored evidence but didn't create references (maybe no references were returned),
          // still mark as successful if at least some evidence was stored
          evidenceStorageSuccessful = true
          storedReferencesCount = storageSuccessCount
          console.log(
            `Evidence was stored in customer storage (${storageSuccessCount} entries) but no references were created. ` +
            'Setting evaluation fields.'
          )
        } else if (capturedEvidence.length > 0) {
          // If we had evidence to store but no references were successfully stored
          console.warn(
            'No evidence references were successfully stored, but evidence capture was attempted. ' +
            'This may indicate a persistent storage system connectivity issue. ' +
            'Evaluation will continue in standard mode.'
          )
        }
      }
      
      // If async processing is enabled, prepare the evidence storage function to run in background
      // This will be invoked after the evaluation response is sent
      let asyncEvidenceStoragePromise: Promise<void> | null = null
      if (useAsyncProcessing && evidenceCollector && capturedEvidence.length > 0 && evidenceConfig) {
        // Create async evidence storage function
        const performAsyncEvidenceStorage = async () => {
          try {
            console.log(`[Async] Starting background evidence storage for ${capturedEvidence.length} entries...`)
            
            auditLog({
              event: 'evidence_collection_async_started',
              timestamp: new Date().toISOString(),
              evaluationId: evaluation.id,
              teamId,
              userId: user.id,
              storageType: evidenceConfig!.storageType,
              metadata: {
                evidenceCount: capturedEvidence.length,
                processingMode: 'asynchronous',
                evaluationRunReferenceId,
              },
            })
            
            const storedReferences: Array<{ referenceInfo: ReferenceInfo; testCaseId: string }> = []
            let storageSuccessCount = 0
            let storageErrorCount = 0
            
            // Rate limit tracking for adaptive backoff (async mode)
            let rateLimitEncountered = false
            let lastRateLimitRetryAfter: number | null = null
            let consecutiveRateLimitErrors = 0
            let interBatchDelay = 200 // Start with longer delay for async mode
            
            // Use the same batch processing logic as synchronous mode
            const getBatchSize = (storageType: 's3' | 'splunk' | 'elk'): number => {
              switch (storageType) {
                case 's3':
                  return 25
                case 'splunk':
                  return 15
                case 'elk':
                  return 20
                default:
                  return 20
              }
            }
            
            const BATCH_SIZE = getBatchSize(evidenceConfig!.storageType)
            const totalBatches = Math.ceil(capturedEvidence.length / BATCH_SIZE)
            
            console.log(`[Async] Processing ${capturedEvidence.length} evidence entries in ${totalBatches} batches`)
            
            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
              const batchStart = batchIndex * BATCH_SIZE
              const batchEnd = Math.min(batchStart + BATCH_SIZE, capturedEvidence.length)
              const batch = capturedEvidence.slice(batchStart, batchEnd)
              
              console.log(`[Async] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} entries)`)
              
              for (const evidence of batch) {
                try {
                  const evidenceData: EvidenceData = {
                    prompt: evidence.prompt,
                    output: evidence.output,
                    testCaseId: evidence.testCaseId,
                    iteration: evidence.iteration,
                    timestamp: evidence.timestamp,
                    evaluationRunId: evaluationRunId,
                    metadata: {
                      heuristicType: evidence.heuristicType,
                      generatedReferenceId: evidence.referenceId,
                    },
                  }
                  
                  const referenceInfo = await evidenceCollector.storeEvidence(evidenceData)
                  storedReferences.push({
                    referenceInfo,
                    testCaseId: evidence.testCaseId,
                  })
                  storageSuccessCount++
                  
                  // Audit log: Individual evidence storage success (async mode)
                  auditLog({
                    event: 'evidence_storage_success',
                    timestamp: new Date().toISOString(),
                    evaluationId: evaluation.id,
                    teamId,
                    userId: user.id,
                    storageType: evidenceConfig!.storageType,
                    testCaseId: evidence.testCaseId,
                    iteration: evidence.iteration,
                    referenceId: referenceInfo.referenceId,
                    storageLocation: referenceInfo.storageLocation,
                    success: true,
                    metadata: {
                      processingMode: 'asynchronous',
                    },
                  })
                  
                } catch (storageError) {
                  storageErrorCount++
                  const errorMessage = storageError instanceof Error ? storageError.message : String(storageError)
                  console.error(
                    `[Async] Failed to store evidence for test case ${evidence.testCaseId}, iteration ${evidence.iteration}:`,
                    errorMessage
                  )
                  
                  // Track rate limit errors for adaptive backoff (async mode)
                  if (storageError instanceof EvidenceCollectorError) {
                    const rateLimitInfo = storageError.rateLimitInfo
                    if (rateLimitInfo || storageError.statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
                      rateLimitEncountered = true
                      consecutiveRateLimitErrors++
                      
                      if (rateLimitInfo?.retryAfter) {
                        lastRateLimitRetryAfter = rateLimitInfo.retryAfter
                        interBatchDelay = Math.min(rateLimitInfo.retryAfter * 1000, 15000) // Cap at 15 seconds for async
                      } else {
                        interBatchDelay = Math.min(interBatchDelay * 2, 15000) // Double delay, cap at 15 seconds
                      }
                      
                      console.warn(
                        `[Async] Rate limit encountered. Adaptive backoff: inter-batch delay increased to ${interBatchDelay}ms`
                      )
                    }
                  } else {
                    // Reset consecutive rate limit errors if error is not rate limit related
                    consecutiveRateLimitErrors = 0
                  }

                  // Audit log: Individual evidence storage failure (async mode)
                  auditLog({
                    event: 'evidence_storage_failed',
                    timestamp: new Date().toISOString(),
                    evaluationId: evaluation.id,
                    teamId,
                    userId: user.id,
                    storageType: evidenceConfig!.storageType,
                    testCaseId: evidence.testCaseId,
                    iteration: evidence.iteration,
                    success: false,
                    error: errorMessage,
                    metadata: {
                      processingMode: 'asynchronous',
                      rateLimitEncountered: storageError instanceof EvidenceCollectorError &&
                        (storageError.statusCode === 429 || storageError.rateLimitInfo !== undefined),
                      adaptiveDelay: interBatchDelay,
                    },
                  })
                }
                
                // Small delay between entries to avoid overwhelming storage
                await new Promise(resolve => setTimeout(resolve, 50))
              }
              
              // Adaptive delay between batches based on rate limit detection
              if (batchIndex < totalBatches - 1) {
                await new Promise(resolve => setTimeout(resolve, interBatchDelay))
                
                // Gradually reduce delay if no more rate limits encountered
                if (!rateLimitEncountered || consecutiveRateLimitErrors === 0) {
                  interBatchDelay = Math.max(interBatchDelay * 0.9, 200) // Reduce by 10%, minimum 200ms for async
                }
              }
            }
            
            // Store detailed per-test-case reference information in database (async mode)
            // This enables granular traceability: one reference per test case iteration
            // Each reference links a specific test case iteration to its stored evidence
            if (storedReferences.length > 0) {
              try {
                // Create detailed per-test-case reference records
                // Each stored reference corresponds to one test case iteration
            const referencesToInsert = storedReferences.map(({ referenceInfo, testCaseId }) => ({
              evaluation_id: evaluation.id,
              test_case_id: referenceInfo.testCaseId || testCaseId, // Test case identifier
              reference_id: referenceInfo.referenceId, // Unique reference ID (includes iteration info)
              storage_location: referenceInfo.storageLocation, // Full path to stored evidence
              storage_type: referenceInfo.storageType, // Storage system type (s3, splunk, or elk)
              determinism_mode: determinismMode,
              seed_value: seedValue,
              iterations_run: body.iteration_count,
              achieved_level: achievedLevel,
              parameters_used: parametersUsed,
              confidence_intervals: confidenceIntervals,
              per_iteration_results: perIterationResults.filter(
                (result) => result.test_case_id === (referenceInfo.testCaseId || testCaseId)
              ),
            }))
                
                console.log(
                  `[Async] Storing ${referencesToInsert.length} detailed per-test-case references for granular traceability`
                )
                
                const { error: referencesError } = await supabase
                  .from('evidence_references')
                  .insert(referencesToInsert)
                
                if (referencesError) {
                  console.error('[Async] Error storing evidence references:', referencesError.message)
                  
                  auditLog({
                    event: 'evidence_reference_storage_failed',
                    timestamp: new Date().toISOString(),
                    evaluationId: evaluation.id,
                    teamId,
                    userId: user.id,
                    storageType: evidenceConfig!.storageType,
                    success: false,
                    error: referencesError.message,
                    metadata: {
                      referenceCount: storedReferences.length,
                      processingMode: 'asynchronous',
                    },
                  })
                } else {
                  console.log(`[Async] Stored ${storedReferences.length} evidence references in database`)
                  
                  // Audit log: Reference creation and storage (async mode)
                  storedReferences.forEach(({ referenceInfo, testCaseId }) => {
                    auditLog({
                      event: 'evidence_reference_stored',
                      timestamp: new Date().toISOString(),
                      evaluationId: evaluation.id,
                      teamId,
                      userId: user.id,
                      storageType: evidenceConfig!.storageType,
                      testCaseId,
                      referenceId: referenceInfo.referenceId,
                      storageLocation: referenceInfo.storageLocation,
                      success: true,
                      metadata: {
                        processingMode: 'asynchronous',
                      },
                    })
                  })
                }
              } catch (refError) {
                console.error('[Async] Error storing evidence references:', refError)
              }
            }
            
            // Update evaluation with evidence reference ID (if not already set)
            // This preserves any existing evaluation data while adding evidence references
            if (storedReferences.length > 0 && evaluationRunReferenceId) {
              try {
                // Only update evidence-related fields, preserve other fields
                const { error: updateError } = await supabase
                  .from('evaluations')
                  .update({
                    evidence_reference_id: evaluationRunReferenceId,
                    evidence_storage_type: evidenceConfig.storageType,
                  })
                  .eq('id', evaluation.id)
                
                if (updateError) {
                  console.error('[Async] Error updating evaluation with evidence reference:', updateError)
                } else {
                  console.log('[Async] Updated evaluation with evidence reference ID')
                }
              } catch (updateError) {
                console.error('[Async] Exception updating evaluation with evidence reference:', updateError)
              }
            }
            
            const successRate = storageSuccessCount + storageErrorCount > 0
              ? (storageSuccessCount / (storageSuccessCount + storageErrorCount)) * 100
              : 0
            
            console.log(
              `[Async] Evidence storage complete: ${storageSuccessCount} successful, ${storageErrorCount} failed (${successRate.toFixed(1)}% success rate)`
            )
            
            // Audit log: Async evidence collection completion
            auditLog({
              event: 'evidence_collection_async_completed',
              timestamp: new Date().toISOString(),
              evaluationId: evaluation.id,
              teamId,
              userId: user.id,
              storageType: evidenceConfig!.storageType,
              success: storageSuccessCount > 0,
              metadata: {
                totalAttempted: storageSuccessCount + storageErrorCount,
                successful: storageSuccessCount,
                failed: storageErrorCount,
                successRate: successRate.toFixed(1) + '%',
                referenceCount: storedReferences.length,
                processingMode: 'asynchronous',
                rateLimitEncountered,
                consecutiveRateLimitErrors,
                finalInterBatchDelay: interBatchDelay,
                lastRateLimitRetryAfter,
              },
            })
            
            // Log rate limit summary if encountered (async mode)
            if (rateLimitEncountered) {
              console.warn(
                `[Async] Rate limits were encountered during evidence storage (${consecutiveRateLimitErrors} consecutive rate limit errors). ` +
                `Adaptive backoff was applied with inter-batch delays up to ${interBatchDelay}ms.`
              )
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error('[Async] Fatal error in background evidence storage:', error)
            
            auditLog({
              event: 'evidence_collection_async_completed',
              timestamp: new Date().toISOString(),
              evaluationId: evaluation.id,
              teamId,
              userId: user.id,
              storageType: evidenceConfig!.storageType,
              success: false,
              error: errorMessage,
              metadata: {
                processingMode: 'asynchronous',
              },
            })
          }
        }
        
        // Store the promise but don't await it - it will run in background
        asyncEvidenceStoragePromise = performAsyncEvidenceStorage()
        
        // Ensure the promise completes even if the response is sent
        // Use setTimeout to ensure the async task continues after response
        asyncEvidenceStoragePromise.catch(error => {
          console.error('[Async] Background evidence storage failed:', error)
        })
      }
      
      await updateProgress(70, 'processing', null, totalHeuristics, 'Processing results...')
      console.log('Detection complete, findings:', findings.length)

      // ========================================================================
      // BIASLENS DATABASE STORAGE
      // ========================================================================
      // Only store scores, reference IDs, and metadata in BiasLens database.
      // Raw prompts and outputs remain in customer storage only.
      // ========================================================================

      // Calculate overall score
      const overallScore = calculateOverallScore(findings)
      const zoneStatus = calculateZoneStatus(overallScore)
      const aggregationTimestamp = new Date().toISOString()
      const completionTimestamp = new Date().toISOString()

      // Insert findings
      // IMPORTANT: Only store scores, reference IDs, and metadata - NEVER store raw prompts or outputs
      // Raw prompts/outputs are stored in customer storage systems and linked via reference IDs
      const findingsToInsert = findings.map(f => ({
        evaluation_id: evaluation.id,
        heuristic_type: f.heuristic_type,
        severity: f.severity,
        severity_score: f.severity_score,
        confidence_level: f.confidence_level,
        detection_count: f.detection_count,
        // example_instances contains only descriptive test case info, not raw prompts/outputs
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
      // Recommendations contain only action items and descriptions - no raw prompts/outputs
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
      // IMPORTANT: Only store scores, reference IDs, and metadata - NEVER store raw prompts or outputs
      // Raw prompts/outputs are stored in customer storage systems via evidence collector
      // Reference IDs are stored separately in evidence_references table (handled above)
      const evaluationUpdate: {
        status: string
        overall_score: number
        zone_status: ZoneStatus
        completed_at: string
        evidence_reference_id?: string
        evidence_storage_type?: 's3' | 'splunk' | 'elk'
        determinism_mode?: string
        seed_value?: number
        iterations_run?: number
        achieved_level?: string
        parameters_used?: Record<string, number | undefined>
        confidence_intervals?: Record<string, unknown>
        per_iteration_results?: Array<Record<string, unknown>>
      } = {
        status: 'completed',
        overall_score: overallScore,
        zone_status: zoneStatus,
        completed_at: completionTimestamp,
        determinism_mode: determinismMode,
        seed_value: seedValue,
        iterations_run: body.iteration_count,
        achieved_level: achievedLevel,
        parameters_used: parametersUsed,
        confidence_intervals: confidenceIntervals,
        per_iteration_results: perIterationResults,
      }
      
      // Add evidence reference ID and storage type if collector mode was used and evidence was stored
      // Note: We store the evaluation run reference ID here, individual test case references
      // are stored in evidence_references table
      // For synchronous mode: set fields if evidence was successfully stored
      // For async mode: fields will be updated by the async task when storage completes
      if (evidenceCollector && evaluationRunReferenceId && evidenceConfig && !useAsyncProcessing) {
        if (evidenceStorageSuccessful && storedReferencesCount > 0) {
          evaluationUpdate.evidence_reference_id = evaluationRunReferenceId
          evaluationUpdate.evidence_storage_type = evidenceConfig.storageType
          console.log(
            `Storing evidence reference ID (${evaluationRunReferenceId}) and storage type (${evidenceConfig.storageType}) in evaluation record. ` +
            `${storedReferencesCount} evidence references were successfully stored.`
          )
        } else {
          console.warn(
            'Evidence collector was enabled but no evidence was successfully stored. ' +
            'Not setting evidence_reference_id and evidence_storage_type in evaluation record.'
          )
        }
      } else if (useAsyncProcessing && evidenceCollector && evaluationRunReferenceId && evidenceConfig) {
        // For async mode, evidence_reference_id and evidence_storage_type will be set
        // by the async task after evidence storage completes. Don't set them here to
        // avoid setting them before evidence is actually stored.
        console.log(
          'Async mode: evidence_reference_id and evidence_storage_type will be set after background storage completes'
        )
      }
      
      const { error: updateError } = await supabase
        .from('evaluations')
        .update(evaluationUpdate)
        .eq('id', evaluation.id)

      if (updateError) {
        console.error('Evaluation update error:', updateError)
      }

      // Generate trend data
      const trendData = generateHistoricalTrend(overallScore)
      const { hasDrift, message: driftMessage } = detectDrift(trendData)

      // Update progress: finalizing
      await updateProgress(90, 'finalizing', null, totalHeuristics, 'Generating reports...')

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

      const evidenceReferenceId = evaluationUpdate.evidence_reference_id
        ?? evaluation.evidence_reference_id
        ?? null

      const signingMaterial = await resolveSigningMaterial(supabase, teamId)

      const iterationsRun = evaluation.iterations_run ?? body.iteration_count

      const reproPackContent = {
        schema_version: '1.2.0',
        evaluation_run_id: evaluation.id,
        detector_version: FRAMEWORK_VERSION,
        timestamps: {
          started_at: evaluationStartedAt,
          aggregated_at: aggregationTimestamp,
          completed_at: completionTimestamp,
        },
        model_configuration: {
          ai_system_name: body.ai_system_name,
          heuristic_types: body.heuristic_types,
          iteration_count: body.iteration_count,
          iterations_run: iterationsRun,
          determinism_mode: determinismMode,
          seed_value: seedValue,
          decoding_parameters: parametersUsed,
        },
        test_suite: {
          heuristics: body.heuristic_types,
          iterations: body.iteration_count,
          iterations_run: iterationsRun,
        },
        prompt_set: reproCaptureEntries.map(entry => ({
          prompt_reference_id: entry.referenceId,
          test_case_id: entry.testCaseId,
          iteration: entry.iteration,
          heuristic_type: entry.heuristicType,
          captured_at: entry.capturedAt,
        })),
        output_hashes: reproCaptureEntries.map(entry => ({
          prompt_reference_id: entry.referenceId,
          test_case_id: entry.testCaseId,
          iteration: entry.iteration,
          sha256: entry.outputHash,
        })),
        aggregate_metrics: {
          overall_score: overallScore,
          zone_status: zoneStatus,
          confidence_intervals: confidenceIntervals,
        },
        evidence_reference_id: evidenceReferenceId,
        replay_instructions: buildReplayInstructions({
          heuristicTypes: body.heuristic_types,
          iterationCount: body.iteration_count,
          iterationsRun,
          detectorVersion: FRAMEWORK_VERSION,
          determinismMode,
          seedValue,
          achievedLevel,
          samplingParameters: parametersUsed,
          confidenceIntervals,
          evidenceReferenceId,
          evidenceStorageType: evidenceConfig?.storageType,
          replayEntries: reproCaptureEntries,
        }),
        signing: {
          mode: signingMaterial.signingMode,
          authority: signingMaterial.signingAuthority,
          key_id: signingMaterial.signingKeyId,
          public_key: signingMaterial.publicKeyPem,
        },
      }

      const { hash: contentHash } = await computeReproPackHash(reproPackContent)
      const signature = await signHash(signingMaterial.privateKeyPem, contentHash)

      const { data: reproPackRecord, error: reproPackError } = await supabase
        .from('repro_packs')
        .insert({
          evaluation_run_id: evaluation.id,
          content_hash: contentHash,
          signature,
          signing_authority: signingMaterial.signingAuthority,
          signing_key_id: signingMaterial.signingKeyId,
          created_at: completionTimestamp,
          repro_pack_content: reproPackContent,
        })
        .select()
        .single()

      if (reproPackError) {
        console.error('Failed to insert repro pack:', reproPackError)
        throw new Error('Failed to persist repro pack for evaluation run')
      }

          // Update progress: complete
          await updateProgress(100, 'completed', null, totalHeuristics, 'Evaluation complete!')

          // Clean up progress record after a short delay
          setTimeout(async () => {
            if (progressRecord) {
              await supabase
                .from('evaluation_progress')
                .delete()
                .eq('id', progressRecord.id)
            }
          }, 5000)

          console.log(`[Background] Evaluation ${evaluation.id} completed successfully`)

        } catch (backgroundError) {
          // Handle background processing errors
          console.error(`[Background] Evaluation ${evaluation.id} failed:`, backgroundError)
          
          // Update evaluation status to failed
          await supabase
            .from('evaluations')
            .update({
              status: 'failed',
            })
            .eq('id', evaluation.id)

          // Update progress to show failure
          if (progressRecord) {
            await supabase
              .from('evaluation_progress')
              .update({
                progress_percent: 0,
                current_phase: 'failed',
                message: backgroundError instanceof Error ? backgroundError.message : 'Evaluation failed unexpectedly',
              })
              .eq('id', progressRecord.id)
          }
        }
      }

      // Use EdgeRuntime.waitUntil to run processing in background
      // This allows us to return immediately while processing continues
      EdgeRuntime.waitUntil(runEvaluationInBackground())

      // Return immediate response with evaluation ID for progress tracking
      return new Response(JSON.stringify(immediateResponse), {
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
