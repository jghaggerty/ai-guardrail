import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvidenceCollectionSettings } from './EvidenceCollectionSettings';

describe('EvidenceCollectionSettings', () => {
  it('renders placeholder message', () => {
    render(<EvidenceCollectionSettings />);
    expect(screen.getByText('Evidence Collection Settings')).toBeInTheDocument();
    expect(screen.getByText(/Evidence collection configuration is not yet available/)).toBeInTheDocument();
  });
});
