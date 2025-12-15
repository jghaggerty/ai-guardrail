import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EvidenceCollectionSettings } from './EvidenceCollectionSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Create a chainable mock for Supabase query builder
const createChainableMock = (resolveValue: any = { data: null, error: null }) => {
  const chainable: any = {};
  chainable.select = vi.fn(() => chainable);
  chainable.eq = vi.fn(() => chainable);
  chainable.single = vi.fn(() => Promise.resolve(resolveValue));
  chainable.maybeSingle = vi.fn(() => Promise.resolve(resolveValue));
  chainable.insert = vi.fn(() => chainable);
  chainable.update = vi.fn(() => chainable);
  chainable.delete = vi.fn(() => chainable);
  // Support for chaining after terminal operations
  chainable.then = (resolve: any) => Promise.resolve(resolveValue).then(resolve);
  return chainable;
};

// Create a mock that returns different values for different tables
const createTableAwareMock = (profileData: any, configData: any) => {
  let callCount = 0;
  return vi.fn((tableName: string) => {
    callCount++;
    // First call is typically for 'profiles', subsequent for 'evidence_collection_configs'
    if (tableName === 'profiles') {
      return createChainableMock({ data: profileData, error: null });
    }
    return createChainableMock({ data: configData, error: null });
  });
};

// Mock dependencies
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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import { useAuth } from '@/contexts/AuthContext';

describe('EvidenceCollectionSettings', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockTeamId = 'team-123';

  const mockProfile = {
    team_id: mockTeamId,
  };

  const mockConfig = {
    id: 'config-123',
    team_id: mockTeamId,
    storage_type: 's3' as const,
    is_enabled: true,
    configuration: {
      bucketName: 'test-bucket',
      region: 'us-east-1',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'test-secret-key',
    },
    last_tested_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: { user: mockUser } as any,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  describe('Component Rendering', () => {
    it('renders loading state initially', async () => {
      // Create a mock that never resolves to keep loading state
      const chainable: any = {};
      chainable.select = vi.fn(() => chainable);
      chainable.eq = vi.fn(() => chainable);
      chainable.single = vi.fn(() => new Promise(() => {})); // Never resolves

      vi.mocked(supabase.from).mockReturnValue(chainable);

      render(<EvidenceCollectionSettings />);

      // Check for loading indicator (there should be an animated spinner)
      const loadingContainer = document.querySelector('svg.animate-spin');
      expect(loadingContainer).toBeInTheDocument();
    });

    it('renders the component with collector mode toggle', async () => {
      const selectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: mockProfile, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      }));

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as any);

      render(<EvidenceCollectionSettings />);

      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });
    });

    it('loads and displays existing configuration', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, mockConfig));

      render(<EvidenceCollectionSettings />);

      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      // Check that S3 configuration fields are populated (existing config auto-enables form)
      await waitFor(() => {
        const bucketInput = screen.getByLabelText(/bucket name/i);
        expect(bucketInput).toHaveValue('test-bucket');
      });
    });
  });

  describe('Form Interactions', () => {
    it('toggles collector mode on/off', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(toggle);

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('shows storage type selector when collector mode is enabled', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/storage type/i)).toBeInTheDocument();
      });
    });

    it('shows S3 configuration form when S3 is selected', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      // S3 should be selected by default
      await waitFor(() => {
        expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument();
      });
    });

    it('updates S3 configuration fields', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument();
      });

      const bucketInput = screen.getByLabelText(/bucket name/i) as HTMLInputElement;
      fireEvent.change(bucketInput, { target: { value: 'my-test-bucket' } });

      expect(bucketInput.value).toBe('my-test-bucket');
    });
  });

  describe('Form Validation', () => {
    it('validates required S3 fields', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument();
      });

      // When collector mode is enabled but fields are empty, Configuration Incomplete warning shows
      await waitFor(() => {
        expect(screen.getByText('S3 bucket name is required')).toBeInTheDocument();
      });

      // Test invalid bucket name format
      const bucketInput = screen.getByLabelText(/bucket name/i) as HTMLInputElement;
      fireEvent.change(bucketInput, { target: { value: 'ab' } }); // Too short
      fireEvent.blur(bucketInput);

      await waitFor(() => {
        // The validation message mentions 3-63 characters in some form
        expect(screen.getByText(/3-63 characters/i)).toBeInTheDocument();
      });
    });

    it('validates AWS region format', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
      });

      const regionInput = screen.getByLabelText(/region/i) as HTMLInputElement;

      // Invalid region format
      fireEvent.change(regionInput, { target: { value: 'invalid-region' } });
      fireEvent.blur(regionInput);

      await waitFor(() => {
        // The validation message mentions valid AWS region
        expect(screen.getByText(/valid aws region/i)).toBeInTheDocument();
      });
    });

    it('disables save button when validation errors exist', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument();
      });

      // Leave required fields empty
      const saveButton = screen.getByRole('button', { name: /save configuration/i });

      // Button should be disabled due to missing required fields
      expect(saveButton).toBeDisabled();
    });
  });

  describe('API Calls', () => {
    it('tests connection successfully', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, mockConfig));
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, message: 'Connection successful' },
        error: null,
      } as any);

      render(<EvidenceCollectionSettings />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
      });

      const testButton = screen.getByRole('button', { name: /test connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('test-evidence-connection', {
          body: { configId: mockConfig.id },
        });
        expect(toast.success).toHaveBeenCalledWith('Connection test successful!');
      });
    });

    it('handles connection test failure', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, mockConfig));
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: false, message: 'Connection failed: Invalid credentials' },
        error: null,
      } as any);

      render(<EvidenceCollectionSettings />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
      });

      const testButton = screen.getByRole('button', { name: /test connection/i });
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Connection test failed'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Warning Indicators', () => {
    it('shows incomplete configuration warning when enabled without fields', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByText(/configuration incomplete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Storage Type Specific Forms', () => {
    it('shows S3 configuration fields when S3 is selected', async () => {
      vi.mocked(supabase.from).mockImplementation(createTableAwareMock(mockProfile, null));

      render(<EvidenceCollectionSettings />);
      await waitFor(() => {
        expect(screen.getByText('Collector Mode')).toBeInTheDocument();
      });

      const toggle = screen.getByRole('switch', { name: /collector mode/i });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(screen.getByLabelText(/bucket name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/region/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/access key id/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/secret access key/i)).toBeInTheDocument();
      });
    });
  });
});
