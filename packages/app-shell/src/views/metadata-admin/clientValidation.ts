// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Live client-side Zod validation for metadata drafts.
 *
 * Unblocked by `@objectstack/spec@7.x` — the spec package now ships
 * per-metadata-type Zod schemas under its kernel/data/ui/automation/
 * ai/system subpaths, so we no longer have to wait for the next save
 * round-trip to learn the draft is invalid.
 *
 * Usage (from ResourceEditPage):
 *
 *   const { issues } = await validateMetadataDraft(type, draft);
 *   setIssues(issues);
 *
 * Schemas are loaded lazily — the first call for a given type kicks
 * off a dynamic `import()` of the relevant spec subpath, then caches
 * the result. Types we don't have a client-side schema for (e.g.
 * `validation`, `trigger`, `connector`, etc.) return an empty issue list;
 * the user still gets server-side diagnostics on save.
 */

import type { SchemaFormIssue } from './SchemaForm';
import { lintCelPredicate } from './celAuthoring';
import { readFields } from './previews/object-fields-io';

/**
 * The structural slice of a Zod issue this module reads.
 *
 * `code` and `errors` are optional so the `ZodLikeSchema` contract stays
 * satisfiable by anything shaped like a Zod schema; every real Zod 4 issue
 * carries `code`, and only `invalid_union` carries `errors`.
 */
type ZodLikeIssue = {
  path?: Array<string | number>;
  message: string;
  /** Zod 4 issue discriminator (`invalid_type`, `invalid_union`, …). */
  code?: string;
  /**
   * Present only on `invalid_union`: ONE issue group per union member, in the
   * union's own member order. Zod reports a union failure as a single root
   * issue and buries every member's real diagnostics here.
   */
  errors?: ZodLikeIssue[][];
};

type ZodLikeSchema = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: ZodLikeIssue[] };
  };
};

/**
 * Which door a draft came through — the two are validated by different gates
 * (objectstack#5316).
 *
 *  - `create` — the draft is being AUTHORED in this admin. It is judged by the
 *    authoring schema, which is the strict one: a key the authoring contract
 *    does not declare is a mistake the author should see now.
 *  - `edit` — the draft is a body that came back OUT of storage. It is judged by
 *    the same WIRE schema the server's `saveMetaItem` runs, because the platform
 *    itself writes keys into stored bodies that the authoring contract has no
 *    reason to declare.
 *
 * Only `view` currently distinguishes the two; every other loader ignores the
 * mode and returns the one schema it has always returned.
 */
export type DraftMode = 'create' | 'edit';

type SchemaLoader = (mode: DraftMode) => Promise<ZodLikeSchema | undefined>;

/**
 * The `view` metadata type has TWO spec-declared shapes, and the backend serves
 * both (framework `objectql/engine.ts` registration; see the header of
 * `MetadataProvider.mergeViewsIntoObjects`):
 *
 *  - **ViewItem** (`ViewItemSchema`) — the first-class per-view record,
 *    `{ name: '<object>.<key>', object, viewKind, label, config }` (ADR-0017,
 *    "object has-many view"). This is what this admin AUTHORS: see `anchors.ts`
 *    `createBuildBody` and the `view-create-body.test.ts` guard.
 *  - **Container** (`ViewSchema`) — the aggregated
 *    `{ name, label, object, list, form, listViews, formViews }`, still served
 *    for records that were never expanded into ViewItems.
 *
 * This validator used to name only the container. That looked harmless because
 * the container was non-strict: a ViewItem's `viewKind` / `config` were silently
 * STRIPPED, so every draft this admin creates "passed" without one of its own
 * keys ever being checked. Spec 17.0.0 made the container strict, turning that
 * vacuous pass into a loud rejection — which is how `createConformance.test.ts`
 * surfaced it during the 17.0.0-rc.2 uptake.
 *
 * So dispatch on the record's own discriminant rather than guessing: `viewKind`
 * is what makes a record a ViewItem, and it is the same test
 * `MetadataProvider.isViewItem()` applies on the read side. This is NOT a
 * tolerant fallback — neither shape is coerced or waved through, each is checked
 * strictly against its own schema. Which of the two should be the single
 * authorable shape is a real open question, tracked in objectui#3312.
 */
/**
 * The `view` discriminant, in ONE place: `viewKind` is what makes a record a
 * ViewItem rather than the aggregated container, and it is the same test
 * `MetadataProvider.isViewItem()` applies on the read side.
 *
 * Both the create gate's schema dispatch (`viewSchemaForDraft`) and the edit
 * gate's union-diagnostic selection (`viewUnionMemberIndex`) read it here, so
 * the two can never drift apart into two different notions of "is a ViewItem".
 */
function isViewItemDraft(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'viewKind' in (value as object);
}

function viewSchemaForDraft(item: ZodLikeSchema, container: ZodLikeSchema): ZodLikeSchema {
  return {
    safeParse: (value: unknown) => (isViewItemDraft(value) ? item : container).safeParse(value),
  };
}

/**
 * ── Union-failure diagnostics for the `view` EDIT gate (objectui#3606) ──
 *
 * PRESENTATION ONLY. Nothing below can change a verdict: it runs strictly
 * inside the final issue→`SchemaFormIssue` mapping, after `ok` has already been
 * decided by the one gate (`ViewMetadataSchema`) and after every issue filter
 * has run. Same input set, same `ok`; only the rendered `path`/`message` move.
 *
 * The edit gate is `z.preprocess(stripViewConsoleDecorations, z.union([…]))`.
 * Zod reports a union failure as a SINGLE root issue — `code: 'invalid_union'`,
 * `path: []`, `message: 'Invalid input'` — and buries each member's real
 * diagnostics in `issue.errors`, one group per member, in member order. Mapping
 * that root issue literally is what collapsed every field-level diagnostic on
 * the edit path into one un-addressable "Invalid input": `SchemaForm` highlights
 * by `path` and Monaco locates by `path`, so an empty path points at nothing,
 * and the guided messages the spec wrote for these rejections (#4001) never
 * reached the user.
 *
 * Selection is by the draft's OWN discriminant — the same `isViewItemDraft` the
 * create gate dispatches on — never by a heuristic over the groups. "Fewest
 * issues / deepest path" was measured and picks wrong: for a container carrying
 * an unknown key, the ViewItem group reports a deeper `viewKind` discriminator
 * error that is the wrong message entirely. We show ONLY the selected member's
 * issues; showing all four would put "this is not a container" in front of
 * someone editing a ViewItem.
 *
 * Measured member layout of `ViewMetadataSchema`'s union (@objectstack/spec
 * 17.0.0-rc.5):
 *
 *   [0] `ViewItemWireSchema`  — the stored ViewItem record (itself a
 *       discriminated union on `viewKind`; a valid discriminator resolves
 *       straight through, so its issues arrive flat and field-addressed).
 *   [1] the aggregated container — same shape as the exported `ViewSchema`.
 *   [2] flattened list-view overlay.
 *   [3] flattened form-view overlay.
 *
 * This indexes members POSITIONALLY, which couples to a spec-internal detail.
 * That coupling is deliberate and it is guarded, not hoped for: reading the
 * groups the failing gate itself produced is the only way the diagnostics
 * cannot describe a schema other than the one that judged. The alternative —
 * re-parsing with the exported member schemas — was measured and rejected: the
 * container member is NOT the exported `ViewSchema` object (equal shape today,
 * a resemblance maintained by hand), and a re-parse would also have to
 * re-apply `stripViewConsoleDecorations` itself, reconstructing the spec's
 * pipeline composition in a second place that can drift. The positional read
 * is pinned by the CANARY tests in `clientValidation.viewDiagnostics.test.ts`:
 * they assert the selected member's exact `path` + `message` for known bodies,
 * so reordering, adding or removing a union member turns them red instead of
 * silently mis-selecting.
 */
const VIEW_UNION_MEMBERS = { wireItem: 0, container: 1 } as const;

function viewUnionMemberIndex(draft: unknown): number {
  return isViewItemDraft(draft) ? VIEW_UNION_MEMBERS.wireItem : VIEW_UNION_MEMBERS.container;
}

/**
 * Expand a ROOT union failure into the selected member's own issues, or return
 * `null` to say "nothing better to show" — in which case the caller renders the
 * root issue unchanged, exactly as before. It can never return an empty list,
 * so a rejected draft always renders at least one issue.
 *
 * Root-only by design: a member issue's `path` is relative to the union node,
 * and only at the root is that the same as the draft-absolute path `SchemaForm`
 * needs. A union nested deeper (e.g. `config.columns`) keeps Zod's own message;
 * it still carries a real path, so it is addressable — unlike the root case.
 */
function expandViewUnionIssue(issue: ZodLikeIssue, draft: unknown): ZodLikeIssue[] | null {
  if (issue.code !== 'invalid_union') return null;
  if ((issue.path ?? []).length !== 0) return null;
  const groups = issue.errors;
  if (!Array.isArray(groups)) return null;
  const group = groups[viewUnionMemberIndex(draft)];
  if (!Array.isArray(group) || group.length === 0) return null;
  return group;
}

// Map metadata-type name → loader for that type's root Zod schema.
// Each loader pulls only one spec subpath so we don't drag the whole
// 2MB schema bundle into the studio bundle.
//
// Types still falling through to server-only validation:
//   - `validation`: not a top-level metadata file; lives inside object. (DataValidationRuleSchema
//     exists but has empty shape, so it's not useful for client validation.)
//   - `policy`: spec 11.2.0 (PR #2078) removed the generic `PolicySchema` (the org-wide
//     password/network/session/audit policy) from `@objectstack/spec/security`, and the
//     canonical metadata-type→schema registry (spec kernel/metadata-type-schemas.ts) has
//     no `policy` entry — so there is no client schema. `RowLevelSecurityPolicySchema`
//     remains on /security but is a different shape (a per-object RLS rule), NOT the
//     `policy` metadata file, so it must not be substituted.
//   - `trigger`: no standalone TriggerSchema export at runtime (only
//     ConnectorTriggerSchema / WebhookEventSchema variants).
//   - `sharing_rule`: SharingRuleSchema is declared but has empty shape — server-only.
//   - `translation`: TranslationBundleSchema is z.object({}) — accepts anything; server-only.
//   - `connector`: ConnectorSchema requires an `id` field that's not in the on-disk
//     metadata shape — the spec models the runtime connector instance, not the file.
//     Wiring it would flag every valid connector definition.
const LOADERS: Record<string, SchemaLoader> = {
  // data
  object: async () => (await import('@objectstack/spec/data')).ObjectSchema as unknown as ZodLikeSchema,
  hook: async () => (await import('@objectstack/spec/data')).HookSchema as unknown as ZodLikeSchema,
  mapping: async () => (await import('@objectstack/spec/data')).MappingSchema as unknown as ZodLikeSchema,
  analytics_cube: async () => (await import('@objectstack/spec/data')).CubeSchema as unknown as ZodLikeSchema,

  // ui
  //
  // `view` is the one type whose two doors need two gates (objectstack#5316).
  //
  // CREATE — the authoring gate, unchanged: `viewSchemaForDraft` dispatches on
  // the record's own `viewKind` discriminant to `ViewItemSchema` (what
  // `createBuildBody` emits) or `ViewSchema` (the container). #5074 made these
  // strict on purpose and this admin's create path passes them cleanly.
  //
  // EDIT — the WIRE gate. The editor opens a body that came back out of
  // `sys_metadata`, and a stored view body carries keys the PLATFORM wrote:
  // `isPinned` (the view switcher's pin action, `ObjectView.tsx:882`),
  // `sortOrder` (the reorder write, `ObjectView.tsx:931`), and — nested —
  // the console filter/sort builders' per-row `id`. `updateView` GETs the
  // stored item and PUTs `{ ...current, ...partial }`; `saveMetaItem` persists
  // the accepted body verbatim (ADR-0005 §Validation). So the server ACCEPTS
  // this body — it validates against `ViewMetadataSchema` — while the authoring
  // gate rejects it. Judging a stored body by the authoring schema made the
  // client strictly stricter than the server; that is the inversion #5316 fixes.
  //
  // Why `ViewMetadataSchema` and not the narrower `ViewItemWireSchema`, which
  // also declares `isPinned`/`sortOrder`: two measured reasons.
  //   1. It is the schema the `view` metadata type registers, i.e. literally
  //      the one `saveMetaItem` runs — so client and server accept the same
  //      set by construction rather than by a maintained resemblance.
  //   2. `ViewItemWireSchema` covers only the ViewItem record. It rejects the
  //      container and the flattened overlay, and — measurably — still rejects
  //      `config.filter[].id` with `unrecognized_keys`, because that decoration
  //      is stripped by `ViewMetadataSchema`'s `z.preprocess`, which runs ahead
  //      of every union member and reaches nested blocks a member-level
  //      `.strip()` cannot.
  //
  // NOT a "try both, pass if either passes" fallback: each mode has exactly ONE
  // gate and a rejection is final. The last pins in
  // `clientValidation.viewShapes.test.ts` guard that.
  view: async (mode) => {
    const { ViewItemSchema, ViewSchema, ViewMetadataSchema } = await import('@objectstack/spec/ui');
    if (mode === 'edit') return ViewMetadataSchema as unknown as ZodLikeSchema;
    return viewSchemaForDraft(
      ViewItemSchema as unknown as ZodLikeSchema,
      ViewSchema as unknown as ZodLikeSchema,
    );
  },
  page: async () => (await import('@objectstack/spec/ui')).PageSchema as unknown as ZodLikeSchema,
  app: async () => (await import('@objectstack/spec/ui')).AppSchema as unknown as ZodLikeSchema,
  dashboard: async () => (await import('@objectstack/spec/ui')).DashboardSchema as unknown as ZodLikeSchema,
  report: async () => (await import('@objectstack/spec/ui')).ReportSchema as unknown as ZodLikeSchema,
  action: async () => (await import('@objectstack/spec/ui')).ActionSchema as unknown as ZodLikeSchema,
  theme: async () => (await import('@objectstack/spec/ui')).ThemeSchema as unknown as ZodLikeSchema,

  // automation
  flow: async () => (await import('@objectstack/spec/automation')).FlowSchema as unknown as ZodLikeSchema,
  // `workflow` is no longer a standalone metadata type (ADR-0020) — record
  // state machines are a `state_machine` validation rule on the object,
  // validated as part of ObjectSchema; there is no top-level workflow schema.
  // `approval` is no longer a standalone metadata type — it's a flow node
  // (`type: 'approval'`, ADR-0019). Its config (ApprovalNodeConfigSchema) is
  // validated as part of the enclosing flow; there is no top-level schema, so
  // it falls through to server-side validation.
  webhook: async () => (await import('@objectstack/spec/automation')).WebhookSchema as unknown as ZodLikeSchema,

  // ai
  agent: async () => (await import('@objectstack/spec/ai')).AgentSchema as unknown as ZodLikeSchema,
  tool: async () => (await import('@objectstack/spec/ai')).ToolSchema as unknown as ZodLikeSchema,
  skill: async () => (await import('@objectstack/spec/ai')).SkillSchema as unknown as ZodLikeSchema,

  // system
  // NOTE: `EmailTemplateDefinitionSchema`, NOT the removed `EmailTemplateSchema`.
  // The `email_template` metadata kind has resolved to the Definition schema
  // since spec 7.1.0 (`BUILTIN_METADATA_TYPE_SCHEMAS` in
  // `kernel/metadata-type-schemas.ts` is the authority); `EmailTemplateSchema`
  // survived only as an inline sub-shape of the old `Notification` holder and
  // was deleted with it in objectstack#4610 / #4616. So this validator was
  // checking authored templates against the WRONG contract — `name` + `locale`
  // and `bodyHtml` / `bodyText`, not `id` and `body` + `bodyType`.
  email_template: async () => (await import('@objectstack/spec/system')).EmailTemplateDefinitionSchema as unknown as ZodLikeSchema,
  job: async () => (await import('@objectstack/spec/system')).JobSchema as unknown as ZodLikeSchema,

  // security
  // NOTE: use PermissionSetSchema from /security, NOT PluginPermissionSchema from /kernel —
  // the kernel one is the plugin-sandbox permission ({id,resource,actions}), not the
  // metadata permission set ({name,objects,fields}). See
  // packages/spec/src/kernel/metadata-type-schemas.ts for the canonical mapping.
  permission: async () => (await import('@objectstack/spec/security')).PermissionSetSchema as unknown as ZodLikeSchema,
  // `policy` intentionally omitted — spec 11.2.0 dropped `PolicySchema` and the metadata-type
  // registry has no `policy` schema; drafts fall through to server-side validation (see top).
  // `profile` intentionally omitted — ADR-0090 D2 removed the profile concept (spec 13);
  // `role` is likewise gone, renamed to `position` (ADR-0090 D3).

  // identity
  position: async () => (await import('@objectstack/spec/identity')).PositionSchema as unknown as ZodLikeSchema,

  // api
  api: async () => (await import('@objectstack/spec/api')).ApiEndpointSchema as unknown as ZodLikeSchema,
};

// Flow node `type` values the running server accepts but the published
// `@objectstack/spec` FlowNodeSchema enum predates. The framework HEAD opened
// FlowNodeSchema.type to a validated string (ADR-0019 P2) and registers these
// as built-in node descriptors, but that spec change is not yet on npm — so the
// published closed enum spuriously flags them. We suppress only the enum
// mismatch on the node's `.type`; every other field is still validated.
//   - `approval`: durable-pause approval node (ADR-0019).
//   - `connector_action`: deliberate open extension point for connector-provided
//     node types — must never be flagged as invalid.
const FORWARD_COMPAT_FLOW_NODE_TYPES = new Set(['approval', 'connector_action']);
const FLOW_NODE_TYPE_ISSUE = /^nodes\.(\d+)\.type$/;

function nodeTypeAt(draft: unknown, index: number): string | undefined {
  const nodes = (draft as { nodes?: unknown })?.nodes;
  if (!Array.isArray(nodes)) return undefined;
  const node = nodes[index] as { type?: unknown } | undefined;
  return typeof node?.type === 'string' ? node.type : undefined;
}

/**
 * Field conditional-rule keys validated as CEL predicates (ADR-0036 B2,
 * objectui#1582). The spec's Zod only checks the SHAPE (`string | envelope`);
 * a syntactically broken predicate round-trips fine and then silently
 * fail-opens at runtime, so we lint the CEL here — the same
 * `@objectstack/formula` verdict the field inspector's editor shows live.
 */
const FIELD_RULE_KEYS = ['visibleWhen', 'readonlyWhen', 'requiredWhen'] as const;

/** Extract a predicate's CEL source from either wire shape (string | envelope). */
function predicateSource(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { source?: unknown }).source === 'string') {
    // Only lint envelopes that are (implicitly) CEL — a non-CEL dialect is the
    // engine's own error to raise, not ours to mis-lint as CEL.
    const dialect = (v as { dialect?: unknown }).dialect;
    if (dialect === undefined || dialect === 'cel') return (v as { source: string }).source;
  }
  return null;
}

/**
 * Lint every field conditional rule — and every `formula` field's
 * `expression` (role `value`, objectui#1582 follow-up) — on an object draft.
 * Runs with `scope: 'record'` (fields are namespaced under `record` in both
 * sites) and reports only lint ERRORS — warnings would be noise at the draft
 * level; the inline editor already surfaces them where the author can act.
 */
async function validateObjectFieldRules(draft: unknown): Promise<SchemaFormIssue[]> {
  const d = draft as { name?: unknown; fields?: unknown } | null | undefined;
  const view = readFields(d?.fields);
  if (view.entries.length === 0) return [];
  const objectName = typeof d?.name === 'string' ? d.name : undefined;
  const fieldNames = view.entries.map((e) => e.name);
  const issues: SchemaFormIssue[] = [];
  for (let i = 0; i < view.entries.length; i++) {
    const entry = view.entries[i];
    const pathKey = view.shape === 'array' ? String(i) : entry.name;
    for (const key of FIELD_RULE_KEYS) {
      const source = predicateSource(entry.def[key]);
      if (source == null || !source.trim()) continue;
      const findings = await lintCelPredicate(source, {
        objectName,
        fields: fieldNames,
        scope: 'record',
      });
      for (const f of findings) {
        if (f.severity !== 'error') continue;
        issues.push({ path: `fields.${pathKey}.${key}`, message: f.message });
      }
    }
    if (entry.def.type === 'formula') {
      const source = predicateSource(entry.def.expression);
      if (source == null || !source.trim()) continue;
      const findings = await lintCelPredicate(source, {
        objectName,
        // A formula may reference every sibling, not itself (circular).
        fields: fieldNames.filter((n) => n !== entry.name),
        scope: 'record',
        role: 'value',
      });
      for (const f of findings) {
        if (f.severity !== 'error') continue;
        issues.push({ path: `fields.${pathKey}.expression`, message: f.message });
      }
    }
  }
  return issues;
}

// Keyed by mode AND type — `view` resolves to a different schema per mode, so
// caching by type alone would hand the create gate whichever mode asked first.
const SCHEMA_CACHE = new Map<string, ZodLikeSchema | null>();

async function getSchemaForType(type: string, mode: DraftMode): Promise<ZodLikeSchema | null> {
  const key = `${mode}:${type}`;
  if (SCHEMA_CACHE.has(key)) return SCHEMA_CACHE.get(key) ?? null;
  const loader = LOADERS[type];
  if (!loader) {
    SCHEMA_CACHE.set(key, null);
    return null;
  }
  try {
    const schema = await loader(mode);
    const value = (schema && typeof schema.safeParse === 'function') ? schema : null;
    SCHEMA_CACHE.set(key, value);
    return value;
  } catch {
    SCHEMA_CACHE.set(key, null);
    return null;
  }
}

/**
 * Returns true if a client-side schema exists for the given metadata
 * type. Useful for deciding whether to skip the debounce in caller.
 */
export function hasClientValidator(type: string): boolean {
  return type in LOADERS;
}

export interface ValidateResult {
  /** Whether a client schema was available and the draft conforms. */
  ok: boolean;
  /** Issues to render in SchemaForm + Monaco. Empty on success or unsupported type. */
  issues: SchemaFormIssue[];
}

/**
 * Run Zod validation for the given metadata draft. Returns `{ok: true,
 * issues: []}` for types without a registered schema so callers can
 * fall back to server-side diagnostics without special-casing.
 */
export async function validateMetadataDraft(
  type: string,
  draft: unknown,
  /**
   * The live server JSON schema for this type (from `/meta/types`, i.e.
   * `RichMetadataTypeEntry.schema`). When provided it ROOT-CURES cross-repo
   * spec skew: the bundled `@objectstack/spec` may lag the running server, so
   * we never let the client be STRICTER than the server — a "missing required
   * field" flagged by the (possibly stale) bundled Zod is suppressed when the
   * server marks that field optional. The server's own validation on save
   * stays authoritative. This makes the editor track the live schema without a
   * per-change shim (cf. `FORWARD_COMPAT_FLOW_NODE_TYPES`).
   */
  serverSchema?: { required?: unknown },
  /**
   * Which door the draft came through (objectstack#5316). Defaults to
   * `'create'` — the AUTHORING gate, which is the strict one — so a call site
   * that omits it can only ever over-report, never silently widen the door.
   * Callers that open a STORED body must say `{ mode: 'edit' }`.
   */
  options?: { mode?: DraftMode },
): Promise<ValidateResult> {
  const mode: DraftMode = options?.mode ?? 'create';
  const schema = await getSchemaForType(type, mode);
  if (!schema) return { ok: true, issues: [] };

  // CEL lint for object field conditional rules — additive to the Zod shape
  // check (a draft can be shape-valid yet carry an unparsable predicate).
  const celIssues = type === 'object' ? await validateObjectFieldRules(draft) : [];

  const result = schema.safeParse(draft);
  if (result.success) {
    return celIssues.length > 0 ? { ok: false, issues: celIssues } : { ok: true, issues: [] };
  }

  let rawIssues = result.error?.issues ?? [];

  // Cross-repo skew root-cure — drop "missing required field" false positives
  // for top-level fields the SERVER schema marks optional. Only suppresses when
  // the field is actually absent in the draft (a present-but-invalid field
  // still surfaces), so the client can never be stricter than the live server.
  const serverRequired = Array.isArray(serverSchema?.required)
    ? new Set((serverSchema!.required as unknown[]).map((x) => String(x)))
    : undefined;
  if (serverRequired && draft && typeof draft === 'object' && !Array.isArray(draft)) {
    const d = draft as Record<string, unknown>;
    rawIssues = rawIssues.filter((i) => {
      const path = i.path ?? [];
      if (path.length !== 1) return true; // only top-level field issues
      const field = String(path[0]);
      const absent = d[field] === undefined || d[field] === null;
      return !(absent && !serverRequired.has(field));
    });
  }
  // Forward-compat: don't let the published flow schema's closed node-type
  // enum reject node types the running server supports (see
  // FORWARD_COMPAT_FLOW_NODE_TYPES). Suppress only the `.type` enum mismatch
  // for those nodes; all other issues still surface.
  if (type === 'flow') {
    rawIssues = rawIssues.filter((i) => {
      const path = (i.path ?? []).map((seg) => String(seg)).join('.');
      const match = FLOW_NODE_TYPE_ISSUE.exec(path);
      if (!match) return true;
      const nodeType = nodeTypeAt(draft, Number(match[1]));
      return !(nodeType && FORWARD_COMPAT_FLOW_NODE_TYPES.has(nodeType));
    });
  }
  if (rawIssues.length === 0 && celIssues.length === 0) return { ok: true, issues: [] };

  // Presentation only — see `expandViewUnionIssue`. `ok` is already `false`
  // here and `rawIssues` is already final; this only decides what gets RENDERED
  // for each of them, so the verdict cannot move (pinned by the parity test in
  // `clientValidation.viewDiagnostics.test.ts`).
  const issues: SchemaFormIssue[] = [
    ...rawIssues.flatMap((i) => {
      const expanded = type === 'view' ? expandViewUnionIssue(i, draft) : null;
      return (expanded ?? [i]).map((issue) => ({
        path: (issue.path ?? []).map((seg) => String(seg)).join('.'),
        message: issue.message,
      }));
    }),
    ...celIssues,
  ];
  return { ok: false, issues };
}
