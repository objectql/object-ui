/**
 * Tests for resolveRecordFormTarget — the modal-vs-page decision used by
 * `AppContent.handleEdit` when the user clicks "Create" or "Edit" on a
 * record. Covers:
 *   - default (no editMode) → modal
 *   - editMode: 'modal' → modal (explicit opt-out)
 *   - editMode: 'page' + null/undefined record → create URL
 *   - editMode: 'page' + record with id → edit URL
 *   - editMode: 'page' + record with _id (Mongo-style) → edit URL
 *   - URL encoding of record ids that contain reserved characters
 *   - missing objectDef → modal (defensive fallback)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveRecordFormTarget,
  resolveFormViewLayout,
  resolveNavigateCreateUrl,
  resolveNavigateEditUrl,
} from '../recordFormNavigation';

describe('resolveRecordFormTarget', () => {
  const baseUrl = '/apps/sales';

  it('returns modal when editMode is unset (default)', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account' },
        baseUrl,
        record: null,
      }),
    ).toEqual({ kind: 'modal' });
  });

  it('returns modal when editMode is explicitly "modal"', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'modal' },
        baseUrl,
        record: { id: 'r1' },
      }),
    ).toEqual({ kind: 'modal' });
  });

  it('returns the create URL when editMode is "page" and no record is provided', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: null,
      }),
    ).toEqual({ kind: 'page', url: '/apps/sales/account/new' });
  });

  it('returns the edit URL when editMode is "page" and record has id', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: { id: 'r1' },
      }),
    ).toEqual({ kind: 'page', url: '/apps/sales/account/record/r1/edit' });
  });

  it('falls back to record._id (Mongo-style) when id is missing', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: { _id: 'mongo-7' },
      }),
    ).toEqual({ kind: 'page', url: '/apps/sales/account/record/mongo-7/edit' });
  });

  it('URL-encodes record ids with reserved characters', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: { id: 'a/b c' },
      }),
    ).toEqual({
      kind: 'page',
      url: '/apps/sales/account/record/a%2Fb%20c/edit',
    });
  });

  it('treats an empty-string id as create-mode', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: { id: '' },
      }),
    ).toEqual({ kind: 'page', url: '/apps/sales/account/new' });
  });

  it('treats numeric ids correctly', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: 'account', editMode: 'page' },
        baseUrl,
        record: { id: 42 },
      }),
    ).toEqual({ kind: 'page', url: '/apps/sales/account/record/42/edit' });
  });

  it('returns modal when objectDef is missing (defensive fallback)', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: null,
        baseUrl,
        record: { id: 'r1' },
      }),
    ).toEqual({ kind: 'modal' });
  });

  it('returns modal when objectDef has no name', () => {
    expect(
      resolveRecordFormTarget({
        objectDef: { name: '', editMode: 'page' },
        baseUrl,
        record: { id: 'r1' },
      }),
    ).toEqual({ kind: 'modal' });
  });
});

describe('resolveNavigateCreateUrl', () => {
  const defaultBaseUrl = '/apps/sales';

  it('uses params.objectName as primary source', () => {
    expect(
      resolveNavigateCreateUrl({
        action: { params: { objectName: 'lead' } },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/new' });
  });

  it('falls back to action.objectName when params.objectName is missing', () => {
    expect(
      resolveNavigateCreateUrl({
        action: { objectName: 'lead' },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/new' });
  });

  it('falls back to context.objectName as last resort', () => {
    expect(
      resolveNavigateCreateUrl({
        action: {},
        context: { objectName: 'lead' },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/new' });
  });

  it('prefers context.baseUrl over defaultBaseUrl', () => {
    expect(
      resolveNavigateCreateUrl({
        action: { params: { objectName: 'lead' } },
        context: { baseUrl: '/apps/marketing' },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/marketing/lead/new' });
  });

  it('errors when objectName cannot be resolved', () => {
    expect(
      resolveNavigateCreateUrl({
        action: {},
        defaultBaseUrl,
      }),
    ).toEqual({
      success: false,
      error: 'navigate_create: objectName is required',
    });
  });
});

describe('resolveNavigateEditUrl', () => {
  const defaultBaseUrl = '/apps/sales';

  it('builds the edit URL from params', () => {
    expect(
      resolveNavigateEditUrl({
        action: { params: { objectName: 'lead', recordId: 'L-7' } },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/record/L-7/edit' });
  });

  it('falls back to action.objectName + action.recordId', () => {
    expect(
      resolveNavigateEditUrl({
        action: { objectName: 'lead', recordId: 'L-7' },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/record/L-7/edit' });
  });

  it('uses context.objectName but never context.recordId', () => {
    // recordId must always come from the action — every record click
    // should provide its own id.
    expect(
      resolveNavigateEditUrl({
        action: { params: { recordId: 'L-7' } },
        context: { objectName: 'lead' },
        defaultBaseUrl,
      }),
    ).toEqual({ success: true, url: '/apps/sales/lead/record/L-7/edit' });
  });

  it('URL-encodes record ids', () => {
    expect(
      resolveNavigateEditUrl({
        action: { params: { objectName: 'lead', recordId: 'a/b c' } },
        defaultBaseUrl,
      }),
    ).toEqual({
      success: true,
      url: '/apps/sales/lead/record/a%2Fb%20c/edit',
    });
  });

  it('errors when objectName is missing', () => {
    expect(
      resolveNavigateEditUrl({
        action: { params: { recordId: 'L-7' } },
        defaultBaseUrl,
      }),
    ).toEqual({
      success: false,
      error: 'navigate_edit: objectName and recordId are required',
    });
  });

  it('errors when recordId is missing', () => {
    expect(
      resolveNavigateEditUrl({
        action: { params: { objectName: 'lead' } },
        defaultBaseUrl,
      }),
    ).toEqual({
      success: false,
      error: 'navigate_edit: objectName and recordId are required',
    });
  });

  it('errors when recordId is empty string', () => {
    expect(
      resolveNavigateEditUrl({
        action: { params: { objectName: 'lead', recordId: '' } },
        defaultBaseUrl,
      }),
    ).toEqual({
      success: false,
      error: 'navigate_edit: objectName and recordId are required',
    });
  });
});


describe('resolveFormViewLayout', () => {
  it('returns {} when objectDef is missing', () => {
    expect(resolveFormViewLayout(undefined)).toEqual({});
    expect(resolveFormViewLayout(null)).toEqual({});
  });

  it('returns {} when the object declares no form view', () => {
    expect(resolveFormViewLayout({})).toEqual({});
    expect(resolveFormViewLayout({ formViews: {} })).toEqual({});
  });

  it('returns the curated sections for a simple form view (no contentLayout)', () => {
    const sections = [{ label: 'Details', fields: [{ field: 'subject' }] }];
    expect(resolveFormViewLayout({ form: { type: 'simple', sections } })).toEqual({ sections });
  });

  it('adds contentLayout:"tabbed" for a tabbed form view with sections', () => {
    const sections = [
      { label: 'A', fields: [{ field: 'x' }] },
      { label: 'B', fields: [{ field: 'y' }] },
    ];
    expect(resolveFormViewLayout({ form: { type: 'tabbed', sections } })).toEqual({
      sections,
      contentLayout: 'tabbed',
    });
  });

  it('stacks wizard/split sections (no contentLayout — no modal equivalent)', () => {
    const sections = [{ label: 'Step 1', fields: ['a'] }];
    expect(resolveFormViewLayout({ form: { type: 'wizard', sections } })).toEqual({ sections });
    expect(resolveFormViewLayout({ form: { type: 'split', sections } })).toEqual({ sections });
  });

  it('treats an empty sections array as "no curation" (omits the key)', () => {
    expect(resolveFormViewLayout({ form: { type: 'simple', sections: [] } })).toEqual({});
    // …even when tabbed: contentLayout only rides along with real sections.
    expect(resolveFormViewLayout({ form: { type: 'tabbed', sections: [] } })).toEqual({});
  });

  it('forwards non-empty subforms (master-detail) and omits empty ones', () => {
    const subforms = [{ childObject: 'invoice_line' }];
    expect(resolveFormViewLayout({ form: { type: 'simple', subforms } })).toEqual({ subforms });
    expect(resolveFormViewLayout({ form: { type: 'simple', subforms: [] } })).toEqual({});
  });

  it('combines sections + subforms', () => {
    const sections = [{ label: 'Details', fields: ['subject'] }];
    const subforms = [{ childObject: 'invoice_line' }];
    expect(resolveFormViewLayout({ form: { type: 'simple', sections, subforms } })).toEqual({
      sections,
      subforms,
    });
  });

  it('falls back to formViews.default when `form` is absent (legacy container)', () => {
    const sections = [{ label: 'Details', fields: ['subject'] }];
    expect(
      resolveFormViewLayout({ formViews: { default: { type: 'simple', sections } } }),
    ).toEqual({ sections });
  });

  it('prefers the default `form` ViewItem over formViews.default', () => {
    const formSections = [{ label: 'Primary', fields: ['a'] }];
    const legacySections = [{ label: 'Legacy', fields: ['b'] }];
    expect(
      resolveFormViewLayout({
        form: { type: 'simple', sections: formSections },
        formViews: { default: { type: 'simple', sections: legacySections } },
      }),
    ).toEqual({ sections: formSections });
  });
});
