export type SeedSupport = 'full' | 'partial' | 'none'
export type DecodingSupport = 'temperature-only' | 'top-p' | 'top-p-top-k'

export interface ProviderCapabilities {
  seedSupport: SeedSupport
  minTemperature: number
  decodingSupport: DecodingSupport
  guidance?: string
}

const MODEL_CAPABILITIES: Record<string, ProviderCapabilities> = {
  openai: {
    seedSupport: 'full',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Supports seeding and temperature down to 0. Top-k is not available.',
  },
  azure: {
    seedSupport: 'full',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Matches OpenAI seeding with top-p decoding only.',
  },
  anthropic: {
    seedSupport: 'partial',
    minTemperature: 0.01,
    decodingSupport: 'top-p',
    guidance: 'Seeds are best-effort; temperature floors around 0.01 with no top-k.',
  },
  google: {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p-top-k',
    guidance: 'Gemini models can honor seeds on some tiers and expose top-p/top-k controls.',
  },
  meta: {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p-top-k',
    guidance: 'Llama deployments typically allow seeds with full decoding controls.',
  },
  deepseek: {
    seedSupport: 'partial',
    minTemperature: 0.01,
    decodingSupport: 'top-p-top-k',
    guidance: 'Best-effort seeding; temperatures floor near 0.01 with full decoding controls.',
  },
  bedrock: {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Capabilities vary by foundation model; seeds are best-effort and top-k is limited.',
  },
  custom: {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Assumes OpenAI-compatible seed handling with top-p decoding.',
  },
}

export function getProviderCapabilities(provider: string): ProviderCapabilities {
  const normalized = provider.toLowerCase()
  return MODEL_CAPABILITIES[normalized] || {
    seedSupport: 'partial',
    minTemperature: 0,
    decodingSupport: 'top-p',
    guidance: 'Capabilities unknown; assuming partial seeding and top-p decoding.',
  }
}

interface AchievedLevelInput {
  capabilities: ProviderCapabilities
  deterministicEnabled: boolean
  requestedTemperature: number
  requestedTopK?: number
}

export function resolveAchievedLevel({
  capabilities,
  deterministicEnabled,
  requestedTemperature,
  requestedTopK,
}: AchievedLevelInput): string {
  if (!deterministicEnabled) return 'standard'
  if (capabilities.seedSupport === 'none') return 'standard:no_seed_support'

  const parts = [capabilities.seedSupport === 'full' ? 'seeded' : 'seeded_best_effort']

  if (requestedTemperature < capabilities.minTemperature) {
    parts.push(`temp_floor_${capabilities.minTemperature}`)
  }

  if (capabilities.decodingSupport === 'temperature-only') {
    parts.push('decoding_temperature_only')
  } else if (capabilities.decodingSupport === 'top-p' && requestedTopK) {
    parts.push('decoding_top_p_only')
  }

  return parts.join('|')
}
