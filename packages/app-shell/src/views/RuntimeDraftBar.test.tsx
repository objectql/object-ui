// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RuntimeDraftBar } from './RuntimeDraftBar';

/**
 * ADR-0034 step 3 (#1515) chrome tests.
 *
 * The bar is fully gated by the `VITE_RUNTIME_EDIT_VIA_META` flag (toggled via
 * `vi.stubEnv`). Flag OFF must render NOTHING and touch no network; flag ON
 * surfaces the draft indicator / publish / discard and resumes the draft.
 */

function makeMetadataClient(draftItem: unknown = null) {
  return {
    get: vi.fn().mockResolvedValue(draftItem),
    publish: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  };
}

describe('RuntimeDraftBar (ADR-0034)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('flag OFF (default)', () => {
    it('renders nothing and never reads the draft', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', '');
      const metadataClient = makeMetadataClient({ item: { a: 1 } });

      const { container } = render(
        <RuntimeDraftBar type="view" name="my_view" metadataClient={metadataClient} />,
      );

      expect(container.querySelector('[data-testid="runtime-draft-bar"]')).toBeNull();
      // No draft read fired — the legacy path must stay inert.
      expect(metadataClient.get).not.toHaveBeenCalled();
    });
  });

  describe('flag ON', () => {
    it('shows the indicator + publish when a draft is pending, and resumes it', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient({
        type: 'view',
        name: 'my_view',
        item: { columns: ['name'] },
      });
      const onResume = vi.fn();

      render(
        <RuntimeDraftBar
          type="view"
          name="my_view"
          metadataClient={metadataClient}
          onResume={onResume}
        />,
      );

      await waitFor(() =>
        expect(screen.getByTestId('runtime-draft-bar')).toBeTruthy(),
      );
      expect(screen.getByTestId('runtime-draft-publish')).toBeTruthy();
      expect(screen.getByTestId('runtime-draft-discard')).toBeTruthy();
      expect(metadataClient.get).toHaveBeenCalledWith('view', 'my_view', {
        state: 'draft',
      });
      expect(onResume).toHaveBeenCalledWith({ columns: ['name'] });
    });

    it('still shows the indicator when onResume throws (resume is best-effort)', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const metadataClient = makeMetadataClient({ item: { columns: ['name'] } });
      const onResume = vi.fn(() => {
        throw new Error('seed failed');
      });

      render(
        <RuntimeDraftBar
          type="view"
          name="my_view"
          metadataClient={metadataClient}
          onResume={onResume}
        />,
      );

      // A throwing resume must NOT hide the "unpublished changes" chrome —
      // the draft still exists on the server.
      await waitFor(() => expect(screen.getByTestId('runtime-draft-bar')).toBeTruthy());
      expect(onResume).toHaveBeenCalled();
    });

    it('renders nothing when there is no pending draft', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient(null);

      const { container } = render(
        <RuntimeDraftBar type="report" name="my_report" metadataClient={metadataClient} />,
      );

      await waitFor(() => expect(metadataClient.get).toHaveBeenCalled());
      expect(container.querySelector('[data-testid="runtime-draft-bar"]')).toBeNull();
    });

    it('publishes the pending draft on click', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient({ item: { columns: ['name'] } });
      const onAfterChange = vi.fn();

      render(
        <RuntimeDraftBar
          type="dashboard"
          name="my_dash"
          metadataClient={metadataClient}
          onAfterChange={onAfterChange}
        />,
      );

      const publishBtn = await screen.findByTestId('runtime-draft-publish');
      fireEvent.click(publishBtn);

      await waitFor(() =>
        expect(metadataClient.publish).toHaveBeenCalledWith('dashboard', 'my_dash'),
      );
      expect(onAfterChange).toHaveBeenCalled();
    });

    it('Publish is disabled while the panel has unsaved edits (dirty)', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient({ item: { columns: ['name'] } });

      render(
        <RuntimeDraftBar
          type="view"
          name="my_view"
          metadataClient={metadataClient}
          dirty
        />,
      );

      const publishBtn = await screen.findByTestId('runtime-draft-publish');
      expect((publishBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('surfaces the indicator immediately when savedSignal bumps (no read race)', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient(null); // no draft on initial read

      const { rerender, container } = render(
        <RuntimeDraftBar
          type="view"
          name="my_view"
          metadataClient={metadataClient}
          savedSignal={0}
        />,
      );

      // No draft yet → nothing rendered.
      await waitFor(() => expect(metadataClient.get).toHaveBeenCalled());
      expect(container.querySelector('[data-testid="runtime-draft-bar"]')).toBeNull();

      // Host saved a draft → bump the signal → indicator appears at once,
      // without depending on a re-read.
      rerender(
        <RuntimeDraftBar
          type="view"
          name="my_view"
          metadataClient={metadataClient}
          savedSignal={1}
        />,
      );
      await waitFor(() =>
        expect(screen.getByTestId('runtime-draft-bar')).toBeTruthy(),
      );
    });

    it('savedSignal does nothing when the flag is off', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', '');
      const metadataClient = makeMetadataClient(null);

      const { rerender, container } = render(
        <RuntimeDraftBar type="view" name="my_view" metadataClient={metadataClient} savedSignal={0} />,
      );
      rerender(
        <RuntimeDraftBar type="view" name="my_view" metadataClient={metadataClient} savedSignal={1} />,
      );

      expect(container.querySelector('[data-testid="runtime-draft-bar"]')).toBeNull();
    });

    it('stays inert until a name is known', async () => {
      vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true');
      const metadataClient = makeMetadataClient({ item: { a: 1 } });

      const { container } = render(
        <RuntimeDraftBar type="view" metadataClient={metadataClient} />,
      );

      expect(container.querySelector('[data-testid="runtime-draft-bar"]')).toBeNull();
      expect(metadataClient.get).not.toHaveBeenCalled();
    });
  });
});
