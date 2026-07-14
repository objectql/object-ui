/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * AiUsageIndicator (ADR-0057 #8) — renders per-meter rings, hides itself when
 * there's nothing to show (fail-soft), surfaces a "running low" hint near the cap,
 * and offers the upgrade / top-up CTA (reusing the 429 deep-link). Never a token #.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AiUsageResponse, AiMeterUsage } from '../../hooks/useAiUsage';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));
const openMock = vi.fn();
vi.mock('../../console/marketplace/marketplaceApi', () => ({
  cloudPricingDeepLink: () => 'https://cloud.example/upgrade',
}));
vi.mock('../../hooks/useAiUsage', () => ({ useAiUsage: vi.fn() }));

import { useAiUsage } from '../../hooks/useAiUsage';
import { AiUsageIndicator } from '../AiUsageIndicator';

const meter = (over: Partial<AiMeterUsage> = {}): AiMeterUsage => ({
  planType: 'free',
  fraction: 0.3,
  unmetered: false,
  resetKind: 'daily',
  resetsAt: null,
  upgrade: true,
  topUp: false,
  ...over,
});

function setUsage(usage: AiUsageResponse | null) {
  (useAiUsage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    usage,
    loading: false,
    error: undefined,
    refetch: vi.fn(),
  });
}

describe('AiUsageIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('open', openMock);
  });

  it('renders nothing when usage is unknown (null)', () => {
    setUsage(null);
    const { container } = render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    expect(screen.queryByTestId('ai-usage-indicator')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when both meters are unmetered / null-fraction', () => {
    setUsage({ meters: { build: meter({ unmetered: true, fraction: null }), dataChat: meter({ fraction: null }) } });
    render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    expect(screen.queryByTestId('ai-usage-indicator')).not.toBeInTheDocument();
  });

  it('renders the indicator when a meter has a numeric fraction', () => {
    setUsage({ meters: { build: meter({ fraction: 0.4 }), dataChat: meter({ fraction: 0.1 }) } });
    render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    expect(screen.getByTestId('ai-usage-indicator')).toBeInTheDocument();
    // No token numbers anywhere in the rendered output (D5).
    expect(screen.getByTestId('ai-usage-indicator').textContent ?? '').not.toMatch(/\d{3,}/);
  });

  it('shows a "running low" hint when a meter is near full', () => {
    setUsage({ meters: { build: meter({ fraction: 0.9 }), dataChat: meter({ fraction: 0.1 }) } });
    render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    expect(screen.getByText('Running low')).toBeInTheDocument();
  });

  it('does not show the low hint when both meters have headroom', () => {
    setUsage({ meters: { build: meter({ fraction: 0.2 }), dataChat: meter({ fraction: 0.1 }) } });
    render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    expect(screen.queryByText('Running low')).not.toBeInTheDocument();
  });

  it('opens the upgrade deep-link from the CTA when a free meter is near full', () => {
    setUsage({ meters: { build: meter({ fraction: 0.95, upgrade: true }), dataChat: meter({ fraction: 0.1 }) } });
    render(<AiUsageIndicator apiBase="/api/v1/ai" />);
    fireEvent.click(screen.getByTestId('ai-usage-indicator'));
    const cta = screen.getByTestId('ai-usage-cta-build');
    fireEvent.click(cta);
    expect(openMock).toHaveBeenCalledWith('https://cloud.example/upgrade', '_blank', 'noopener,noreferrer');
  });
});
