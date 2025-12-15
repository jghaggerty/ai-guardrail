import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getProviderCapabilities,
  logDeterminismFallback,
  resolveLLMOptions,
  type DeterminismMetadata,
} from './types.ts'

describe('LLM option resolution', () => {
  const defaults = { model: 'demo-model', maxTokens: 256, timeout: 1000 }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clamps unsupported parameters and records fallbacks', () => {
    const anthropicCaps = getProviderCapabilities('Anthropic')
    const resolved = resolveLLMOptions(anthropicCaps, {
      determinismMode: 'full',
      seed: 123,
      temperature: -1,
      topP: -0.5,
    }, defaults)

    expect(resolved.seed).toBeUndefined()
    expect(resolved.temperature).toBe(0)
    expect(resolved.topP).toBe(0)
    expect(resolved.determinismMetadata.achievedLevel).toBe('near')
    expect(resolved.determinismMetadata.fallbackReasons).toContain('Seed is not supported by this provider')
  })

  it('applies provider minimums for topK and keeps determinism disabled when requested', () => {
    const googleCaps = getProviderCapabilities('Google')
    const resolved = resolveLLMOptions(googleCaps, {
      determinismMode: 'disabled',
      topK: 0,
      temperature: 0.4,
    }, defaults)

    expect(resolved.topK).toBe(1)
    expect(resolved.temperature).toBe(0.4)
    expect(resolved.determinismMetadata.achievedLevel).toBe('disabled')
    expect(resolved.determinismMetadata.fallbackReasons).toBeUndefined()
  })

  it('logs deterministic downgrades with applied parameters', () => {
    const logger = vi.spyOn(console, 'log').mockImplementation(() => {})
    const metadata: DeterminismMetadata = {
      requestedMode: 'full',
      achievedLevel: 'near',
      providerCapabilities: getProviderCapabilities('Meta'),
      fallbackReasons: ['Seed is not supported by this provider'],
      appliedParameters: { seed: undefined, topK: 1 },
    }

    logDeterminismFallback(metadata)
    expect(logger).toHaveBeenCalled()

    logger.mockRestore()
  })
})
