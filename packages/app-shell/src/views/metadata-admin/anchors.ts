// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in anchor relationships for the Related tab.
 *
 * Each entry tells the metadata-admin engine "items of type X belong to
 * (are anchored at) items of type Y when this predicate matches". The
 * Related panel on the parent's edit page uses this registry to decide
 * which `client.list(type)` calls to make and how to group the results.
 *
 * Adding a new relationship is intentionally a one-liner — declare it
 * here (or in your own plugin's bootstrap) and the UI picks it up with
 * no further wiring. Predicates are kept tiny because they run client-
 * side over every item returned from `list()`.
 *
 * Why not parse the schema and infer this? Some types nest the anchor
 * deep in `data.object` or `list.data.object`; some types live on the
 * parent (e.g. `fields` is embedded inside the object item itself).
 * Hand-rolled declarations are clearer than schema-walking heuristics.
 */

import { registerMetadataResource, anchorByField } from './registry';


export function registerBuiltinAnchors(): void {
  // ── EMBEDDED: items stored inside the object body itself ──────────
  //
  // Fields, indexes, and embedded validations don't have a top-level
  // metadata type; they live under `object.fields`, `object.indexes[]`,
  // `object.validations[]`. We surface them with `source: 'embedded'`
  // so the Related panel can list them without a separate API call.
  //
  // `fields` is stored as a NAME-KEYED MAP (`{ email: {...}, name: {...} }`)
  // — not an array — so we adapt it into an array carrying the key as
  // `name` for the panel to render.
  registerMetadataResource({
    type: '__object_field' as any,
    label: 'Field',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      editAs: 'field',
      embeddedPath: 'fields',
      extract: (parent) => mapOrArrayToList((parent as { fields?: unknown }).fields),
      groupLabel: 'Fields',
      order: 5,
    }],
  });

  registerMetadataResource({
    type: '__object_index' as any,
    label: 'Index',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      editAs: 'index',
      embeddedPath: 'indexes',
      extract: (parent) => {
        const raw = (parent as { indexes?: unknown }).indexes;
        if (!Array.isArray(raw)) return [];
        // Indexes have no `name`; synthesise one from their column list.
        return (raw as Array<Record<string, unknown>>).map((idx, i) => {
          const fields = Array.isArray(idx.fields) ? idx.fields.join(',') : '';
          const synthesised = fields ? `idx_${fields}` : `index_${i}`;
          return { name: synthesised, ...idx };
        });
      },
      groupLabel: 'Indexes',
      order: 10,
    }],
  });

  registerMetadataResource({
    type: '__object_validation' as any,
    label: 'Embedded validation',
    anchors: [{
      anchorType: 'object',
      source: 'embedded',
      editAs: 'validation',
      embeddedPath: 'validations',
      extract: (parent) => mapOrArrayToList((parent as { validations?: unknown }).validations),
      groupLabel: 'Embedded Validations',
      order: 15,
    }],
  });

  // ── LIST: standalone child metadata types ─────────────────────────

  // hook.object → object (beforeInsert / afterUpdate / …)
  registerMetadataResource({
    type: 'hook',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Hooks',
      order: 20,
    }],
    createFields: ['label', 'name', 'object', 'description'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createDefaults: { events: [] },
  });

  // Approval is no longer a standalone metadata type (ADR-0019) — it is a flow
  // node (`type: 'approval'`). Approvals therefore surface on an object through
  // the Flows it belongs to, not a separate "Approval Processes" group.

  // page.object → object (auto-generated record pages, etc.)
  registerMetadataResource({
    type: 'page',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Pages',
      order: 40,
    }],
    // Mirror `view`'s create form: a page (esp. a *record* page) must be able to
    // bind an `object` and pick its page `type` / `kind` at creation — the
    // identity-only form (label/name/icon/description) couldn't make a record
    // page. The block layout is then composed in the editor's PagePreview canvas.
    createFields: ['label', 'name', 'object', 'type', 'kind'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createSchema: {
      type: 'object',
      required: ['label', 'name', 'type'],
      properties: {
        label: { type: 'string', title: 'Label', description: 'Human-readable page title.' },
        name: {
          type: 'string',
          title: 'Name',
          description: 'Page key (snake_case).',
          pattern: '^[a-z_][a-z0-9_]*$',
        },
        type: {
          type: 'string',
          title: 'Page type',
          // 'list' (interface page) is the primary, most-built page type — offer
          // it first and as the default. 'dashboard' is roadmap (no distinct
          // renderer yet), so it's omitted here, matching the edit form.
          enum: ['list', 'record', 'home', 'app', 'utility'],
          default: 'list',
          description: 'List / Interface page = a data view (Airtable-style: columns, filters, visualizations). Record page renders one object record.',
        },
        object: {
          type: 'string',
          title: 'Object',
          widget: 'ref:object',
          description: 'The object this page reads from — the data source for a list page, or the record object for a record page.',
        },
        kind: {
          type: 'string',
          title: 'Kind',
          enum: ['full', 'slotted'],
          default: 'full',
          description: 'full = the whole page; slotted = override only named slots of the default.',
        },
      },
    },
    createDefaults: { type: 'list', kind: 'full', regions: [] },
    // Seed a record page's regions from the bound object's synthesized default
    // detail page, so authoring starts from the auto-generated layout (the same
    // one the runtime renders by default) instead of a blank canvas.
    createSeed: async (draft, { client }) => {
      // List/interface page: pre-bind the chosen object as the data source so
      // the new page renders immediately (the author then curates columns,
      // filters, visualizations in the editor).
      if (draft?.type === 'list') {
        return draft?.object ? { interfaceConfig: { source: String(draft.object) } } : {};
      }
      if (draft?.type !== 'record' || !draft?.object) return {};
      try {
        const objectDef = await client.get('object', String(draft.object));
        if (!objectDef || typeof objectDef !== 'object') return {};
        const { buildDefaultPageSchema } = await import('@object-ui/plugin-detail');
        const synth = buildDefaultPageSchema(objectDef as any) as Record<string, any>;
        const seed: Record<string, unknown> = {};
        if (Array.isArray(synth?.regions) && synth.regions.length) seed.regions = synth.regions;
        if (synth?.template) seed.template = synth.template;
        return seed;
      } catch {
        return {};
      }
    },
  });

  // A view is the canonical first-class ViewItem ({ viewKind, config }),
  // bound to its object by the top-level `object` foreign key.
  registerMetadataResource({
    type: 'view',
    anchors: [{
      anchorType: 'object',
      match: anchorByField([
        'object',
        'config.data.object',
      ]),
      groupLabel: 'Views',
      order: 30,
    }],
    createFields: ['label', 'name', 'object', 'kind'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createSchema: {
      type: 'object',
      required: ['label', 'name', 'object', 'kind'],
      properties: {
        label: { type: 'string', title: 'Label', description: 'Human-readable view name.' },
        name: {
          type: 'string',
          title: 'Name',
          description: 'View key (snake_case). Qualified to <object>.<key> on save.',
          pattern: '^[a-z_][a-z0-9_]*$',
        },
        object: {
          type: 'string',
          title: 'Object',
          widget: 'ref:object',
          description: 'The object this view displays.',
        },
        kind: {
          type: 'string',
          title: 'View kind',
          enum: ['grid', 'kanban', 'gallery', 'calendar', 'timeline', 'gantt', 'chart'],
          default: 'grid',
          description: 'Pick a starter layout. Switch later in the designer.',
        },
      },
    },
    // Emit a canonical ViewItem. `name` is the globally-unique qualified id
    // `<object>.<key>`; the layout `kind` (grid/kanban/…) is all list-family,
    // so `viewKind` is 'list' and the chosen layout lives at `config.type`.
    createBuildBody: (draft) => {
      const object = String(draft.object ?? '');
      const key = String(draft.name ?? '');
      const qualifiedName =
        key.includes('.') || !object ? key : `${object}.${key}`;
      return {
        name: qualifiedName,
        object,
        viewKind: 'list',
        label: draft.label,
        config: {
          type: (draft.kind as string) || 'grid',
          columns: [],
          data: { provider: 'object', object },
        },
      };
    },
  });

  // flow may reference an object at the root or under `on`
  registerMetadataResource({
    type: 'flow',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'on.object', 'trigger.object']),
      groupLabel: 'Flows',
      order: 50,
    }],
    createFields: ['label', 'name', 'type', 'description'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createDefaults: { nodes: [], edges: [] },
  });
  // ADR-0020: `workflow` retired as a metadata type — record state machines
  // are a `state_machine` validation rule on the object (no separate anchor).

  // trigger.object → object (low-level DB-style triggers)
  registerMetadataResource({
    type: 'trigger',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'on.object']),
      groupLabel: 'Triggers',
      order: 52,
    }],
    createFields: ['label', 'name', 'object'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
  });

  // validation: usually embedded in the object, but standalone variants
  // do exist. Match anything whose `object` points back at us.
  registerMetadataResource({
    type: 'validation',
    anchors: [{
      anchorType: 'object',
      match: anchorByField('object'),
      groupLabel: 'Validations',
      order: 25,
    }],
    createFields: ['label', 'name', 'message'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createSchema: {
      type: 'object',
      required: ['label', 'name', 'message'],
      properties: {
        label: { type: 'string', title: 'Label', description: 'Human-readable rule name.' },
        name: {
          type: 'string',
          title: 'Name',
          description: 'Machine name (snake_case). Used in URLs.',
          pattern: '^[a-z_][a-z0-9_]*$',
        },
        message: {
          type: 'string',
          title: 'Error message',
          description: 'Shown to the user when the rule blocks save.',
        },
      },
    },
    createDefaults: {
      type: 'script',
      active: true,
      events: ['insert', 'update'],
      priority: 10,
      severity: 'error',
      condition: 'false',
    },
  });

  // permission has a sparse object-keyed map under `objects`. Match by
  // membership of the parent name in that map.
  registerMetadataResource({
    type: 'permission',
    anchors: [{
      anchorType: 'object',
      match: (item, name) => {
        const objs = (item as { objects?: Record<string, unknown> })?.objects;
        return !!objs && typeof objs === 'object' && name in objs;
      },
      groupLabel: 'Permissions',
      order: 60,
    }],
    createFields: ['label', 'name'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createDefaults: { objects: {} },
  });

  // action — both record-scoped and object-scoped actions live here.
  // Schemas vary, so accept any of the three common shapes.
  registerMetadataResource({
    type: 'action',
    anchors: [{
      anchorType: 'object',
      match: anchorByField([
        'object',
        'target.object',
        'on.object',
      ]),
      groupLabel: 'Actions',
      order: 55,
    }],
    createFields: ['label', 'name', 'objectName', 'icon'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    // A new action defaults to `type: 'script'` (ActionType.default), which the
    // spec requires to carry an executable `body` or `target` — otherwise the
    // draft fails validation on save (422) and AppPlugin registers no engine
    // handler (the #2169 "Mark Done" runtime miss). Seed a no-op L2 body so
    // "New action -> name -> Save" round-trips; the author edits the source after.
    createDefaults: {
      type: 'script',
      body: { language: 'js', source: 'return { success: true };' },
    },
  });

  // dashboard / report — surface ones bound to a specific object.
  // Many will not have an explicit anchor; those simply don't appear.
  registerMetadataResource({
    type: 'dashboard',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'data.object']),
      groupLabel: 'Dashboards',
      order: 80,
    }],
    createFields: ['label', 'name', 'description'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    createDefaults: { widgets: [] },
  });
  registerMetadataResource({
    type: 'report',
    anchors: [{
      anchorType: 'object',
      match: anchorByField(['object', 'data.object']),
      groupLabel: 'Reports',
      order: 81,
    }],
    // ADR-0021 single-form: a report is dataset-bound — `objectName` and the
    // legacy `columns` array were removed from ReportSchema, so seeding them
    // here produced a stub that failed server validation ("a report needs
    // `dataset` + `values`"). Report-create now lights up the canvas +
    // ReportDefaultInspector (see CREATE_MODE_CANVAS_TYPES), where the author
    // picks the dataset/measures/dimensions directly; we just seed a sensible
    // starting type.
    createFields: ['label', 'name', 'description'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
    ],
    // Seed `drilldown:true` so the inspector toggle reflects the schema default
    // (otherwise it shows OFF on a fresh report while the spec default is true).
    createDefaults: { type: 'summary', drilldown: true },
  });

  // Cosmetic defaults for the `object` type list page — gives Object the
  // same look as every other metadata type while still surfacing the
  // fields/columns developers care about most.
  registerMetadataResource({
    type: 'object',
    iconName: 'database',
    domain: 'data',
    // Protocol-driven create form: ask for identity only. The rest of
    // the object (fields, validations, indexes, hooks, …) is added
    // through the bespoke designer that takes over on the edit page,
    // so requiring it up-front would just front-load 30 inputs with
    // no payoff.
    createFields: ['label', 'pluralLabel', 'name', 'description'],
    createDerive: [
      { from: 'label', to: 'name', transform: 'slugify', untilUserEdits: true },
      { from: 'label', to: 'pluralLabel', transform: 'plural-en', untilUserEdits: true },
    ],
    // `fields` is the only other required key on the ObjectSchema —
    // seed it as an empty record so the saved body validates.
    createDefaults: { fields: {} },
    searchableFields: ['name', 'label', 'pluralLabel', 'description'],
    listColumns: [
      { key: 'name', label: 'Name', width: '24%' },
      { key: 'label', label: 'Label', width: '22%' },
      { key: 'pluralLabel', label: 'Plural', width: '22%' },
      {
        key: 'fields',
        label: 'Fields',
        width: '90px',
        render: (value) => {
          if (value == null) return '—';
          const count = Array.isArray(value)
            ? value.length
            : typeof value === 'object'
              ? Object.keys(value as Record<string, unknown>).length
              : 0;
          return count;
        },
      },
      { key: 'description', label: 'Description' },
    ],
  });
}

/**
 * Coerce an embedded "collection" into a list of `{ name, …rest }`.
 *
 * ObjectStack stores some embedded collections as name-keyed maps
 * (`object.fields`) and others as arrays (`object.indexes`). Both want
 * to render the same way in Related; this helper papers over the gap
 * by injecting the map key as `name` when needed.
 */
function mapOrArrayToList(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => {
      const body = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
      return { name: k, ...body };
    });
  }
  return [];
}
