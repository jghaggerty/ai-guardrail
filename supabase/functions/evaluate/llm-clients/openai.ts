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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export class OpenAIClient implements LLMClient {
  provider: string;
  providerCapabilities = getProviderCapabilities('OpenAI');
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider || 'OpenAI';
    this.providerCapabilities = getProviderCapabilities(this.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const resolved = resolveLLMOptions(this.providerCapabilities, options, {
      model: this.model,
      maxTokens: 1024,
      temperature: 0.7,
      timeout: 60000,
    });

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
          seed: resolved.seed,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `OpenAI API error: ${response.status}`;
        
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
        throw new LLMError('No content in OpenAI response', undefined, false);
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
      
      throw new LLMError(`OpenAI request failed: ${err.message || 'Unknown error'}`, undefined, true);
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
