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

type ZodLikeSchema = {
  safeParse: (value: unknown) => {
    success: boolean;
    error?: { issues: Array<{ path: Array<string | number>; message: string }> };
  };
};

type SchemaLoader = () => Promise<ZodLikeSchema | undefined>;

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
  view: async () => (await import('@objectstack/spec/ui')).ViewSchema as unknown as ZodLikeSchema,
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
  email_template: async () => (await import('@objectstack/spec/system')).EmailTemplateSchema as unknown as ZodLikeSchema,
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
const FIELD_RULE_KEYS = ['visibleWhen', 'readonlyWhen', 'requiredWhen', 'conditionalRequired'] as const;

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
 * Lint every field conditional rule on an object draft. Runs with
 * `scope: 'record'` (fields are namespaced under `record` in these rules) and
 * reports only lint ERRORS — warnings would be noise at the draft level; the
 * inline editor already surfaces them where the author can act.
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
  }
  return issues;
}

const SCHEMA_CACHE = new Map<string, ZodLikeSchema | null>();

async function getSchemaForType(type: string): Promise<ZodLikeSchema | null> {
  if (SCHEMA_CACHE.has(type)) return SCHEMA_CACHE.get(type) ?? null;
  const loader = LOADERS[type];
  if (!loader) {
    SCHEMA_CACHE.set(type, null);
    return null;
  }
  try {
    const schema = await loader();
    const value = (schema && typeof schema.safeParse === 'function') ? schema : null;
    SCHEMA_CACHE.set(type, value);
    return value;
  } catch {
    SCHEMA_CACHE.set(type, null);
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
): Promise<ValidateResult> {
  const schema = await getSchemaForType(type);
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

  const issues: SchemaFormIssue[] = [
    ...rawIssues.map((i) => ({
      path: (i.path ?? []).map((seg) => String(seg)).join('.'),
      message: i.message,
    })),
    ...celIssues,
  ];
  return { ok: false, issues };
}
