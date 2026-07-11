import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ObjectForm } from './ObjectForm';
import { registerAllFields } from '@object-ui/fields';
import React from 'react';

registerAllFields();

/**
 * ADR-0092 D4 — managed-object edit affordance gating.
 *
 * Non-`platform` lifecycle buckets (config / system / append-only /
 * better-auth) blanket-disable every form field by default. When an object
 * OPENS per-record editing for the mode via `userActions.{edit,create}`, the
 * blanket lock lifts and each field's own `readonly` flag decides — so a
 * `managedBy:'better-auth'` object like sys_user can expose `name`/`image`
 * while keeping `email`/`role` read-only. The server-side write guard is the
 * real boundary; this is UX only.
 */
describe('ObjectForm — managed-object edit affordance (ADR-0092 D4)', () => {
  const sysUserFields = {
    name: { type: 'text', label: 'Name', readonly: false },
    image: { type: 'url', label: 'Profile Image', readonly: false },
    email: { type: 'email', label: 'Email', readonly: true },
    role: { type: 'text', label: 'Role', readonly: true },
  };

  const record = { id: 'u1', name: 'Dev Admin', email: 'a@b.c', role: 'user', image: '' };
  const dsFor = (schema: any): any => ({
    getObjectSchema: vi.fn().mockResolvedValue(schema),
    findOne: vi.fn().mockResolvedValue(record),
    getRecord: vi.fn().mockResolvedValue(record),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  });

  const renderEdit = (schema: any) =>
    render(
      <ObjectForm
        schema={{ type: 'object-form', objectName: schema.name, mode: 'edit', recordId: 'u1' } as any}
        dataSource={dsFor(schema)}
      />,
    );

  async function inputByName(container: HTMLElement, name: string): Promise<HTMLInputElement> {
    return waitFor(() => {
      const el = container.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
      if (!el) throw new Error(`${name} input not yet rendered`);
      return el;
    });
  }

  it('better-auth object WITH userActions.edit: editable (readonly:false) field becomes an enabled input', async () => {
    const schema = { name: 'sys_user', managedBy: 'better-auth', userActions: { edit: true }, fields: sysUserFields };
    const { container } = renderEdit(schema);

    // The profile field the affordance opens (readonly:false) is now editable —
    // the blanket managed-object lock no longer applies. (readonly:true fields
    // like email/role are excluded from the edit form by the existing
    // readonly-field mechanism, so they can never be edited here either.)
    const name = await inputByName(container, 'name');
    expect(name.disabled).toBe(false);
    // No readonly field leaks in as an enabled input.
    expect(container.querySelector('input[name="email"]:not([disabled])')).toBeNull();
    expect(container.querySelector('input[name="role"]:not([disabled])')).toBeNull();
  });

  it('better-auth object WITHOUT userActions.edit: blanket lock disables the field (backward compat)', async () => {
    const schema = { name: 'sys_session', managedBy: 'better-auth', fields: sysUserFields };
    const { container } = renderEdit(schema);

    const name = await inputByName(container, 'name');
    expect(name.disabled).toBe(true); // no affordance override → blanket lock applies even to readonly:false
  });

  it('platform object: fields editable regardless (unchanged behavior)', async () => {
    const schema = { name: 'crm_lead', managedBy: 'platform', fields: { name: { type: 'text', label: 'Name' } } };
    const { container } = renderEdit(schema);
    const name = await inputByName(container, 'name');
    expect(name.disabled).toBe(false);
  });
});
