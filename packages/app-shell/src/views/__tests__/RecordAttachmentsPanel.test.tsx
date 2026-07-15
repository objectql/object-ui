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
