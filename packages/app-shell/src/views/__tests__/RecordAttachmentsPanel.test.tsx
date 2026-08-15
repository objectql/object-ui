// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordAttachmentsPanel } from '../RecordAttachmentsPanel';

const ROW = {
  id: 'a1',
  file_id: 'f1',
  file_name: 'report.pdf',
  mime_type: 'application/pdf',
  size: 1024,
  uploaded_by: 'someone-else',
};

function makeDataSource(overrides: Partial<Record<'find' | 'create' | 'delete', any>> = {}) {
  return {
    find: vi.fn(async () => [ROW]),
    create: vi.fn(async () => ({ id: 'a2' })),
    delete: vi.fn(async () => ({})),
    ...overrides,
  };
}

function setup(dataSource: any) {
  render(
    <RecordAttachmentsPanel
      objectName="att_case"
      recordId="r1"
      dataSource={dataSource}
      currentUserId="me"
    />,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('RecordAttachmentsPanel — server-denial error mapping (#2755)', () => {
  it('maps ATTACHMENT_DELETE_DENIED to the friendly uploader/editor message', async () => {
    const dataSource = makeDataSource({
      delete: vi.fn(async () => {
        throw new Error(
          '403: Cannot delete attachment a1: only the uploader or a user who can edit the parent record (att_case/r1) may delete it (ATTACHMENT_DELETE_DENIED)',
        );
      }),
    });
    setup(dataSource);
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    // The delete button renders for EVERY row (server is the gate).
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete attachment' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Only the uploader or someone who can edit this record may delete this attachment.',
      ),
    );
    // The optimistic removal must NOT have happened on failure.
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('maps PERMISSION_DENIED (no delete bit in the baseline) to friendly copy', async () => {
    const dataSource = makeDataSource({
      delete: vi.fn(async () => {
        const err: any = new Error("[Security] Access denied: operation 'delete' …");
        err.code = 'PERMISSION_DENIED';
        throw err;
      }),
    });
    setup(dataSource);
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete attachment' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent("You don't have permission to do that."),
    );
  });

  it('successful delete removes the row without an error banner', async () => {
    const dataSource = makeDataSource();
    setup(dataSource);
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete attachment' }));

    await waitFor(() => expect(screen.queryByText('report.pdf')).not.toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(dataSource.delete).toHaveBeenCalledWith('sys_attachment', 'a1');
  });
});

/**
 * A denied list is not an empty list (#4269).
 *
 * A member denied the parent opened a record holding 2095+ attachments; the
 * `sys_attachment` list read answered 403 and the panel rendered "No
 * attachments yet. Upload a file to get started." — an assertion about the
 * record's contents that the panel had no standing to make, plus an Upload
 * the server would refuse.
 *
 * The 403 arrives as a THROW: the ObjectStack adapter's `find()` degrades only
 * a non-authz 404 to `{ data: [], total: 0 }` and rethrows everything else, so
 * the panel's `catch` is where the two verdicts were being merged.
 */
describe('RecordAttachmentsPanel — denied vs empty list (#4269)', () => {
  /** The decorated shape the adapter rethrows: `httpStatus` + semantic code. */
  function deniedListSource() {
    return makeDataSource({
      find: vi.fn(async () => {
        throw Object.assign(
          new Error(
            "[Security] Access denied: operation 'find' on sys_attachment for user u-42 (2095 rows withheld)",
          ),
          { httpStatus: 403, code: 'PERMISSION_DENIED' },
        );
      }),
    });
  }

  it('THE DEFECT — a 403 list read renders the denied state, never "No attachments yet"', async () => {
    setup(deniedListSource());

    await waitFor(() =>
      expect(screen.getByTestId('record-attachments-denied')).toBeInTheDocument(),
    );
    expect(screen.getByText("You don't have access to these attachments.")).toBeInTheDocument();
    // The empty state is reserved for a genuine 200-with-zero-rows.
    expect(screen.queryByText(/No attachments yet/)).not.toBeInTheDocument();
  });

  it('withdraws the Upload affordance under a denied list', async () => {
    setup(deniedListSource());

    await waitFor(() =>
      expect(screen.getByTestId('record-attachments-denied')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
  });

  // The objectui#2532 failure mode — raw error dump, status code, leaked row
  // counts — was ABSENT before this change and must stay absent: the denied
  // state renders the i18n sentence and nothing sourced from the error.
  it('leaks nothing from the error body — no status code, no server text, no row count', async () => {
    setup(deniedListSource());

    await waitFor(() =>
      expect(screen.getByTestId('record-attachments-denied')).toBeInTheDocument(),
    );
    const panel = screen.getByTestId('record-attachments-panel');
    expect(panel.textContent).not.toMatch(/403/);
    expect(panel.textContent).not.toMatch(/2095/);
    expect(panel.textContent).not.toMatch(/u-42/);
    expect(panel.textContent).not.toMatch(/\[Security\]|Access denied: operation/);
    // The denial is a state, not an error banner.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('classifies a PERMISSION_DENIED code carrying no numeric status', async () => {
    const dataSource = makeDataSource({
      find: vi.fn(async () => {
        const err: any = new Error('refused');
        err.code = 'PERMISSION_DENIED';
        throw err;
      }),
    });
    setup(dataSource);

    await waitFor(() =>
      expect(screen.getByTestId('record-attachments-denied')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
  });

  it('a genuine 200-with-zero-rows still renders the empty state AND the Upload button', async () => {
    setup(makeDataSource({ find: vi.fn(async () => []) }));

    await waitFor(() =>
      expect(
        screen.getByText('No attachments yet. Upload a file to get started.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
    expect(screen.queryByTestId('record-attachments-denied')).not.toBeInTheDocument();
  });

  // PIN, not an endorsement. A non-authz failure keeps the pre-existing
  // behaviour — swallowed to the empty state, Upload still offered. That is
  // the same "unknown rendered as empty" defect one status over, but fixing it
  // needs the loaded/unknown status vocabulary (#4235-style), not this
  // denied-vs-empty split; filed separately. This test exists so the next
  // change to that branch is a DELIBERATE one.
  it('pins today’s behaviour for a NON-authz failure: still the empty state', async () => {
    setup(
      makeDataSource({
        find: vi.fn(async () => {
          throw new TypeError('Failed to fetch');
        }),
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByText('No attachments yet. Upload a file to get started.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('record-attachments-denied')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });
});

describe('RecordAttachmentsPanel — authenticated signed-URL download (#2970)', () => {
  it('fetches /files/:id/url with auth and opens the signed URL', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    // The declared envelope the route answers as of objectstack#3689 — the URL
    // moved from the top level down under `data`.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { url: '/api/v1/storage/_local/raw/tok123' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    setup(makeDataSource());
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const calledUrl = String(fetchSpy.mock.calls[0][0]);
    expect(calledUrl).toContain('/api/v1/storage/files/f1/url');
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/storage/_local/raw/tok123'),
        '_blank',
        'noopener,noreferrer',
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('maps a 403 ATTACHMENT_DOWNLOAD_DENIED to friendly copy and does not open a tab', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'ATTACHMENT_DOWNLOAD_DENIED', message: 'You do not have access…' },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    setup(makeDataSource());
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "You don't have access to download this attachment.",
      ),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('maps a 401 AUTH_REQUIRED to friendly copy', async () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required to download this file' },
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    setup(makeDataSource());
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Please sign in to download this attachment.'),
    );
  });

  // The console ships independently of the server it talks to, so it must keep
  // reading the PRE-objectstack#3675 body — code as a sibling of `error`, not a
  // field of it. Without this, pointing a new console at an older server turns
  // every gated download into the generic "Download failed (403)".
  it('still maps the legacy top-level `code` shape (older server)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'You do not have access…', code: 'ATTACHMENT_DOWNLOAD_DENIED' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    setup(makeDataSource());
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "You don't have access to download this attachment.",
      ),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  // Same reasoning on the SUCCESS path (objectstack#3689): the route used to
  // answer a bare `{ url }` with no envelope at all. The reader takes both, so
  // whichever repo lands first, downloads keep working — and this pins that
  // tolerance as deliberate rather than incidental.
  it('still opens the legacy bare `{ url }` shape (older server)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: '/api/v1/storage/_local/raw/legacy-tok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    setup(makeDataSource());
    await waitFor(() => expect(screen.getByText('report.pdf')).toBeInTheDocument());

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/storage/_local/raw/legacy-tok'),
        '_blank',
        'noopener,noreferrer',
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
