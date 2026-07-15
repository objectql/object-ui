/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0080 reverse bridge: the Live Canvas (the build session's result pane,
 * which renders the RUNNING app) must offer an explicit jump into the Studio
 * design surface — otherwise a builder who wants to fine-tune structure after a
 * build is stranded (the pane's only other action is close).
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveCanvas } from './LiveCanvas';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => ({
  ...(await importActual<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

describe('LiveCanvas — Design in Studio bridge', () => {
  beforeEach(() => navigate.mockClear());

  it('renders a Design in Studio control that opens the package’s design surface', () => {
    render(
      <LiveCanvas appName="项目管理" appSegment="app.v6gq" materialized refreshKey={0} onClose={() => {}} />,
    );
    const btn = screen.getByTestId('live-canvas-open-designer');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(navigate).toHaveBeenCalledWith('/studio/app.v6gq/interfaces');
  });

  it('omits the bridge when the app has no addressable package segment', () => {
    render(<LiveCanvas appName="Draft" refreshKey={0} onClose={() => {}} />);
    expect(screen.queryByTestId('live-canvas-open-designer')).not.toBeInTheDocument();
  });

  it('still renders the close control', () => {
    render(<LiveCanvas appName="项目管理" appSegment="app.v6gq" materialized refreshKey={0} onClose={() => {}} />);
    expect(screen.getByTestId('live-canvas-close')).toBeInTheDocument();
  });
});
