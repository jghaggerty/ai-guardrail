import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { EvaluationRun, HeuristicFinding, Recommendation } from '@/types/bias'
import Index from './Index'

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { email: 'tester@example.com' } }),
}))

vi.mock('@/hooks/useEvaluationProgress', () => ({
  useEvaluationProgress: () => ({
    progressPercent: 0,
    message: '',
    phaseLabel: '',
    currentHeuristic: null,
    testsCompleted: 0,
    testsTotal: 0,
    resetProgress: vi.fn(),
    isSubscribed: false,
  }),
}))

vi.mock('@/components/ConfigurationPanel', () => ({ ConfigurationPanel: () => null }))
vi.mock('@/components/HeuristicCard', () => ({ HeuristicCard: () => <div data-testid="heuristic-card" /> }))
vi.mock('@/components/LongitudinalChart', () => ({ LongitudinalChart: () => <div data-testid="chart" /> }))
vi.mock('@/components/RecommendationsList', () => ({ RecommendationsList: () => <div data-testid="recommendations" /> }))
vi.mock('@/components/FindingDetailsDialog', () => ({ FindingDetailsDialog: () => null }))
vi.mock('@/components/HistoryPanel', () => ({ HistoryPanel: () => <div data-testid="history" /> }))
vi.mock('@/components/ReproPackMetadata', () => ({ ReproPackMetadata: () => <div data-testid="repro" /> }))
vi.mock('@/lib/api', () => ({
  runFullEvaluation: vi.fn(),
  ApiError: class extends Error {},
  fetchReproPack: vi.fn(),
  verifyReproPackSignature: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))
vi.mock('lucide-react', () => {
  const Icon = () => <span />
  return { Brain: Icon, Download: Icon, ToggleLeft: Icon, TrendingDown: Icon, Activity: Icon, LogOut: Icon, RotateCcw: Icon, History: Icon, X: Icon, Copy: Icon, Check: Icon, Info: Icon, Database: Icon }
})

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/card', () => ({ Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button> }))
vi.mock('@/components/ui/progress', () => ({ Progress: () => <div data-testid="progress" /> }))

const baseFinding: HeuristicFinding = {
  id: 'finding-1',
  type: 'anchoring',
  name: 'Anchoring Bias',
  severity: 'medium',
  confidence: 82,
  description: 'Example finding',
  examples: ['Example'],
  impact: 'Moderate',
  detectedAt: new Date(),
}

const recommendation: Recommendation = {
  id: 'rec-1',
  priority: 'high',
  title: 'Reduce bias',
  description: 'Example recommendation',
  action: 'Take action',
  estimatedImpact: 'High',
  implementationComplexity: 'low',
  relatedHeuristic: 'anchoring',
}

const buildRun = (overrides: Partial<EvaluationRun> = {}): EvaluationRun => ({
  id: 'run-1',
  status: 'completed',
  progress: 100,
  overallScore: 87.4,
  timestamp: new Date(),
  config: {
    selectedHeuristics: ['anchoring'],
    iterations: 5,
    systemName: 'Test system',
    deterministic: {
      enabled: true,
      level: 'full',
      adaptiveIterations: false,
      fixedIterations: 5,
    },
  },
  findings: [baseFinding],
  recommendations: [recommendation],
  baselineComparison: [{ timestamp: new Date(), score: 75, zone: 'green' }],
  ...overrides,
})

describe('Index determinism display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders deterministic badge and CI summary for full mode', () => {
    const run = buildRun({
      determinismMode: 'full deterministic',
      confidenceIntervals: { overall_score: [0.72, 0.88] },
      iterationsRun: 5,
      seedValue: 7,
    })

    render(<Index initialEvaluationRun={run} />)

    expect(screen.getByText('Deterministic')).toBeInTheDocument()
    expect(screen.getByText('CI: 0.7–0.9')).toBeInTheDocument()
    expect(screen.getByText(/Iterations: 5/)).toBeInTheDocument()
  })

  it('renders near-deterministic badge when downgraded', () => {
    const run = buildRun({
      determinismMode: 'near deterministic',
      confidenceIntervals: { overall_score: [0.61, 0.66] },
      iterationsRun: 12,
    })

    render(<Index initialEvaluationRun={run} />)

    expect(screen.getByText('Near-Deterministic')).toBeInTheDocument()
    expect(screen.getByText(/CI: 0.6/)).toBeInTheDocument()
    expect(screen.getByText(/Iterations: 12/)).toBeInTheDocument()
  })
})
