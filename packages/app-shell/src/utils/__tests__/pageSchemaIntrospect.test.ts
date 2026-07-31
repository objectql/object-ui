import { describe, it, expect } from 'vitest';
import { hasExplicitDiscussion, hasExplicitAttachments } from '../pageSchemaIntrospect';

describe('hasExplicitDiscussion', () => {
  it('returns false for nullish and primitive inputs', () => {
    expect(hasExplicitDiscussion(null)).toBe(false);
    expect(hasExplicitDiscussion(undefined)).toBe(false);
    expect(hasExplicitDiscussion('record:discussion')).toBe(false);
    expect(hasExplicitDiscussion(42)).toBe(false);
  });

  it('detects record:discussion at the root', () => {
    expect(hasExplicitDiscussion({ type: 'record:discussion' })).toBe(true);
  });

  it('detects the record:chatter alias', () => {
    expect(hasExplicitDiscussion({ type: 'record:chatter' })).toBe(true);
  });

  it('detects discussion nested inside children/items/body/components', () => {
    const node = (key: string) => ({
      type: 'foo',
      [key]: [{ type: 'record:discussion' }],
    });
    expect(hasExplicitDiscussion(node('children'))).toBe(true);
    expect(hasExplicitDiscussion(node('items'))).toBe(true);
    expect(hasExplicitDiscussion(node('body'))).toBe(true);
    expect(hasExplicitDiscussion(node('components'))).toBe(true);
  });

  it('detects discussion nested inside properties.children/items', () => {
    expect(
      hasExplicitDiscussion({
        type: 'foo',
        properties: { children: [{ type: 'record:discussion' }] },
      }),
    ).toBe(true);
    expect(
      hasExplicitDiscussion({
        type: 'foo',
        properties: { items: [{ type: 'record:chatter' }] },
      }),
    ).toBe(true);
  });

  it('detects discussion nested inside regions[].components[] (synth + full pages)', () => {
    // Mirrors buildDefaultPageSchema output shape.
    const synthPage = {
      type: 'record',
      pageType: 'record',
      object: 'account',
      template: 'full-width',
      regions: [
        {
          name: 'main',
          width: 'full',
          components: [
            { type: 'page:header' },
            { type: 'page:tabs', items: [{ type: 'page:tab', children: [] }] },
            { type: 'record:discussion' },
          ],
        },
      ],
    };
    expect(hasExplicitDiscussion(synthPage)).toBe(true);
  });

  it('returns false when no discussion node exists anywhere in the tree', () => {
    const page = {
      type: 'record',
      regions: [
        {
          name: 'main',
          components: [
            { type: 'page:header' },
            {
              type: 'page:tabs',
              items: [
                { type: 'page:tab', children: [{ type: 'record:details' }] },
                { type: 'page:tab', children: [{ type: 'record:history' }] },
              ],
            },
          ],
        },
      ],
    };
    expect(hasExplicitDiscussion(page)).toBe(false);
  });

  it('handles deep nesting (page:tabs > page:tab > record:discussion)', () => {
    const page = {
      regions: [
        {
          components: [
            {
              type: 'page:tabs',
              items: [
                {
                  type: 'page:tab',
                  children: [{ type: 'record:discussion' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(hasExplicitDiscussion(page)).toBe(true);
  });

  it('does not loop forever on cyclic schemas', () => {
    const a: any = { type: 'page:section' };
    const b: any = { type: 'page:section', children: [a] };
    a.children = [b];
    expect(hasExplicitDiscussion(a)).toBe(false);
  });
});

// objectstack#4358 — the synthesized default page now places
// `record:attachments` beside the discussion feed; RecordDetailView uses this
// walker to skip its legacy bottom-of-page append.
describe('hasExplicitAttachments', () => {
  it('returns false for nullish and primitive inputs', () => {
    expect(hasExplicitAttachments(null)).toBe(false);
    expect(hasExplicitAttachments(undefined)).toBe(false);
    expect(hasExplicitAttachments('record:attachments')).toBe(false);
  });

  it('detects record:attachments at the root and nested in children', () => {
    expect(hasExplicitAttachments({ type: 'record:attachments' })).toBe(true);
    expect(
      hasExplicitAttachments({
        type: 'grid',
        children: [{ type: 'record:attachments' }, { type: 'record:discussion' }],
      }),
    ).toBe(true);
  });

  it('detects attachments inside the synthesized footer grid (regions[].components[])', () => {
    // Mirrors buildDefaultPageSchema output for an enable.files object.
    const synthPage = {
      type: 'record',
      regions: [
        {
          name: 'main',
          components: [
            { type: 'page:header' },
            { type: 'page:tabs', items: [{ type: 'page:tab', children: [] }] },
            {
              type: 'grid',
              columns: { xs: 1, lg: 3 },
              children: [
                { type: 'record:attachments', className: 'lg:col-span-1' },
                { type: 'record:discussion', className: 'lg:col-span-2' },
              ],
            },
          ],
        },
      ],
    };
    expect(hasExplicitAttachments(synthPage)).toBe(true);
  });

  it('returns false when no attachments node exists (discussion alone)', () => {
    expect(
      hasExplicitAttachments({
        regions: [{ components: [{ type: 'record:discussion' }] }],
      }),
    ).toBe(false);
  });
});
