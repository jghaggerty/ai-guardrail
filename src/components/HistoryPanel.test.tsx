import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HistoryPanel } from './HistoryPanel';
import { fetchHistoricalEvaluations, loadEvaluationDetails, HistoricalEvaluation } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/api', () => ({
  fetchHistoricalEvaluations: vi.fn(),
  loadEvaluationDetails: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('HistoryPanel', () => {
  const mockOnLoadEvaluation = vi.fn();

  const mockEvaluations: HistoricalEvaluation[] = [
    {
      id: 'eval-1',
      aiSystemName: 'Test System',
      createdAt: '2024-01-01T00:00:00Z',
      completedAt: '2024-01-01T00:05:00Z',
      overallScore: 75.5,
      zoneStatus: 'green',
      status: 'completed',
      heuristicTypes: ['anchoring', 'confirmation_bias'],
      iterationCount: 10,
    },
    {
      id: 'eval-2',
      aiSystemName: 'Test System 2',
      createdAt: '2024-01-02T00:00:00Z',
      completedAt: '2024-01-02T00:05:00Z',
      overallScore: 82.3,
      zoneStatus: 'yellow',
      status: 'completed',
      heuristicTypes: ['loss_aversion'],
      iterationCount: 5,
      evidenceReferenceId: 'ref-id-123',
      evidenceStorageType: 's3',
    },
    {
      id: 'eval-3',
      aiSystemName: 'Test System 3',
      createdAt: '2024-01-03T00:00:00Z',
      completedAt: '2024-01-03T00:05:00Z',
      overallScore: 90.0,
      zoneStatus: 'red',
      status: 'completed',
      heuristicTypes: ['sunk_cost'],
      iterationCount: 15,
      evidenceReferenceId: 'ref-id-456',
      evidenceStorageType: 'splunk',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchHistoricalEvaluations).mockResolvedValue(mockEvaluations);
  });

  describe('Reference ID Indicator Display', () => {
    it('does not display reference ID indicator when not present', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('Test System')).toBeInTheDocument();
      });

      // First evaluation doesn't have reference ID
      const firstEval = screen.getByText('Test System').closest('div');
      expect(firstEval).not.toHaveTextContent(/REF|S3|Splunk|ELK/i);
    });

    it('displays reference ID indicator with storage type when present', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('Test System 2')).toBeInTheDocument();
      });

      // Second evaluation has S3 reference
      expect(screen.getByText('S3')).toBeInTheDocument();
    });

    it('displays correct storage type labels for different storage types', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('Splunk')).toBeInTheDocument();
      });

      // Should show both S3 and Splunk
      expect(screen.getByText('S3')).toBeInTheDocument();
      expect(screen.getByText('Splunk')).toBeInTheDocument();
    });

    it('displays REF badge when storage type is not provided but reference ID exists', async () => {
      const evalWithRefOnly: HistoricalEvaluation[] = [
        {
          ...mockEvaluations[0],
          evidenceReferenceId: 'ref-id-only',
          evidenceStorageType: undefined,
        },
      ];

      vi.mocked(fetchHistoricalEvaluations).mockResolvedValueOnce(evalWithRefOnly);

      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('REF')).toBeInTheDocument();
      });
    });
  });

  describe('Reference ID Indicator Tooltip', () => {
    it('has tooltip trigger for evidence reference badge', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('S3')).toBeInTheDocument();
      });

      // The S3 badge should be wrapped in a tooltip trigger
      const s3Badge = screen.getByText('S3');
      expect(s3Badge).toBeInTheDocument();
      // Verify the badge has cursor-help class indicating it's a tooltip trigger
      expect(s3Badge.closest('[class*="cursor-help"]')).toBeInTheDocument();
    });

    it('evidence reference badge contains database icon', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('S3')).toBeInTheDocument();
      });

      // The badge should contain the Database icon
      const s3Badge = screen.getByText('S3');
      const badgeContainer = s3Badge.closest('div');
      expect(badgeContainer?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    it('renders historical evaluations list', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('Test System')).toBeInTheDocument();
        expect(screen.getByText('Test System 2')).toBeInTheDocument();
        expect(screen.getByText('Test System 3')).toBeInTheDocument();
      });
    });

    it('displays evaluation scores correctly', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText(/Score: 75.5/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 82.3/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 90.0/)).toBeInTheDocument();
      });
    });

    it('displays zone status badges correctly', async () => {
      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('green')).toBeInTheDocument();
        expect(screen.getByText('yellow')).toBeInTheDocument();
        expect(screen.getByText('red')).toBeInTheDocument();
      });
    });
  });

  describe('Loading Evaluation with Reference ID', () => {
    it('loads evaluation details when view button is clicked', async () => {
      const mockEvaluationRun = {
        id: 'eval-2',
        config: { selectedHeuristics: [], iterations: 5, systemName: 'Test System 2' },
        status: 'completed' as const,
        progress: 100,
        findings: [],
        recommendations: [],
        timestamp: new Date(),
        overallScore: 82.3,
        baselineComparison: [],
        evidenceReferenceId: 'ref-id-123',
        evidenceStorageType: 's3' as const,
      };

      vi.mocked(loadEvaluationDetails).mockResolvedValueOnce(mockEvaluationRun);

      render(<HistoryPanel onLoadEvaluation={mockOnLoadEvaluation} />);

      await waitFor(() => {
        expect(screen.getByText('Test System 2')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByText('View');
      fireEvent.click(viewButtons[1]); // Click the second "View" button

      await waitFor(() => {
        expect(loadEvaluationDetails).toHaveBeenCalledWith('eval-2');
        expect(mockOnLoadEvaluation).toHaveBeenCalledWith(mockEvaluationRun);
      });
    });
  });
});
