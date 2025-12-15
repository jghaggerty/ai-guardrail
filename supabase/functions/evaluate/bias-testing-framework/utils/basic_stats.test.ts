import {
  mean,
  variance,
  standardDeviation,
  confidenceInterval95,
  coefficientOfVariation,
} from './basic_stats.ts'

Deno.test('mean and variance calculations', () => {
  const values = [2, 4, 6, 8]
  if (mean(values) !== 5) throw new Error('Mean should be 5')

  const computedVariance = variance(values)
  if (Math.abs(computedVariance - 6.6667) > 0.0001) {
    throw new Error(`Variance expected ~6.6667, received ${computedVariance}`)
  }
})

Deno.test('standard deviation uses sample variance', () => {
  const values = [10, 10, 10, 10]
  if (standardDeviation(values) !== 0) {
    throw new Error('Standard deviation should be 0 for constant series')
  }
})

Deno.test('confidence interval shrinks as sample grows', () => {
  const smallSample = [10, 12, 14]
  const largerSample = [10, 12, 14, 16, 18]

  const smallCi = confidenceInterval95(smallSample)
  const largeCi = confidenceInterval95(largerSample)

  const smallWidth = smallCi[1] - smallCi[0]
  const largeWidth = largeCi[1] - largeCi[0]

  if (largeWidth >= smallWidth) {
    throw new Error('CI width should shrink with more observations')
  }
})

Deno.test('coefficient of variation handles zeros', () => {
  if (coefficientOfVariation([]) !== 0) {
    throw new Error('CV for empty array should be 0')
  }

  const cv = coefficientOfVariation([1, 1, 1, 1])
  if (cv !== 0) {
    throw new Error('CV should be 0 for identical values')
  }
})
