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
