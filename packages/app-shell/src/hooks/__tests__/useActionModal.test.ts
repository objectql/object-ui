import { describe, it, expect } from 'vitest';
import { normalizeModalSchema } from '../useActionModal';

describe('normalizeModalSchema', () => {
  it('keeps a string target UNRESOLVED — page-vs-object is a metadata question', () => {
    // framework#3530: assuming "object" here sent every page-targeting modal
    // action to GET /meta/object/<page>, which 400s and rendered ModalForm's
    // "Error loading form — Bad Request". `resolveModalTarget` asks the
    // metadata service instead (see useActionModal.resolve.test.tsx).
    expect(normalizeModalSchema('log_call')).toEqual({ targetName: 'log_call' });
    expect(normalizeModalSchema('contact')).toEqual({ targetName: 'contact' });
  });

  it('carries a create_/new_/add_ prefix guess ALONGSIDE the raw target', () => {
    expect(normalizeModalSchema('create_opportunity')).toEqual({
      targetName: 'create_opportunity', objectName: 'opportunity', mode: 'create',
    });
    expect(normalizeModalSchema('new_task')).toEqual({
      targetName: 'new_task', objectName: 'task', mode: 'create',
    });
    expect(normalizeModalSchema('add_note')).toEqual({
      targetName: 'add_note', objectName: 'note', mode: 'create',
    });
  });

  it('carries an edit_/update_ prefix guess as an edit form', () => {
    expect(normalizeModalSchema('edit_account')).toEqual({
      targetName: 'edit_account', objectName: 'account', mode: 'edit',
    });
    expect(normalizeModalSchema('update_lead')).toEqual({
      targetName: 'update_lead', objectName: 'lead', mode: 'edit',
    });
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
