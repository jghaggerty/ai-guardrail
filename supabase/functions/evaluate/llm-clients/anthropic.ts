import { LLMClient, LLMClientConfig, LLMOptions, LLMResponse, LLMError } from './types.ts';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

export class AnthropicClient implements LLMClient {
  provider = 'Anthropic';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  async generateCompletion(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model || this.model;
    const maxTokens = options?.maxTokens || 1024;
    const temperature = options?.temperature ?? 0.7;
    const timeout = options?.timeout || 60000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Anthropic API error: ${response.status}`;
        
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
      const content = data.content?.[0];

      if (!content?.text) {
        throw new LLMError('No content in Anthropic response', undefined, false);
      }

      return {
        content: content.text,
        tokensUsed: data.usage ? {
          prompt: data.usage.input_tokens,
          completion: data.usage.output_tokens,
          total: data.usage.input_tokens + data.usage.output_tokens,
        } : undefined,
        finishReason: data.stop_reason,
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
      
      throw new LLMError(`Anthropic request failed: ${err.message || 'Unknown error'}`, undefined, true);
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
