/**
 * ExpressionContext Provider
 *
 * Provides expression evaluation context (user, app, data) to all child components.
 * Used by useCondition/useExpression hooks from @object-ui/react to evaluate
 * dynamic visibility, disabled, and hidden expressions in navigation items,
 * fields, and components.
 *
 * @example
 * ```tsx
 * <ExpressionProvider user={currentUser} app={activeApp}>
 *   <AppSidebar />
 * </ExpressionProvider>
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react';
import { ExpressionEvaluator } from '@object-ui/core';
import { PredicateScopeProvider, reportUnresolvableVisibilityPredicate } from '@object-ui/react';

export interface ExpressionContextValue {
  /** Current authenticated user */
  user: Record<string, any>;
  /** Active application config */
  app: Record<string, any>;
  /** Additional data scope */
  data: Record<string, any>;
  /**
   * Deployment-level feature flags surfaced by `/api/v1/auth/config`
   * (e.g. `multiOrgEnabled`). Used by CEL/template predicates on
   * metadata actions and views to hide entries that would otherwise
   * hit a forbidden endpoint. Empty `{}` when auth config hasn't
   * loaded yet — predicates should default to "visible" in that case
   * (see `sys_organization.create_organization.visible`).
   */
  features: Record<string, any>;
  /** The evaluator instance (for imperative use) */
  evaluator: ExpressionEvaluator;
}

const ExprCtx = createContext<ExpressionContextValue | null>(null);

/** The inputs an app-shell surface has when it needs a predicate scope. */
export interface ExpressionScopeInput {
  user?: Record<string, any>;
  app?: Record<string, any>;
  data?: Record<string, any>;
  features?: Record<string, any>;
}

/**
 * The ONE predicate scope this tier binds — the single declaration of what an
 * app-shell expression can name.
 *
 * ADR-0068 D1: expose the SAME user object under the canonical `current_user`
 * plus the back-compat `user` alias, the server-RLS-parity `ctx.user` alias,
 * and the server-CEL-parity `os.user` alias (the spec's canonical identity
 * scope — `{{os.user.id}}` per @objectstack/spec expression docs), so a
 * predicate authored against any one form evaluates identically on client,
 * server-formula, and server-RLS (#2358 trap 1). D1 names a client `visible`
 * gate as one of the three surfaces that must agree.
 *
 * ## Why this is a function and not three literals
 *
 * It was three literals, and they drifted (objectui#6493). `ExpressionProvider`
 * built the full bag, while `RecordFormPage` and `AppContent` each built a
 * private `new ExpressionEvaluator({ user, app, data })` for the SAME kind of
 * gate — an object field's `visible` — beside the provider they never read.
 * Those bags bound `user` but not the other three spellings of the same object,
 * and not `features` at all, so ONE authored predicate meant two things
 * depending on which evaluator reached it: `current_user` resolved on a nav
 * item and FAULTED on a field, and a fault fails OPEN (`evaluateVisibility`
 * below), which is indistinguishable on screen from a gate that said yes.
 * A copy of the bag is how that recurs; a call is not.
 *
 * `features` is renderer-tier, not contract — the same posture `@objectstack/
 * spec`'s `page.zod.ts` documents for component `visibleWhen` ("the shipping
 * renderer additionally mounts `app`, `features`, `os.user` … renderer
 * behaviour, NOT contract-guaranteed"). It is bound here because it is what
 * THIS tier's own diagnostic advice tells an author they may name.
 */
export function buildExpressionScope({
  user = {},
  app = {},
  data = {},
  features = {},
}: ExpressionScopeInput = {}): Record<string, any> {
  return { current_user: user, user, ctx: { user }, os: { user }, app, data, features };
}

/**
 * An `ExpressionEvaluator` over {@link buildExpressionScope}.
 *
 * Every app-shell site that needs an evaluator imperatively (i.e. one it cannot
 * take from `useExpressionContext()`, because it builds the field list ABOVE
 * the provider it mounts) calls this instead of `new ExpressionEvaluator(...)`
 * with a hand-written bag.
 */
export function createExpressionEvaluator(input: ExpressionScopeInput = {}): ExpressionEvaluator {
  return new ExpressionEvaluator(buildExpressionScope(input));
}

interface ExpressionProviderProps {
  children: React.ReactNode;
  user?: Record<string, any>;
  app?: Record<string, any>;
  data?: Record<string, any>;
  features?: Record<string, any>;
}

export function ExpressionProvider({ children, user = {}, app = {}, data = {}, features = {} }: ExpressionProviderProps) {
  const value = useMemo(() => {
    const evaluator = createExpressionEvaluator({ user, app, data, features });
    return { user, app, data, features, evaluator };
  }, [user, app, data, features]);

  // Also feed the predicate scope used by useCondition/useExpression in
  // @object-ui/react so action visibility predicates (e.g. on toolbar
  // buttons) can see deployment-level flags like features.multiOrgEnabled.
  // The SAME bag the evaluator above got — one builder, so the imperative and
  // the hook-driven halves of this provider cannot drift apart either.
  const scope = useMemo(
    () => buildExpressionScope({ user, app, data, features }),
    [user, app, data, features],
  );

  return (
    <ExprCtx.Provider value={value}>
      <PredicateScopeProvider scope={scope}>{children}</PredicateScopeProvider>
    </ExprCtx.Provider>
  );
}

/**
 * Hook to access the expression context.
 * Returns the full context value or a default empty context.
 */
export function useExpressionContext(): ExpressionContextValue {
  const ctx = useContext(ExprCtx);
  if (!ctx) {
    // Return a safe default so components can be used outside the provider.
    // Through the same builder: the hand-written version gave `current_user`,
    // `ctx.user` and `os.user` three DIFFERENT empty objects, which ADR-0068 D1
    // spells as aliases "pointing at the same object".
    const fallback = { user: {}, app: {}, data: {}, features: {} };
    return { ...fallback, evaluator: createExpressionEvaluator(fallback) };
  }
  return ctx;
}

/**
 * The `type` slot of the shared visibility-fault reporter, for THIS surface
 * (objectui#6443).
 *
 * ## Why the slot needed a decision at all
 *
 * `reportUnresolvableVisibilityPredicate` (@object-ui/react, objectui#6038)
 * dedupes on `(type, key, predicate source)` — `id` rides along in the printed
 * line but is deliberately NOT in the key. So whatever goes in `type` sets this
 * site's RATE LIMIT, and a nav item is not a schema node: there is no
 * `schema.type` to hand over.
 *
 * ## Why a CONSTANT, and not the item's identity
 *
 * The choice is between a constant (one line per distinct authored predicate
 * SOURCE) and something per-item (one line per menu entry). Measured against
 * the three cases that can actually occur:
 *
 *   - two entries, two different broken predicates -> BOTH keys already differ
 *     on `source`, so both report either way. No difference.
 *   - two entries sharing ONE broken predicate (the copy-pasted role gate, the
 *     common shape) -> a constant reports ONCE, which is correct: it is one
 *     authoring mistake, in one string, fixed in one edit. A per-item key would
 *     report once per entry and add no information — same text, same reason.
 *   - one entry, evaluated many times -> both dedupe. This site is re-entered
 *     more than a node gate is: `hasVisibleNavigationItems` re-runs every item
 *     predicate to DERIVE area visibility (objectui#3311) before
 *     `NavigationRenderer` runs them again to render, and both re-run on every
 *     sidebar re-render.
 *
 * A per-item key is therefore never better and sometimes much worse. It is also
 * unreachable without widening `VisibilityEvaluator` (@object-ui/layout), whose
 * whole signature is `(expression) => boolean` — a cross-package public type
 * change this diagnostics-only card does not get to make. The predicate SOURCE
 * is the locator instead, and it is in both the key and the printed line: it is
 * the string an author greps their metadata for, and it is unique to the bug in
 * a way an item id is not.
 *
 * ## Why this spelling
 *
 * Namespaced with a colon, like `page:tabs` (the other non-node surface wired to
 * this reporter). It names the app-shell `visible` GATE, not a component key —
 * `app-shell` is deliberately NOT a registry key (objectui#4841), and the colon
 * keeps this label out of that bare namespace so a diagnostic can never be read
 * as claiming one.
 *
 * It is deliberately NOT `nav:item`, even though this card is written about nav
 * and area items: `evaluateVisibility` is also the gate `RecordFormPage` runs
 * over an object's field visibility predicates, and labelling those "nav" would
 * be false.
 *
 * The stated consequence — a nav item and a form field carrying the IDENTICAL
 * broken predicate text sharing one dedupe entry — no longer arises, and the
 * reason is worth keeping rather than deleting. Since objectui#6514 the two
 * sites report under DIFFERENT authored keys (`visible` for nav and area items,
 * `visibleWhen` for an object field), and `key` is part of the dedupe tuple, so
 * the same broken string now produces one line per surface. That is a strictly
 * better outcome than the one accepted here, and it is a side effect of naming
 * the key honestly, not a goal: the line still names the predicate SOURCE,
 * which is what both sites are grepped by.
 */
const APP_SHELL_VISIBLE_SURFACE = 'app-shell:visible';

/**
 * Evaluate a visibility expression.
 * Supports:
 * - boolean: true/false
 * - string "true"/"false"
 * - template expression: "${user.role === 'admin'}"
 * - `{ dialect: 'cel', source }` envelopes — the shape the spec's
 *   `ExpressionInputSchema` normalizes every authored `visible` string into,
 *   which is what nav/area items carry after the server serves the app schema
 * - bare expression strings (evaluated as one boolean expression)
 *
 * Everything non-literal is delegated to `evaluator.evaluateCondition`, which
 * routes CEL envelopes to the canonical `@objectstack/formula` engine. The
 * envelope and bare-string shapes used to fall through to a blanket
 * `return true`, so a constant-false nav `visible` predicate (e.g.
 * ``P`'org_admin' in current_user.positions` ``) still rendered for everyone —
 * the app author had no working way to hide a menu item by role.
 *
 * Returns true if the item should be visible (fail-open on evaluation errors,
 * matching the evaluator's own default).
 */
export function evaluateVisibility(
  expression: string | boolean | { dialect?: string; source?: string } | undefined,
  evaluator: ExpressionEvaluator,
  authoredKey: string = 'visible',
): boolean {
  if (expression === undefined || expression === null) return true;
  if (expression === true || expression === 'true') return true;
  if (expression === false || expression === 'false') return false;

  // objectui#6443 — the fault is REPORTED now, and the verdict is untouched.
  //
  // `evaluateCondition` is fail-soft: it answers an unevaluable predicate with
  // `true` from its OWN catch and does not throw, so the `catch` below never
  // saw a predicate fault and this site swallowed every one of them in
  // silence — in production AND in development, which is what made it worse
  // than the node gate objectui#6038 fixed. `onFault` is the only channel that
  // reaches that swallowed fault, and it costs nothing: no `throwOnError`
  // second evaluation, same single engine call as before.
  //
  // FAIL-OPEN IS UNCHANGED, deliberately. A predicate that cannot be evaluated
  // still returns `true`, so the nav item, area or field still renders for
  // everyone — including the role the predicate was written to exclude. That is
  // the shipped permission-boundary semantics; flipping it to fail-closed is a
  // behaviour change, not a diagnostic, and it is not this card's to make. This
  // card makes the silence stop, nothing else.
  const report = (reason: unknown): void =>
    reportUnresolvableVisibilityPredicate(
      APP_SHELL_VISIBLE_SURFACE,
      undefined,
      // The key the AUTHOR wrote, which is what the printed line tells them to
      // grep for. Nav and area items carry `visible`, the default; an object
      // field's predicate is `visibleWhen` (objectui#6514), and naming it
      // `visible` there would send an author to a key `FieldSchema` REFUSES.
      authoredKey,
      expression,
      reason,
      // objectui#6487. Until this argument existed the line closed with the
      // NODE tier's advice, telling an author whose nav predicate faulted to
      // check `record` and `page.<var>` — two roots the bag built in
      // `ExpressionProvider` above does not contain at all — while the identity
      // aliases, `app` and `features` that it DOES contain went unnamed.
      'app-shell',
    );

  try {
    return evaluator.evaluateCondition(expression, { onFault: report });
  } catch (err) {
    // Defensive, and now loud too: `evaluateCondition` handles its own faults,
    // so reaching here means the evaluator itself threw. That path returned the
    // same fail-open `true` in silence; it no longer does.
    report(err);
    return true; // Default to visible on error
  }
}

/**
 * The two field-visibility keys `@objectstack/spec`'s `FieldSchema` DECLARES.
 *
 * There is deliberately no `visible` here (objectui#6514). `FieldSchema` is a
 * `strictObject` and `visible` is not one of its keys: it appears in
 * `FIELD_KEY_GUIDANCE` as prose that REFUSES the spelling, and deliberately not
 * as an alias, because — quoting the guidance's own comment — "this surface
 * declares BOTH forms and the two answers have opposite polarity: renaming onto
 * `visibleWhen` sends `visible: false` to a slot that wants a CEL string, and
 * renaming onto `hidden` silently inverts the value the author already wrote."
 * Reading the refused key here would be a second, renderer-side contract for a
 * spelling the platform tells authors not to write (AGENTS.md #0.1).
 */
export interface FieldVisibilityDeclaration {
  /**
   * Static, and INVERTED relative to the `visible` it replaces: `visible: false`
   * is `hidden: true`. Declared `z.boolean().default(false)`, so validated
   * metadata carries an explicit `false` on every field that is not hidden.
   *
   * `=== true` is the whole read, and no coercion belongs here: a string
   * `'true'` is not spec-valid field metadata, and making it work would
   * fossilize a second dialect for the one key whose polarity is already the
   * easiest thing on this surface to get backwards.
   */
  hidden?: boolean;
  /** Per-record CEL predicate — the field is shown only when TRUE, else hidden. */
  visibleWhen?: string | boolean | { dialect?: string; source?: string };
}

/**
 * Should this object field be rendered? — the app-shell's field-list gate.
 *
 * The name is `isObjectFieldVisible` and not the shorter `isFieldVisible`,
 * because that shorter name is twice taken in this repo by functions answering
 * different questions: `views/metadata-admin/inspectors/flow-node-config.ts`
 * gates a flow node's CONFIG inputs on the node's type, and `apps/console`'s
 * `FormPage` evaluates the VIEW-level field predicate — "different authoring
 * slots with different owners", in that file's own words. Neither reads an
 * object field's declared metadata keys, which is the only thing this one does;
 * one shared name across the three would blur exactly the distinction those
 * files keep.
 *
 * ## The keys, and the one that is NOT read
 *
 * Both call sites (`RecordFormPage`, and `AppContent`'s global record-form
 * modal) used to gate on `evaluateVisibility(f.visible, …)`. That key is
 * refused by `FieldSchema`, so the gate was unreachable through the authoring
 * surface — a field `visible` never survives validation, and a census over the
 * framework's 113 `*.object.*` files found zero of them. Maintainer ruling,
 * 2026-08-27 (objectui#6514, Option A): read the DECLARED keys instead and
 * DELETE the dead read. `visible` is not consulted, in either polarity.
 *
 * ## Why the two keys compose as AND
 *
 * `hidden` is the static gate; `visibleWhen` is documented as "shown only when
 * TRUE (else hidden)" — a NECESSARY condition, never a licence to un-hide a
 * statically hidden field. So a field shows only when it is not `hidden` AND
 * its predicate holds. This is the same shape `@object-ui/core`'s
 * `resolveFieldRuleState` already uses one tier down, where the static and the
 * predicate OR into the restrictive verdict (`readonly || readonlyWhen`,
 * `required || requiredWhen`).
 *
 * ## Scope: no `current_user` binding is ADDED here
 *
 * Field-level visibility keeps the contract's current scope (ruling
 * sub-clause, 2026-08-27). This helper adds no roots: it hands `visibleWhen` to
 * `evaluateVisibility` over whatever evaluator the caller already built, and
 * the fail-open on a faulting predicate is the shipped, documented behaviour of
 * this tier (objectui#6443 / #6487) — unchanged. Per-user field hiding is the
 * option/form layers' job, because those bind the user.
 */
export function isObjectFieldVisible(
  field: FieldVisibilityDeclaration | undefined,
  evaluator: ExpressionEvaluator,
): boolean {
  // INVERTED. `hidden: true` means "do not render"; `false` and absent both
  // mean "render". Read it backwards and nothing goes red — a field either
  // vanishes with no diagnostic, or leaks to a principal it was hidden from.
  if (field?.hidden === true) return false;
  return evaluateVisibility(field?.visibleWhen, evaluator, 'visibleWhen');
}
