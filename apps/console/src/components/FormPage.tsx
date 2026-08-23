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
 * an internal submit lands on the record it just wrote, while the public
 * path keeps the anonymous `thank-you` confirmation. See
 * {@link resolveSubmitBehavior}. This is the same shape as Airtable Forms —
 * the form view metadata is identical whether it is embedded publicly or
 * used by logged-in operators.
 *
 * ## Create vs edit (objectui#4278)
 *
 * The internal route also serves EDIT, and which one it is comes from the URL:
 * `ActionRunner.executeForm` forwards the record an action was fired from as
 * `/forms/:name?recordId=<id>`. Until #4278 this route ignored that param
 * entirely — it rendered empty inputs and its submit was an unconditional
 * `POST` — so an "edit this record" action produced a blank form and then a
 * DUPLICATE record. `?recordId=` now selects the whole read/write pair:
 * `GET /data/:object/:id` to prefill, `PATCH /data/:object/:id` to save. See
 * {@link readFormRecordTarget} for the create/edit/refuse decision and
 * {@link readPrefill} for what wins when a `prefill_` param and a stored value
 * name the same field.
 *
 * ## Which object that id belongs to (objectui#4292)
 *
 * An id alone does not say which object it names, so the read/write pair above
 * resolves it against the FormView's own target — right when the action fired
 * from a record of that object, silently wrong when it did not. `?recordObject=`
 * now travels with the id and this route refuses when the two disagree; see
 * {@link FORM_RECORD_OBJECT_PARAM} for why it can only ever refuse, and the
 * guard in {@link loadInternalForm} for where it fires (before any `/data/`
 * request, so a mismatch reads nothing and writes nothing).
 *
 * ## Where a declared `redirect` goes (objectui#4190)
 *
 * `submitBehavior: { kind: 'redirect' }` was consumed as a browser-level
 * navigation on the authored string, which is why the card asked what that
 * string even meant. objectstack#7496 ruled it: a RELATIVE in-app path, with
 * `{{record.field}}` interpolation, URL-escaped when the redirect is built.
 * So the destination is a route in this shell and it is navigated to with the
 * router — a full-page navigation ignores the console mount and drops the
 * submitter at the origin root — while an out-of-contract absolute is refused
 * on screen instead of followed. See `submitRedirect.ts`.
 *
 * ## Conditional field visibility (objectui#5594)
 *
 * A FormView field may carry a CEL predicate saying WHEN it is visible —
 * `visibleWhen`, or the deprecated ADR-0089 alias `visibleOn`. This renderer
 * read neither, so such a field rendered unconditionally on both routes:
 * fail-open and silent, with no diagnostic for the author.
 *
 * It is the SECOND form renderer in this repo, which is why the gap survived.
 * objectui#2212 recorded this exact symptom and PR #2214 fixed it on the OTHER
 * chain — `ModalForm` -> `resolveFormViewLayout` -> `@object-ui/plugin-form`
 * `sectionFields.ts` -> `@object-ui/components` `renderers/form/form.tsx` —
 * which this file is on at no point, and #2212's regression pin lives with
 * that chain, so nothing in the suite could see this copy.
 *
 * The wiring is #2212's ruling applied verbatim, not a second semantics: see
 * {@link isFieldVisible} for the engine, the bound scope, and what the fix
 * deliberately does not change.
 *
 * ## The other three conditional-rule surfaces (objectui#5627)
 *
 * #5594 wired ONE of the four surfaces the sibling chain honours — the
 * view-level field predicate. The other three were dropped in the same place
 * and for the same reason: nothing downstream could read a key this file's
 * payload types did not admit.
 *
 *  - SECTION-level `visibleWhen` / `visibleOn` (ADR-0089). The section type is
 *    no longer this file's to widen — objectui#5596 replaced the hand copy with
 *    the shared `FormSectionSpec`, which has DECLARED these two keys ever since
 *    ("declaring a key is not honouring it", as that type's own docstring says
 *    while naming this card). What was missing here was the evaluation, and the
 *    render mapped every section unconditionally. See {@link isSectionVisible}.
 *  - OBJECT-level `visibleWhen` / `readonlyWhen` / `requiredWhen` (ADR-0036),
 *    authored on the object's field rather than on the form view. This file's
 *    own `ObjectFieldDef` admitted none of them, so `readonly` and `required`
 *    were whatever the static flags said. See {@link resolveRowState}, which
 *    resolves them through the SHARED `resolveFieldRuleState` rather than
 *    re-deriving what the three rules mean for a fourth time.
 *
 * Both halves are RENDERING rules: a hidden section's fields still submit their
 * values, exactly as a hidden field's do (triage ruling, 2026-08-22, following
 * #5594 and the plugin-form chain). Nothing in this file makes visibility a
 * submit-payload rule, at either granularity.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  evalFieldPredicate,
  isServerOwnedValue,
  resolveFieldRuleState,
  type FieldRulePredicate,
} from '@object-ui/core';
import type { FormFieldSpec, FormSectionSpec, FormViewSpec } from '@object-ui/app-shell';
import { resolveSubmitRedirect } from './submitRedirect';

const API_BASE = (import.meta.env.VITE_SERVER_URL || '') + '/api/v1';

/** Resolved server payload for a public form. */
interface PublicFormPayload {
  slug: string;
  object: string;
  label?: string;
  form: FormViewBody;
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
  /**
   * The OBJECT-level conditional rules (ADR-0036), authored on the object's
   * field rather than on a form view — a DIFFERENT slot from the view-level
   * predicate {@link RenderableField.visibleWhen} carries (objectui#5627).
   *
   * The sibling chain keeps the two apart on purpose: `@object-ui/plugin-form`
   * `sectionFields.ts` copies these three straight off the object field and
   * routes the VIEW predicate into `visibleOn` "so the object rule is never
   * clobbered", and `@object-ui/components` `renderers/form/form.tsx` then
   * evaluates the two slots independently and ANDs them. This file admitted
   * neither of them until #5627, so `buildSections` could not read what it was
   * never handed: `readonly` was `override.readonly ?? false` and `required`
   * was `override.required ?? def.required ?? false` — static, never
   * conditional, on both routes including the anonymous `/f/:slug` one.
   *
   * Typed as `@object-ui/core`'s own {@link FieldRulePredicate} rather than
   * re-spelled, because that is the parameter type of `resolveFieldRuleState`,
   * the engine every one of these predicates is handed to. (The view-level slot
   * derives its type from `FormFieldSpec` for the same reason, one layer up.)
   */
  visibleWhen?: FieldRulePredicate;
  readonlyWhen?: FieldRulePredicate;
  requiredWhen?: FieldRulePredicate;
}

/** Visualization types the form renderer understands (FormViewSpec.type). */
const FORM_SPEC_TYPES = new Set(['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal']);

/**
 * The form CONFIG plus the view identity that travels beside it (objectui#5596).
 *
 * {@link FormViewSpec} is the converged form contract and carries no `label`:
 * `@objectstack/spec`'s `FormViewSchema` REJECTS that key outright
 * (`unrecognized_keys`, measured against the installed 17.0.0) — a form config
 * says `title`, not `label`. Until #5596 this file's hand copy declared `label`
 * on the form type, which read as "a FormView may be labelled" and is not true.
 *
 * The value those reads actually find is the VIEW's identity label, and both
 * bodies this renderer accepts carry it one way or another:
 *
 *  - the `ExpandedViewItem` envelope (#2208) puts it beside `config`, and
 *    {@link resolveInternalForm} already reads it from there;
 *  - a FLATTENED runtime overlay has no envelope at all — the config and the
 *    identity share one object, which is exactly what the spec publishes as
 *    `VIEW_METADATA_MEMBERS.formOverlay` (`FormViewSchema` extended with
 *    `label` / `object` / `viewKind` / ...). On that branch `form === body`, so
 *    the label is reachable through the form variable.
 *
 * So the key is declared HERE, on the body this renderer unwraps, and not on the
 * form contract shared with `packages/app-shell`. Narrowed to `string` because
 * every read below assigns it into a `string` slot; the spec's own overlay types
 * it `I18nLabel`, whose inline locale-map arm no form renderer in this repo
 * resolves.
 */
type FormViewBody = FormViewSpec & { label?: string };

/**
 * Post-submit behaviour — DERIVED from the converged form contract, not
 * restated (objectui#5596).
 *
 * This was a hand-written four-member union carrying the comment "Mirrors the
 * spec FormView.submitBehavior union", which is the claim shape
 * `scripts/check-spec-symbol-derivation.mjs` exists to catch: a mirror that
 * nothing checks is one spec release from being a fork. Reading it back off
 * {@link FormViewSpec} makes the mirror structural.
 *
 * `redirect.url` is still a plain string, because that is what the contract
 * ships: the ruled shape (objectstack#7496) is a refinement ON a string, so the
 * key arrives as the author wrote it. What it is ALLOWED to say is not restated
 * here either — `resolveSubmitRedirect` asks the spec's own schema at the
 * moment of use (`submitRedirect.ts`).
 */
type SubmitBehavior = NonNullable<FormViewSpec['submitBehavior']>;

/** Which surface is rendering the form — see {@link FormPageProps.mode}. */
export type FormPageMode = 'public' | 'internal';

/**
 * The query param naming the record an internal form edits — the one
 * `ActionRunner.executeForm` forwards (`/forms/:name?recordId=<id>`).
 *
 * ## Why the same spelling as the drawer's reserved param, deliberately
 *
 * `recordId` is ALREADY reserved in `@object-ui/app-shell`'s registry
 * (`src/urlParams.ts` → `RECORD_DRAWER_PARAM`), where it opens a record-detail
 * drawer over a list. That is not a collision to route around, and #4278 ruling
 * point 3 asked for the relationship to be measured rather than assumed:
 *
 *  - the two readers can never see one URL. React Router renders exactly one
 *    leaf per location, `/forms/:name` is a TOP-LEVEL route in `App.tsx`
 *    (sibling of `/apps/*`, where `ObjectView` — the drawer's only reader,
 *    `views/ObjectView.tsx`, the single `RECORD_DRAWER_PARAM` call site
 *    outside the registry itself — is mounted), and `InternalFormRoute` renders
 *    `DefaultHomeLayout` + this component and no list. Disjoint subtrees, so
 *    the same URL cannot carry both meanings at once;
 *  - and the MEANING is the same one either way — "the record this surface is
 *    about". A second spelling (`formRecordId`, …) for that fact would be the
 *    de-facto second contract AGENTS.md #0.1 forbids, and would make the
 *    already-reserved name look free to repurpose.
 *
 * So this is the registry's name, used as the registry defines it. It is a
 * literal here rather than an import only because `@object-ui/app-shell`
 * exports its package root alone — its `exports` map publishes `.` and
 * `./styles.css`, nothing else — and that root does not re-export
 * `./urlParams`, so `RECORD_DRAWER_PARAM` has no spelling a consumer can
 * import. Retiring this literal means publishing the registry from that root,
 * the way objectui#4280 collected `resolveHostAppSegment`. `FormPage.test.ts`
 * pins the two spellings equal so they cannot drift apart in silence.
 */
export const FORM_RECORD_ID_PARAM = 'recordId';

/**
 * The object the accompanying {@link FORM_RECORD_ID_PARAM} belongs to
 * (objectui#4292) — `ActionRunner.executeForm` forwards the two together.
 *
 * ## Why an id needed an object at all
 *
 * `?recordId=` names an id and nothing else, so this route has to pick an
 * object to resolve it against, and it picks the FormView's own target — the
 * only one it knows. That is right whenever the action fired from a record OF
 * that object, and until #4292 nothing checked that it had: an action whose
 * `locations` put it on an Account but whose `target` is `showcase_task.edit`
 * is publishable metadata, and where primary keys are per-table integers
 * `GET /data/showcase_task/42` answers happily for the user who was looking at
 * Account 42. The server cannot flag it either — it echoes the path's object
 * back (`getData` returns `object: request.object`), so the response is
 * self-consistent. #4278 shipped the read/write pair that turned that from a
 * duplicate INSERT into a targeted UPDATE of the wrong record, which is what
 * made the missing identity worth closing.
 *
 * ## An ASSERTION, never an override — the whole point
 *
 * This param cannot change which object the form edits; that comes from the
 * view metadata and only from there. Its sole power is to make the form
 * REFUSE. Reading it as a selector instead would let any hand-authored URL aim
 * a form at an arbitrary object — the same hole, re-opened from the other side.
 * (The registry's `formObject` is deliberately the other thing: it selects the
 * object the record-form OVERLAY edits. Same `<param>Object` naming, opposite
 * powers, separate surfaces.)
 *
 * Spelled as a literal here and in `ActionRunner` for the reason
 * {@link FORM_RECORD_ID_PARAM} documents — `@object-ui/core` sits below this
 * app and app-shell exports no `./urlParams`. `FormPage.test.ts` pins the two
 * ends together by running the real producer and reading its URL back here,
 * so a rename on either side fails rather than silently disarming the guard.
 */
export const FORM_RECORD_OBJECT_PARAM = 'recordObject';

/**
 * What the URL says this internal form is FOR: creating a record, editing a
 * named one, or nothing coherent.
 *
 * The third case is the point. #4278 ruling point 2 is fail-closed: an edit
 * intent this route cannot honour must reach the error state, because silently
 * falling back to create mode is the EXACT harm the card was filed about (an
 * empty form whose submit inserts a duplicate). A present-but-blank
 * `?recordId=` — which `ActionRunner` really can emit, since it appends the
 * param for any `recordId != null` and an empty-string id passes that test —
 * declares edit intent and names no record, so it refuses rather than degrades.
 */
export type FormRecordTarget =
  | { kind: 'create' }
  | { kind: 'edit'; recordId: string; recordObject: string | null }
  | { kind: 'refuse'; reason: string };

/**
 * Decide {@link FormRecordTarget} from the surface and the query string.
 *
 * PUBLIC mode never reads the param, and that is a contract, not an
 * optimisation: `/f/:slug` is the anonymous surface, where the visitor
 * controls the URL and the backend resolver deliberately exposes one
 * submit-only endpoint. Honouring `?recordId=` there would turn a public form
 * into an arbitrary-record reader and writer. The public path is unchanged by
 * every part of #4278, and this line is where that holds — `recordObject`
 * (#4292) is read on the same terms, i.e. not at all on that surface.
 *
 * `recordObject` is carried to the loader rather than judged here: the object
 * it must agree with is the FormView's, which only the view metadata knows, so
 * the comparison happens where that arrives ({@link loadInternalForm}). What
 * this function decides is unchanged — create, edit, or refuse from the URL
 * alone. A blank or whitespace-only `recordObject` is treated as ABSENT, not as
 * a mismatch: it asserts nothing, and #4292 ruling point 2 tightens the guard
 * only where identity information is actually present (a URL can always just
 * omit the param, so refusing here would buy nothing and would break the
 * hand-authored deep links the ruling preserves).
 */
export function readFormRecordTarget(
  mode: FormPageMode,
  search: URLSearchParams,
): FormRecordTarget {
  if (mode !== 'internal') return { kind: 'create' };
  const raw = search.get(FORM_RECORD_ID_PARAM);
  // No id ⇒ create, whatever `recordObject` says: with no record named there is
  // nothing for an object assertion to be about.
  if (raw === null) return { kind: 'create' };
  const recordId = raw.trim();
  if (!recordId) {
    return {
      kind: 'refuse',
      reason:
        `This form was opened to edit a record (?${FORM_RECORD_ID_PARAM}=), but no record id was supplied. ` +
        'Re-open it from the record, or drop the parameter to create a new one.',
    };
  }
  const declaredObject = (search.get(FORM_RECORD_OBJECT_PARAM) ?? '').trim();
  return { kind: 'edit', recordId, recordObject: declaredObject || null };
}

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
 *
 * Since objectui#4278 the internal route also EDITS, and this one value covers
 * both writes: "land on the record this submit wrote" — the created one, or
 * the one `?recordId=` named. It is one behaviour, so it keeps one name; a
 * second `updated-record` kind would be two spellings of a single rule, and
 * the name is #4109's rather than churned here because renaming it would
 * restate a just-landed contract for cosmetics. The create/edit split lives
 * where it belongs — in the id the handler navigates with, not in the union.
 */
type EffectiveSubmitBehavior = SubmitBehavior | { kind: 'created-record' };


/** Normalized field row used by the renderer. */
interface RenderableField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  readonly: boolean;
  hidden: boolean;
  /**
   * Conditional visibility for this row, as authored on the FORM VIEW's field
   * — the predicate {@link isFieldVisible} evaluates against the LIVE form
   * values, as distinct from the static `hidden` flag above.
   *
   * The VIEW level, specifically: the object field's own `visibleWhen` is a
   * separate rule that lives in {@link RenderableField.rules} and is ANDed with
   * this one by {@link resolveRowState} (objectui#5627). Two layers may both
   * condition one control, and either one hiding it is enough.
   *
   * Resolved CANONICAL-FIRST when the row is built: `visibleWhen ?? visibleOn`.
   * ADR-0089 renamed the key, and `@objectstack/spec`'s normaliser REWRITES the
   * alias rather than keeping both, so a spec-served FormView carries
   * `visibleWhen` and no `visibleOn` at all. The deprecated spelling is still
   * read because it still has live producers — hand-written layouts, and this
   * app's own create schemas, which never pass through that normaliser. Same
   * spelling and same precedence as the two sibling readers, deliberately:
   * `@object-ui/plugin-form` `sectionFields.ts` (`fd.visibleWhen ?? fd.visibleOn`)
   * and app-shell's metadata-admin `readVisibility`.
   *
   * The TYPE is derived from the authoring surface rather than restated:
   * re-spelling `string | { dialect?, source }` here would be a third
   * description of one contract, which is the exact class objectui#5542 closed
   * in this file.
   */
  visibleWhen?: FormFieldSpec['visibleWhen'];
  /**
   * The OBJECT-level rules (ADR-0036) copied off {@link ObjectFieldDef} —
   * `visibleWhen`, `readonlyWhen`, `requiredWhen` (objectui#5627).
   *
   * Carried as a GROUP rather than as three sibling keys because the group IS
   * `resolveFieldRuleState`'s first parameter: {@link resolveRowState} hands
   * this object over whole, so there is no per-key re-assembly step for a
   * fourth consumer-side copy of the rule semantics to hide in. Nesting also
   * settles the one genuine ambiguity in this row type — `visibleWhen` one
   * level up is the VIEW's predicate, `rules.visibleWhen` is the OBJECT's, and
   * the sibling chain's runtime `FormField` happens to spell that same pair the
   * other way round (`visibleWhen` = object, `visibleOn` = view). A reader of
   * either file can tell which layer a predicate came from without knowing the
   * other file's convention.
   *
   * Carried, not evaluated, for the reason the view-level slot is: the verdict
   * depends on the live values, and these rows are memoized on the loaded spec.
   */
  rules?: {
    visibleWhen?: FieldRulePredicate;
    readonlyWhen?: FieldRulePredicate;
    requiredWhen?: FieldRulePredicate;
  };
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
  /**
   * Conditional visibility for the whole section (ADR-0089), resolved
   * CANONICAL-FIRST when the row is built: `visibleWhen ?? visibleOn`
   * (objectui#5627).
   *
   * The same key, the same precedence and the same reason as the field row one
   * type up — the spec's normaliser rewrites the alias, so a spec-served
   * FormView carries only `visibleWhen`, while hand-written layouts and this
   * app's own create schemas still produce the deprecated spelling. app-shell's
   * `SchemaForm` reads its sections through a `readVisibility` helper spelling
   * exactly this `??`; that helper is module-private there (it is not part of
   * `@object-ui/app-shell`'s published surface), so the shared machinery this
   * file can actually import is the ENGINE — `evalFieldPredicate`, via
   * {@link isSectionVisible} — which is the half that decides anything.
   *
   * Type derived from the shared authoring surface (objectui#5596's
   * {@link FormSectionSpec}) rather than restated, exactly as the field row
   * derives its own from `FormFieldSpec`.
   */
  visibleWhen?: FormSectionSpec['visibleWhen'];
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
        // Canonical key wins over the deprecated alias — see
        // `RenderableField.visibleWhen`. Carried, not evaluated: the verdict
        // depends on the live form values, which change per keystroke, while
        // these rows are memoized on the loaded spec.
        visibleWhen: override.visibleWhen ?? override.visibleOn,
        // The OBJECT's own rules (ADR-0036), off the object field and NOT
        // merged with the view predicate above: two layers, two slots, ANDed
        // at render by `resolveRowState` (objectui#5627). A `??` here would be
        // the collapse the sibling chain avoids on purpose — a view predicate
        // would then clobber the object's rule instead of narrowing it.
        rules: {
          visibleWhen: def.visibleWhen,
          readonlyWhen: def.readonlyWhen,
          requiredWhen: def.requiredWhen,
        },
        placeholder: override.placeholder ?? def.placeholder,
        helpText: override.helpText ?? def.helpText,
        defaultValue: def.defaultValue,
        options: normalizeOptions(def.options),
        // The FORM's ceiling wins over the object's, exactly like every
        // sibling key above. This one key read `def` alone, so a tighter
        // per-form limit — a short public intake form over a generously
        // sized column — was discarded with no diagnostic, and the docstring
        // promising overrides win was false for it (objectui#5595). The
        // override can only NARROW what the author sees at the input; the
        // object's storage ceiling still decides at submit time.
        maxLength: override.maxLength ?? def.maxLength,
        colSpan: override.colSpan ?? 1,
      });
    }
    return {
      label: sec.label,
      columns: cols,
      collapsible: !!sec.collapsible,
      collapsed: !!sec.collapsed,
      // Canonical key wins over the deprecated alias, same precedence as the
      // field row — see `RenderableSection.visibleWhen` (objectui#5627).
      visibleWhen: sec.visibleWhen ?? sec.visibleOn,
      fields,
    };
  });
}

/**
 * Is this row on screen, given the form's current state?
 *
 * Two independent reasons a field is not rendered, answered in ONE place so
 * "is this field visible" has a single reader:
 *
 *  1. `hidden: true` — the static flag. Unconditional.
 *  2. `visibleWhen` — the conditional predicate (ADR-0089), evaluated against
 *     the live form values on every render.
 *
 * The predicate is routed through the CANONICAL engine — `evalFieldPredicate`
 * (`@object-ui/core`, `evaluator/fieldRules.ts`) — which is objectui#2212's
 * ruling applied verbatim rather than a second predicate semantics invented
 * for this renderer. Two form renderers disagreeing about what `visibleWhen`
 * MEANS would be a worse defect than one renderer ignoring it. So the engine,
 * the accepted wire shapes (bare CEL string and `{ dialect, source }`), the
 * bound scope and the failure behaviour are the shared ones by construction,
 * not by agreement.
 *
 * Scope: `record.*` is the LIVE values — what the inputs currently hold, not
 * what was loaded — so a predicate re-decides as the user types, which is the
 * whole point of a conditional field. `previous.*` is the stored record an
 * edit form started from (objectui#4278), unbound on a create form. That is
 * the same pair `form.tsx` binds on the sibling chain.
 *
 * Fail-open (`fallback: true`) is deliberate and shared: a predicate that
 * cannot be evaluated must not HIDE a field, because a hidden field is one the
 * submitter can neither fill in nor see is missing. Open does not mean silent
 * — `evalFieldPredicate` warns once per predicate text, naming the field.
 *
 * ## What this deliberately does NOT do
 *
 * It does not strip the VALUE of a field it hides. `values` still carries
 * whatever {@link readPrefill} seeded and `handleSubmit` still submits it —
 * exactly what a statically `hidden: true` field has always done here, and
 * what the plugin-form chain does (#2212's fix returns `null` at render and
 * clears stale ERRORS, never values). Conditional visibility is a rendering
 * rule in both renderers; making it a submit-payload rule would be a new
 * contract, decided once for both, not invented here in the second one.
 */
export function isFieldVisible(
  field: RenderableField,
  values: Record<string, unknown>,
  previous?: Record<string, unknown> | null,
): boolean {
  if (field.hidden) return false;
  return evalFieldPredicate(field.visibleWhen, values, true, previous ?? undefined, undefined, {
    // Named for the canonical key even when the deprecated alias supplied the
    // predicate: ADR-0089 is what this predicate is CALLED, and the warning
    // prints the source text verbatim, which is what finds a hand-written
    // `visibleOn`. A second stored key whose only job is to spell a deprecated
    // name in a warning would be bookkeeping, not an honoured key.
    context: `visibleWhen of field '${field.name}'`,
  });
}

/**
 * Is this SECTION on screen, given the form's current state? (objectui#5627)
 *
 * The section-granularity twin of {@link isFieldVisible}, and deliberately the
 * same three things: the canonical-first key read (done once, at build time —
 * `RenderableSection.visibleWhen`), the canonical ENGINE
 * (`evalFieldPredicate`), and fail-OPEN with a one-time warning. A section that
 * cannot be evaluated must not vanish, for the field-level reason multiplied by
 * however many controls it holds: a section nobody can see is one the submitter
 * can neither fill in nor notice is missing.
 *
 * Scope is the same pair the field predicate binds — live `record.*`, stored
 * `previous.*` — so an author writes ONE dialect for both granularities, and
 * `SECTION.visibleWhen` and `FIELD.visibleWhen` cannot disagree about what
 * `record.status` refers to.
 *
 * ## Rendering rule, ruled (triage first-touch, 2026-08-22)
 *
 * > Section-level visibility is a rendering rule — a hidden section's fields
 * > still submit, matching the field-level answer #5594 deliberately kept and
 * > the plugin-form chain.
 *
 * So this decides what is DRAWN and nothing else: `values` still carries what
 * {@link readPrefill} seeded and `handleSubmit` still submits it, exactly as a
 * field hidden by its own predicate has done here since #5594.
 */
export function isSectionVisible(
  section: RenderableSection,
  values: Record<string, unknown>,
  previous?: Record<string, unknown> | null,
): boolean {
  return evalFieldPredicate(section.visibleWhen, values, true, previous ?? undefined, undefined, {
    // Sections have no `name`, so the locator is the heading an author can
    // actually find in their own metadata; an unlabelled section says so
    // rather than printing `undefined`.
    context: `visibleWhen of section '${section.label ?? '(unlabelled)'}'`,
  });
}

/**
 * The row's EFFECTIVE `{ visible, readonly, required }` — every conditional
 * rule that bears on one control, resolved in one place (objectui#5627).
 *
 * Three of the four inputs are the OBJECT-level rules (`rules.visibleWhen`,
 * `readonlyWhen`, `requiredWhen`) and they are not evaluated here at all: they
 * go to `@object-ui/core`'s `resolveFieldRuleState`, the engine the sibling
 * renderers (`renderers/form/form.tsx`, `WizardForm`, `GridField`,
 * `plugin-kanban`) already share. That reuse is the point of the card — a
 * FOURTH consumer-side re-implementation of "what does readonlyWhen mean" is
 * the defect, not the fix — and it is what carries three settled rulings in
 * without re-deriving any of them: a static `readonly: true` is never weakened
 * by a false predicate, a static `required: true` is never weakened by a false
 * one either, and `serverOwnedValue` outranks both spellings of required.
 *
 * ## `isCreateForm` is the CALLER's fact
 *
 * `resolveFieldRuleState` must be told whether this submit is an INSERT; it may
 * not infer it (objectui#4085 — an evaluator guessing from a missing `previous`
 * would read an edit form that simply passes none as a create). This renderer
 * knows it exactly, from the URL: {@link readFormRecordTarget} already decided
 * create / edit / refuse, and `/f/:slug` is create by construction. Passed as a
 * required parameter rather than defaulted, so a new call site cannot get edit
 * semantics by omission.
 *
 * On a create form a field whose `defaultValue` is a runtime instruction the
 * server resolves per insert (`NOW()`, `current_user`, a CEL envelope) is
 * therefore not required — whatever `requiredWhen` evaluates to (#4085) and
 * whatever the static flag says (#4069). Both halves come from the resolver,
 * not from a carve-out re-derived here; `isServerOwnedValue` is likewise the
 * shared classifier, handed the declared default this row already carries.
 *
 * ## The two visibility LAYERS are ANDed, never collapsed
 *
 * A view-level predicate ({@link isFieldVisible}) and an object-level one
 * (`rules.visibleWhen`) are different authoring slots with different owners,
 * and the sibling chain keeps them separate for exactly that reason. Either
 * one resolving false hides the control; neither can re-show what the other
 * hid. Both are evaluated on every call even when the first has already
 * decided, because the warning a broken predicate emits is the author's ONLY
 * diagnostic — short-circuiting would make a typo in one layer invisible
 * whenever the other happened to hide the row.
 */
export function resolveRowState(
  field: RenderableField,
  values: Record<string, unknown>,
  previous: Record<string, unknown> | null | undefined,
  isCreateForm: boolean,
): { visible: boolean; readonly: boolean; required: boolean } {
  const ruleState = resolveFieldRuleState(
    field.rules ?? {},
    values,
    {
      required: field.required,
      readonly: field.readonly,
      serverOwnedValue: isServerOwnedValue(
        // The shape that classifier reads — the resolved object-field metadata
        // and its declared default, which is what `def.defaultValue` already
        // put on this row in `buildSections`.
        { field: { defaultValue: field.defaultValue } },
        isCreateForm,
      ),
    },
    previous ?? undefined,
    undefined,
    `field '${field.name}'`,
  );
  const viewVisible = isFieldVisible(field, values, previous);
  return {
    visible: ruleState.visible && viewVisible,
    readonly: ruleState.readonly,
    required: ruleState.required,
  };
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
 * Strip the transport envelope off a data-API body, if there is one.
 *
 * Not a metadata dialect but a platform fact: two transports serve these
 * routes and only one wraps the body. `packages/rest`'s server answers the
 * bare protocol payload (`res.json(result)`), while the runtime's
 * http-dispatcher wraps every success as `{ success, data, meta }`. The
 * platform already resolves this in exactly ONE rule, in
 * `@objectstack/client`:
 *
 *     async unwrapResponse(res) {
 *       const body = await res.json();
 *       if (body && typeof body.success === 'boolean' && 'data' in body) return body.data;
 *       return body;
 *     }
 *
 * `FormPage` hand-rolls `fetch` instead of going through that client (it
 * predates having one here), so the same rule has to be applied at these call
 * sites. Mirroring it is not inventing a dialect — spelling a DIFFERENT rule
 * would be, which is why this is ONE function read by every data-API response
 * this file consumes (create, and since #4278 the record read) rather than the
 * same three lines written out twice.
 *
 * Returns null for anything that is not an object, so callers get one shape to
 * check instead of two.
 */
function unwrapTransportEnvelope(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const unwrapped =
    typeof body.success === 'boolean' && 'data' in body ? body.data : body;
  if (!unwrapped || typeof unwrapped !== 'object') return null;
  return unwrapped as Record<string, unknown>;
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
 * The transport envelope is absorbed by {@link unwrapTransportEnvelope} —
 * see there for why that is a platform fact rather than a dialect.
 *
 * ## Why the EDIT path does not use this (objectui#4278)
 *
 * `UpdateDataResponse` was measured and declares the identical triple
 * (`{ object, id, record, droppedFields? }`, `api/protocol.zod.ts`), so this
 * function would fit an update response byte for byte. It is deliberately not
 * pointed at one: on the edit path the id is already known — it came from the
 * URL and is the id we just `PATCH`ed — so reading it back would create a
 * SECOND source for one fact, and the two could only ever disagree by way of a
 * server bug this renderer would then silently follow. The create path has no
 * such source, which is exactly why it must read the response. One fact, one
 * reader, chosen per path.
 *
 * Returns null when the payload names no id, so the caller can confirm the
 * submit instead of navigating to `…/record/undefined`.
 */
export function readCreatedRecordId(payload: unknown): string | null {
  const unwrapped = unwrapTransportEnvelope(payload);
  if (!unwrapped) return null;
  const id = unwrapped.id;
  // The spec declares `id: z.string()`. The numeric branch is a coercion of
  // that SAME key for drivers whose primary key surfaces as an integer — one
  // key, one meaning, so it cannot mask a producer emitting the wrong shape.
  if (typeof id === 'string') return id === '' ? null : id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return null;
}

/**
 * The stored record an edit form starts from, read off the
 * `GET /api/v1/data/:object/:id` response.
 *
 * The response contract is spec-declared — `GetDataResponse = { object, id,
 * record }` (`@objectstack/spec`, `api/protocol.zod.ts`; the protocol's
 * `getData` returns exactly that triple and throws `recordNotFoundError`
 * otherwise, which REST maps to 404). The envelope is handled by
 * {@link unwrapTransportEnvelope}.
 *
 * Throws — rather than returning null — on anything it cannot vouch for,
 * because #4278 ruling point 2 is fail-closed and this function is the last
 * place that can tell an unreadable record from an empty one. A null return
 * would land in the same `values` state as create mode, which is the harm.
 *
 * ## The object check, and the honest limit of it
 *
 * The `object` key is compared against the FormView's target, and a mismatch
 * refuses. Measured reachability: the deployed server ECHOES the path object
 * (`getData` returns `object: request.object`), and we build that path from
 * the view's own target — so a live `packages/rest` deployment cannot produce
 * a mismatch here. This is therefore a contract assertion at the consumer, not
 * a live defect being patched; it costs three lines and it is what makes the
 * form's object and the record's object one checked fact instead of an
 * assumption, for any transport that does not echo.
 *
 * The case that IS live is the other one, and it is handled by the fetch
 * rather than by this check: a `recordId` belonging to a DIFFERENT object is
 * not found under the view's object, so the read 404s and refuses. See
 * `loadInternalForm`.
 */
export function readLoadedRecord(
  payload: unknown,
  expectedObject: string,
  recordId: string,
): Record<string, unknown> {
  const unwrapped = unwrapTransportEnvelope(payload);
  if (!unwrapped) {
    throw new Error(
      `Could not read record "${recordId}" of ${expectedObject}: the server returned no record payload.`,
    );
  }
  const servedObject = unwrapped.object;
  if (typeof servedObject === 'string' && servedObject && servedObject !== expectedObject) {
    throw new Error(
      `Record "${recordId}" belongs to ${servedObject}, but this form edits ${expectedObject}. ` +
        'Refusing to open it — check the action that linked here.',
    );
  }
  const record = unwrapped.record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error(
      `Could not read record "${recordId}" of ${expectedObject}: the response carried no "record".`,
    );
  }
  return record as Record<string, unknown>;
}

/**
 * The initial form state — every value an input starts life holding.
 *
 * Three sources, in strictly increasing precedence (#4278 ruling on prefill):
 *
 *  1. the field's `defaultValue` from the object schema — a CREATE-time
 *     proposal;
 *  2. the stored `record`, when this form is editing one. Present-but-null
 *     counts and beats a default: on an edit form the stored value is the
 *     truth, and letting a default paint over a cleared field would silently
 *     propose a change the user never made — which a subsequent save would
 *     then write;
 *  3. an explicit `?prefill_<field>=` query param, which wins over both.
 *
 * Point 3 is the ruling: "explicit `prefill_` params override the loaded
 * record's values for the fields they name … record values fill the rest". A
 * producer that forwards `?recordId=` AND `?prefill_x=` in one URL is
 * expressing intent — edit THIS record, with THIS field pre-changed — and the
 * narrower, per-field instruction is the more specific one. Fields the params
 * do not name keep their stored values, so the precedence is per FIELD and
 * never wholesale.
 */
export function readPrefill(
  fields: RenderableField[],
  search: URLSearchParams,
  record?: Record<string, unknown> | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) out[f.name] = f.defaultValue;
    // `hasOwnProperty` rather than a truthiness/undefined test: a stored null
    // or empty string is a real value on an edit form, and must beat the
    // default.
    if (record && Object.prototype.hasOwnProperty.call(record, f.name)) {
      out[f.name] = record[f.name];
    }
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
  form: FormViewBody;
  objectSchema: ObjectSchemaPayload | null;
  /**
   * The stored record this form is editing, or null in create mode
   * (objectui#4278). Non-null iff the load resolved a `?recordId=`.
   */
  record: Record<string, unknown> | null;
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
    // The anonymous surface never edits a stored record — see
    // `readFormRecordTarget` for why `?recordId=` is not readable here.
    record: null,
  };
}

/**
 * Unwrap a `/meta/view/:name` response into the {@link FormViewBody} the renderer
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
): { label: string; object?: string; form: FormViewBody } {
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
  const form: FormViewBody = isEnvelope ? spec.config : spec;
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
    // `data.object` is a declared FormView key since objectui#5596, so this no
    // longer needs `as any` — only a narrowing to the one arm that carries an
    // object name (`ViewDataSchema`'s `provider: 'object'`), read defensively
    // because the body itself is untrusted.
    object: (isEnvelope ? spec.object : undefined)
      ?? (form?.data as { object?: string } | undefined)?.object
      ?? spec?.object,
    form,
  };
}

/**
 * Internal mode: pull the FormView metadata directly + the target object's
 * schema, and — when the URL names a record (objectui#4278) — that record.
 *
 * We use the same `/meta` REST surface the rest of the console already speaks,
 * so anything the user has READ on works automatically.
 *
 * ## Why the record read is fatal when the schema read is not
 *
 * The object-schema fetch below is deliberately swallowed: without it the
 * renderer degrades to text inputs, which is a WORSE form but still the right
 * form, doing the right thing on submit. A failed RECORD read has no such
 * benign degradation — carrying on would render empty inputs and, on submit,
 * insert a duplicate. That is #4278's exact harm, so per ruling point 2 this
 * throws and the caller shows the error state. The gap between the two `catch`
 * postures is the gap between "less detail" and "wrong operation".
 */
async function loadInternalForm(
  name: string,
  recordId?: string | null,
  recordObject?: string | null,
): Promise<LoadedForm> {
  const viewRes = await apiFetch(`/meta/view/${encodeURIComponent(name)}`);
  if (!viewRes.ok) {
    throw new Error(`Form metadata not found: view/${name}`);
  }
  const viewBody = await viewRes.json();
  const { label, object: objectName, form } = resolveInternalForm(name, viewBody);
  if (!objectName) {
    throw new Error(`FormView "${name}" is missing an "object" target`);
  }
  // #4292, the consumer half: the URL asserted which object the id belongs to,
  // and it is not this form's. Refuse HERE — before the object-schema fetch and
  // well before the record read — so a mismatch costs zero `/data/` traffic and
  // can never reach a write. This is the second half of a check the producer
  // already made (`ActionRunner.executeForm` will not forward an id across an
  // object boundary at all); it is not redundant with it, because URLs also
  // arrive hand-written, bookmarked, or from a producer that predates the fix.
  //
  // Distinct from `readLoadedRecord`'s mismatch check, deliberately: that one
  // judges what the SERVER served, this one what the LINK claimed, and the two
  // wordings stay different so a failure names which of them fired.
  if (recordObject && recordObject !== objectName) {
    throw new Error(
      `This form edits ${objectName}, but the link says record "${recordId}" belongs to ` +
        `${recordObject}. Refusing to open it — check the action that linked here.`,
    );
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

  // #4278: the edit half. Fetched with the VIEW's object, so a `recordId`
  // belonging to some other object is simply not found here and 404s into the
  // refusal below — the live shape of "the record's object doesn't match the
  // form's" (`readLoadedRecord` documents why the echoed `object` key cannot
  // be the signal on this server).
  let record: Record<string, unknown> | null = null;
  if (recordId) {
    const recRes = await apiFetch(
      `/data/${encodeURIComponent(objectName)}/${encodeURIComponent(recordId)}`,
    );
    if (!recRes.ok) {
      const detail = await recRes.text().catch(() => '');
      throw new Error(
        `Could not open record "${recordId}" of ${objectName} for editing (${recRes.status})` +
          `${detail ? `: ${detail}` : recRes.statusText ? `: ${recRes.statusText}` : ''}`,
      );
    }
    record = readLoadedRecord(await recRes.json(), objectName, recordId);
  }

  return {
    label,
    object: objectName,
    form,
    objectSchema,
    record,
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

/**
 * Internal mode submit. Auth cookie carries identity.
 *
 * `POST /data/:object` to create; `PATCH /data/:object/:id` to update the
 * record `?recordId=` named (objectui#4278). Before that param was read, this
 * was an unconditional POST — which is why an "edit" action inserted a second
 * record instead of changing the one the user was looking at.
 *
 * The verb is MEASURED, not chosen: `PATCH /:object/:id → updateData` is the
 * data plugin's declared route (`@objectstack/spec`,
 * `api/plugin-rest-api.zod.ts`), it is what `packages/rest`'s server registers,
 * and `packages/rest/src/openapi-builtin-paths.ts` records that the server
 * "answers `PATCH` and 405s the `PUT`" — a published document that said `PUT`
 * was itself filed as a defect (#5588). Every other update client in this
 * workspace spells the same pair: `ApiDataSource.update` (`packages/core`),
 * the console's own API discovery and Integrations pages, and app-shell's
 * `ObjectApiPanel`. The body is the bare field patch, matching create.
 */
async function submitInternal(
  objectName: string,
  data: Record<string, unknown>,
  recordId?: string | null,
): Promise<unknown> {
  const path = recordId
    ? `/data/${encodeURIComponent(objectName)}/${encodeURIComponent(recordId)}`
    : `/data/${encodeURIComponent(objectName)}`;
  const res = await apiFetch(path, {
    method: recordId ? 'PATCH' : 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `${recordId ? 'Update' : 'Create'} failed (${res.status}): ${body || res.statusText}`,
    );
  }
  return res.json().catch(() => ({}));
}

// ─── Field renderers ─────────────────────────────────────────────────

const FIELD_CLASS =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

interface FieldInputProps {
  field: RenderableField;
  /**
   * The row's EFFECTIVE required/readonly verdict for the CURRENT values, from
   * {@link resolveRowState} — never the static flags on `field` (objectui#5627).
   *
   * A prop rather than a read of `field.required` / `field.readonly`, because
   * those two are now only INPUTS to the verdict: an object-level `readonlyWhen`
   * can lock a statically-editable field and a `requiredWhen` can require a
   * statically-optional one. Taking it as a parameter is what makes the control
   * and the asterisk beside it read ONE verdict — the two-layer disagreement
   * objectui#4201 removed on the sibling chain, where a field showed no marker
   * and the submit was refused anyway.
   */
  state: { readonly: boolean; required: boolean };
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldInput({ field, state, value, onChange }: FieldInputProps) {
  const common = {
    id: `f_${field.name}`,
    name: field.name,
    required: state.required,
    disabled: state.readonly,
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
            disabled={state.readonly}
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
          <option value="" disabled={state.required}>
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
                disabled={state.readonly}
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
   * Builds the console path of the record an INTERNAL submit just wrote —
   * created, or (objectui#4278) updated — so the default `created-record`
   * behaviour has somewhere to land.
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
  /**
   * Create, edit, or refuse — decided from the URL alone (objectui#4278), so
   * the whole read/write pair below has ONE switch rather than a `recordId`
   * truthiness test at each of the three sites that need it.
   */
  const target = readFormRecordTarget(mode, search);
  const editingId = target.kind === 'edit' ? target.recordId : null;
  /** The object the URL claims `editingId` belongs to (#4292), or null. */
  const editingObject = target.kind === 'edit' ? target.recordObject : null;
  /**
   * Is the write this form is heading for an INSERT? Read off the same URL
   * switch as the pair above, because `resolveFieldRuleState` requires the
   * caller to STATE it rather than infer it (objectui#4085) — see
   * {@link resolveRowState}. `/f/:slug` is create by construction: public mode
   * never reads `?recordId=` at all.
   */
  const isCreateForm = target.kind !== 'edit';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /**
   * The outcome of a `redirect` submit behaviour: the in-app route to go to
   * once `delayMs` has elapsed, or the fact that the authored destination was
   * refused (objectui#4190). Null until a redirect submit resolves.
   *
   * A refusal needs its own state rather than riding on `error`, for two
   * reasons. This page renders "Redirecting…" for a submitted redirect, and that
   * line would be a lie — nothing is going anywhere, and the submitter needs the
   * confirmation their record WAS written plus the reason it stopped here. And
   * the refusal travels WITH that flag rather than in `error` so one fact has
   * one reader: `error` is the page's load/submit failure channel, which a
   * refused destination is not (the submit succeeded).
   */
  const [redirect, setRedirect] = useState<
    { kind: 'pending'; path: string } | { kind: 'refused'; refusal: string } | null
  >(null);

  // Load spec on mount / when identifier or the record it targets changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // A `?recordId=` we cannot make sense of never reaches a loader: it is an
    // edit intent this route cannot honour, and #4278 ruling point 2 says
    // refuse rather than degrade into the create path.
    const loader =
      target.kind === 'refuse'
        ? Promise.reject(new Error(target.reason))
        : mode === 'public'
          ? loadPublicForm(identifier)
          : loadInternalForm(identifier, editingId, editingObject);
    loader
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        const sections = buildSections(result.form, result.objectSchema);
        const allFields = sections.flatMap((s) => s.fields);
        setValues(readPrefill(allFields, search, result.record));
      })
      .catch((e) => {
        if (!cancelled) {
          // Clear any previously loaded form: a refusal must not leave an
          // editable form on screen behind the error.
          setLoaded(null);
          setError(e?.message ?? String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // `target`/`editingId` are derived from `search`, already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, identifier, search]);

  const sections = useMemo<RenderableSection[]>(
    () => (loaded ? buildSections(loaded.form, loaded.objectSchema) : []),
    [loaded],
  );

  const behavior: EffectiveSubmitBehavior = resolveSubmitBehavior(
    mode,
    loaded?.form?.submitBehavior,
  );

  /**
   * The delayed leg of a `redirect` submit behaviour.
   *
   * It is an effect rather than a timer armed inside the submit handler so the
   * wait is TIED to this component: a submitter who leaves during `delayMs` is
   * not yanked back by a timer that outlived the page. `delayMs` semantics are
   * otherwise unchanged — the pause is what makes the confirmation readable,
   * the spec still declares the key, and an unset one still means "go now"
   * (a zero-delay timer, i.e. after this render commits).
   */
  const pendingRedirect = redirect?.kind === 'pending' ? redirect.path : null;
  const redirectDelayMs = behavior.kind === 'redirect' ? (behavior.delayMs ?? 0) : 0;
  useEffect(() => {
    if (pendingRedirect === null) return;
    const timer = setTimeout(() => navigate(pendingRedirect), redirectDelayMs);
    return () => clearTimeout(timer);
  }, [pendingRedirect, redirectDelayMs, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
    setSubmitting(true);
    setError(null);
    try {
      const result =
        mode === 'public'
          ? await submitPublic(identifier, values)
          : await submitInternal(loaded.object, values, editingId);
      toast.success('Submitted');
      // Behaviour after submit
      switch (behavior.kind) {
        case 'created-record': {
          // The internal default (#4109 ruling point 2): land on the record
          // this submit wrote. Client-side `navigate` — NOT
          // `window.location.assign` — because the record page lives in the
          // same SPA and a full reload would throw away the shell this route
          // now renders inside.
          //
          // On an EDIT (#4278) the destination is the id we already hold: it
          // came from the URL and is the row we just PATCHed, so there is
          // nothing to read out of the response and no way for it to be
          // missing. `readCreatedRecordId` is for the create path, which has
          // no other source — see its docblock for why the update response's
          // (identical, measured) `id` is deliberately not read back.
          const id = editingId ?? readCreatedRecordId(result);
          const to = id ? recordPath?.(loaded.object, id) : null;
          if (to) {
            navigate(to);
            break;
          }
          // No id in the response, or no record page to land on. Confirm the
          // submit rather than navigate somewhere broken — the write itself
          // succeeded, so silence would be the worse answer.
          setSubmitted(true);
          break;
        }
        case 'redirect': {
          // objectstack#7496 ruled this url a RELATIVE in-app path, so the
          // destination is a route in this shell — see `submitRedirect.ts` for
          // why the verdict is the spec's own, why a browser-level navigation
          // was the objectui#4190 defect rather than the mechanism, and why
          // `withConsoleBase` is not the tool.
          //
          // The token scope is the record this submit just wrote: the values as
          // submitted, with whatever the server echoed back layered over them
          // (defaults and computed fields are canonical there). The id is read
          // exactly as the `created-record` arm above reads it, so ONE rule
          // answers "the record this submit wrote" for both arms and a
          // `{{record.id}}` token cannot resolve one way here and another there.
          const written = unwrapTransportEnvelope(result)?.record;
          const writtenId = editingId ?? readCreatedRecordId(result);
          const verdict = resolveSubmitRedirect(behavior.url, {
            ...values,
            ...(written && typeof written === 'object' ? (written as Record<string, unknown>) : {}),
            ...(writtenId ? { id: writtenId } : {}),
          });
          if (!verdict.ok) {
            // The write SUCCEEDED and only the destination is out of contract.
            // So: confirm the submit, and put the refusal on screen — dropping
            // it would leave the submitter watching a redirect that must never
            // happen, and following it is the open redirect the ruling closed.
            toast.error(verdict.refusal);
            setRedirect({ kind: 'refused', refusal: verdict.refusal });
            setSubmitted(true);
            break;
          }
          setRedirect({ kind: 'pending', path: verdict.path });
          setSubmitted(true);
          break;
        }
        case 'continue': {
          // Reset values so the user can submit again. On an edit form that
          // means back to the record as loaded — NOT to blank, which would
          // stage a wipe of every field on the next save.
          const allFields = sections.flatMap((s) => s.fields);
          setValues(readPrefill(allFields, search, loaded.record));
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
    // A refused destination (objectui#4190) still confirms the write — it
    // happened — and shows why nothing was navigated to. "Redirecting…" is
    // reserved for a redirect that is actually pending.
    if (redirect?.kind === 'refused') {
      return (
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <div className="rounded-md border bg-card p-6 text-center">
            <h2 className="mb-2 text-lg font-semibold">Thanks!</h2>
            <p className="text-sm text-muted-foreground">
              Your submission has been received.
            </p>
          </div>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {redirect.refusal}
          </div>
        </div>
      );
    }
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
        {sections.map((sec, i) => {
          // A section conditioned away is skipped IN PLACE rather than filtered
          // out of the list first (objectui#5627). The key here is the section's
          // POSITION, and these predicates re-decide on every keystroke: filtering
          // would renumber every later section the moment one hid, remounting
          // their inputs and taking the caret with them. `null` keeps each
          // surviving section on the key it already had.
          if (!isSectionVisible(sec, values, loaded.record)) return null;
          return (
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
              {sec.fields.map((f) => {
                // One resolution per row per render, read by all three of the
                // things that depend on it below — the row's presence, the
                // required marker, and the control's own attributes. Computing
                // it three times would be three chances to disagree.
                const state = resolveRowState(f, values, loaded.record, isCreateForm);
                if (!state.visible) return null;
                return (
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
                    {state.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>
                  <FieldInput
                    field={f}
                    state={state}
                    value={values[f.name]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                  />
                  {f.helpText && (
                    <p className="mt-1 text-xs text-muted-foreground">{f.helpText}</p>
                  )}
                </div>
                );
              })}
            </div>
          </section>
          );
        })}
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
