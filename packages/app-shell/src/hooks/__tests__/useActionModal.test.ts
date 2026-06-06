import { describe, it, expect } from 'vitest';
import { normalizeModalSchema } from '../useActionModal';

describe('normalizeModalSchema', () => {
  it('maps create_/new_/add_ string targets to a create object-form', () => {
    expect(normalizeModalSchema('create_opportunity')).toEqual({ objectName: 'opportunity', mode: 'create' });
    expect(normalizeModalSchema('new_task')).toEqual({ objectName: 'task', mode: 'create' });
    expect(normalizeModalSchema('add_note')).toEqual({ objectName: 'note', mode: 'create' });
  });

  it('maps edit_/update_ string targets to an edit object-form', () => {
    expect(normalizeModalSchema('edit_account')).toEqual({ objectName: 'account', mode: 'edit' });
    expect(normalizeModalSchema('update_lead')).toEqual({ objectName: 'lead', mode: 'edit' });
  });

  it('treats a bare string as a create form for that object', () => {
    expect(normalizeModalSchema('contact')).toEqual({ objectName: 'contact', mode: 'create' });
  });

  it('treats a bare SchemaNode (has type, no descriptor keys) as content', () => {
    const node = { type: 'element:definition-list', properties: { items: [] } };
    expect(normalizeModalSchema(node)).toEqual({ content: node });
  });

  it('passes a modal descriptor through unchanged', () => {
    const desc = { placement: 'side', title: 'Details', content: { type: 'x' } };
    expect(normalizeModalSchema(desc)).toBe(desc);
  });

  it('keeps an object-form descriptor (objectName) as-is', () => {
    const desc = { objectName: 'task', mode: 'edit', recordId: '1' };
    expect(normalizeModalSchema(desc)).toBe(desc);
  });
});
