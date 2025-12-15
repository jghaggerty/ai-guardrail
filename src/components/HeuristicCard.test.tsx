import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HeuristicCard } from './HeuristicCard';
import { HeuristicFinding, EvidenceStorageType } from '@/types/bias';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('HeuristicCard', () => {
  const mockFinding: HeuristicFinding = {
    id: 'finding-1',
    type: 'anchoring',
    name: 'Anchoring Bias',
    severity: 'high',
    confidence: 85,
    description: 'Test description',
    examples: ['Example 1', 'Example 2'],
    impact: 'High impact on decision making',
    detectedAt: new Date('2024-01-01'),
  };

  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reference ID Display', () => {
    it('does not display reference ID when not provided', () => {
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.queryByText(/REF|S3|Splunk|ELK/i)).not.toBeInTheDocument();
    });

    it('displays reference ID badge when provided', () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
        />
      );

      expect(screen.getByText('REF')).toBeInTheDocument();
    });

    it('displays storage type badge when storage type is provided', () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      expect(screen.getByText('S3')).toBeInTheDocument();
    });

    it('displays correct storage type labels', () => {
      const referenceId = 'test-reference-id-123';
      const storageTypes: EvidenceStorageType[] = ['s3', 'splunk', 'elk'];

      storageTypes.forEach((storageType) => {
        const { unmount } = render(
          <HeuristicCard
            finding={mockFinding}
            onViewDetails={mockOnViewDetails}
            evidenceReferenceId={referenceId}
            evidenceStorageType={storageType}
          />
        );

        const expectedLabel = storageType === 's3' ? 'S3' : storageType === 'splunk' ? 'Splunk' : 'ELK';
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Copy Reference ID Functionality', () => {
    it('copies reference ID when badge is clicked', async () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      const badge = screen.getByText('S3');
      fireEvent.click(badge);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(referenceId);
        expect(toast.success).toHaveBeenCalledWith('Reference ID copied to clipboard');
      });
    });

    it('copies reference ID when copy button is clicked', async () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      // Find the copy button by looking for the button with the copy icon (svg with lucide-copy class)
      const copyButton = document.querySelector('button svg.lucide-copy')?.closest('button');
      expect(copyButton).not.toBeNull();
      fireEvent.click(copyButton!);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(referenceId);
        expect(toast.success).toHaveBeenCalledWith('Reference ID copied to clipboard');
      });
    });

    it('shows error toast when clipboard write fails', async () => {
      const referenceId = 'test-reference-id-123';
      const clipboardError = new Error('Clipboard write failed');
      vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(clipboardError);

      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      const badge = screen.getByText('S3');
      fireEvent.click(badge);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to copy reference ID');
      });
    });

    it('shows check icon after successful copy', async () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      // Find the copy button by looking for the button with the copy icon
      const copyButton = document.querySelector('button svg.lucide-copy')?.closest('button');
      expect(copyButton).not.toBeNull();
      fireEvent.click(copyButton!);

      await waitFor(() => {
        // Check icon should appear (it's a Check icon with green color)
        const checkIcon = document.querySelector('svg[class*="text-green-600"]');
        expect(checkIcon).toBeInTheDocument();
      });
    });
  });

  describe('Tooltip Content', () => {
    it('renders tooltip trigger for reference ID badge', async () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="s3"
        />
      );

      // The badge should be rendered and wrapped in a tooltip structure
      const badge = screen.getByText('S3');
      expect(badge).toBeInTheDocument();
      // Verify there's a tooltip structure around the badge
      expect(badge.closest('[class*="cursor"]')).toBeInTheDocument();
    });

    it('renders correct storage type label', async () => {
      const referenceId = 'test-reference-id-123';
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
          evidenceReferenceId={referenceId}
          evidenceStorageType="splunk"
        />
      );

      // Verify the correct storage type label is shown
      expect(screen.getByText('Splunk')).toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    it('renders finding information correctly', () => {
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('Anchoring Bias')).toBeInTheDocument();
      expect(screen.getByText(/Confidence: 85%/)).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('High impact on decision making')).toBeInTheDocument();
    });

    it('calls onViewDetails when "View Detailed Analysis" is clicked', () => {
      render(
        <HeuristicCard
          finding={mockFinding}
          onViewDetails={mockOnViewDetails}
        />
      );

      const viewButton = screen.getByText('View Detailed Analysis');
      fireEvent.click(viewButton);

      expect(mockOnViewDetails).toHaveBeenCalledWith(mockFinding);
    });
  });
});
