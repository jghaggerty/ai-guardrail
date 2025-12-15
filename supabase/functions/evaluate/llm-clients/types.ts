// LLM Client interfaces and types

export type DeterminismMode = 'full' | 'near' | 'disabled';

export interface LLMProviderCapabilities {
  provider: string;
  supportsSeed: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsTopK: boolean;
  minTemperature?: number;
  minTopP?: number;
  minTopK?: number;
}

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  determinismMode?: DeterminismMode;
  achievedLevel?: DeterminismMode;
  providerCapabilities?: LLMProviderCapabilities;
  model?: string;
  timeout?: number;
}

export interface DeterminismMetadata {
  requestedMode: DeterminismMode;
  achievedLevel: DeterminismMode;
  providerCapabilities: LLMProviderCapabilities;
  appliedParameters: {
    seed?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
  };
  fallbackReasons?: string[];
}

export interface LLMResponseMetadata {
  determinism: DeterminismMetadata;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
  metadata?: LLMResponseMetadata;
}

export interface LLMClient {
  provider: string;
  providerCapabilities: LLMProviderCapabilities;
  generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  testConnection(): Promise<boolean>;
}

export interface LLMClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string | null;
  provider?: string;
}

// Rate limit handling
export interface RateLimitInfo {
  retryAfter?: number;
  remaining?: number;
  reset?: number;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isRetryable: boolean = false,
    public readonly rateLimitInfo?: RateLimitInfo
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// Retry configuration
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

// Helper for exponential backoff with jitter
export async function withRetry<T>(
  fn: () => Promise<T>,
  config = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof LLMError) {
        // Don't retry non-retryable errors
        if (!error.isRetryable) {
          throw error;
        }
        
        // Use rate limit retry-after if available
        if (error.rateLimitInfo?.retryAfter) {
          const delay = error.rateLimitInfo.retryAfter * 1000;
          console.log(`Rate limited. Waiting ${delay}ms before retry...`);
          await sleep(Math.min(delay, config.maxDelayMs));
          continue;
        }
      }
      
      if (attempt < config.maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
          config.maxDelayMs
        );
        console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getProviderCapabilities(provider: string): LLMProviderCapabilities {
  switch (provider) {
    case 'OpenAI':
    case 'Azure':
    case 'Custom':
      return {
        provider,
        supportsSeed: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        minTemperature: 0,
        minTopP: 0,
      };
    case 'Anthropic':
      return {
        provider,
        supportsSeed: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        minTemperature: 0,
        minTopP: 0,
      };
    case 'Google':
      return {
        provider,
        supportsSeed: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        minTemperature: 0,
        minTopP: 0,
        minTopK: 1,
      };
    case 'Meta':
      return {
        provider,
        supportsSeed: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        minTemperature: 0,
        minTopP: 0,
        minTopK: 1,
      };
    case 'DeepSeek':
      return {
        provider,
        supportsSeed: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        minTemperature: 0,
        minTopP: 0,
      };
    case 'AWS Bedrock':
      return {
        provider,
        supportsSeed: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        minTemperature: 0,
        minTopP: 0,
        minTopK: 1,
      };
    default:
      return {
        provider,
        supportsSeed: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        minTemperature: 0,
        minTopP: 0,
      };
  }
}

export interface ResolvedLLMOptions {
  model: string;
  maxTokens: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  seed?: number;
  timeout: number;
  determinismMetadata: DeterminismMetadata;
}

export function resolveLLMOptions(
  capabilities: LLMProviderCapabilities,
  options: LLMOptions | undefined,
  defaults: Partial<ResolvedLLMOptions>
): ResolvedLLMOptions {
  const requestedMode: DeterminismMode = options?.determinismMode || 'disabled';
  const fallbackReasons: string[] = [];

  const resolved: ResolvedLLMOptions = {
    model: options?.model || defaults.model || '',
    maxTokens: options?.maxTokens ?? defaults.maxTokens ?? 1024,
    temperature: options?.temperature ?? defaults.temperature,
    topP: options?.topP ?? defaults.topP,
    topK: options?.topK ?? defaults.topK,
    seed: options?.seed ?? defaults.seed,
    timeout: options?.timeout ?? defaults.timeout ?? 60000,
    determinismMetadata: {
      requestedMode,
      achievedLevel: requestedMode,
      providerCapabilities: capabilities,
      appliedParameters: {},
    },
  };

  if (!capabilities.supportsSeed && (options?.seed !== undefined || requestedMode === 'full')) {
    fallbackReasons.push('Seed is not supported by this provider');
    resolved.seed = undefined;
  } else if (capabilities.supportsSeed && requestedMode === 'full') {
    resolved.seed = resolved.seed ?? 0;
  }

  if (!capabilities.supportsTemperature) {
    if (options?.temperature !== undefined || requestedMode === 'full') {
      fallbackReasons.push('Temperature control is not supported by this provider');
    }
    resolved.temperature = undefined;
  } else if (requestedMode === 'full') {
    const minTemp = capabilities.minTemperature ?? 0;
    resolved.temperature = Math.max(minTemp, 0);
  } else if (resolved.temperature !== undefined && capabilities.minTemperature !== undefined) {
    resolved.temperature = Math.max(resolved.temperature, capabilities.minTemperature);
  }

  if (!capabilities.supportsTopP) {
    if (options?.topP !== undefined || requestedMode === 'full') {
      fallbackReasons.push('top_p is not supported by this provider');
    }
    resolved.topP = undefined;
  } else if (requestedMode === 'full') {
    const minTopP = capabilities.minTopP ?? 0;
    resolved.topP = Math.max(minTopP, 0);
  } else if (resolved.topP !== undefined && capabilities.minTopP !== undefined) {
    resolved.topP = Math.max(resolved.topP, capabilities.minTopP);
  }

  if (!capabilities.supportsTopK) {
    if (options?.topK !== undefined || requestedMode === 'full') {
      fallbackReasons.push('top_k is not supported by this provider');
    }
    resolved.topK = undefined;
  } else if (requestedMode === 'full') {
    const minTopK = capabilities.minTopK ?? 1;
    resolved.topK = Math.max(minTopK, 1);
  } else if (resolved.topK !== undefined && capabilities.minTopK !== undefined) {
    resolved.topK = Math.max(resolved.topK, capabilities.minTopK);
  }

  if (fallbackReasons.length && requestedMode !== 'disabled') {
    resolved.determinismMetadata.achievedLevel = 'near';
  }

  resolved.determinismMetadata.appliedParameters = {
    seed: resolved.seed,
    temperature: resolved.temperature,
    topP: resolved.topP,
    topK: resolved.topK,
  };

  if (fallbackReasons.length) {
    resolved.determinismMetadata.fallbackReasons = fallbackReasons;
  }

  if (requestedMode === 'disabled' && !fallbackReasons.length) {
    resolved.determinismMetadata.achievedLevel = 'disabled';
  }

  return resolved;
}

export function logDeterminismFallback(metadata: DeterminismMetadata): void {
  if (metadata.fallbackReasons?.length) {
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Determinism request downgraded',
        achievedLevel: metadata.achievedLevel,
        requestedMode: metadata.requestedMode,
        fallbackReasons: metadata.fallbackReasons,
        provider: metadata.providerCapabilities.provider,
        appliedParameters: metadata.appliedParameters,
      })
    );
  }
}
