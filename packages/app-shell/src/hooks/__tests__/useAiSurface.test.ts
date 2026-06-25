import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDiscovery } from '@object-ui/react';
import { useAiSurfaceEnabled } from '../useAiSurface';

// The AI surface gates on whether the `service-ai` capability is present, as
// reported by discovery. Mock useDiscovery rather than standing up a data source.
// (The VITE_AI_BASE_URL opt-in branch isn't unit-tested here: vitest fixes
// import.meta.env at startup, so it can't be stubbed per-test; it's a thin
// synchronous env read exercised in the real app.)
vi.mock('@object-ui/react', () => ({ useDiscovery: vi.fn() }));
const mockDiscovery = vi.mocked(useDiscovery);

afterEach(() => mockDiscovery.mockReset());

describe('useAiSurfaceEnabled', () => {
  it('is enabled when discovery reports service-ai available (enterprise install)', () => {
    mockDiscovery.mockReturnValue({ isAiEnabled: true, isLoading: false } as any);
    const { result } = renderHook(() => useAiSurfaceEnabled());
    expect(result.current).toEqual({ enabled: true, isLoading: false });
  });

  it('is disabled — not loading — when service-ai is unavailable (Community Edition: no service-ai)', () => {
    mockDiscovery.mockReturnValue({ isAiEnabled: false, isLoading: false } as any);
    const { result } = renderHook(() => useAiSurfaceEnabled());
    expect(result.current).toEqual({ enabled: false, isLoading: false });
  });

  it('reports loading while discovery is still resolving, so guards do not flash a redirect', () => {
    mockDiscovery.mockReturnValue({ isAiEnabled: false, isLoading: true } as any);
    const { result } = renderHook(() => useAiSurfaceEnabled());
    expect(result.current).toEqual({ enabled: false, isLoading: true });
  });
});
