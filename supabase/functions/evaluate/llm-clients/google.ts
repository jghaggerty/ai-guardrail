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

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GoogleClient implements LLMClient {
  provider: string;
  providerCapabilities = getProviderCapabilities('Google');
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMClientConfig) {
    this.provider = config.provider || 'Google';
    this.providerCapabilities = getProviderCapabilities(this.provider);
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  private getModelEndpoint(model: string): string {
    // Map common model names to API model names
    const modelMap: Record<string, string> = {
      'gemini-pro': 'gemini-pro',
      'gemini-ultra': 'gemini-ultra',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-2.5-pro': 'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
      'palm-2': 'text-bison-001',
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

    // Ensure model mapping still honors overrides
    resolved.model = this.getModelEndpoint(resolved.model);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolved.timeout);

    try {
      const url = `${this.baseUrl}/models/${resolved.model}:generateContent?key=${this.apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: resolved.maxTokens,
            temperature: resolved.temperature,
            topP: resolved.topP,
            topK: resolved.topK,
            seed: resolved.seed,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Google AI API error: ${response.status}`;
        
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
      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text;

      if (!content) {
        // Check for safety blocking
        if (candidate?.finishReason === 'SAFETY') {
          throw new LLMError('Response blocked by safety filters', undefined, false);
        }
        throw new LLMError('No content in Google AI response', undefined, false);
      }

      if (resolved.determinismMetadata.fallbackReasons?.length) {
        logDeterminismFallback(resolved.determinismMetadata);
      }

      return {
        content,
        tokensUsed: data.usageMetadata ? {
          prompt: data.usageMetadata.promptTokenCount || 0,
          completion: data.usageMetadata.candidatesTokenCount || 0,
          total: data.usageMetadata.totalTokenCount || 0,
        } : undefined,
        finishReason: candidate?.finishReason,
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
      
      throw new LLMError(`Google AI request failed: ${err.message || 'Unknown error'}`, undefined, true);
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
