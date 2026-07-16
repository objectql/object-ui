/**
 * Tests for PageHeaderRenderer header actions slot.
 *
 * Custom (authored) record detail pages embed action buttons directly on
 * `page:header.actions` (or `.properties.actions`). Without this slot,
 * actions such as Lead → "Convert Lead" silently disappear.
 */

import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import {
  ActionProvider,
  RecordContextProvider,
  InlineEditProvider,
  useInlineEdit,
  PredicateScopeProvider,
} from '@object-ui/react';

function PageHeader({ schema }: { schema: any }) {
  const Component = ComponentRegistry.get('page:header');
  if (!Component) throw new Error('page:header not registered');
  return <Component schema={schema} />;
}

function renderHeader(schema: any, opts?: { record?: any; objectSchema?: any; execute?: any; headerSystemActions?: any[]; scope?: any }) {
  const execute = opts?.execute ?? vi.fn(async () => ({ success: true }));
  let ui = (
    <ActionProvider>
      {opts?.record !== undefined ? (
        <RecordContextProvider
          objectName="lead"
          recordId={opts.record?.id ?? null}
          data={opts.record}
          objectSchema={opts?.objectSchema ?? { name: 'lead', label: 'Lead' }}
          headerSystemActions={opts?.headerSystemActions}
        >
          <PageHeader schema={schema} />
        </RecordContextProvider>
      ) : (
        <PageHeader schema={schema} />
      )}
    </ActionProvider>
  );
  if (opts?.scope) {
    ui = <PredicateScopeProvider scope={opts.scope}>{ui}</PredicateScopeProvider>;
  }
  const utils = render(ui);
  return { ...utils, execute };
}

describe('PageHeaderRenderer — actions slot', () => {
  it('renders inline schema.actions as buttons', () => {
    renderHeader({
      type: 'page:header',
      title: 'Lead',
      actions: [
        { name: 'convert', label: 'Convert Lead', type: 'flow' },
      ],
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('renders schema.properties.actions (spec bridge variant)', () => {
    renderHeader({
      type: 'page:header',
      properties: {
        title: 'Lead',
        actions: [
          { name: 'convert', label: 'Convert Lead', type: 'flow' },
        ],
      },
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('skips actions whose locations exclude record_header', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'a', label: 'Header Action', locations: ['record_header'] },
        { name: 'b', label: 'List Only', locations: ['list_item'] },
      ],
    });
    expect(screen.getByRole('button', { name: /Header Action/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /List Only/i })).toBeNull();
  });

  it('shows action when visible expression matches record', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: 'record.status == "qualified"',
          },
        ],
      },
      { record: { id: '1', status: 'qualified' } },
    );
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('hides action when visible expression does not match record', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: 'record.status == "qualified"',
          },
        ],
      },
      { record: { id: '1', status: 'new' } },
    );
    expect(screen.queryByRole('button', { name: /Convert Lead/i })).toBeNull();
  });

  it('honors structured visible: { dialect, source }', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [
          {
            name: 'convert',
            label: 'Convert Lead',
            visible: { dialect: 'cel', source: 'record.status == "qualified"' },
          },
        ],
      },
      { record: { id: '1', status: 'qualified' } },
    );
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
  });

  it('respects hidden: true', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'shown', label: 'Shown' },
        { name: 'gone', label: 'Hidden Action', hidden: true },
      ],
    });
    expect(screen.getByRole('button', { name: /Shown/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hidden Action/i })).toBeNull();
  });

  it('emits a toolbar role with aria-label when actions render', () => {
    renderHeader({
      type: 'page:header',
      actions: [{ name: 'a', label: 'A' }],
    });
    const bar = screen.getByRole('toolbar', { name: /Page header actions/i });
    expect(bar).toBeTruthy();
  });

  it('falls back to the data-page-actions-slot div when no actions provided', () => {
    const { container } = renderHeader({
      type: 'page:header',
      title: 'Empty',
    });
    expect(container.querySelector('[data-page-actions-slot]')).toBeTruthy();
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
  });

  it('invokes onClick when an action button is clicked', () => {
    const onClick = vi.fn();
    renderHeader({
      type: 'page:header',
      actions: [{ name: 'a', label: 'Click Me', onClick }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Click Me/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('appends host-provided headerSystemActions after authored actions', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [{ name: 'biz', label: 'Convert Lead' }],
      },
      {
        record: { id: '1' },
        headerSystemActions: [
          { name: 'sys_edit', label: '编辑' },
          { name: 'sys_share', label: '分享' },
          { name: 'sys_delete', label: '删除', variant: 'destructive' },
        ],
      },
    );
    // With 4 actions and the default maxVisible of 3, the first three stay
    // inline and the rest collapse into a `⋯` overflow menu. We assert the
    // authored action is rendered as a button and the overflow trigger is
    // present (full menu contents are exercised by separate dropdown
    // interaction tests).
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
  });

  it('dedupes by name — authored beats host system action with same name', () => {
    renderHeader(
      {
        type: 'page:header',
        actions: [{ name: 'sys_edit', label: 'Authored Edit' }],
      },
      {
        record: { id: '1' },
        headerSystemActions: [{ name: 'sys_edit', label: 'System Edit' }],
      },
    );
    expect(screen.getByRole('button', { name: /Authored Edit/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^System Edit$/i })).toBeNull();
  });

  it('renders host system actions even when schema has no actions array', () => {
    renderHeader(
      { type: 'page:header', title: 'Lead' },
      {
        record: { id: '1' },
        headerSystemActions: [{ name: 'sys_edit', label: '编辑' }],
      },
    );
    expect(screen.getByRole('button', { name: /编辑/i })).toBeTruthy();
  });
});

describe('PageHeaderRenderer — inline-edit session gate (objectui#2572)', () => {
  // Enters the shared inline-edit session on mount, simulating a user
  // double-clicking a field in the record body.
  function EnterInlineEdit() {
    const inline = useInlineEdit()!;
    useEffect(() => {
      inline.enter();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  function renderWithInlineEdit(opts: { editing: boolean; actions: any[] }) {
    return render(
      <ActionProvider>
        <RecordContextProvider
          objectName="proj"
          recordId="1"
          data={{ id: '1' }}
          objectSchema={{ name: 'proj', label: 'Project' }}
          headerSystemActions={opts.actions}
        >
          <InlineEditProvider canEdit>
            {opts.editing && <EnterInlineEdit />}
            <PageHeader schema={{ type: 'page:header', title: 'Project' }} />
          </InlineEditProvider>
        </RecordContextProvider>
      </ActionProvider>,
    );
  }

  const editCta = { name: 'sys_edit', label: 'Edit', disableDuringInlineEdit: true };

  it('disables a `disableDuringInlineEdit` action while the session is active', () => {
    renderWithInlineEdit({ editing: true, actions: [editCta] });
    expect(screen.getByRole('button', { name: /Edit/i })).toBeDisabled();
  });

  it('keeps the action enabled when no session is active', () => {
    renderWithInlineEdit({ editing: false, actions: [editCta] });
    expect(screen.getByRole('button', { name: /Edit/i })).toBeEnabled();
  });

  it('leaves unflagged actions alone during the session', () => {
    renderWithInlineEdit({
      editing: true,
      actions: [editCta, { name: 'convert', label: 'Convert' }],
    });
    expect(screen.getByRole('button', { name: /Edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Convert/i })).toBeEnabled();
  });
});

describe('PageHeaderRenderer — inline/overflow split (objectui#2361)', () => {
  it('renders up to three actions side-by-side with no overflow menu', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'convert', label: 'Convert Lead' },
        { name: 'assign', label: 'Assign' },
        { name: 'return', label: 'Return' },
      ],
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Assign/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Return/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /More actions/i })).toBeNull();
  });

  it('overflows past the default maxVisible of 3', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'a', label: 'Action A' },
        { name: 'b', label: 'Action B' },
        { name: 'c', label: 'Action C' },
        { name: 'd', label: 'Action D' },
      ],
    });
    expect(screen.getByRole('button', { name: /Action C/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Action D/i })).toBeNull();
    expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
  });

  it('honors a schema-level maxVisible override', () => {
    renderHeader({
      type: 'page:header',
      maxVisible: 1,
      actions: [
        { name: 'a', label: 'Action A' },
        { name: 'b', label: 'Action B' },
      ],
    });
    expect(screen.getByRole('button', { name: /Action A/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Action B/i })).toBeNull();
    expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
  });

  it('reads maxVisible from properties (spec bridge variant)', () => {
    renderHeader({
      type: 'page:header',
      properties: {
        maxVisible: 4,
        actions: [
          { name: 'a', label: 'Action A' },
          { name: 'b', label: 'Action B' },
          { name: 'c', label: 'Action C' },
          { name: 'd', label: 'Action D' },
        ],
      },
    });
    expect(screen.getByRole('button', { name: /Action D/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /More actions/i })).toBeNull();
  });

  it('promotes a lower `order` into the inline slots (#2339 rule)', () => {
    renderHeader({
      type: 'page:header',
      maxVisible: 1,
      actions: [
        { name: 'a', label: 'Action A' },
        { name: 'b', label: 'Action B', order: -1 },
      ],
    });
    expect(screen.getByRole('button', { name: /Action B/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Action A/i })).toBeNull();
  });

  it('prefers variant: primary as a tie-break within equal order', () => {
    renderHeader({
      type: 'page:header',
      maxVisible: 1,
      actions: [
        { name: 'a', label: 'Action A' },
        { name: 'b', label: 'Action B', variant: 'primary' },
      ],
    });
    expect(screen.getByRole('button', { name: /Action B/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Action A/i })).toBeNull();
  });

  it('pins component: action:menu actions into the overflow menu even below maxVisible', () => {
    renderHeader({
      type: 'page:header',
      actions: [
        { name: 'convert', label: 'Convert Lead' },
        { name: 'sys_delete', label: 'Delete', component: 'action:menu' },
      ],
    });
    expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Delete$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
  });
});

// #2358 — the three action-visibility traps. NOTE: the diagnostics warn ONCE
// per (action name, predicate) pair via a module-level Set, so every test
// below uses unique action names/predicates to stay independent.
describe('PageHeaderRenderer — #2358 action visibility traps', () => {
  describe('trap 2: record_more routes to the ⋯ overflow menu', () => {
    it('renders a record_more-only action in the overflow, never inline', () => {
      renderHeader(
        {
          type: 'page:header',
          actions: [
            { name: 'convert2358', label: 'Convert Lead' },
            { name: 'export_pdf_2358', label: 'Export PDF', locations: ['record_more'] },
          ],
        },
        { record: { id: '1' } },
      );
      // The plain action stays inline; the record_more action must NOT get
      // an inline button — it lives inside the ⋯ dropdown (trigger present).
      expect(screen.getByRole('button', { name: /Convert Lead/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Export PDF/i })).toBeNull();
      expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
    });

    it('renders the ⋯ menu even when a record_more action is the ONLY action', () => {
      renderHeader(
        {
          type: 'page:header',
          actions: [
            { name: 'archive_2358', label: 'Archive Record', locations: ['record_more'] },
          ],
        },
        { record: { id: '1' } },
      );
      expect(screen.queryByRole('button', { name: /Archive Record/i })).toBeNull();
      expect(screen.getByRole('button', { name: /More actions/i })).toBeTruthy();
    });

    it('still excludes locations that are neither record_header nor record_more', () => {
      renderHeader(
        {
          type: 'page:header',
          actions: [
            { name: 'list_only_2358', label: 'List Only', locations: ['list_item'] },
          ],
        },
        { record: { id: '1' } },
      );
      expect(screen.queryByRole('button', { name: /List Only/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /More actions/i })).toBeNull();
    });
  });

  describe('trap 1: os.user identity alias (server CEL parity)', () => {
    it('shows an action gated on os.user.* when the ambient user matches', () => {
      renderHeader(
        {
          type: 'page:header',
          actions: [
            {
              name: 'admin_gate_2358',
              label: 'Admin Gate',
              visible: 'os.user.role == "admin"',
            },
          ],
        },
        { record: { id: '1' }, scope: { user: { id: 'u1', role: 'admin' } } },
      );
      expect(screen.getByRole('button', { name: /Admin Gate/i })).toBeTruthy();
    });

    it('hides an os.user.* gated action when the ambient user does not match', () => {
      renderHeader(
        {
          type: 'page:header',
          actions: [
            {
              name: 'admin_gate_no_match_2358',
              label: 'Admin Gate',
              visible: 'os.user.role == "admin"',
            },
          ],
        },
        { record: { id: '1' }, scope: { user: { id: 'u1', role: 'viewer' } } },
      );
      expect(screen.queryByRole('button', { name: /Admin Gate/i })).toBeNull();
    });
  });

  describe('unified diagnostics: no more silent fail-closed hide', () => {
    it('hides a throwing predicate AND warns once with the action name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const schema = {
          type: 'page:header',
          actions: [
            {
              name: 'bad_scope_2358',
              label: 'Bad Scope',
              visible: 'undeclared_var_2358 == 1',
            },
          ],
        };
        const { unmount } = renderHeader(schema, { record: { id: '1' } });
        expect(screen.queryByRole('button', { name: /Bad Scope/i })).toBeNull();
        const matching = () =>
          warn.mock.calls.filter(c => String(c[0]).includes('bad_scope_2358'));
        expect(matching()).toHaveLength(1);
        expect(String(matching()[0][0])).toMatch(/predicate threw/);
        expect(String(matching()[0][0])).toContain('undeclared_var_2358 == 1');
        // Re-render must not spam the warning (deduped per action+predicate).
        unmount();
        renderHeader(schema, { record: { id: '1' } });
        expect(matching()).toHaveLength(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('trap 3: warns when a predicate references record fields absent from the payload', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        renderHeader(
          {
            type: 'page:header',
            actions: [
              {
                name: 'hidden_field_gate_2358',
                label: 'Hidden Field Gate',
                visible: 'record.secret_level_2358 == "high"',
              },
            ],
          },
          // Non-empty payload WITHOUT the referenced field — mirrors the
          // server stripping `hidden: true` fields from detail payloads.
          { record: { id: '1', status: 'new' } },
        );
        expect(screen.queryByRole('button', { name: /Hidden Field Gate/i })).toBeNull();
        const hits = warn.mock.calls.filter(c =>
          String(c[0]).includes('hidden_field_gate_2358'),
        );
        expect(hits).toHaveLength(1);
        expect(String(hits[0][0])).toContain('secret_level_2358');
        expect(String(hits[0][0])).toMatch(/not present in the record payload/);
      } finally {
        warn.mockRestore();
      }
    });

    it('does not fire the missing-field warning for present-but-null fields', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        renderHeader(
          {
            type: 'page:header',
            actions: [
              {
                name: 'null_field_gate_2358',
                label: 'Null Field Gate',
                visible: 'record.approver_2358 == "u1"',
              },
            ],
          },
          { record: { id: '1', approver_2358: null } },
        );
        // Legitimately empty field → predicate is false, action hidden, but
        // no "missing field" noise.
        expect(screen.queryByRole('button', { name: /Null Field Gate/i })).toBeNull();
        expect(
          warn.mock.calls.filter(c => String(c[0]).includes('null_field_gate_2358')),
        ).toHaveLength(0);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
