// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Capture the schema ObjectForm receives so object-form mode can be asserted
// without standing up the real plugin-form runtime.
const { objectFormSpy, adapterRef } = vi.hoisted(() => ({
  objectFormSpy: vi.fn(),
  adapterRef: { current: { fake: 'adapter' } as unknown },
}));

vi.mock('@object-ui/plugin-form', () => ({
  ObjectForm: ({ schema }: { schema: unknown }) => {
    objectFormSpy(schema);
    return <div data-testid="object-form" />;
  },
}));

vi.mock('../../../providers/AdapterProvider', () => ({
  useAdapter: () => adapterRef.current,
}));

import { ScreenPreview } from './ScreenPreview';
import { buildScreenSpec, isFieldVisibleWhen, hiddenFieldCount } from './screen-spec';

afterEach(() => {
  cleanup();
  objectFormSpy.mockClear();
  adapterRef.current = { fake: 'adapter' };
});

describe('ScreenPreview — flat fields', () => {
  it('renders the title + description with {var} interpolation against supplied variables', () => {
    render(
      <ScreenPreview
        node={{ id: 's1', config: { title: 'Discount for {customer}', description: 'Deal {deal_id} · owner {missing}' } }}
        variables={{ customer: 'Acme', deal_id: 42 }}
      />,
    );
    expect(screen.getByText('Discount for Acme')).toBeInTheDocument();
    // Known var substituted; unknown ref kept literal so the author sees it.
    expect(screen.getByText('Deal 42 · owner {missing}')).toBeInTheDocument();
  });

  it('renders each input field (label, required marker) and a non-functional Submit', () => {
    const { container } = render(
      <ScreenPreview
        node={{
          id: 's1',
          config: {
            title: 'Review',
            fields: [
              { name: 'amount', label: 'Amount', type: 'number', required: true },
              { name: 'note', label: 'Note', type: 'textarea' },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    // Required marker.
    expect(screen.getByText('*')).toBeInTheDocument();
    // Field types map to the runtime inputs (number → spinbutton, textarea).
    expect(container.querySelector('input[type="number"]')).toBeTruthy();
    expect(container.querySelector('textarea')).toBeTruthy();
    // The preview offers a disabled Submit — it never resumes a real run.
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
  });

  it('live-updates when the node config changes', () => {
    const { rerender } = render(<ScreenPreview node={{ id: 's1', config: { title: 'Step one' } }} />);
    expect(screen.getByText('Step one')).toBeInTheDocument();

    rerender(<ScreenPreview node={{ id: 's1', config: { title: 'Step two', fields: [{ name: 'x', label: 'Reason' }] }} } />);
    expect(screen.queryByText('Step one')).not.toBeInTheDocument();
    expect(screen.getByText('Step two')).toBeInTheDocument();
    expect(screen.getByText('Reason')).toBeInTheDocument();
  });

  it('shows an empty-state hint when nothing is configured', () => {
    render(<ScreenPreview node={{ id: 's1', config: {} }} />);
    expect(screen.getByText(/Add a title, description, fields, or an object form/i)).toBeInTheDocument();
  });
});

describe('ScreenPreview — object-form mode', () => {
  it('renders the runtime ObjectForm with the configured object/mode/defaults', () => {
    render(
      <ScreenPreview
        node={{ id: 's1', config: { objectName: 'crm_account', mode: 'edit', defaults: { stage: 'new' } } }}
      />,
    );
    expect(screen.getByTestId('object-form')).toBeInTheDocument();
    const schema = objectFormSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(schema.type).toBe('object-form');
    expect(schema.objectName).toBe('crm_account');
    expect(schema.mode).toBe('edit');
    expect(schema.initialValues).toEqual({ stage: 'new' });
    // Object-form owns no preview Submit (its own bar is hidden in preview).
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('falls back to a hint when no data source is available', () => {
    adapterRef.current = null;
    render(<ScreenPreview node={{ id: 's1', config: { objectName: 'crm_account' } }} />);
    expect(screen.queryByTestId('object-form')).not.toBeInTheDocument();
    expect(screen.getByText(/Connect to a backend to preview this object form/i)).toBeInTheDocument();
  });
});

describe('ScreenPreview — visibleWhen field gating', () => {
  const node = {
    id: 's1',
    config: {
      fields: [
        { name: 'createOpp', label: 'Create Opportunity?', type: 'boolean' },
        { name: 'oppName', label: 'Opportunity Name', type: 'text', visibleWhen: '{createOpp} == true' },
      ],
    },
  };

  it('hides a conditional field when its visibleWhen is false, with a hint', () => {
    render(<ScreenPreview node={node} variables={{ createOpp: false }} />);
    expect(screen.getByText('Create Opportunity?')).toBeInTheDocument();
    expect(screen.queryByText('Opportunity Name')).not.toBeInTheDocument();
    expect(screen.getByText(/hidden by .*visible when/i)).toBeInTheDocument();
  });

  it('shows the conditional field when its visibleWhen is true (no hint)', () => {
    render(<ScreenPreview node={node} variables={{ createOpp: true }} />);
    expect(screen.getByText('Opportunity Name')).toBeInTheDocument();
    expect(screen.queryByText(/hidden by .*visible when/i)).not.toBeInTheDocument();
  });

  it('fail-opens: an undecidable condition (no run state) keeps the field visible', () => {
    // The inspector passes declared defaults; an unset controller can't decide.
    render(<ScreenPreview node={node} variables={{}} />);
    expect(screen.getByText('Opportunity Name')).toBeInTheDocument();
  });
});

describe('isFieldVisibleWhen', () => {
  it('shows when there is no condition or no variables', () => {
    expect(isFieldVisibleWhen(undefined, { x: 1 })).toBe(true);
    expect(isFieldVisibleWhen('', { x: 1 })).toBe(true);
    expect(isFieldVisibleWhen('discount > 0', undefined)).toBe(true);
  });

  it('evaluates {var} and bare-var conditions against the variables', () => {
    expect(isFieldVisibleWhen('{createOpp} == true', { createOpp: true })).toBe(true);
    expect(isFieldVisibleWhen('{createOpp} == true', { createOpp: false })).toBe(false);
    expect(isFieldVisibleWhen('stage == "review"', { stage: 'review' })).toBe(true);
    expect(isFieldVisibleWhen('stage == "review"', { stage: 'draft' })).toBe(false);
    expect(isFieldVisibleWhen('discount > 0', { discount: 5 })).toBe(true);
    expect(isFieldVisibleWhen('discount > 0', { discount: 0 })).toBe(false);
  });

  it('fail-opens when a referenced variable is not set', () => {
    expect(isFieldVisibleWhen('{createOpp} == true', {})).toBe(true);
  });
});

describe('buildScreenSpec', () => {
  it('maps authored config keys onto the runtime ScreenSpec', () => {
    const spec = buildScreenSpec({
      id: 'n1',
      config: {
        title: 'T',
        description: 'D',
        fields: [{ name: 'a', label: 'A', type: 'text', required: true }, { bad: 'no-name' }],
        idVariable: 'account_id',
      },
    });
    expect(spec.nodeId).toBe('n1');
    expect(spec.kind).toBe('fields');
    expect(spec.fields).toEqual([{ name: 'a', label: 'A', type: 'text', required: true }]);
    expect(spec.idVariable).toBe('account_id');
  });

  it('switches to object-form kind when objectName is set', () => {
    const spec = buildScreenSpec({ id: 'n1', config: { objectName: 'crm_account', mode: 'create' } });
    expect(spec.kind).toBe('object-form');
    expect(spec.objectName).toBe('crm_account');
    expect(spec.mode).toBe('create');
  });

  it('gates fields by visibleWhen against the supplied variables', () => {
    const cfg = {
      id: 'n1',
      config: {
        fields: [
          { name: 'createOpp', label: 'Create?', type: 'boolean' },
          { name: 'oppName', label: 'Name', type: 'text', visibleWhen: '{createOpp} == true' },
        ],
      },
    };
    expect(buildScreenSpec(cfg, { createOpp: true }).fields.map((f) => f.name)).toEqual(['createOpp', 'oppName']);
    expect(buildScreenSpec(cfg, { createOpp: false }).fields.map((f) => f.name)).toEqual(['createOpp']);
    // No variables → keep every field (design preview never hides on missing data).
    expect(buildScreenSpec(cfg).fields.map((f) => f.name)).toEqual(['createOpp', 'oppName']);
    expect(hiddenFieldCount(cfg, { createOpp: false })).toBe(1);
    expect(hiddenFieldCount(cfg, { createOpp: true })).toBe(0);
  });
});
