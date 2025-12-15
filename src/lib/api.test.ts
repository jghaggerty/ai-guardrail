import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HeuristicType, SeverityLevel } from '@/types/bias';

// Create a chainable mock for Supabase query builder
const createChainableMock = () => {
  const chainable: any = {
    select: vi.fn(() => chainable),
    eq: vi.fn(() => chainable),
    not: vi.fn(() => chainable),
    order: vi.fn(() => chainable),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  return chainable;
};

// Mock the Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => createChainableMock()),
  },
}));

// Import after mocking
import { runFullEvaluation, checkAuth, ApiError } from './api';
import { supabase } from '@/integrations/supabase/client';

describe('API Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAuth', () => {
    it('returns true when session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      } as any);

      const result = await checkAuth();
      expect(result).toBe(true);
    });

    it('returns false when no session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      const result = await checkAuth();
      expect(result).toBe(false);
    });
  });

  describe('runFullEvaluation', () => {
    it('throws ApiError when not authenticated', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      await expect(
        runFullEvaluation({
          selectedHeuristics: ['anchoring'],
          iterations: 100,
          systemName: 'test-system',
        })
      ).rejects.toThrow(ApiError);
    });

    it('calls edge function with correct parameters', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token-123',
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      } as any);

      const mockResponse = {
        evaluation: {
          id: 'eval-123',
          ai_system_name: 'test-system',
          heuristic_types: ['anchoring', 'confirmation_bias'],
          iteration_count: 100,
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          overall_score: 75,
          zone_status: 'green',
        },
        findings: [
          {
            id: 'finding-1',
            evaluation_id: 'eval-123',
            heuristic_type: 'anchoring',
            severity: 'medium' as SeverityLevel,
            severity_score: 45,
            confidence_level: 0.85,
            detection_count: 12,
            example_instances: ['Example 1', 'Example 2'],
            pattern_description: 'Anchoring bias detected',
            created_at: new Date().toISOString(),
          },
        ],
        recommendations: [
          {
            id: 'rec-1',
            evaluation_id: 'eval-123',
            heuristic_type: 'anchoring',
            priority: 8,
            action_title: 'Implement multi-perspective prompting',
            technical_description: 'Technical details...',
            simplified_description: 'Simple description...',
            estimated_impact: 'high',
            implementation_difficulty: 'moderate',
            created_at: new Date().toISOString(),
          },
        ],
        trends: {
          data_points: [
            { timestamp: new Date().toISOString(), score: 75, zone: 'green' as const },
          ],
          current_zone: 'green' as const,
          drift_alert: false,
          drift_message: null,
        },
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      } as any);

      const result = await runFullEvaluation({
        selectedHeuristics: ['anchoring', 'confirmation_bias'] as HeuristicType[],
        iterations: 100,
        systemName: 'test-system',
      });

      // Verify the edge function was called with correct body
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'evaluate',
        {
          body: expect.objectContaining({
            ai_system_name: 'test-system',
            heuristic_types: ['anchoring', 'confirmation_bias'],
            iteration_count: 100,
            deterministic: expect.objectContaining({
              enabled: false,
              level: 'adaptive',
              adaptive_iterations: true,
              allow_nondeterministic_fallback: true,
            })
          }),
        }
      );

      // Verify the response is transformed correctly
      expect(result.id).toBe('eval-123');
      expect(result.status).toBe('completed');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].type).toBe('anchoring');
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].priority).toBe('high'); // 8 maps to 'high'
    });

    it('handles edge function errors', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      } as any);

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      } as any);

      await expect(
        runFullEvaluation({
          selectedHeuristics: ['anchoring'],
          iterations: 100,
          systemName: 'test-system',
        })
      ).rejects.toThrow('Edge function error');
    });
  });
});

describe('Type Mappings', () => {
  it('all HeuristicType values are valid', () => {
    const validTypes: HeuristicType[] = [
      'anchoring',
      'loss_aversion',
      'confirmation_bias',
      'sunk_cost',
      'availability_heuristic',
    ];

    validTypes.forEach((type) => {
      expect(type).toBeDefined();
    });
  });

  it('all SeverityLevel values are valid', () => {
    const validLevels: SeverityLevel[] = ['low', 'medium', 'high', 'critical'];

    validLevels.forEach((level) => {
      expect(level).toBeDefined();
    });
  });
});
