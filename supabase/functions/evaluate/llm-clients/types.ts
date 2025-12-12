// LLM Client interfaces and types

export interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason?: string;
}

export interface LLMClient {
  provider: string;
  generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  testConnection(): Promise<boolean>;
}

export interface LLMClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string | null;
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
