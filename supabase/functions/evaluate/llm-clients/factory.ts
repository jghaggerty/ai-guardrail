import { LLMClient, LLMClientConfig, LLMError } from './types.ts';
import { OpenAIClient } from './openai.ts';
import { AnthropicClient } from './anthropic.ts';
import { GoogleClient } from './google.ts';

export type SupportedProvider = 'OpenAI' | 'Anthropic' | 'Google' | 'Azure' | 'AWS Bedrock' | 'Custom';

// Create the appropriate LLM client based on provider
export function createLLMClient(
  provider: string,
  apiKey: string,
  model: string,
  baseUrl?: string | null
): LLMClient {
  const config: LLMClientConfig = {
    apiKey,
    model,
    baseUrl,
  };

  switch (provider) {
    case 'OpenAI':
      return new OpenAIClient(config);
    
    case 'Anthropic':
      return new AnthropicClient(config);
    
    case 'Google':
      return new GoogleClient(config);
    
    case 'Azure':
      // Azure uses OpenAI-compatible API with different base URL
      if (!baseUrl) {
        throw new LLMError('Azure requires a custom base URL', undefined, false);
      }
      return new OpenAIClient({ ...config, baseUrl });
    
    case 'AWS Bedrock':
      // For AWS Bedrock, we'd need AWS SDK integration
      // For now, throw an error indicating it's not yet supported
      throw new LLMError(
        'AWS Bedrock integration requires AWS SDK. Please use a custom endpoint.',
        undefined,
        false
      );
    
    case 'Custom':
      // Custom providers use OpenAI-compatible API format
      if (!baseUrl) {
        throw new LLMError('Custom provider requires a base URL', undefined, false);
      }
      return new OpenAIClient({ ...config, baseUrl });
    
    default:
      throw new LLMError(`Unsupported provider: ${provider}`, undefined, false);
  }
}

// Get provider-specific default model
export function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    'OpenAI': 'gpt-4',
    'Anthropic': 'claude-3-sonnet-20240229',
    'Google': 'gemini-pro',
    'Azure': 'gpt-4',
    'Custom': 'gpt-4',
  };
  return defaults[provider] || 'gpt-4';
}

// Validate provider is supported
export function isProviderSupported(provider: string): boolean {
  const supported = ['OpenAI', 'Anthropic', 'Google', 'Azure', 'Custom'];
  return supported.includes(provider);
}
