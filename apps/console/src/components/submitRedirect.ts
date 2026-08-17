// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Where a form's `submitBehavior: { kind: 'redirect' }` sends the submitter
 * (objectui#4190), under the shape objectstack#7496 ruled on 2026-08-11 and
 * objectstack#7657 landed in `@objectstack/spec` (live on the 17.0.0 GA pin
 * this repo installs).
 *
 * The ruling has three points, and they divide cleanly into three layers:
 *
 *   1. **relative paths only** — an absolute or protocol-relative URL is
 *      refused. This is the open-redirect face: the destination is authored
 *      metadata, which is exactly where an address somebody else chose gets
 *      copied in.
 *   2. **interpolation only from declared record fields**, spelled
 *      `{{record.field_name}}`, with every interpolated value **URL-escaped
 *      when the redirect is built**.
 *   3. a **verbatim redirect on the resolved relative path** is the intended
 *      consumption — the destination is that string with its tokens
 *      substituted, and nothing else.
 *
 * Point 1 is a property of the string, so the spec enforces it at the authoring
 * door. Whether `{{record.foo}}` names a field the form's object actually
 * declares needs both the string and the object, so `@objectstack/lint`'s
 * reference-integrity family owns that. Point 2's "when the redirect is built"
 * and point 3's consumption are runtime, and this module is where they happen.
 *
 * ## The shape verdict is the spec's, not a copy of it
 *
 * `@objectstack/spec` does not export its URL check as a function, but it does
 * export the schema the check lives in, so the verdict here is produced by
 * PARSING the smallest form view that carries this behavior. That costs one
 * parse per submit and buys the property that matters: there is no second
 * spelling of a security rule in this repo to drift from the first. When the
 * ruling widens — it says an allowlist of absolute origins "waits for measured
 * demand" — the console follows the pin with no edit here, which is the same
 * lag this card sat blocked on for six days.
 *
 * The alternative was a local re-implementation of the seven refusal families
 * kept honest by a parity table. `scripts/check-spec-symbol-derivation.mjs`
 * exists because this repo has paid for that shape four times (objectstack#4115,
 * objectui#4074/#4588/#4592): a hand copy passes every value comparison right
 * up to the release that moves the original.
 *
 * Parsing a MINIMAL view is load-bearing, not laziness. A whole stored
 * `FormView` refuses on any unrelated key the strict schema does not know, and
 * a redirect must not be refused because some other part of the metadata
 * drifted. The question asked here is narrow — "is this url a value the
 * contract allows?" — so only that value is submitted for judgement, and only
 * issues on that value's path are read back.
 *
 * ## Why the accepted value is an in-app route
 *
 * A ruled-relative path IS a route in this shell, and objectui#4190 was filed
 * because the redirect arm handed it to the browser as a full-page navigation
 * instead. That form of navigation does not see React Router's basename, so on
 * a console served under a mount (the framework CLI configures one for every
 * embedded deployment) an authored `/objects/lead` resolves against the ORIGIN
 * root and leaves the SPA — the same class objectui#4181 fixed on the auth
 * pages. Both mounts of this renderer are inside the console's router
 * (`/f/:slug` and `/forms/:name` are siblings under one `BrowserRouter
 * basename=…`), so a router navigation is what makes "in-app" true.
 *
 * `withConsoleBase()` — objectui#4181's answer — is deliberately NOT used, and
 * the card's reason still holds: it prefixes anything not already targeting
 * another absolute SPA mount, so it would have mangled the absolute case rather
 * than fixing it. With absolutes now refused at the door, the helper is not
 * needed either: the router applies the basename itself, from the same injected
 * `<base href>` the helper reads. One mount source, no prefixing arithmetic.
 *
 * A path that matches no route lands on the shell's own not-found, which is the
 * author's error made visible in the app rather than an origin-root 404 with
 * the session left behind.
 */

import { FormViewSchema } from '@objectstack/spec/ui';

/**
 * The one interpolation the ruled `url` accepts, as a capture of the field
 * segment. The grammar (lowercase snake_case) is the one `object.fields` keys
 * are declared under, narrowed by the ruling to a FLAT segment under the
 * `record.` root — the record just submitted is the whole scope a post-submit
 * moment has.
 *
 * This spelling is the one place the spec's rule is restated rather than asked,
 * because substitution is the half of the ruling assigned to the consumer and
 * the spec exports no substituter. It is safe in one direction only, and that
 * is deliberate: it runs solely on strings the schema has already accepted, and
 * anything it fails to consume leaves a brace behind, which
 * {@link resolveSubmitRedirect} treats as a refusal. So a future divergence
 * from the spec's token grammar can only ever refuse a redirect loudly — never
 * navigate to a half-substituted URL.
 */
const RECORD_TOKEN_RE = /\{\{record\.([a-z_][a-z0-9_]*)\}\}/g;

/** Accepted: `path` is the resolved in-app route to navigate to. */
interface SubmitRedirectAccepted {
  ok: true;
  path: string;
}

/** Refused: `refusal` is author-facing prose explaining what to write instead. */
interface SubmitRedirectRefused {
  ok: false;
  refusal: string;
}

export type SubmitRedirectVerdict = SubmitRedirectAccepted | SubmitRedirectRefused;

/**
 * The string form of a record value inside a URL.
 *
 * Scalars only, and that is not a shortcut: the ruling accepts a FLAT field
 * segment, so a token can only ever name a top-level field, and a field whose
 * value is an object or array has no scalar form to put in a path. Absent and
 * null read as empty — a blank optional field is data, not an authoring defect,
 * and this layer is explicitly not the one that judges whether the field was
 * declared (see the module docblock).
 *
 * The scope is a JSON record as it came off the API, so dates and references
 * arrive already stringified.
 */
function urlValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return '';
}

/**
 * Resolve an authored `submitBehavior.url` into the in-app route to navigate
 * to, or refuse it.
 *
 * @param url    the authored value, exactly as the metadata carries it
 * @param record the record this submit just wrote — the token scope
 *
 * Refusal is fail-closed and quotable: the message is the spec's own
 * prescription (it names the key, the rule, and what to write instead,
 * including that a deliberately external destination is an app navigation item
 * rather than this key), so the author reads the same sentence here that the
 * authoring door would have told them.
 *
 * ## Why substitution cannot widen the destination
 *
 * Every interpolated value goes through `encodeURIComponent`, which escapes the
 * two characters that could add structure — `/` and `:` — along with `?`, `#`
 * and the rest. So a field carrying an address, a traversal, or a space becomes
 * one opaque segment or query value: a token is a VALUE in the path, never a
 * way to add path structure, and a record's contents can never turn a path the
 * contract accepted into one it would not. `submitRedirect.test.ts` pins that
 * by re-parsing the emitted string with the same schema.
 */
export function resolveSubmitRedirect(
  url: string,
  record: Record<string, unknown>,
): SubmitRedirectVerdict {
  const parsed = FormViewSchema.safeParse({ submitBehavior: { kind: 'redirect', url } });

  if (!parsed.success) {
    // Only this value was submitted for judgement, so an issue on its path is
    // the answer; the two fallbacks exist so a refusal is never silent, not
    // because either is expected to be reached.
    const onUrl = parsed.error.issues.find(
      (issue) => issue.path[0] === 'submitBehavior' && issue.path[1] === 'url',
    );
    return {
      ok: false,
      refusal:
        onUrl?.message
        ?? parsed.error.issues[0]?.message
        ?? `\`submitBehavior.url\` is not a value this contract accepts: ${JSON.stringify(url)}.`,
    };
  }

  // Read the value back off the parse rather than reusing the input: the schema
  // is the authority on what it accepted, so if it ever normalises the string
  // this follows without a second edit. Today the two are identical — the key
  // is a plain string with a refinement, deliberately, so that what reaches
  // this renderer stays the string the author wrote.
  const behavior = parsed.data.submitBehavior;
  const accepted = behavior?.kind === 'redirect' ? behavior.url : url;

  const path = accepted.replace(RECORD_TOKEN_RE, (_token, field: string) =>
    encodeURIComponent(urlValue(record[field])),
  );

  if (path.includes('{') || path.includes('}')) {
    // Unreachable while this module's token grammar matches the schema's — the
    // schema refuses a brace that is not a well-formed token. It is a refusal
    // rather than an assertion because the failure it guards is a future
    // widening upstream, and navigating to a URL with an unsubstituted token in
    // it is the one outcome that must not happen.
    return {
      ok: false,
      refusal:
        '`submitBehavior.url` carries an interpolation this renderer could not resolve '
        + `(${JSON.stringify(url)}). A token names one declared record field, spelled `
        + '`{{record.field_name}}`, and the redirect is refused rather than followed with the '
        + 'token left in it.',
    };
  }

  return { ok: true, path };
}
