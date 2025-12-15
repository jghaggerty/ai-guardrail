export type SeedSupport = 'full' | 'partial' | 'none';
export type DecodingSupport = 'temperature-only' | 'top-p' | 'top-p-top-k';

export interface ProviderCapabilities {
  seedSupport: SeedSupport;
  minTemperature: number;
  decodingSupport: DecodingSupport;
  guidance?: string;
}

const MODEL_CAPABILITIES: Record<string, ProviderCapabilities> = {
  'OpenAI': {
    seedSupport: 'full',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Supports seeds and temperature down to 0. Top-k is not available.',
  },
  'Anthropic': {
    seedSupport: 'partial',
    minTemperature: 0.01,
    decodingSupport: 'top-p',
    guidance: 'Best-effort seeding; temperature floors at 0.01. Top-k is not available.',
  },
  'Google': {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p-top-k',
    guidance: 'Gemini models accept seeds on some tiers and support both top-p and top-k.',
  },
  'Meta': {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p-top-k',
    guidance: 'Llama models accept seeds in most deployments and expose full decoding controls.',
  },
  'DeepSeek': {
    seedSupport: 'partial',
    minTemperature: 0.01,
    decodingSupport: 'top-p-top-k',
    guidance: 'Seeding is best-effort; temperature bottoms out near 0.01 with full decoding controls.',
  },
  'Azure': {
    seedSupport: 'full',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Azure OpenAI mirrors OpenAI seeding with top-p decoding only.',
  },
  'AWS Bedrock': {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Capabilities vary by foundation model; seeds are best-effort and top-k is limited.',
  },
  'Custom': {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Assumes OpenAI-compatible seeding and top-p decoding; confirm with your provider.',
  },
};

export function getProviderCapabilities(provider: string): ProviderCapabilities {
  return MODEL_CAPABILITIES[provider] || {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Capabilities unknown; assuming partial seeding and top-p decoding.',
  };
}

export function describeDecodingSupport(decoding: DecodingSupport): string {
  switch (decoding) {
    case 'top-p-top-k':
      return 'Supports both top-p and top-k controls.';
    case 'top-p':
      return 'Supports temperature and top-p; top-k is not available.';
    case 'temperature-only':
    default:
      return 'Only temperature is available; top-p/top-k are ignored.';
  }
}
