/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolveDateMacros } from './date-macros.js';

/**
 * Session-scoped filter placeholders — the sibling vocabulary to
 * `{date-macros}`.
 *
 * Filter values travel as JSON, so a user-scoped slice cannot call
 * `currentUser().id` inline; it writes a placeholder that this module expands
 * immediately before the filter reaches the data source:
 *
 *     { owner_id: '{current_user_id}' }
 *
 * ## Why this module exists (framework #3574)
 *
 * There used to be no shared resolver. Three ad-hoc implementations had grown
 * up independently — one in `ObjectView` for list views, one in
 * `ObjectDataPage` for URL filter triples, one in `NavigationRenderer` for
 * hrefs — and each handled only the shape its own surface happened to use.
 * Dashboard widgets never got one at all, so `{current_user_id}` in a widget
 * filter reached SQL as a literal, matched no row, and the widget rendered
 * `0` with no error in the console or the server log.
 *
 * The failure mode is the point: a metric reading `0` is indistinguishable
 * from a metric that is legitimately zero, so the bug survived review and
 * shipped. Any *new* surface that resolves placeholders itself will
 * eventually reproduce it, which is why resolution lives here, once, and
 * every surface calls {@link resolveFilterPlaceholders}.
 *
 * ## Presentation scope, NOT a security boundary
 *
 * These tokens scope what a surface *shows*. They do not decide what a caller
 * is *allowed* to read — that is RLS, enforced server-side against a
 * different vocabulary rooted at `current_user` (`owner_id = current_user.id`).
 * Dropping a `{current_user_id}` filter widens a view; it must never widen
 * access. Never use a context token as an access control.
 *
 * ## Contract source
 *
 * The canonical vocabulary is published as part of the platform contract at
 * `@objectstack/spec` → `CONTEXT_TOKENS` / `classifyFilterToken`. It is
 * mirrored here — exactly as `date-macros.ts` mirrors `DATE_MACRO_TOKENS` —
 * because the installed `@objectstack/spec` predates that export. Keep the two
 * in sync; the duplication is temporary until the next coordinated release.
 */

/** The complete set of session-scoped filter tokens. */
export const CONTEXT_TOKENS = ['current_user_id', 'current_org_id'] as const;

export type ContextTokenName = (typeof CONTEXT_TOKENS)[number];

/**
 * Near-miss spellings → the token the author meant.
 *
 * Every entry is a real authoring mistake, and each is a correct spelling
 * *somewhere else* in the platform, which is exactly why authors reach for it:
 * `current_user` is the RLS expression root, `{user_id}` is valid
 * `titleFormat` field interpolation, `organization_id` is a real column name.
 *
 * Mirrors `CONTEXT_TOKEN_SUGGESTIONS` in `@objectstack/spec`. Used only to
 * make the runtime warning actionable; the authoring-time gate
 * (`validateFilterTokens` in `@objectstack/lint`) is what actually prevents
 * these from shipping.
 */
const CONTEXT_TOKEN_SUGGESTIONS: Record<string, ContextTokenName> = {
  current_user: 'current_user_id',
  current_user_email: 'current_user_id',
  user_id: 'current_user_id',
  userid: 'current_user_id',
  me: 'current_user_id',
  current_organization_id: 'current_org_id',
  org_id: 'current_org_id',
  organization_id: 'current_org_id',
  current_tenant_id: 'current_org_id',
};

/** Session values a filter placeholder can resolve against. */
export interface FilterTokenScope {
  /** The signed-in user's id. */
  currentUserId?: string | null;
  /** The active organization id. */
  currentOrgId?: string | null;
  /**
   * Called when a placeholder cannot be resolved — either a recognised token
   * with no value in scope (signed out), or a near-miss spelling that resolves
   * in no vocabulary. Defaults to a `console.warn`; pass `null` to silence.
   */
  onUnresolved?: ((message: string) => void) | null;
}

/** Whole-string placeholder: `{token}` or `${token}`, anchored. */
const WHOLE_TOKEN_RE = /^\$?\{([a-zA-Z0-9_]+)\}$/;

function isContextToken(token: string): token is ContextTokenName {
  return (CONTEXT_TOKENS as readonly string[]).includes(token);
}

/**
 * Expand `{current_user_id}` / `{current_org_id}` inside a filter.
 *
 * Walks arrays and plain objects recursively, which is what makes one
 * resolver cover both platform filter shapes: the MongoDB-style object a
 * dashboard widget carries (`{ owner_id: '{current_user_id}' }`) and the
 * condition/triple arrays a list view carries (`[{ field, operator, value }]`
 * / `[['owner','=','…']]`). The predecessor helper in `ObjectView` bailed on
 * non-arrays (`if (!Array.isArray(filter)) return filter`), which is why
 * lifting it into the dashboard would have been a silent no-op.
 *
 * Only whole-string placeholders are substituted — an id is an opaque value,
 * so embedding it in a larger string (`'user-{current_user_id}'`) is never
 * what an author means, and substituting there would silently produce a value
 * that matches nothing. Unknown tokens are passed through untouched so that
 * date macros and nav-only `AppContextSelector` ids survive this pass.
 *
 * An unresolvable *known* token is deliberately left as-is rather than
 * dropped: leaving it yields an empty result, whereas dropping the clause
 * would widen the result set — and a filter that silently widens is far worse
 * than one that silently narrows.
 */
export function resolveContextTokens<T = any>(filter: T, scope: FilterTokenScope = {}): T {
  if (filter == null) return filter;

  const { currentUserId, currentOrgId } = scope;
  const warn =
    scope.onUnresolved === null
      ? () => {}
      : scope.onUnresolved ??
        ((message: string) => {
          // eslint-disable-next-line no-console
          console.warn(`[object-ui] ${message}`);
        });

  const values: Record<ContextTokenName, string | null | undefined> = {
    current_user_id: currentUserId,
    current_org_id: currentOrgId,
  };

  const walk = (value: any): any => {
    if (value == null) return value;

    if (typeof value === 'string') {
      const m = value.match(WHOLE_TOKEN_RE);
      if (!m) return value;
      const token = m[1];

      if (isContextToken(token)) {
        const resolved = values[token];
        if (resolved != null && resolved !== '') return resolved;
        warn(
          `Filter placeholder "{${token}}" could not be resolved — no ${
            token === 'current_user_id' ? 'signed-in user' : 'active organization'
          } in scope. The filter will match no records.`,
        );
        return value;
      }

      // Not ours. Warn only for near-misses, which resolve in no vocabulary
      // at all and would otherwise fail silently; genuine date macros and
      // nav context-selector ids must pass through quietly.
      const suggestion = CONTEXT_TOKEN_SUGGESTIONS[token.toLowerCase()];
      if (suggestion) {
        warn(
          `Filter placeholder "{${token}}" is not a recognised token — did you mean ` +
            `"{${suggestion}}"? It is sent to the server as a literal string and will ` +
            `match no records.`,
        );
      }
      return value;
    }

    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(value)) out[k] = walk((value as any)[k]);
      return out;
    }
    return value;
  };

  return walk(filter) as T;
}

/**
 * Resolve **every** placeholder vocabulary a filter value understands — date
 * macros and context tokens — in one call.
 *
 * This is the function surfaces should call. Calling only one of the two
 * resolvers is the defect behind framework #3574: dashboard widgets called
 * `resolveDateMacros` alone, so `{today}` worked and `{current_user_id}`
 * silently did not.
 *
 * Order is irrelevant (the vocabularies are disjoint) but fixed here so
 * behaviour is identical everywhere.
 */
export function resolveFilterPlaceholders<T = any>(
  filter: T,
  scope: FilterTokenScope = {},
  now: Date = new Date(),
): T {
  if (filter == null) return filter;
  return resolveContextTokens(resolveDateMacros(filter, now), scope);
}
