import { describe, expect, it } from 'vitest'
import {
  calculateConfidenceInterval95,
  calculateConsistency,
  calculateVariance,
} from '../../supabase/functions/evaluate/bias-testing-framework/utils/statistics.ts'

describe('statistics helpers', () => {
  it('handles tiny sample sizes with stable intervals', () => {
    expect(calculateConfidenceInterval95([])).toEqual([0, 0])
    expect(calculateConfidenceInterval95([4])).toEqual([4, 4])

    const pairInterval = calculateConfidenceInterval95([2, 6])
    expect(pairInterval[0]).toBeLessThan(2)
    expect(pairInterval[1]).toBeGreaterThan(6)
  })

  it('uses asymptotic critical values as iterations grow', () => {
    const smallSample = Array.from({ length: 5 }, (_, idx) => idx + 1)
    const largeSample = Array.from({ length: 120 }, (_, idx) => idx % 10)

    const smallCiWidth = calculateConfidenceInterval95(smallSample)[1] - calculateConfidenceInterval95(smallSample)[0]
    const largeCiWidth = calculateConfidenceInterval95(largeSample)[1] - calculateConfidenceInterval95(largeSample)[0]

    expect(largeCiWidth).toBeLessThan(smallCiWidth)
    expect(largeCiWidth).toBeLessThan(2)
  })

  it('computes consistency using variance safeguards', () => {
    expect(calculateConsistency([5, 5, 5])).toBe('high')

    const noisyValues = [10, 1, 9, 2, 11, 3]
    expect(calculateVariance(noisyValues)).toBeGreaterThan(0)
    expect(calculateConsistency(noisyValues)).toBe('low')
  })
})
