import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAiSurface } from '../ConsoleShell';
import { useAiSurfaceEnabled } from '../../hooks/useAiSurface';

// The guard gates purely on the AI-surface signal (the agent catalog); that
// hook's own plumbing is covered by useAiSurface.test.ts.
vi.mock('../../hooks/useAiSurface', () => ({
  useAiSurfaceEnabled: vi.fn(() => ({ enabled: true, isLoading: false })),
}));
const mockSurface = vi.mocked(useAiSurfaceEnabled);

function renderGuardedAi() {
  return render(
    <MemoryRouter initialEntries={['/ai']}>
      <Routes>
        <Route
          path="/ai"
          element={
            <RequireAiSurface>
              <div>AI CHAT</div>
            </RequireAiSurface>
          }
        />
        <Route path="/home" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAiSurface', () => {
  beforeEach(() => {
    mockSurface.mockReturnValue({ enabled: true, isLoading: false });
  });

  it('renders the AI surface when the server serves agents (cloud install)', () => {
    renderGuardedAi();
    expect(screen.getByText('AI CHAT')).toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });

  it('redirects to home when no agents are served (Community Edition) — no dead-end chat', () => {
    mockSurface.mockReturnValue({ enabled: false, isLoading: false });
    renderGuardedAi();
    expect(screen.queryByText('AI CHAT')).not.toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('waits (neither chat nor redirect) while the agent catalog is still resolving', () => {
    mockSurface.mockReturnValue({ enabled: false, isLoading: true });
    renderGuardedAi();
    expect(screen.queryByText('AI CHAT')).not.toBeInTheDocument();
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
  });
});
