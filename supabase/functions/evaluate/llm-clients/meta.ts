import {
  LLMClient,
  LLMClientConfig,
  LLMOptions,
  LLMResponse,
  LLMError,
  getProviderCapabilities,
  resolveLLMOptions,
  logDeterminismFallback,
} from './types.ts';

// Default to Together AI as the inference provider for Llama models
const DEFAULT_BASE_URL = 'https://api.together.xyz/v1';

export class MetaClient implements LLMClient {
  provider: string;
  providerCapabilities = getProviderCapabilities('Meta');
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider || 'Meta';
    this.providerCapabilities = getProviderCapabilities(this.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  private getModelEndpoint(model: string): string {
    // Map common model names to API model names for various providers
    const modelMap: Record<string, string> = {
      // Llama 3.1 models
      'llama-3.1-8b': 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'llama-3.1-70b': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      'llama-3.1-405b': 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
      // Llama 4 Scout models
      'llama-4-scout': 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'llama-4-maverick': 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      // Legacy Llama 3 models
      'llama-3': 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
      'llama-3-8b': 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
      'llama-3-70b': 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo',
    };
    return modelMap[model] || model;
  }

  async generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const resolved = resolveLLMOptions(this.providerCapabilities, options, {
      model: this.getModelEndpoint(this.model),
      maxTokens: 1024,
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      timeout: 60000,
    });

    resolved.model = this.getModelEndpoint(resolved.model);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolved.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolved.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: resolved.maxTokens,
          temperature: resolved.temperature,
          top_p: resolved.topP,
          top_k: resolved.topK,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Meta/Llama API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          // Use default error message
        }

        const isRetryable = response.status === 429 || response.status >= 500;
        const rateLimitInfo = response.status === 429 ? {
          retryAfter: parseInt(response.headers.get('retry-after') || '60', 10),
        } : undefined;

        throw new LLMError(errorMessage, response.status, isRetryable, rateLimitInfo);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice?.message?.content) {
        throw new LLMError('No content in Meta/Llama response', undefined, false);
      }

      if (resolved.determinismMetadata.fallbackReasons?.length) {
        logDeterminismFallback(resolved.determinismMetadata);
      }

      return {
        content: choice.message.content,
        tokensUsed: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined,
        finishReason: choice.finish_reason,
        metadata: { determinism: resolved.determinismMetadata },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new LLMError('Request timeout', undefined, true);
      }

      throw new LLMError(`Meta/Llama request failed: ${err.message || 'Unknown error'}`, undefined, true);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.generateCompletion('Reply with exactly: OK', {
        maxTokens: 10,
        temperature: 0,
      });
      return true;
    } catch {
      return false;
    }
  }
}
