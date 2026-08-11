// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FormPage — single component that renders a FormView either as a public
 * anonymous form (`/f/:slug` → backend `GET/POST /api/v1/forms/:slug`) or
 * as an authed internal form (`/forms/:name` → `GET /api/v1/meta/view/:name`
 * + `POST /api/v1/data/:object`).
 *
 * Both modes share the same renderer; the difference is only in how the
 * spec is loaded, where submissions go, and — since objectui#4109 — what
 * happens after a successful submit when the form view declares nothing:
 * an internal submit lands on the record it just created, while the public
 * path keeps the anonymous `thank-you` confirmation. See
 * {@link resolveSubmitBehavior}. This is the same shape as Airtable Forms —
 * the form view metadata is identical whether it is embedded publicly or
 * used by logged-in operators.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

const API_BASE = (import.meta.env.VITE_SERVER_URL || '') + '/api/v1';

/** Resolved server payload for a public form. */
interface PublicFormPayload {
  slug: string;
  object: string;
  label?: string;
  form: FormViewSpec;
  objectSchema: ObjectSchemaPayload | null;
}

interface ObjectSchemaPayload {
  name: string;
  label?: string;
  fields: Record<string, ObjectFieldDef>;
}

interface ObjectFieldDef {
  type: string;
  label?: string;
  required?: boolean;
  defaultValue?: unknown;
  maxLength?: number;
  options?: Array<{ value: string; label?: string }> | string[];
  placeholder?: string;
  helpText?: string;
}

/** Visualization types the form renderer understands (FormViewSpec.type). */
const FORM_SPEC_TYPES = new Set(['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal']);

interface FormViewSpec {
  type?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  label?: string;
  sections?: FormSectionSpec[];
  groups?: FormSectionSpec[];
  sharing?: { allowAnonymous?: boolean; publicLink?: string };
  /** Behaviour after a successful submit. */
  submitBehavior?: SubmitBehavior;
}

/** Mirrors the spec FormView.submitBehavior union (added in Step 4). */
type SubmitBehavior =
  | { kind: 'thank-you'; title?: string; message?: string }
  | { kind: 'redirect'; url: string; delayMs?: number }
  | { kind: 'continue' }
  | { kind: 'next-record' };

/** Which surface is rendering the form — see {@link FormPageProps.mode}. */
export type FormPageMode = 'public' | 'internal';

/**
 * What the renderer actually does after a successful submit: every authorable
 * {@link SubmitBehavior}, plus the one behaviour the PLATFORM supplies rather
 * than the author.
 *
 * `created-record` is deliberately NOT a member of the spec's authorable union
 * (`thank-you | redirect | continue | next-record` — a STRICT discriminated
 * union in `@objectstack/spec`, so authoring `kind: 'created-record'` is
 * rejected at publish time and always will be). Nothing ever parses it out of
 * metadata: it exists only as the value {@link resolveSubmitBehavior} returns
 * when an internal form declares nothing. That is what lets the platform
 * default differ from every authorable kind WITHOUT widening the contract or
 * teaching authors a second dialect for something they never write.
 */
type EffectiveSubmitBehavior = SubmitBehavior | { kind: 'created-record' };

interface FormSectionSpec {
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4 | '1' | '2' | '3' | '4';
  fields: Array<string | FormFieldSpec>;
}

interface FormFieldSpec {
  field: string;
  label?: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  widget?: string;
}

/** Normalized field row used by the renderer. */
interface RenderableField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readonly: boolean;
  hidden: boolean;
  placeholder?: string;
  helpText?: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  colSpan: 1 | 2 | 3 | 4;
}

interface RenderableSection {
  label?: string;
  columns: 1 | 2 | 3 | 4;
  collapsible: boolean;
  collapsed: boolean;
  fields: RenderableField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Coerce a `columns` literal into a numeric 1..4. */
export function normalizeColumns(c: unknown): 1 | 2 | 3 | 4 {
  const n = typeof c === 'string' ? parseInt(c, 10) : (c as number);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 2;
}

/** Normalize field options from various Object schema shapes into `{value,label}`. */
export function normalizeOptions(opts: unknown): Array<{ value: string; label: string }> | undefined {
  if (!Array.isArray(opts)) return undefined;
  return opts.map((o) => {
    if (typeof o === 'string') return { value: o, label: o };
    if (o && typeof o === 'object') {
      const v = String((o as any).value ?? (o as any).id ?? '');
      const l = String((o as any).label ?? (o as any).name ?? v);
      return { value: v, label: l };
    }
    return { value: String(o), label: String(o) };
  });
}

/**
 * Merge a FormView's section/field overrides with the target object's
 * field definitions to produce concrete rows the renderer can draw.
 * Field-level FormField overrides take precedence over object defaults.
 */
export function buildSections(
  form: FormViewSpec,
  objectSchema: ObjectSchemaPayload | null,
): RenderableSection[] {
  const sections = form.sections ?? form.groups ?? [];
  const objFields = objectSchema?.fields ?? {};
  return sections.map((sec) => {
    const cols = normalizeColumns(sec.columns);
    const fields: RenderableField[] = [];
    for (const entry of sec.fields ?? []) {
      const override: FormFieldSpec =
        typeof entry === 'string' ? { field: entry } : { ...entry };
      const def: ObjectFieldDef =
        objFields[override.field] ?? ({ type: 'text' } as ObjectFieldDef);
      fields.push({
        name: override.field,
        label: override.label ?? def.label ?? override.field,
        type: def.type ?? 'text',
        required: override.required ?? def.required ?? false,
        readonly: override.readonly ?? false,
        hidden: override.hidden ?? false,
        placeholder: override.placeholder ?? def.placeholder,
        helpText: override.helpText ?? def.helpText,
        defaultValue: def.defaultValue,
        options: normalizeOptions(def.options),
        maxLength: def.maxLength,
        colSpan: override.colSpan ?? 1,
      });
    }
    return {
      label: sec.label,
      columns: cols,
      collapsible: !!sec.collapsible,
      collapsed: !!sec.collapsed,
      fields,
    };
  });
}

/**
 * The post-submit behaviour actually applied, given what the form view
 * declared and which surface is rendering it.
 *
 * Maintainer ruling, 2026-08-10 (objectstack#7245, quoted verbatim on
 * objectui#4109):
 *
 * > **the `type: 'form'` contract means in-shell, and an internal submit lands
 * > on the record.**
 * >
 * > 2. Internal-mode submit defaults to redirect-to-created-record;
 * >    `thank-you` stays the default for the public `/f/:slug` path only.
 *
 * Before this, the default was `{ kind: 'thank-you' }` for BOTH modes, so a
 * signed-in operator who had just created a record was told "Your submission
 * has been received" with no link to it — the anonymous-form confirmation,
 * shown to someone who is not anonymous and is not done.
 *
 * The DECLARED behaviour still wins in both modes, and that precedence is the
 * point: per ruling point 3 the corpus must never have to opt out of a wrong
 * default, so this only ever fills the gap an author left empty.
 */
export function resolveSubmitBehavior(
  mode: FormPageMode,
  declared: SubmitBehavior | undefined,
): EffectiveSubmitBehavior {
  if (declared) return declared;
  return mode === 'internal' ? { kind: 'created-record' } : { kind: 'thank-you' };
}

/**
 * The id of the record an internal submit just created, read off the
 * `POST /api/v1/data/:object` response.
 *
 * The response contract is spec-declared — `CreateDataResponse = { object, id,
 * record, droppedFields? }` (`@objectstack/spec`, `api/protocol.zod.ts`) — and
 * the top-level `id` IS the created record's id. We read that one declared key
 * and no alias: `record.id` carries the same value, but reading both would be
 * exactly the second de-facto contract AGENTS.md #0.1 forbids.
 *
 * What this DOES have to absorb is the transport envelope, which is not a
 * metadata dialect but a platform fact: two transports serve this route and
 * only one wraps the body. `packages/rest`'s server answers the bare object
 * (`res.status(201).json(result)`), while the runtime's http-dispatcher wraps
 * every success as `{ success, data, meta }`. The platform already resolves
 * this in exactly ONE rule, in `@objectstack/client`:
 *
 *     async unwrapResponse(res) {
 *       const body = await res.json();
 *       if (body && typeof body.success === 'boolean' && 'data' in body) return body.data;
 *       return body;
 *     }
 *
 * `FormPage` hand-rolls `fetch` instead of going through that client (it
 * predates having one here), so the same rule has to be applied at this call
 * site. Mirroring it is not inventing a dialect — spelling a DIFFERENT rule
 * would be.
 *
 * Returns null when the payload names no id, so the caller can confirm the
 * submit instead of navigating to `…/record/undefined`.
 */
export function readCreatedRecordId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const unwrapped =
    typeof body.success === 'boolean' && 'data' in body
      ? (body.data as Record<string, unknown> | null | undefined)
      : body;
  if (!unwrapped || typeof unwrapped !== 'object') return null;
  const id = (unwrapped as Record<string, unknown>).id;
  // The spec declares `id: z.string()`. The numeric branch is a coercion of
  // that SAME key for drivers whose primary key surfaces as an integer — one
  // key, one meaning, so it cannot mask a producer emitting the wrong shape.
  if (typeof id === 'string') return id === '' ? null : id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return null;
}

/** Apply `?prefill_<field>=<value>` query params to the initial form state. */
export function readPrefill(
  fields: RenderableField[],
  search: URLSearchParams,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
    const fromQuery = search.get(`prefill_${f.name}`);
    if (fromQuery !== null) out[f.name] = fromQuery;
  }
  return out;
}

/** Authed/anonymous fetch — credentials included so cookies (auth) flow. */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
}

// ─── Loaders ─────────────────────────────────────────────────────────

/**
 * Result of loading a form spec — shared by both public and internal
 * modes so the renderer downstream is mode-agnostic.
 */
interface LoadedForm {
  label: string;
  object: string;
  form: FormViewSpec;
  objectSchema: ObjectSchemaPayload | null;
}

/** Public mode: hit the anonymous `/forms/:slug` resolver. */
async function loadPublicForm(slug: string): Promise<LoadedForm> {
  const res = await apiFetch(`/forms/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load form (${res.status}): ${body || res.statusText}`);
  }
  const payload = (await res.json()) as PublicFormPayload;
  return {
    label: payload.label ?? payload.form?.label ?? payload.object,
    object: payload.object,
    form: payload.form,
    objectSchema: payload.objectSchema,
  };
}

/**
 * Unwrap a `/meta/view/:name` response into the FormViewSpec the renderer
 * consumes. Since the ADR-0017 registrar the server returns the flattened
 * ExpandedViewItem envelope — `{ name, object, viewKind, label, config:
 * { type, sections, … } }` — with the actual form spec nested under
 * `config`. Pre-fix, this loader read `sections`/`label` off the envelope
 * itself and rendered every internal form as zero fields plus a bare
 * Submit that "succeeded" (objectui#2208). Older servers / seeded rows may
 * still serve `{ item: { spec } }` or the bare spec, so all shapes are
 * accepted.
 *
 * Also rejects non-form views loudly: a list-view name reaching this route
 * (e.g. an action target hit by the framework#2554 key collision) used to
 * render as that same empty-form false positive.
 */
export function resolveInternalForm(
  name: string,
  viewBody: unknown,
): { label: string; object?: string; form: FormViewSpec } {
  const body = viewBody as Record<string, any> | null;
  const item = body?.item ?? body;
  const spec = item?.spec ?? item;
  const isEnvelope =
    spec && typeof spec === 'object'
    && spec.config && typeof spec.config === 'object'
    && ('viewKind' in spec || 'object' in spec);
  // viewKind may sit on the envelope OR on a flattened list-view body
  // (runtime personalization overlays are persisted with the config at the
  // top level), so read it wherever it is.
  const viewKind: string | undefined =
    spec && typeof spec === 'object' ? spec.viewKind : undefined;
  if (viewKind && viewKind !== 'form') {
    throw new Error(
      `View "${name}" is a ${viewKind} view, not a form view — check the action or link that targets it.`,
    );
  }
  const form: FormViewSpec = isEnvelope ? spec.config : spec;
  // A flattened list config carries no viewKind at all but declares a grid/
  // kanban/… visualization type no form renderer understands — same false
  // positive, same loud failure.
  if (!viewKind && form && typeof form === 'object' && typeof form.type === 'string'
    && !FORM_SPEC_TYPES.has(form.type)) {
    throw new Error(
      `View "${name}" is a ${form.type} view, not a form view — check the action or link that targets it.`,
    );
  }
  return {
    label: (isEnvelope ? spec.label : undefined) ?? form?.label ?? name,
    object: (isEnvelope ? spec.object : undefined) ?? (form as any)?.data?.object ?? spec?.object,
    form,
  };
}

/**
 * Internal mode: pull the FormView metadata directly + the target object's
 * schema. We use the same `/meta` REST surface the rest of the console
 * already speaks, so anything the user has READ on works automatically.
 */
async function loadInternalForm(name: string): Promise<LoadedForm> {
  const viewRes = await apiFetch(`/meta/view/${encodeURIComponent(name)}`);
  if (!viewRes.ok) {
    throw new Error(`Form metadata not found: view/${name}`);
  }
  const viewBody = await viewRes.json();
  const { label, object: objectName, form } = resolveInternalForm(name, viewBody);
  if (!objectName) {
    throw new Error(`FormView "${name}" is missing an "object" target`);
  }
  let objectSchema: ObjectSchemaPayload | null = null;
  try {
    const objRes = await apiFetch(`/meta/object/${encodeURIComponent(objectName)}`);
    if (objRes.ok) {
      const objBody = await objRes.json();
      const objItem = objBody?.item ?? objBody;
      const objSpec = objItem?.spec ?? objItem;
      if (objSpec?.fields && typeof objSpec.fields === 'object') {
        objectSchema = {
          name: objSpec.name ?? objectName,
          label: objSpec.label,
          fields: objSpec.fields,
        };
      }
    }
  } catch {
    // Schema fallback is non-fatal — the renderer copes with text inputs.
  }
  return {
    label,
    object: objectName,
    form,
    objectSchema,
  };
}

/** Public mode submit — POST to `/forms/:slug/submit`. */
async function submitPublic(slug: string, data: Record<string, unknown>): Promise<unknown> {
  const res = await apiFetch(`/forms/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Submit failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

/** Internal mode submit — POST to `/data/:object`. Auth cookie carries identity. */
async function submitInternal(
  objectName: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const res = await apiFetch(`/data/${encodeURIComponent(objectName)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Create failed (${res.status}): ${body || res.statusText}`);
  }
  return res.json().catch(() => ({}));
}

// ─── Field renderers ─────────────────────────────────────────────────

const FIELD_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

interface FieldInputProps {
  field: RenderableField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const common = {
    id: `f_${field.name}`,
    name: field.name,
    required: field.required,
    disabled: field.readonly,
    placeholder: field.placeholder,
    className: FIELD_CLASS,
  };

  const v = value == null ? '' : (value as any);

  switch (field.type) {
    case 'textarea':
    case 'paragraph':
    case 'long_text':
      return (
        <textarea
          {...common}
          rows={5}
          maxLength={field.maxLength}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
    case 'integer':
    case 'decimal':
    case 'currency':
      return (
        <input
          {...common}
          type="number"
          value={v === '' ? '' : Number(v)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    case 'email':
      return (
        <input {...common} type="email" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'url':
      return (
        <input {...common} type="url" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'password':
      return (
        <input {...common} type="password" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'date':
      return (
        <input {...common} type="date" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'time':
      return (
        <input {...common} type="time" value={String(v)} onChange={(e) => onChange(e.target.value)} />
      );
    case 'datetime':
    case 'timestamp':
      return (
        <input
          {...common}
          type="datetime-local"
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'boolean':
    case 'toggle':
    case 'checkbox':
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            id={common.id}
            name={common.name}
            type="checkbox"
            disabled={field.readonly}
            checked={Boolean(v)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span>{field.placeholder ?? field.label}</span>
        </label>
      );
    case 'select':
    case 'picklist':
    case 'enum': {
      const opts = field.options ?? [];
      return (
        <select
          {...common}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled={field.required}>
            {field.placeholder ?? '— Select —'}
          </option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    case 'radio': {
      const opts = field.options ?? [];
      return (
        <div className="flex flex-wrap gap-3">
          {opts.map((o) => (
            <label key={o.value} className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={field.name}
                value={o.value}
                checked={String(v) === o.value}
                disabled={field.readonly}
                onChange={() => onChange(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    default:
      return (
        <input
          {...common}
          type="text"
          maxLength={field.maxLength}
          value={String(v)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// ─── Main component ─────────────────────────────────────────────────

export interface FormPageProps {
  /** `'public'` for /f/:slug (anonymous), `'internal'` for /forms/:name (authed). */
  mode: FormPageMode;
  /**
   * Builds the console path of a record an INTERNAL submit just created, so
   * the default `created-record` behaviour has somewhere to land.
   *
   * Injected rather than computed here because the answer is not a property of
   * the form: a record page is app-scoped (`/apps/<segment>/<object>/record/
   * <id>` — ADR-0048), and WHICH app should host an app-independent page for
   * this user is a policy with a home of its own. `InternalFormRoute` owns it;
   * `FormPage` stays a renderer and keeps working outside a metadata catalog
   * (which is what the public `/f/:slug` mount is — no catalog, no app, and no
   * business having either).
   *
   * Returning `null` — or omitting the prop, as the public mount does — means
   * "no record page to land on", and the submit falls back to confirming.
   */
  recordPath?: (objectName: string, recordId: string) => string | null;
}

/**
 * Render a public or internal form by reading the relevant URL param.
 *
 * Why one component for both modes? The renderer, validation, layout and
 * post-submit behaviour are identical — only the *spec source* and the
 * *submit target* differ. Forking the component would duplicate the
 * field-rendering branch which is the bulk of the code.
 */
export function FormPage({ mode, recordPath }: FormPageProps) {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const identifier = (mode === 'public' ? params.slug : params.name) ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load spec on mount / when identifier changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const loader = mode === 'public' ? loadPublicForm(identifier) : loadInternalForm(identifier);
    loader
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        const sections = buildSections(result.form, result.objectSchema);
        const allFields = sections.flatMap((s) => s.fields);
        setValues(readPrefill(allFields, search));
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, identifier, search]);

  const sections = useMemo<RenderableSection[]>(
    () => (loaded ? buildSections(loaded.form, loaded.objectSchema) : []),
    [loaded],
  );

  const behavior: EffectiveSubmitBehavior = resolveSubmitBehavior(
    mode,
    loaded?.form?.submitBehavior,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const result =
        mode === 'public'
          ? await submitPublic(identifier, values)
          : await submitInternal(loaded.object, values);
      toast.success('Submitted');
      // Behaviour after submit
      switch (behavior.kind) {
        case 'created-record': {
          // The internal default (ruling point 2): land on what was just
          // created. Client-side `navigate` — NOT `window.location.assign` —
          // because the record page lives in the same SPA and a full reload
          // would throw away the shell this route now renders inside.
          const id = readCreatedRecordId(result);
          const to = id ? recordPath?.(loaded.object, id) : null;
          if (to) {
            navigate(to);
            break;
          }
          // No id in the response, or no record page to land on. Confirm the
          // submit rather than navigate somewhere broken — the create itself
          // succeeded, so silence would be the worse answer.
          setSubmitted(true);
          break;
        }
        case 'redirect': {
          const delay = behavior.delayMs ?? 0;
          setTimeout(() => window.location.assign(behavior.url), delay);
          setSubmitted(true);
          break;
        }
        case 'continue': {
          // Reset values to defaults so the user can submit another one.
          const allFields = sections.flatMap((s) => s.fields);
          setValues(readPrefill(allFields, search));
          break;
        }
        case 'next-record':
        case 'thank-you':
        default:
          setSubmitted(true);
          break;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (error && !loaded) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }
  if (!loaded) return null;

  // `created-record` reaches this branch only on the fallback path above (no
  // id in the response, or nowhere to land) — a successful redirect navigates
  // away instead. It carries no author-supplied title/message, so it renders
  // the generic confirmation.
  if (submitted && (behavior.kind === 'thank-you' || behavior.kind === 'created-record')) {
    const title = behavior.kind === 'thank-you' ? behavior.title : undefined;
    const message = behavior.kind === 'thank-you' ? behavior.message : undefined;
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border bg-card p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">
            {title ?? 'Thanks!'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {message ?? 'Your submission has been received.'}
          </p>
        </div>
      </div>
    );
  }
  if (submitted && behavior.kind === 'redirect') {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">{loaded.label}</h1>
        {loaded.form?.label && loaded.form.label !== loaded.label && (
          <p className="mt-1 text-sm text-muted-foreground">{loaded.form.label}</p>
        )}
      </header>
      <form onSubmit={handleSubmit} className="space-y-6">
        {sections.map((sec, i) => (
          <section key={i} className="rounded-md border bg-card p-4 sm:p-5">
            {sec.label && (
              <h2 className="mb-3 text-sm font-medium">{sec.label}</h2>
            )}
            <div
              className={
                sec.columns === 1
                  ? 'grid grid-cols-1 gap-4'
                  : sec.columns === 2
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2'
                    : sec.columns === 3
                      ? 'grid grid-cols-1 gap-4 sm:grid-cols-3'
                      : 'grid grid-cols-1 gap-4 sm:grid-cols-4'
              }
            >
              {sec.fields.filter((f) => !f.hidden).map((f) => (
                <div
                  key={f.name}
                  className={
                    f.colSpan === 2 ? 'sm:col-span-2'
                      : f.colSpan === 3 ? 'sm:col-span-3'
                        : f.colSpan === 4 ? 'sm:col-span-4'
                          : ''
                  }
                >
                  <label
                    htmlFor={`f_${f.name}`}
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    {f.label}
                    {f.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  <FieldInput
                    field={f}
                    value={values[f.name]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                  />
                  {f.helpText && (
                    <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FormPage;
