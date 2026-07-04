import { describe, it, expect } from 'vitest';
import { sanitizeFormData } from './sanitize';

describe('sanitizeFormData', () => {
  it('drops server-managed keys regardless of schema', () => {
    const out = sanitizeFormData({
      id: 'r1',
      _id: 'r1',
      created_at: 'x',
      updated_at: 'x',
      createdAt: 'x',
      updatedAt: 'x',
      organization_id: 'o1',
      organizationId: 'o1',
      name: 'keep',
    });
    // No schema → only server-managed keys are stripped; business keys stay.
    expect(out).toEqual({ name: 'keep' });
  });

  it('drops computed / read-only field types when a schema is provided', () => {
    const schema = {
      fields: {
        name: { type: 'text' },
        budget: { type: 'currency' },
        // Computed field types — never writable, server rejects them.
        budget_remaining: { type: 'formula' },
        task_count: { type: 'summary' },
        seq: { type: 'autonumber' },
        // Flagged read-only / computed even though the base type is writable.
        locked: { type: 'text', readonly: true },
        derived: { type: 'text', computed: true },
      },
    };
    const out = sanitizeFormData(
      {
        name: 'Website',
        budget: 1000,
        budget_remaining: 400,
        task_count: 5,
        seq: 42,
        locked: 'no',
        derived: 'no',
      },
      schema,
    );
    expect(out).toEqual({ name: 'Website', budget: 1000 });
  });

  it('drops keys absent from the schema (flattened/projected fields)', () => {
    const schema = { fields: { name: { type: 'text' } } };
    const out = sanitizeFormData({ name: 'keep', account__name: 'drop' }, schema);
    expect(out).toEqual({ name: 'keep' });
  });

  it('keeps unknown business keys when schema is null (inline forms)', () => {
    // Inline forms have no fetched object schema; passing null must NOT drop
    // every key — only the server-managed ones.
    const out = sanitizeFormData({ id: 'r1', anything: 1, custom: 'ok' }, null);
    expect(out).toEqual({ anything: 1, custom: 'ok' });
  });

  it('returns non-object input unchanged', () => {
    expect(sanitizeFormData(undefined as any)).toBeUndefined();
    expect(sanitizeFormData(null as any)).toBeNull();
  });
});
