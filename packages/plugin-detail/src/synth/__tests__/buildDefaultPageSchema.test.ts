/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDefaultPageSchema,
  buildDefaultHeader,
  buildDefaultActions,
  buildDefaultHighlights,
  buildDefaultTabs,
  buildDefaultDiscussion,
  detectStatusField,
  deriveStages,
  deriveHighlightFields,
  deriveFieldGroupDetailSections,
  resolveDetailSections,
  type ObjectDefLike,
} from '../buildDefaultPageSchema';

const leadDef: ObjectDefLike = {
  name: 'lead',
  label: 'Lead',
  fields: {
    first_name: { name: 'first_name', label: 'First Name', type: 'text' },
    last_name: { name: 'last_name', label: 'Last Name', type: 'text' },
    email: { name: 'email', label: 'Email', type: 'email' },
    phone: { name: 'phone', label: 'Phone', type: 'phone' },
    rating: { name: 'rating', label: 'Rating', type: 'text' },
    source: { name: 'source', label: 'Source', type: 'text' },
    owner_id: { name: 'owner_id', label: 'Owner', type: 'lookup' },
    status: {
      name: 'status',
      label: 'Status',
      type: 'picklist',
      options: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'qualified', label: 'Qualified' },
      ],
    },
    created_at: { name: 'created_at', label: 'Created', type: 'datetime' },
  },
};

describe('detectStatusField', () => {
  it('returns null for undefined def', () => {
    expect(detectStatusField(undefined)).toBeNull();
  });

  it('honours explicit stageField', () => {
    expect(detectStatusField({ stageField: 'pipeline', fields: { pipeline: {} } }))
      .toBe('pipeline');
  });

  it('picks status by name', () => {
    expect(detectStatusField(leadDef)).toBe('status');
  });

  it('falls back to stage / state / phase', () => {
    expect(detectStatusField({ fields: { stage: {} } })).toBe('stage');
    expect(detectStatusField({ fields: { state: {} } })).toBe('state');
    expect(detectStatusField({ fields: { phase: {} } })).toBe('phase');
  });

  it('detects by type=status when no canonical name present', () => {
    expect(
      detectStatusField({ fields: { lifecycle: { type: 'status' } } }),
    ).toBe('lifecycle');
  });

  it('returns null when nothing matches', () => {
    expect(detectStatusField({ fields: { foo: {} } })).toBeNull();
  });
});

describe('deriveStages', () => {
  it('returns null when statusField missing', () => {
    expect(deriveStages(leadDef, null)).toBeNull();
  });

  it('returns null when field has no options', () => {
    expect(deriveStages({ fields: { status: {} } }, 'status')).toBeNull();
  });

  it('maps picklist options to {value,label}', () => {
    expect(deriveStages(leadDef, 'status')).toEqual([
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
    ]);
  });
});

describe('deriveHighlightFields', () => {
  it('honours explicit objectDef.highlightFields', () => {
    expect(deriveHighlightFields({ ...leadDef, highlightFields: ['email', 'phone'] }, 'status'))
      .toEqual(['email', 'phone']);
  });

  it('caps explicit list at max', () => {
    expect(
      deriveHighlightFields(
        { ...leadDef, highlightFields: ['a', 'b', 'c', 'd', 'e', 'f'] },
        null,
        3,
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('prefers owner / rating / source / phone / email and skips status', () => {
    const fields = deriveHighlightFields(leadDef, 'status');
    expect(fields).not.toContain('status');
    expect(fields).not.toContain('created_at');
    expect(fields).toContain('owner_id');
    expect(fields.length).toBeLessThanOrEqual(4);
  });

  it('falls back to any field order when preferred names absent', () => {
    const def: ObjectDefLike = { fields: { foo: {}, bar: {}, baz: {} } };
    expect(deriveHighlightFields(def, null)).toEqual(['foo', 'bar', 'baz']);
  });

  it('skips system tenancy + audit fields (organization_id, created_by, etc.)', () => {
    const def: ObjectDefLike = {
      fields: {
        id: {},
        organization_id: {},
        created_by: {},
        updated_by: {},
        tenant_id: {},
        workspace_id: {},
        useful_field: {},
        another_useful: {},
      },
    };
    const fields = deriveHighlightFields(def, null);
    expect(fields).not.toContain('organization_id');
    expect(fields).not.toContain('created_by');
    expect(fields).not.toContain('updated_by');
    expect(fields).not.toContain('tenant_id');
    expect(fields).not.toContain('workspace_id');
    expect(fields).toContain('useful_field');
    expect(fields).toContain('another_useful');
  });

  it('skips the record primary/title field to avoid duplicating the page H1', () => {
    const def: ObjectDefLike = {
      primaryField: 'subject',
      fields: {
        subject: {},
        name: {}, // common candidate also skipped
        priority: {},
        status: {},
        due_date: {},
        notes: {},
      },
    };
    const fields = deriveHighlightFields(def, 'status');
    expect(fields).not.toContain('subject');
    expect(fields).not.toContain('name');
    expect(fields).not.toContain('status');
    expect(fields).toContain('priority');
  });
});

describe('buildDefaultPageSchema', () => {
  it('emits a record Page with full-width template + main region', () => {
    const page = buildDefaultPageSchema(leadDef);
    expect(page.type).toBe('record');
    expect(page.pageType).toBe('record');
    expect(page.object).toBe('lead');
    expect(page.template).toBe('full-width');
    expect(page.regions).toHaveLength(1);
    expect(page.regions[0].name).toBe('main');
  });

  it('emits page:header, record:highlights, record:path, page:tabs, record:discussion', () => {
    const types = buildDefaultPageSchema(leadDef).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).toEqual([
      'page:header',
      'record:highlights',
      'record:path',
      'page:tabs',
      'record:discussion',
    ]);
  });

  it('omits record:path when no status field', () => {
    const def: ObjectDefLike = { name: 'note', fields: { body: {} } };
    const types = buildDefaultPageSchema(def).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).not.toContain('record:path');
  });

  it('omits record:highlights when no fields derivable', () => {
    const def: ObjectDefLike = { name: 'empty', fields: {} };
    const types = buildDefaultPageSchema(def).regions[0].components.map(
      (c: any) => c.type,
    );
    expect(types).not.toContain('record:highlights');
  });

  it('hideDiscussion drops record:discussion', () => {
    const types = buildDefaultPageSchema(leadDef, { hideDiscussion: true })
      .regions[0].components.map((c: any) => c.type);
    expect(types).not.toContain('record:discussion');
  });

  it('hideHighlights / hidePath each drop their component', () => {
    const types = buildDefaultPageSchema(leadDef, {
      hideHighlights: true,
      hidePath: true,
    }).regions[0].components.map((c: any) => c.type);
    expect(types).not.toContain('record:highlights');
    expect(types).not.toContain('record:path');
  });

  it('options override auto-derivation', () => {
    const page = buildDefaultPageSchema(leadDef, {
      highlightFields: ['email'],
      statusField: 'rating',
      stages: [{ value: 'hot', label: 'Hot' }],
    });
    const hl = page.regions[0].components.find((c: any) => c.type === 'record:highlights');
    const path = page.regions[0].components.find((c: any) => c.type === 'record:path');
    expect(hl.fields).toEqual(['email']);
    expect(path.statusField).toBe('rating');
    expect(path.stages).toEqual([{ value: 'hot', label: 'Hot' }]);
  });

  it('page:header.recordChrome defaults to true and can be turned off', () => {
    const on = buildDefaultPageSchema(leadDef).regions[0].components[0];
    const off = buildDefaultPageSchema(leadDef, { recordChrome: false }).regions[0].components[0];
    expect(on.recordChrome).toBe(true);
    expect(off.recordChrome).toBe(false);
  });

  it('page:tabs always carries a details tab containing record:details', () => {
    const tabs = buildDefaultPageSchema(leadDef).regions[0].components.find(
      (c: any) => c.type === 'page:tabs',
    );
    expect(tabs.items).toHaveLength(1);
    expect(tabs.items[0].label).toBe('Details');
    expect(tabs.items[0].children[0].type).toBe('record:details');
  });

  it('handles undefined def gracefully', () => {
    const page = buildDefaultPageSchema(undefined);
    expect(page.type).toBe('record');
    expect(page.object).toBeUndefined();
    const types = page.regions[0].components.map((c: any) => c.type);
    // Should still emit page:header + page:tabs + record:discussion;
    // no highlights / path because the def is empty.
    expect(types).toEqual(['page:header', 'page:tabs', 'record:discussion']);
  });

  describe('slice 4 — headerActions / related / activity / history', () => {
    it('embeds headerActions into page:header.actions instead of a separate quick_actions node', () => {
      const page = buildDefaultPageSchema(leadDef, {
        headerActions: [
          { name: 'edit', label: 'Edit', locations: ['record_header'] },
        ],
      });
      const types = page.regions[0].components.map((c: any) => c.type);
      expect(types[0]).toBe('page:header');
      // No separate record:quick_actions sibling — actions live on the header.
      expect(types).not.toContain('record:quick_actions');
      const header = page.regions[0].components[0];
      expect(Array.isArray(header.actions)).toBe(true);
      expect(header.actions).toHaveLength(1);
      expect(header.actions[0].name).toBe('edit');
    });

    it('omits header.actions when headerActions empty or absent', () => {
      const noOpt = buildDefaultPageSchema(leadDef);
      const emptyOpt = buildDefaultPageSchema(leadDef, { headerActions: [] });
      const header1 = noOpt.regions[0].components[0];
      const header2 = emptyOpt.regions[0].components[0];
      expect(header1.actions).toBeUndefined();
      expect(header2.actions).toBeUndefined();
    });

    it('emits Related tab with one record:related_list per entry', () => {
      const page = buildDefaultPageSchema(leadDef, {
        // The Related tab is the default home for related lists. The
        // Reference Rail is opt-in (`showReferenceRail`), so it stays off
        // here and the Related tab renders even with 2+ related lists.
        related: [
          {
            objectName: 'task',
            relationshipField: 'lead_id',
            title: 'Tasks',
            limit: 10,
          },
          {
            objectName: 'note',
            relationshipField: 'parent_id',
          },
        ],
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items).toHaveLength(2);
      expect(tabs.items[1].label).toBe('Related');
      expect(tabs.items[1].children).toHaveLength(2);
      expect(tabs.items[1].children[0].type).toBe('record:related_list');
      expect(tabs.items[1].children[0].objectName).toBe('task');
      expect(tabs.items[1].children[0].relationshipField).toBe('lead_id');
      expect(tabs.items[1].children[0].limit).toBe(10);
    });

    it('does NOT emit a Reference Rail by default, keeping the Related tab', () => {
      const page = buildDefaultPageSchema(leadDef, {
        related: [
          { objectName: 'task', relationshipField: 'lead_id' },
          { objectName: 'note', relationshipField: 'parent_id' },
        ],
      });
      // No aside region — the rail is opt-in.
      expect(page.regions.find((r: any) => r.name === 'aside')).toBeUndefined();
      // Related tab survives (Details + Related).
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      const labels = tabs.items.map((t: any) => t.label);
      expect(labels).toContain('Related');
    });

    it('emits a Reference Rail aside region and suppresses the duplicate Related tab when showReferenceRail is on and 2+ related lists are present', () => {
      const page = buildDefaultPageSchema(leadDef, {
        showReferenceRail: true,
        related: [
          { objectName: 'task', relationshipField: 'lead_id' },
          { objectName: 'note', relationshipField: 'parent_id' },
        ],
      });
      // Related tab is suppressed (Details only)
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items).toHaveLength(1);
      expect(tabs.items[0].label).toBe('Details');
      // Aside region emitted with the rail
      const aside = page.regions.find((r: any) => r.name === 'aside');
      expect(aside).toBeDefined();
      expect(aside.components[0].type).toBe('record:reference_rail');
      expect(aside.components[0].entries).toHaveLength(2);
      expect(aside.components[0].entries[0].objectName).toBe('task');
    });

    it('emits aside region from slots.rightRail even without any related lists', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: {
          rightRail: [
            { type: 'card', title: 'Workflow status', children: [] },
          ],
        },
      });
      const aside = page.regions.find((r: any) => r.name === 'aside');
      expect(aside).toBeDefined();
      // No reference rail (no related lists), only the slot contribution
      expect(aside.components).toHaveLength(1);
      expect(aside.components[0].type).toBe('card');
      expect(aside.components[0].title).toBe('Workflow status');
    });

    it('appends slots.rightRail after the auto-emitted reference rail', () => {
      const page = buildDefaultPageSchema(leadDef, {
        showReferenceRail: true,
        related: [
          { objectName: 'task', relationshipField: 'lead_id' },
          { objectName: 'note', relationshipField: 'parent_id' },
        ],
        slots: {
          rightRail: { type: 'card', title: 'Activity' },
        },
      });
      const aside = page.regions.find((r: any) => r.name === 'aside');
      expect(aside).toBeDefined();
      expect(aside.components).toHaveLength(2);
      expect(aside.components[0].type).toBe('record:reference_rail');
      expect(aside.components[1].type).toBe('card');
    });

    it('emits Activity tab when showActivity is true', () => {
      const page = buildDefaultPageSchema(leadDef, { showActivity: true });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      const labels = tabs.items.map((t: any) => t.label);
      expect(labels).toContain('Activity');
      const act = tabs.items.find((t: any) => t.label === 'Activity');
      expect(act.children[0].type).toBe('record:activity');
    });

    it('emits History tab with entries when history option provided', () => {
      const entries = [
        { id: '1', timestamp: '2025-01-01', action: 'created' },
      ];
      const page = buildDefaultPageSchema(leadDef, {
        history: { entries, loading: false },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      const hist = tabs.items.find((t: any) => t.label === 'History');
      expect(hist).toBeDefined();
      expect(hist.children[0].type).toBe('record:history');
      expect(hist.children[0].entries).toEqual(entries);
      expect(hist.children[0].loading).toBe(false);
    });

    it('Details / Related / Activity / History tab order is stable', () => {
      const page = buildDefaultPageSchema(leadDef, {
        related: [{ objectName: 'task', relationshipField: 'lead_id' }],
        showActivity: true,
        history: { entries: [], loading: false },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items.map((t: any) => t.label)).toEqual([
        'Details',
        'Related',
        'Activity',
        'History',
      ]);
    });

    describe("relatedLayout: 'tabs'", () => {
      const related = [
        {
          objectName: 'task',
          relationshipField: 'lead_id',
          title: 'Tasks',
          limit: 10,
          icon: 'check',
        },
        {
          objectName: 'note',
          relationshipField: 'parent_id',
        },
      ];

      it("gives each related list its own peer tab instead of one shared Related tab", () => {
        const page = buildDefaultPageSchema(leadDef, {
          related,
          relatedLayout: 'tabs',
        });
        const tabs = page.regions[0].components.find(
          (c: any) => c.type === 'page:tabs',
        );
        // Details + one tab per related child (no shared 'Related' tab).
        expect(tabs.items.map((t: any) => t.label)).toEqual([
          'Details',
          'Tasks',
          'note',
        ]);
        const tasksTab = tabs.items[1];
        expect(tasksTab.icon).toBe('check');
        expect(tasksTab.children).toHaveLength(1);
        expect(tasksTab.children[0].type).toBe('record:related_list');
        expect(tasksTab.children[0].objectName).toBe('task');
        expect(tasksTab.children[0].relationshipField).toBe('lead_id');
        expect(tasksTab.children[0].limit).toBe(10);
        // The second related child (no title) falls back to its objectName.
        expect(tabs.items[2].children[0].objectName).toBe('note');
      });

      it("defaults to the stacked 'Related' tab when relatedLayout is omitted", () => {
        const page = buildDefaultPageSchema(leadDef, { related });
        const tabs = page.regions[0].components.find(
          (c: any) => c.type === 'page:tabs',
        );
        expect(tabs.items.map((t: any) => t.label)).toEqual([
          'Details',
          'Related',
        ]);
        expect(tabs.items[1].children).toHaveLength(2);
      });

      it("still honours hideRelatedTab (no related tabs emitted)", () => {
        const page = buildDefaultPageSchema(leadDef, {
          related,
          relatedLayout: 'tabs',
          hideRelatedTab: true,
        });
        const tabs = page.regions[0].components.find(
          (c: any) => c.type === 'page:tabs',
        );
        expect(tabs.items.map((t: any) => t.label)).toEqual(['Details']);
      });

      it("keeps Activity / History after the per-table tabs", () => {
        const page = buildDefaultPageSchema(leadDef, {
          related,
          relatedLayout: 'tabs',
          showActivity: true,
          history: { entries: [], loading: false },
        });
        const tabs = page.regions[0].components.find(
          (c: any) => c.type === 'page:tabs',
        );
        expect(tabs.items.map((t: any) => t.label)).toEqual([
          'Details',
          'Tasks',
          'note',
          'Activity',
          'History',
        ]);
      });
    });
  });

  describe('slice I — slot overrides', () => {
    it('replaces the page:header node when slots.header is provided', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: { header: { type: 'div', children: 'Custom Header' } },
      });
      const first = page.regions[0].components[0];
      expect(first.type).toBe('div');
      expect(first.children).toBe('Custom Header');
      // header slot should suppress the default page:header
      const hasDefaultHeader = page.regions[0].components.some(
        (c: any) => c.type === 'page:header',
      );
      expect(hasDefaultHeader).toBe(false);
    });

    it('accepts an array slot and flattens it in place', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: {
          header: [
            { type: 'div', id: 'banner' },
            { type: 'page:header' },
          ],
        },
      });
      const types = page.regions[0].components.slice(0, 2).map((c: any) => c.type);
      expect(types).toEqual(['div', 'page:header']);
    });

    it('actions slot overrides even when headerActions is empty', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: { actions: { type: 'div', id: 'custom-bar' } },
      });
      const hasCustom = page.regions[0].components.some(
        (c: any) => c.type === 'div' && c.id === 'custom-bar',
      );
      expect(hasCustom).toBe(true);
    });

    it('highlights slot replaces the entire chips+path strip', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: { highlights: { type: 'div', id: 'custom-strip' } },
      });
      const has = (t: string, id?: string) =>
        page.regions[0].components.some(
          (c: any) => c.type === t && (id == null || c.id === id),
        );
      expect(has('div', 'custom-strip')).toBe(true);
      expect(has('record:highlights')).toBe(false);
      expect(has('record:path')).toBe(false);
    });

    it('details slot replaces only the Details tab body, keeps other tabs', () => {
      const page = buildDefaultPageSchema(leadDef, {
        related: [{ objectName: 'task', relationshipField: 'lead_id' }],
        history: { entries: [], loading: false },
        slots: { details: { type: 'div', id: 'custom-details' } },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items.map((t: any) => t.label)).toEqual([
        'Details',
        'Related',
        'History',
      ]);
      expect(tabs.items[0].children).toEqual([{ type: 'div', id: 'custom-details' }]);
      // record:details default body must be gone
      const firstBodyType = tabs.items[0].children[0].type;
      expect(firstBodyType).toBe('div');
    });

    it('tabs slot wins over details slot when both provided', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: {
          tabs: { type: 'page:tabs', items: [{ label: 'Only', children: [] }] },
          details: { type: 'div', id: 'unused' },
        },
      });
      const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
      expect(tabs.items).toHaveLength(1);
      expect(tabs.items[0].label).toBe('Only');
      // details slot was not applied
      const hasUnused = page.regions[0].components.some(
        (c: any) => c.id === 'unused',
      );
      expect(hasUnused).toBe(false);
    });

    it('discussion slot overrides even when hideDiscussion is true', () => {
      const page = buildDefaultPageSchema(leadDef, {
        hideDiscussion: true,
        slots: { discussion: { type: 'div', id: 'custom-discussion' } },
      });
      const last = page.regions[0].components[page.regions[0].components.length - 1];
      expect(last.id).toBe('custom-discussion');
    });

    it('omitted slots fall through to synth defaults', () => {
      const page = buildDefaultPageSchema(leadDef, {
        slots: { header: { type: 'div', id: 'h' } },
      });
      // header replaced, but discussion + tabs + highlights still default
      const types = page.regions[0].components.map((c: any) => c.type);
      expect(types).toContain('record:highlights');
      expect(types).toContain('record:path');
      expect(types).toContain('page:tabs');
      expect(types).toContain('record:discussion');
    });
  });

  describe('slice I — sub-builders', () => {
    it('buildDefaultHeader returns a page:header node with recordChrome default true', () => {
      const node = buildDefaultHeader(leadDef);
      expect(node).toEqual({ type: 'page:header', recordChrome: true });
    });

    it('buildDefaultActions returns null for empty actions list', () => {
      expect(buildDefaultActions(leadDef, [])).toBeNull();
      expect(buildDefaultActions(leadDef, undefined)).toBeNull();
    });

    it('buildDefaultActions returns a quick_actions node when actions are provided', () => {
      const node = buildDefaultActions(leadDef, [{ id: 'edit', label: 'Edit' }]);
      expect(node?.type).toBe('record:quick_actions');
      expect(node?.location).toBe('record_header');
      expect(node?.actions).toHaveLength(1);
    });

    it('buildDefaultHighlights returns [chips, path] when status field is present', () => {
      const nodes = buildDefaultHighlights(leadDef);
      const types = nodes.map((n) => n.type);
      expect(types).toContain('record:highlights');
      expect(types).toContain('record:path');
    });

    it('buildDefaultHighlights respects hideHighlights / hidePath flags', () => {
      const nodes = buildDefaultHighlights(leadDef, {
        hideHighlights: true,
        hidePath: true,
      });
      expect(nodes).toHaveLength(0);
    });

    it('buildDefaultTabs emits Details/Related/Activity/History in order', () => {
      const tabs = buildDefaultTabs(leadDef, {
        related: [{ objectName: 'task', relationshipField: 'lead_id' }],
        showActivity: true,
        history: { entries: [], loading: false },
      });
      expect(tabs.type).toBe('page:tabs');
      expect(tabs.items.map((t: any) => t.label)).toEqual([
        'Details',
        'Related',
        'Activity',
        'History',
      ]);
    });

    it('buildDefaultDiscussion returns the record:discussion node', () => {
      expect(buildDefaultDiscussion()).toEqual({ type: 'record:discussion' });
    });
  });
});

// ADR-0085 — top-level semantic roles (stageField / highlightFields).
describe('semantic-role hints (ADR-0085 / #2065)', () => {
  describe('detectStatusField', () => {
    it('an explicit stageField wins over heuristics', () => {
      expect(
        detectStatusField({
          stageField: 'pipeline',
          fields: { pipeline: {}, status: {} },
        }),
      ).toBe('pipeline');
    });

    it('stageField: false suppresses detection entirely', () => {
      expect(
        detectStatusField({
          stageField: false,
          fields: { status: { type: 'status' } },
        }),
      ).toBeNull();
    });

    it('falls back to the heuristic when no role is declared', () => {
      expect(detectStatusField({ fields: { status: {} } })).toBe('status');
    });
  });

  describe('deriveHighlightFields', () => {
    it('highlightFields wins over the deprecated compactLayout spelling', () => {
      expect(
        deriveHighlightFields(
          {
            ...leadDef,
            highlightFields: ['phone', 'rating'],
            compactLayout: ['email'],
          },
          'status',
        ),
      ).toEqual(['phone', 'rating']);
    });

    it('reads the deprecated compactLayout when highlightFields is absent', () => {
      expect(
        deriveHighlightFields({ ...leadDef, compactLayout: ['email', 'phone'] }, 'status'),
      ).toEqual(['email', 'phone']);
    });

    it('drops non-string entries and caps the declared list at max', () => {
      expect(
        deriveHighlightFields(
          { highlightFields: ['a', '', { name: 'x' } as any, 'b', 'c', 'd'], fields: {} },
          null,
          3,
        ),
      ).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('deriveFieldGroupDetailSections (#2148)', () => {
  const groupedDef: ObjectDefLike = {
    name: 'account',
    fieldGroups: [
      { key: 'basic', label: '基本信息' },
      { key: 'finance', label: '财务', collapsible: true, collapsed: true },
      { key: 'unused', label: 'Empty group' },
    ],
    fields: {
      name: { label: 'Name', type: 'text', group: 'basic' },
      industry: { label: 'Industry', type: 'select', group: 'basic' },
      revenue: { label: 'Revenue', type: 'currency', group: 'finance' },
      website: { label: 'Website', type: 'url' },
      secret: { label: 'Secret', type: 'text', group: 'basic', hidden: true },
      created_at: { label: 'Created', type: 'datetime' },
      organization_id: { label: 'Org', type: 'text' },
    },
  };

  it('returns sections in declared order with collapse passthrough, dropping empty groups', () => {
    const sections = deriveFieldGroupDetailSections(groupedDef)!;
    expect(sections.map((s: any) => s.name)).toEqual(['basic', 'finance', undefined]);
    expect(sections[0].title).toBe('基本信息');
    expect(sections[0].fields.map((f: any) => f.name)).toEqual(['name', 'industry']);
    expect(sections[1]).toMatchObject({
      name: 'finance',
      title: '财务',
      collapsible: true,
      defaultCollapsed: true,
    });
    // 'unused' group has no fields → dropped.
    expect(sections.some((s: any) => s.name === 'unused')).toBe(false);
  });

  it('collects ungrouped fields into a trailing untitled section, skipping audit/system fields', () => {
    const sections = deriveFieldGroupDetailSections(groupedDef)!;
    const trailing = sections[sections.length - 1];
    expect(trailing.name).toBeUndefined();
    expect(trailing.title).toBeUndefined();
    expect(trailing.fields.map((f: any) => f.name)).toEqual(['website']);
  });

  it('honours the canonical collapse enum (ADR-0085)', () => {
    const sections = deriveFieldGroupDetailSections({
      fieldGroups: [
        { key: 'a', label: 'A', collapse: 'collapsed' },
        { key: 'b', label: 'B', collapse: 'expanded' },
      ],
      fields: { x: { group: 'a' }, y: { group: 'b' } },
    })!;
    expect(sections[0]).toMatchObject({ name: 'a', collapsible: true, defaultCollapsed: true });
    expect(sections[1]).toMatchObject({ name: 'b', collapsible: true });
    expect(sections[1].defaultCollapsed).toBeUndefined();
  });

  it('keeps audit fields an author EXPLICITLY grouped', () => {
    const def: ObjectDefLike = {
      fieldGroups: [{ key: 'meta', label: 'Meta' }],
      fields: {
        title: { type: 'text' },
        created_at: { type: 'datetime', group: 'meta' },
      },
    };
    const sections = deriveFieldGroupDetailSections(def)!;
    expect(sections[0].fields.map((f: any) => f.name)).toEqual(['created_at']);
  });

  it('skips hidden fields even when grouped', () => {
    const sections = deriveFieldGroupDetailSections(groupedDef)!;
    const basic = sections.find((s: any) => s.name === 'basic')!;
    expect(basic.fields.map((f: any) => f.name)).not.toContain('secret');
  });

  it('emits rich field descriptors (label / type / options)', () => {
    const sections = deriveFieldGroupDetailSections(groupedDef)!;
    expect(sections[0].fields[1]).toMatchObject({
      name: 'industry',
      label: 'Industry',
      type: 'select',
    });
  });

  it('returns null when grouping does not apply', () => {
    // No fieldGroups at all.
    expect(deriveFieldGroupDetailSections(leadDef)).toBeNull();
    // Declared groups but no field references one.
    expect(
      deriveFieldGroupDetailSections({
        fieldGroups: [{ key: 'g1' }],
        fields: { a: {}, b: {} },
      }),
    ).toBeNull();
    // Undefined def.
    expect(deriveFieldGroupDetailSections(undefined)).toBeNull();
  });

  it('ignores keyless / malformed group entries', () => {
    expect(
      deriveFieldGroupDetailSections({
        fieldGroups: [{ label: 'No key' } as any, null as any],
        fields: { a: { group: 'x' } },
      }),
    ).toBeNull();
  });
});

describe('resolveDetailSections priority (ADR-0085)', () => {
  const groupedDef: ObjectDefLike = {
    fieldGroups: [{ key: 'g', label: 'G' }],
    fields: { a: { group: 'g' }, b: {} },
  };

  it('explicit options.sections wins', () => {
    const explicit = [{ title: 'Explicit', fields: ['a'] }];
    expect(resolveDetailSections(groupedDef, explicit)).toBe(explicit);
  });

  it('derives from fieldGroups last, else undefined', () => {
    const derived = resolveDetailSections(groupedDef)!;
    expect(derived[0]).toMatchObject({ name: 'g', title: 'G' });
    expect(resolveDetailSections(leadDef)).toBeUndefined();
    expect(resolveDetailSections(undefined)).toBeUndefined();
  });

  it('empty options.sections array does not shadow the fallbacks', () => {
    const derived = resolveDetailSections(groupedDef, [])!;
    expect(derived[0]).toMatchObject({ name: 'g' });
  });
});

describe('buildDefaultPageSchema integration (#2148)', () => {
  it('record:details picks up fieldGroups-derived sections when no options.sections', () => {
    const def: ObjectDefLike = {
      name: 'account',
      fieldGroups: [{ key: 'basic', label: 'Basic' }],
      fields: {
        name: { type: 'text', group: 'basic' },
        website: { type: 'url' },
      },
    };
    const page = buildDefaultPageSchema(def);
    const tabs = page.regions[0].components.find((c: any) => c.type === 'page:tabs');
    const details = tabs.items[0].children[0];
    expect(details.type).toBe('record:details');
    expect(details.sections[0]).toMatchObject({ name: 'basic', title: 'Basic' });
  });

  it('stageField: false drops record:path', () => {
    const def: ObjectDefLike = {
      ...leadDef,
      stageField: false,
    };
    const types = buildDefaultPageSchema(def).regions[0].components.map((c: any) => c.type);
    expect(types).not.toContain('record:path');
  });
});
