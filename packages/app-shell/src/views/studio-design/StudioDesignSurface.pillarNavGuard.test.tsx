// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Studio header — unsaved-changes guard on SPA navigation (objectui#2600).
 *
 * The pillar links, the Home button and the PackageSwitcher are pure
 * react-router client navigation, so the editors' `beforeunload` guard never
 * fires; before this guard existed they unmounted a dirty pillar silently and
 * discarded its unsaved edits. Pillars now mirror their dirty state up to the
 * surface (same `onDirtyChange` contract as the Access rail guard, PR #2588),
 * and every header-driven departure gates on a native confirm:
 *
 *   • dirty + pillar switch → confirm; cancel keeps the pillar and its edits,
 *   • dirty + Home → same confirm; cancel stays, confirm leaves,
 *   • dirty + package switch → same confirm,
 *   • clean navigation never prompts,
 *   • re-clicking the open pillar never prompts (nothing unmounts),
 *   • a confirmed discard clears the guard (the pillar resets on unmount).
 *
 * Rendered through the real StudioDesignSurface + AccessPillar +
 * PermissionMatrixEditPage stack (mocking only data I/O and heavy rail
 * siblings), so the dirty report crosses every real seam.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let clientImpl: any;

vi.mock('../metadata-admin/useMetadata', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useMetadataClient: () => clientImpl,
    useMetadataTypes: () => ({
      loading: false,
      error: null,
      entries: [{ type: 'permission', label: 'Permission', allowOrgOverride: true }],
    }),
  };
});

// The surface's package list (header switcher + writability gate) — two
// writable packages so the switcher has somewhere to go.
vi.mock('./packages-io', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    fetchPackages: vi.fn(async () => [
      { id: 'app.a', name: 'App A', writable: true, namespace: 'a' },
      { id: 'app.b', name: 'App B', writable: true, namespace: 'b' },
    ]),
  };
});

// Rail siblings / docks that are irrelevant to the guard — keep the render light.
vi.mock('./PackageOwdOverviewPanel', () => ({
  PackageOwdOverviewPanel: () => <div data-testid="owd-overview" />,
}));
vi.mock('../../components/SuggestedBindingsPanel', () => ({
  SuggestedBindingsPanel: () => null,
}));
vi.mock('../metadata-admin/AccessExplainPanel', () => ({
  AccessExplainPanel: () => null,
}));
vi.mock('./StudioAiCopilot', () => ({
  StudioChatDock: () => null,
}));
vi.mock('../../preview/DraftChangesPanel', () => ({
  DraftChangesPanel: () => null,
}));

import { StudioDesignSurface } from './StudioDesignSurface';

// jsdom has no matchMedia — useIsMobile / useIsWideViewport need a stub.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as any;

// Radix Popover (PackageSwitcher) floats via floating-ui, which observes size.
(globalThis as any).ResizeObserver =
  (globalThis as any).ResizeObserver ??
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

interface Server {
  byName: Record<string, Record<string, unknown>>;
  saved: Array<Record<string, unknown>>;
}

function freshServer(): Server {
  return {
    saved: [],
    byName: {
      set_a: {
        name: 'set_a',
        label: 'Set A',
        objects: { a_account: { allowRead: true } },
        fields: {},
      },
    },
  };
}

function makeClient(server: Server) {
  return {
    // Serves the Access rail (list('permission')), the embedded matrix
    // (list('object') + object get), the header's app probe (list('app')),
    // and — after a pillar switch — the Interfaces pillar's app resolution.
    list: async (type: string) => {
      if (type === 'permission') {
        return Object.values(server.byName).map((s) => ({ name: s.name, label: s.label }));
      }
      if (type === 'object') return [{ name: 'a_account' }];
      return [];
    },
    listDrafts: async () => [],
    layered: async (_type: string, name: string) => ({
      effective: server.byName[name],
      code: null,
      overlay: null,
      overlayScope: null,
    }),
    getDraft: async () => null,
    get: async (type: string) =>
      type === 'object' ? { fields: [{ name: 'name', label: 'Name' }] } : null,
    save: async (_t: string, _n: string, payload: Record<string, unknown>) => {
      server.saved.push(payload);
      return payload;
    },
  } as any;
}

// This jsdom environment ships no window.confirm at all — install a mock
// outright rather than spying.
let confirmSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  clientImpl = makeClient(freshServer());
  confirmSpy = vi.fn();
  window.confirm = confirmSpy as unknown as typeof window.confirm;
  // The surface's pending-drafts counter polls over raw fetch — stub it flat.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderSurfaceOnAccess() {
  render(
    <MemoryRouter initialEntries={['/studio/app.a/access']}>
      <Routes>
        <Route path="/studio/:packageId/:tab" element={<StudioDesignSurface />} />
        <Route path="/home" element={<div data-testid="home-page" />} />
      </Routes>
    </MemoryRouter>,
  );
  // First set is auto-selected; its matrix header carries the set name.
  await screen.findByDisplayValue('set_a');
}

/** Flip a cell in the open matrix so the editor reports dirty. */
function dirtyTheMatrix() {
  const row = screen.getByText('a_account').closest('tr')!;
  fireEvent.click(within(row).getByRole('button', { name: 'None' }));
}

const matrixEditSurvived = () => {
  // Row "None" left Read unchecked — a remount would reload allowRead: true.
  const row = screen.getByText('a_account').closest('tr')!;
  expect(within(row).getByRole('checkbox', { name: 'a_account Read' })).not.toBeChecked();
};

describe('Studio header — unsaved pillar edits guard (#2600)', () => {
  it('asks before a pillar switch when dirty; cancel keeps the pillar and its edits', async () => {
    await renderSurfaceOnAccess();
    dirtyTheMatrix();

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('link', { name: 'Interfaces' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('set_a')).toBeInTheDocument();
    matrixEditSurvived();

    // Confirming the same switch discards and lands on the Interfaces pillar.
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('link', { name: 'Interfaces' }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    await screen.findByText('This package has no app yet');
    expect(screen.queryByDisplayValue('set_a')).not.toBeInTheDocument();

    // The discarded pillar reset the guard on unmount — walking back to
    // Access must NOT prompt again.
    fireEvent.click(screen.getByRole('link', { name: 'Access' }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    await screen.findByDisplayValue('set_a');
  });

  it('switches pillars without prompting when clean', async () => {
    await renderSurfaceOnAccess();

    fireEvent.click(screen.getByRole('link', { name: 'Interfaces' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await screen.findByText('This package has no app yet');
  });

  it('never prompts when re-clicking the open pillar (nothing unmounts)', async () => {
    await renderSurfaceOnAccess();
    dirtyTheMatrix();

    fireEvent.click(screen.getByRole('link', { name: 'Access' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('set_a')).toBeInTheDocument();
    matrixEditSurvived();
  });

  it('gates the Home button; cancel stays, confirm leaves the studio', async () => {
    await renderSurfaceOnAccess();
    dirtyTheMatrix();

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTitle('Back to home'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('set_a')).toBeInTheDocument();
    matrixEditSurvived();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByTitle('Back to home'));
    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
  });

  it('gates a package switch; cancel keeps the edits in place', async () => {
    await renderSurfaceOnAccess();
    dirtyTheMatrix();

    // Open the switcher (its label resolves once fetchPackages lands).
    fireEvent.click(await screen.findByRole('button', { name: /App A/ }));
    const other = await screen.findByRole('button', { name: /App B/ });

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(other);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('set_a')).toBeInTheDocument();
    matrixEditSurvived();

    // Confirming jumps to the other package (header re-labels; matrix reloads).
    fireEvent.click(await screen.findByRole('button', { name: /App A/ }));
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(await screen.findByRole('button', { name: /App B/ }));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(screen.getByTitle('Switch / create package')).toHaveTextContent('App B'),
    );
  });

  it('never prompts a clean package switch', async () => {
    await renderSurfaceOnAccess();

    fireEvent.click(await screen.findByRole('button', { name: /App A/ }));
    fireEvent.click(await screen.findByRole('button', { name: /App B/ }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTitle('Switch / create package')).toHaveTextContent('App B'),
    );
  });
});
