/**
 * Tests for PageHeaderRenderer record-chip title resolution.
 *
 * The default console record page renders `page:header` (synthesized by
 * `buildDefaultPageSchema`), so this renderer IS the record detail H1.
 * It must honour the object's declared `nameField` / `displayNameField`
 * via the unified ADR-0079 resolver — an object whose title lives in e.g.
 * `subject` must not fall back to `${objectLabel} ${id}`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { ActionProvider, RecordContextProvider } from '@object-ui/react';

function PageHeader({ schema }: { schema: any }) {
  const Component = ComponentRegistry.get('page:header');
  if (!Component) throw new Error('page:header not registered');
  // eslint-disable-next-line react-hooks/static-components -- ComponentRegistry.get returns a registered component (stable), not one created during render
  return <Component schema={schema} />;
}

function renderHeader(opts: { record: any; objectSchema: any; schema?: any }) {
  return render(
    <ActionProvider>
      <RecordContextProvider
        objectName={opts.objectSchema?.name ?? 'task'}
        recordId={opts.record?.id ?? null}
        data={opts.record}
        objectSchema={opts.objectSchema}
      >
        <PageHeader schema={opts.schema ?? { type: 'page:header' }} />
      </RecordContextProvider>
    </ActionProvider>
  );
}

describe('PageHeaderRenderer — record title resolution', () => {
  it('resolves the declared nameField (no literal name/title field)', () => {
    renderHeader({
      objectSchema: {
        name: 'task',
        label: 'Task',
        nameField: 'subject',
        fields: { subject: { type: 'text', label: 'Subject' } },
      },
      record: { id: 'rec-12345678', subject: 'Fix the widget' },
    });
    expect(screen.getByText('Fix the widget')).toBeTruthy();
  });

  it('nameField wins over a record-level `name` value', () => {
    renderHeader({
      objectSchema: {
        name: 'contract',
        label: 'Contract',
        nameField: 'contract_no',
        fields: {
          name: { type: 'text', label: 'Name' },
          contract_no: { type: 'text', label: 'Contract No' },
        },
      },
      record: { id: 'rec-1', name: 'internal-name', contract_no: 'HT-2026-001' },
    });
    expect(screen.getByText('HT-2026-001')).toBeTruthy();
  });

  it('honours the deprecated displayNameField alias', () => {
    renderHeader({
      objectSchema: {
        name: 'activity',
        label: 'Activity',
        displayNameField: 'activity_name',
        fields: { activity_name: { type: 'text', label: 'Activity Name' } },
      },
      record: { id: 'rec-2', activity_name: 'Kickoff call' },
    });
    expect(screen.getByText('Kickoff call')).toBeTruthy();
  });

  it('titleFormat still outranks nameField (legacy header behaviour)', () => {
    renderHeader({
      objectSchema: {
        name: 'contact',
        label: 'Contact',
        nameField: 'nickname',
        titleFormat: '{first_name} {last_name}',
        fields: {
          nickname: { type: 'text' },
          first_name: { type: 'text' },
          last_name: { type: 'text' },
        },
      },
      record: { id: 'rec-3', nickname: 'Ada', first_name: 'Ada', last_name: 'Lovelace' },
    });
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('falls back to `${objectLabel} ${id}` when the record is truly unnamed', () => {
    renderHeader({
      objectSchema: {
        name: 'audit_log',
        label: 'Audit Log',
        fields: { acted_at: { type: 'datetime' } },
      },
      record: { id: 'abcdefgh-rest-of-id', acted_at: '2026-07-04' },
    });
    expect(screen.getByText(/Audit Log abcdefgh/)).toBeTruthy();
  });
});

/**
 * `objectSchema.primaryField` is NOT a rung of this chain (objectui#7586).
 *
 * `primaryField` is a `DetailViewSchema` key (`@object-ui/types` `views.ts`) —
 * a VIEW key a view author sets, which `DetailView.resolveDisplayTitle` reads
 * off `schema` and is welcome to. It was ALSO read here off the OBJECT def,
 * and ranked ABOVE the unified ADR-0079 resolver that ADR-0079 Phase 2 made
 * the single pointer to a record's identity.
 *
 * No producer can put it on an object: `@objectstack/spec`'s object schema is
 * a `strictObject` that answers `unrecognized_keys: ['primaryField']`, which
 * is why objectstack#6326 deleted the identical read from two lint rules and
 * objectui#7287 / PR #7585 deleted it from `resolveTitleField`. Three of this
 * repo's own changelogs already describe the probe as "not a spec property —
 * always undefined" while the code kept honouring it.
 *
 * ⚠️ These cases are about RANKING, not about the key being unreadable. Each
 * object below carries `primaryField` AND a legitimate declaration, and the
 * assertion is that the legitimate one wins — so deleting the rung turns them
 * green and re-adding it anywhere above the resolver turns them red again.
 * A case with `primaryField` alone would pass on a chain that had merely
 * demoted it, which is not what this pins.
 */
describe('PageHeaderRenderer — `objectSchema.primaryField` is not a rung (#7586)', () => {
  it('does not let `primaryField` outrank the declared `nameField`', () => {
    const { container } = renderHeader({
      objectSchema: {
        name: 'contract',
        label: 'Contract',
        nameField: 'contract_no',
        // Off-spec: a DetailViewSchema key sitting on an OBJECT def.
        primaryField: 'ref_no',
        fields: {
          contract_no: { type: 'text', label: 'Contract No' },
          ref_no: { type: 'text', label: 'Ref No' },
        },
      },
      record: { id: 'rec-1', contract_no: 'HT-2026-001', ref_no: 'R-999' },
    });

    // The ACTUAL H1 of the synthesized record page, not a prediction of it.
    expect(container.querySelector('h1')?.textContent).toBe('HT-2026-001');
    expect(screen.queryByText('R-999')).toBeNull();
  });

  it('does not let `primaryField` outrank `titleFormat`', () => {
    const { container } = renderHeader({
      objectSchema: {
        name: 'contact',
        label: 'Contact',
        titleFormat: '{first_name} {last_name}',
        primaryField: 'ref_no',
        fields: {
          first_name: { type: 'text' },
          last_name: { type: 'text' },
          ref_no: { type: 'text' },
        },
      },
      record: { id: 'rec-2', first_name: 'Ada', last_name: 'Lovelace', ref_no: 'R-999' },
    });

    expect(container.querySelector('h1')?.textContent).toBe('Ada Lovelace');
    expect(screen.queryByText('R-999')).toBeNull();
  });

  it('does not let `primaryField` outrank the type-aware derivation', () => {
    const { container } = renderHeader({
      objectSchema: {
        name: 'task',
        label: 'Task',
        // Nothing declared: the ADR-0079 resolver derives `subject` from the
        // field types, the rung this chain used to jump over.
        primaryField: 'ref_no',
        fields: {
          subject: { type: 'text', label: 'Subject' },
          ref_no: { type: 'text', label: 'Ref No' },
        },
      },
      record: { id: 'rec-3', subject: 'Fix the widget', ref_no: 'R-999' },
    });

    expect(container.querySelector('h1')?.textContent).toBe('Fix the widget');
    expect(screen.queryByText('R-999')).toBeNull();
  });

  /**
   * Non-vacuity for the three above, and the case that measures the DELETED
   * RUNG directly rather than a re-ranking of it.
   *
   * ⚠️ Written the obvious way first, and the obvious way cannot fail:
   * `primaryField: 'ref_no'` over a TEXT `ref_no` still produced `R-999` after
   * the rung was gone, because the ADR-0079 type-aware derivation picks
   * `ref_no` on its own — the only title-typed field on the object. Measured,
   * not assumed. A pin written that way would have gone green against a
   * `primaryField` rung that was still there.
   *
   * `autonumber` is the type that separates the two readings: it is in core's
   * `NON_TITLE_TYPES`, so the resolver REFUSES `ref_no` (an autonumber is a
   * record's number, never its name), the record-key walk below never looks at
   * `ref_no` either, and every remaining rung declines. Only the deleted
   * `primaryField` rung could put `R-999` in this heading. The chain lands on
   * the `${objectLabel} ${id}` floor instead.
   */
  it('a `primaryField` the resolver refuses does not title the record at all', () => {
    const { container } = renderHeader({
      objectSchema: {
        name: 'ledger_entry',
        label: 'Ledger Entry',
        primaryField: 'ref_no',
        fields: {
          ref_no: { type: 'autonumber', label: 'Ref No' },
          posted_at: { type: 'datetime' },
        },
      },
      record: { id: 'abcdefgh-rest-of-id', ref_no: 'R-999', posted_at: '2026-07-04' },
    });

    expect(container.querySelector('h1')?.textContent).toMatch(/^Ledger Entry abcdefgh/);
    expect(screen.queryByText('R-999')).toBeNull();
  });
});
