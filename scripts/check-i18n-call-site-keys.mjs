#!/usr/bin/env node
/**
 * Every key a component asks `t()` for must EXIST in the `en` locale pack — and
 * where the call site also writes an inline `defaultValue`, that dead string
 * must say the same thing the pack does (objectui#3810) — and the interpolation
 * arguments the call site passes must be exactly the holes the `en` value has
 * to receive them (objectui#3845) — and the OTHER spelling of a fallback,
 * `t(key) || 'English'`, must not exist at all (objectui#4117).
 *
 * Run:  node scripts/check-i18n-call-site-keys.mjs   (also `pnpm check:i18n-keys`)
 * Exit: 0 = every in-scope call-site key resolves (or is baselined), no inline
 *           default contradicts its `en` value, no call site's option names
 *           disagree with its `en` value's holes, and no call site carries a
 *           literal sibling fallback, 1 = otherwise
 *
 * ## The gap this closes (objectui#3530)
 *
 * `packages/i18n/src/__tests__/all-locales-key-parity.test.ts` asserts that every
 * pack defines every `en` key and no pack defines a key `en` lacks — a **pack vs
 * pack** invariant. It is blind by construction to the other direction: a key a
 * component *references* that NO pack defines. Ten packs identically missing a
 * key is full parity, and full parity is green.
 *
 * Nothing else caught it either, because `fallbackLng: 'en'` plus an inline
 * `t(key, { defaultValue: 'English text' })` renders correct English at the one
 * call site while the key stays untranslatable in all ten languages. The
 * dev-only missing-key warner (`i18n.ts`) is the only runtime signal and CI
 * never sees a browser console. objectui#3517 was one instance —
 * `form.createTargetOrg`, missing from all ten packs, covered by an inline
 * default for months, found only by #3469's by-hand per-key sweep. This gate is
 * the class, not the instance: the first full run over `main` found
 * 258 more.
 *
 * ## Division of labour with the other two i18n gates
 *
 * All three read the same ten packs, and each is blind to what the next owns:
 *
 *   - THIS gate: call site -> `en`. Does the key a component asks for exist, and
 *     does the call site's own inline `defaultValue` agree with the `en` value?
 *     Both directions of one question — what this call site will render.
 *   - `packages/i18n/src/__tests__/all-locales-key-parity.test.ts`: pack vs pack
 *     KEY SETS, plus placeholder shape. Never reads a value.
 *   - `scripts/check-i18n-en-drift.mjs` (objectui#3650): `en` vs the other nine
 *     packs, as an event — when an `en` string CHANGES, the nine translations
 *     must change in the same PR (or be waived). Neither pack gate can see a
 *     value go stale: objectui#3582 and objectui#3625 were eight packs serving a
 *     retired sentence at full key parity, the second one in idiomatic native
 *     script that every value-shaped heuristic also reads as healthy.
 *
 * The `default-value-drift` class below is the fourth blind spot in that
 * partition, and it was blind to all three by construction (objectui#3810):
 * this gate asked only whether the key existed, parity reads no values at all,
 * and en-drift fires on CHANGE — and in every one of the 43 sites the `en` value
 * had not moved for months. The call site was the thing that disagreed.
 *
 * `interpolation-parity` is the fifth, and it is blind to all four
 * (objectui#3845). Parity DOES compare placeholder shape — but pack against
 * pack: the nine translations must hold the same `{{holes}}` as `en`. Ten packs
 * agreeing on `Update` while the call site passes `version` is full placeholder
 * parity, because no pack gate ever reads the argument list. And a `defaultValue`
 * that agrees byte for byte with `en` says nothing about the arguments either:
 * `home.welcome` passed `product` to `Welcome to {{product}}`, the `en` value was
 * later rewritten to `Build your business system with AI`, and #3810's rule is
 * satisfied the moment the call site copies that new sentence — with the now
 * inert `product` still sitting beside it.
 *
 * ## What is IN scope, and why the answer is not "every `t(`"
 *
 * A naive grep for `t('...')` scores 3485 call sites in this repo and would be
 * wrong about roughly a third of them, because `t` is not one function:
 *
 *   - 2370 calls reach i18next and therefore the locale packs. Those are the
 *     subject of this gate.
 *   - 1074 calls go to `packages/app-shell/src/views/metadata-admin/i18n.ts`, a
 *     module-local `engine.*` label table that is NOT an i18next pack and never
 *     will be (read its header). Checking its keys against `en` produces 89
 *     permanent false reds — measured, by removing the exclusion.
 *   - 41 calls are a local `t` that is not a translator at all — a `useCallback`
 *     result, a `Date` difference, a `||` chain, a `.t()` method on some other
 *     object.
 *
 * So the unit of classification is the **binding**, not the spelling. For each
 * `t(...)`/`tt(...)` call this file resolves which declaration of `t` is in
 * scope at that position (nearest enclosing scope wins, then the latest
 * declaration before the use), and classifies it:
 *
 *   PACK   — bound from a call to a translate hook: `const { t } = useXxx…()`,
 *            `const tt = useSafeTranslate()`. The hook-name convention is
 *            `use*Translation` / `use*Translate` / `use*T` and it is a real
 *            repo-wide convention: all 26 such hooks are either
 *            `createSafeTranslation(...)` factories or thin wrappers over
 *            `useObjectTranslation`. **Checked.**
 *   LOCAL  — bound from an `import` of a module in EXCLUDED_TRANSLATORS below,
 *            or forwarded inside that module's declared scope. **Skipped**, by
 *            declaration, with a reason. An import from any *other* module is a
 *            hard error, so a second local table cannot appear silently.
 *   OTHER  — anything else (`const t = someValue`). **Skipped**, counted.
 *
 * A `t` received as a parameter or a prop inherits its file's provenance: a
 * helper that takes `t: TranslateFn` is checked in a file whose own `t` comes
 * from a hook, and skipped inside the metadata-admin tree. That hop is the one
 * place a type checker would be exact and this parser is a heuristic, so it is
 * worth knowing what it buys: deleting `forwardedScope` puts 89 call sites
 * (78 distinct `engine.*`/`perm.cel.*`/`perm.rls.*` keys) back on the report,
 * every one of them a component that was handed the metadata-admin table's `t`
 * by its parent, and not one of them a real finding.
 *
 * `dead-sibling-fallback` is the sixth, and it was blind to all five — including
 * the two that read values — for one syntactic reason (objectui#4117): every
 * rule above reads the call's ARGUMENTS, and this fallback is not an argument.
 * `t('marketplace.detail.moreOptions') || 'More options'` carries no options
 * object at all, so class 3 sees no `defaultValue` to compare and class 4 sees
 * an empty (and correct) argument set. The dead English sits one operator to the
 * right of everything this file used to look at. `node.parent` is what closes
 * it, and the rule is the class rather than the instance: the first full run
 * found 24 such sites in four files, every one of them on a key `en` defines.
 *
 * ## Five failure classes
 *
 * 1. `missing-key` — a literal key with no leaf in `en`. i18next plural suffixes
 *    (`_one`, `_other`, …) count as defining the base key, and a key passed with
 *    `returnObjects: true` may name a subtree rather than a leaf.
 * 2. `missing-prefix` — a template key (`` t(`marketplace.category.${c}`) ``)
 *    whose static head matches NO `en` key at all. Then every possible expansion
 *    is missing, whatever the substitution evaluates to. This is the only claim
 *    about a dynamic key that is true without knowing the value.
 * 3. `default-value-drift` (objectui#3810) — the key EXISTS and the call site
 *    still carries a literal `t(key, { defaultValue: 'other English' })` whose
 *    text differs from the `en` value. i18next uses `defaultValue` only on a
 *    miss, so with the key present the pack always wins and that string is
 *    structurally dead code — dead code that states, at the call site, a
 *    different sentence from the one users read. Two costs, both measured on
 *    `main`: the reader (and the AI writing the next edit) is misled —
 *    `ForgotPasswordPage` claimed `If an account exists, a reset link has been
 *    sent.` while the pack asserts `We've sent a password reset link to
 *    {{email}}.`, a materially different privacy claim — and on the day the key
 *    is renamed or dropped, rendering silently falls back to that other
 *    sentence, in a diff where nobody expected copy to change.
 *
 *    Classes 1 and 3 are disjoint by construction: drift is judged only when the
 *    key resolves to an `en` leaf this file could read as a string, so a call
 *    site is never reported twice, and each report reads on its own. Deliberately
 *    NOT judged (counted instead): a computed default (`defaultValue: label`), a
 *    call whose key is dynamic or denotes several literals, a `returnObjects`
 *    subtree, and the plural families — `t('detail.showEmptyRelated')` resolves
 *    through `_one`/`_other`, and there is no single form to compare against.
 *
 *    The rule is HARD from day one — no baseline section, unlike classes 1-2.
 *    That is a measurement, not an aspiration: the first full run found 43 sites
 *    in 19 files, all of them aligned in the same PR (objectui#3810), so there
 *    is no debt for a ratchet to hold. A `defaultValue` written on a key that is
 *    NOT yet in `en` stays legal — that transition period runs for months
 *    (objectui#3546) and is class 1's business, not this one's.
 *
 * 4. `interpolation-parity` (objectui#3845) — the key EXISTS, and the set of
 *    interpolation option names the call site passes is not the set of `{{hole}}`
 *    names the `en` value has. Both directions fail, because the declaration and
 *    the thing that consumes it are the same statement read from two ends:
 *
 *      - **inert** — an argument passed with no hole to receive it. i18next
 *        drops it silently, so the author's intent evaporates with no runtime
 *        signal at all: `marketplace.action.updateTo` passed `version` to a value
 *        reading `Update`, while its sister key three hundred lines down renders
 *        `Update → v{{version}}` from the same variable. Nothing is broken today,
 *        which is exactly why nothing ever noticed.
 *      - **unfilled** — a hole with no argument to fill it. i18next leaves the
 *        braces in the output, so the user reads a literal `{{name}}`. This
 *        direction measured 0 on `main` when the rule landed; keeping it judged
 *        is the difference between "0 by luck" and "0 by guarantee".
 *
 *    Deliberately NOT judged (counted instead), and each abstention is a
 *    decision:
 *
 *      - The same key preconditions as class 3 — a dynamic or several-literal
 *        key, a `returnObjects` subtree, an `en` leaf that is not a readable
 *        static string. Plural families fall out here too: `t(k, { count })`
 *        resolves through `_one`/`_other` and there is no single value whose
 *        holes could be the answer, so the families are never judged.
 *      - An options object whose NAME SET cannot be read: a spread, a computed
 *        name, a getter — or a `replace:` redirect, which is where i18next takes
 *        the interpolation data from when it is present, making the top-level
 *        names not interpolation at all. Today the repo has none of these; the
 *        abstention is what stops the first one becoming a false red.
 *      - RESERVED names are removed from BOTH sides before comparing, not just
 *        from the call site's. `count` is the reason: it is an i18next control
 *        option AND the value of a `{{count}}` hole, so subtracting it from one
 *        side only would report every counted string as unfilled.
 *
 *    Nested `t()` inside the options object is not a special case here and must
 *    not become one: the arguments of an inner call are not properties of the
 *    outer object literal, so an AST reading the outer literal's own properties
 *    never sees them. It is called out because the census that found this class
 *    was done with a regex first, and the regex read the inner `index:` of
 *    `packages/fields/src/widgets/ImageField.tsx` as an argument of the outer
 *    `fields.image.enlarge` call — one false positive out of two hits. The
 *    self-test pins the AST's behaviour on exactly that shape.
 *
 *    Also HARD from day one, and for the same reason: the first full run found
 *    2 inert sites and 0 unfilled ones, both fixed in objectui#3845's PR by
 *    DELETING the dead argument. Adding the hole to the `en` value instead is a
 *    product decision about what the string should say — it changes what users
 *    read and obliges the nine other packs through objectui#3650 — so the gate
 *    accepts either resolution and neither is its to make.
 *
 * 5. `dead-sibling-fallback` (objectui#4117) — the key EXISTS and the call site
 *    still writes a literal fallback as the call's SIBLING rather than as an
 *    argument: `t('detail.moreOptions') || 'More options'`, or the same with
 *    `??`. Unlike class 3 this rule does not ask what the fallback SAYS. It is
 *    existence-is-red, and the fix is DELETION, because there is no reading of
 *    this spelling under which the right operand can render:
 *
 *      - With a provider, i18next serves the pack value — the same reason class
 *        3's `defaultValue` is dead.
 *      - With NO provider, this spelling is strictly worse than `defaultValue`
 *        rather than equivalent to it. react-i18next's not-ready `t` returns the
 *        KEY, and `createSafeTranslation`'s fallback returns `defaults[key] ||
 *        key` — both truthy — so `||` skips the right operand and the user reads
 *        a raw `console.objectView.delete`. `defaultValue` at least renders
 *        English there. Same family as objectui#3865; this is its `||` half.
 *
 *    So the two spellings are not two ways to write one thing: one is dead and
 *    misleading, the other is dead and misleading AND cannot degrade gracefully.
 *    The ruling on this card keeps ONE blessed fallback spelling — `defaultValue`,
 *    governed by class 3 — instead of two competing ones, which is also why this
 *    rule does not simply extend class 3's byte-equality test to the sibling
 *    position: aligning these strings would bless the spelling.
 *
 *    Deliberately NOT judged (counted instead), and each abstention is a
 *    decision the class above would get wrong:
 *
 *      - The same key preconditions as classes 3 and 4 — a dynamic or
 *        several-literal key, a `returnObjects` subtree, an `en` leaf that is
 *        not a readable static string (the plural families land here).
 *      - An `en` value that is the EMPTY STRING. Then `t()` really can return a
 *        falsy value and `||` really can reach its right operand, so the premise
 *        of the whole class fails. `en` has no such leaf today; the abstention is
 *        what stops the first one becoming a wrong red.
 *      - A NON-LITERAL right operand (`t(key) || label`). What renders is then a
 *        runtime value, not a second copy of the sentence, and judging it would
 *        mean claiming something about a variable this parser cannot read —
 *        exactly how class 3 treats a computed `defaultValue`.
 *      - An OPTIONAL call, `t?.(key) ?? 'English'`. This one is not a parser
 *        limitation but a live path: where `t` is an optional prop, the call
 *        evaluates to `undefined` whenever the prop is absent and the fallback
 *        is what renders. Both of `packages/app-shell/src/layout/
 *        ContextSelectors.tsx`'s sites are this shape, and its own
 *        `ContextSelectors.persist.test.tsx` renders the hook with no `t` — so
 *        deleting those two would have replaced a rendered placeholder with
 *        `undefined`. The card that filed this class listed them among the 24;
 *        measuring the call shape is what took them back out.
 *
 *    Only the LEFT operand position is judged. `someLabel || t('common.actions')`
 *    is the healthy, opposite shape — a runtime value with a translated fallback
 *    — and `main` has 94 of them against these 24. A rule that read "appears in a
 *    `||`" rather than "is the left operand of one" would condemn all 94.
 *
 *    HARD from day one, like classes 3 and 4: the first full run found 24 sites,
 *    22 of them judged and deleted in objectui#4117's own PR, so there is no debt
 *    for a ratchet to hold. And a fallback written on a key `en` does NOT define
 *    stays legal — that is class 1's business, not this one's.
 *
 * ## Dynamic keys: the explicit policy
 *
 * A key that is not a string literal cannot be resolved statically. Those call
 * sites are **not checked and not failed** — they are COUNTED, and the count is
 * printed on every run, so the unanalyzable surface is visible rather than
 * silently absorbed. The `missing-prefix` class above recovers the part of it
 * that can be decided. Same treatment, same reason, for the deliberate
 * `I18N_PROBE_FLAG` misses (see below) and for the skipped binding classes.
 *
 * ## The probe exclusion
 *
 * `useObjectLabel` probes convention keys (`{ns}.objects.{name}.label`) that are
 * SUPPOSED to miss — it falls back to the server-resolved label. Those calls
 * carry `[I18N_PROBE_FLAG]: true`, and this gate excludes them by that flag, not
 * by path, so a probe written anywhere is excluded and a non-probe call in
 * `useObjectLabel.ts` is not. Both of today's probe sites happen to use dynamic
 * keys, so the flag currently only moves them out of the dynamic counter; the
 * exclusion is still load-bearing for the literal-key probe someone writes next,
 * and `scripts/__tests__/check-i18n-call-site-keys.test.ts` pins that shape.
 *
 * ## The baseline
 *
 * `scripts/i18n-call-site-key-baseline.json` lists the keys already missing on
 * `main` when this gate landed, each with the issue tracking its fix — classes 1
 * and 2 only; classes 3 and 4 have no baseline and never needed one. It is a
 * ratchet, not an allowlist: a key that is NOT in it fails, and an entry that no
 * longer fires (key added to `en`, or its last call site deleted) ALSO fails, so
 * the file can only shrink. Fixing the debt means adding the key to
 * `packages/i18n/src/locales/en.ts` — which immediately makes
 * `all-locales-key-parity.test.ts` demand it in the other nine packs, which is
 * the correct order.
 */

import ts from 'typescript';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/** Hook names whose `t` reaches i18next. See the header for why a name is enough. */
export const PACK_HOOK = /^use[A-Za-z0-9_]*(Translation|Translate|T)$/;

/**
 * Annotations that mark a forwarded `t` as a translator. Only used to tell a
 * forwarded translator apart from an unrelated `t` parameter; provenance (which
 * table it reaches) comes from the file, not from the type.
 */
export const TRANSLATOR_TYPE =
  /Translat|\bTFunction\b|\bTFn\b|\(\s*key\s*:|\(\s*keyOrKeys\s*:|\(\s*k\s*:\s*string/;

/** The option flag `useObjectLabel` sets on its deliberate convention-key misses. */
export const PROBE_FLAG_NAMES = /I18N_PROBE_FLAG|__ouiLabelProbe/;

/**
 * i18next option names that CONTROL the lookup rather than fill a hole
 * (objectui#3845). Subtracted from both sides of the interpolation comparison —
 * see the header for why `count` in particular must leave the hole set too.
 *
 * `replace` is absent on purpose: it does not merely fail to be interpolation
 * data, it REDIRECTS where the data comes from, so a call site carrying one is
 * abstained on rather than having one name dropped.
 */
export const RESERVED_OPTION_NAMES = new Set([
  // plural / context selection — and `count` is also its own `{{count}}` hole
  'count',
  'ordinal',
  'context',
  // the default a miss falls back to, in all its plural spellings
  'defaultValue',
  'defaultValue_zero',
  'defaultValue_one',
  'defaultValue_two',
  'defaultValue_few',
  'defaultValue_many',
  'defaultValue_other',
  // namespace / language selection
  'ns',
  'lng',
  'lngs',
  'fallbackLng',
  // return shape and post-processing
  'returnObjects',
  'returnDetails',
  'returnedObjectHandler',
  'joinArrays',
  'postProcess',
  'postProcessorOptions',
  // interpolation and key parsing control
  'interpolation',
  'skipInterpolation',
  'keySeparator',
  'nsSeparator',
  'escapeValue',
  // missing-key handling
  'parseMissingKeyHandler',
  'missingKeyNoValueFallbackToKey',
  'appendNamespaceToMissingKey',
]);

/**
 * Keys whose `{{hole}}` is filled by the CONSUMER of the translated string
 * rather than by i18next (objectui#3845). Every entry is a decision with a
 * reason, the way `EXCLUDED_TRANSLATORS` is — and the self-test verifies each
 * one's premise against both the `en` pack and the named source file, so an
 * entry cannot outlive the substitution it describes.
 *
 * i18next leaves an unmatched `{{name}}` in the output verbatim, which is what
 * makes a second substitution stage possible at all: the string travels through
 * `t()` with its hole intact and the component fills it afterwards. That is a
 * deliberate design here, not an oversight — the sister label three lines away
 * in `apps/console/src/pages/auth/ForgotPasswordPage.tsx` spells the same
 * pattern with SINGLE braces (`Resend in {seconds}s`) precisely to stay out of
 * i18next's way, and the inconsistency between the two spellings is filed as
 * objectui#4135.
 *
 * The listed hole names are removed from the hole set, so the `unfilled`
 * direction stays silent — and the `inert` direction keeps judging them, which
 * is the direction that matters here: passing `email` to `t()` would let
 * i18next consume the hole, `ForgotPasswordForm`'s `includes('{{email}}')`
 * guard would then miss, and its fallback branch would append the address a
 * SECOND time. So for these keys the argument must not be passed, and the gate
 * still says so.
 */
export const EXTERNALLY_INTERPOLATED_HOLES = [
  {
    key: 'auth.forgotPassword.successDescription',
    holes: ['email'],
    filledBy: 'packages/auth/src/ForgotPasswordForm.tsx',
    marker: "successDescription.replace('{{email}}', email)",
    reason:
      'the label is a PROP of `ForgotPasswordForm`, which substitutes the address itself ' +
      'once the form knows it — the call site cannot, because it renders before the user ' +
      'has typed anything. All ten packs carry the hole, so this is the shape in every ' +
      'language, not an en-only quirk.',
  },
];

/**
 * The interpolation names an `en` value has holes for (objectui#3845).
 *
 * i18next's default interpolation is `{{name}}`; `{{name, format}}` names a
 * formatter, `{{- name}}` asks for the unescaped value, and `{{a.b}}` reads a
 * keypath off the option called `a`. Today's pack uses none of the three — all
 * 84 distinct holes in `en` are bare names — but reading through them costs four
 * lines and stops the first one that appears from being read as a different
 * hole (or, for the keypath, as a missing option nobody passes).
 */
export function holesOf(value) {
  const names = new Set();
  for (const match of value.matchAll(/\{\{([^{}]+)\}\}/g)) {
    const name = match[1]
      .split(',')[0] // `{{n, number}}` — the formatter is not part of the name
      .trim()
      .replace(/^-\s*/, '') // `{{- html}}` — the unescape marker is not either
      .split('.')[0] // `{{user.name}}` is filled by the option called `user`
      .trim();
    if (name) names.add(name);
  }
  return names;
}

/**
 * `t` bindings that do NOT resolve against the locale packs. Every entry is a
 * decision with a reason; an imported `t` from anywhere else is a hard error
 * (`unregistered-translator`) rather than a silent skip.
 *
 * `forwardedScope` is the directory whose files may receive this table's `t` as
 * a parameter or prop. Without it, a component that takes `t` from a
 * metadata-admin parent reads as pack-backed and its `engine.*` keys report as
 * missing — 89 such false reds, measured, across `CelPredicateField.tsx`,
 * `CelTestRunDialog.tsx`, `ConditionalFormattingEditor.tsx`,
 * `PermissionAdvancedFacets.tsx` and `PermissionMatrixEditor.tsx`.
 */
export const EXCLUDED_TRANSLATORS = [
  {
    module: 'packages/app-shell/src/views/metadata-admin/i18n.ts',
    forwardedScope: ['packages/app-shell/src/views/metadata-admin/'],
    reason:
      'module-local engine.* label table (a plain Record lookup, not i18next); ' +
      'its keys are not in any locale pack by design — see that file\'s header',
  },
];

/** Directories never scanned: build output, deps, and test/mock trees. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', '__mocks__']);
const TEST_FILE = /(^|[/\\])__tests__[/\\]|\.test\.tsx?$|\.spec\.tsx?$/;

/** i18next resolves `key` when the pack defines any of these plural forms. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

// ── the `en` pack ────────────────────────────────────────────────────────────

/**
 * Read a node as a static string, or return `null` if it is not one.
 *
 * `'a' + 'b'` counts: `en.ts` wraps one long sentence that way
 * (`objectActions.resetPackageSetConfirm`), and a leaf this returns `null` for
 * is a leaf the `default-value-drift` rule cannot judge — so folding the
 * concatenation here is what keeps that one key inside the checked surface
 * instead of silently outside it.
 */
function staticString(node, source) {
  const inner = unwrapExpression(node);
  if (!inner) return null;
  if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return inner.text;
  if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(inner.left, source);
    const right = staticString(inner.right, source);
    return left === null || right === null ? null : left + right;
  }
  return null;
}

/**
 * Dotted leaf paths of `packages/i18n/src/locales/en.ts`, read from its AST,
 * plus the leaf VALUES — the strings the app actually renders.
 *
 * Parsed rather than imported so the gate needs no build step and no TS loader.
 * `scripts/__tests__/check-i18n-call-site-keys.test.ts` pins this extraction
 * against the real module evaluated by vitest, keys AND values, so the two
 * cannot drift.
 *
 * `values` holds only leaves that read as a static string. Every leaf is in
 * `leaves` either way: the key rules judge existence and need no value, and the
 * value rule declines to judge what it could not read rather than guessing.
 *
 * @returns {{ leaves: Set<string>, branches: Set<string>, values: Map<string, string> }}
 */
export function collectEnKeys(root) {
  const file = join(root, 'packages/i18n/src/locales/en.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  const unwrap = (node) => {
    let n = node;
    while (ts.isAsExpression(n) || ts.isParenthesizedExpression(n) || (ts.isSatisfiesExpression?.(n) ?? false)) n = n.expression;
    return n;
  };

  let literal = null;
  const findEn = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'en' &&
      node.initializer
    ) {
      const init = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(init)) literal = init;
    }
    ts.forEachChild(node, findEn);
  };
  findEn(source);
  if (!literal) throw new Error(`cannot find the \`const en = { … }\` object literal in ${file}`);

  const leaves = new Set();
  const branches = new Set();
  const values = new Map();
  const walk = (object, prefix) => {
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        throw new Error(`unsupported property form in ${file} at ${prefix || '<root>'}: ${ts.SyntaxKind[prop.kind]}`);
      }
      const name =
        ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)
          ? prop.name.text
          : null;
      if (name === null) {
        throw new Error(`unsupported key form in ${file} at ${prefix || '<root>'}`);
      }
      const path = prefix ? `${prefix}.${name}` : name;
      const value = unwrap(prop.initializer);
      if (ts.isObjectLiteralExpression(value)) {
        branches.add(path);
        walk(value, path);
      } else {
        leaves.add(path);
        const text = staticString(value, source);
        if (text !== null) values.set(path, text);
      }
    }
  };
  walk(literal, '');
  return { leaves, branches, values };
}

// ── source walk ──────────────────────────────────────────────────────────────

/** Every non-test `.ts`/`.tsx` file under `packages/` and `apps/`. */
export function collectSourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !TEST_FILE.test(full)) out.push(full);
    }
  };
  for (const top of ['packages', 'apps']) {
    const dir = join(root, top);
    if (existsSync(dir)) walk(dir);
  }
  return out.sort();
}

/** The scope node a declaration belongs to (function body, block, file, …). */
function enclosingScope(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isSourceFile(current) ||
      ts.isBlock(current) ||
      ts.isModuleBlock(current) ||
      ts.isCaseBlock(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isForStatement(current) ||
      ts.isForOfStatement(current) ||
      ts.isForInStatement(current)
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/** Resolve a relative import specifier to a repo-relative file path. */
function resolveImport(root, fromFile, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const base = resolve(dirname(fromFile), specifier);
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(root, candidate);
  }
  return relative(root, base);
}

/**
 * Collect every declaration of `t`/`tt` in a file, with the shape that produced
 * it. Kinds: `packHook`, `import`, `localFunction`, `forwarded`, `other`.
 */
function collectBindings(root, file, source) {
  const bindings = [];
  const add = (name, declaration, kind, detail) =>
    bindings.push({
      name,
      kind,
      detail,
      scope: enclosingScope(declaration) ?? source,
      pos: declaration.getStart(source),
    });
  const named = (name) => name === 't' || name === 'tt';

  const visit = (node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      const specifier = node.moduleSpecifier.getText(source).slice(1, -1);
      for (const element of node.importClause.namedBindings.elements) {
        if (named(element.name.text)) {
          add(element.name.text, node, 'import', resolveImport(root, file, specifier));
        }
      }
    }

    if (ts.isFunctionDeclaration(node) && node.name && named(node.name.text)) {
      add(node.name.text, node, 'localFunction', 'declared in this file');
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      let init = node.initializer;
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init) || ts.isNonNullExpression(init)) {
        init = init.expression;
      }
      let kind = 'other';
      let detail = ts.SyntaxKind[init.kind];
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
        detail = `${init.expression.text}()`;
        if (PACK_HOOK.test(init.expression.text)) kind = 'packHook';
      } else if (ts.isCallExpression(init)) {
        detail = `${init.expression.getText(source)}()`;
      } else if (ts.isIdentifier(init)) {
        // `const { t } = props` — a forwarded translator, same hop as a parameter.
        kind = 'forwarded';
        detail = `destructured from \`${init.text}\``;
      }

      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ? element.propertyName.getText(source) : element.name.getText(source);
          if (property !== 't' && property !== 'tt') continue;
          if (!ts.isIdentifier(element.name)) continue;
          add(element.name.text, node, kind === 'other' ? 'other' : kind, detail);
        }
      } else if (ts.isIdentifier(node.name) && named(node.name.text)) {
        add(node.name.text, node, kind, detail);
      }
    }

    if (ts.isParameter(node)) {
      if (ts.isIdentifier(node.name) && named(node.name.text)) {
        const annotation = node.type ? node.type.getText(source).replace(/\s+/g, ' ') : '';
        add(node.name.text, node, TRANSLATOR_TYPE.test(annotation) ? 'forwarded' : 'other', `parameter: ${annotation || '(untyped)'}`);
      } else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          const property = element.propertyName ? element.propertyName.getText(source) : element.name.getText(source);
          if (property !== 't' && property !== 'tt') continue;
          if (!ts.isIdentifier(element.name)) continue;
          // A destructured prop: prefer the member's own type off an inline
          // type literal, else the whole annotation (`SomeProps`).
          let annotation = node.type ? node.type.getText(source).replace(/\s+/g, ' ') : '';
          if (node.type && ts.isTypeLiteralNode(node.type)) {
            for (const member of node.type.members) {
              if (ts.isPropertySignature(member) && member.name.getText(source) === property && member.type) {
                annotation = member.type.getText(source).replace(/\s+/g, ' ');
              }
            }
          }
          add(element.name.text, node, 'forwarded', `prop: ${annotation || '(untyped)'}`);
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return bindings;
}

/** Nearest binding of `name` visible at `position`: deepest scope, then latest declaration. */
function bindingAt(bindings, source, name, position) {
  let best = null;
  for (const binding of bindings) {
    if (binding.name !== name) continue;
    if (!binding.scope) continue;
    if (position < binding.scope.getStart(source) || position > binding.scope.getEnd()) continue;
    if (!best) {
      best = binding;
      continue;
    }
    const deeper = binding.scope.getStart(source) > best.scope.getStart(source);
    const sameScope = binding.scope === best.scope;
    if (deeper) best = binding;
    else if (sameScope && binding.pos <= position && (best.pos > position || binding.pos > best.pos)) best = binding;
  }
  return best;
}

/** Strip `as`/parenthesis wrappers, which callers use to satisfy the key type. */
function unwrapExpression(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isParenthesizedExpression(current) || ts.isNonNullExpression(current))) {
    current = current.expression;
  }
  return current;
}

/** Literal keys a first argument denotes, plus whether any part of it is dynamic. */
function literalKeysOf(argument, source) {
  const keys = [];
  let dynamic = false;
  const read = (node) => {
    if (!node) {
      dynamic = true;
      return;
    }
    const inner = unwrapExpression(node);
    if (inner !== node) {
      read(inner);
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      keys.push(node.text);
    } else if (ts.isArrayLiteralExpression(node)) {
      // `tt(['common.total', 'dashboard.total'], 'Total')` — a migration chain.
      for (const element of node.elements) read(element);
    } else if (ts.isConditionalExpression(node)) {
      read(node.whenTrue);
      read(node.whenFalse);
    } else {
      dynamic = true;
    }
  };
  read(argument);
  return { keys, dynamic };
}

/**
 * The inline `defaultValue` an options argument carries (objectui#3810).
 *
 * `{ present: false }`            — no `defaultValue` property at all.
 * `{ present: true, text }`       — a static string this rule can compare.
 * `{ present: true, text: null }` — written, but computed (a template with a
 *                                   substitution, a variable, a ternary). Not
 *                                   comparable, so it is counted, never failed.
 */
function inlineDefaultValue(node, source) {
  for (const argument of node.arguments.slice(1)) {
    const inner = unwrapExpression(argument);
    if (!inner || !ts.isObjectLiteralExpression(inner)) continue;
    for (const property of inner.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name =
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
      if (name !== 'defaultValue') continue;
      return { present: true, text: staticString(property.initializer, source) };
    }
  }
  return { present: false, text: null };
}

/**
 * The interpolation option names a call site passes (objectui#3845).
 *
 * `{ readable: true, names }`  — the full name set, reserved names already
 *                                removed. An empty set is a real answer: it says
 *                                this call passes nothing to interpolate.
 * `{ readable: false }`        — the name set is not statically knowable, so the
 *                                rule abstains rather than guessing at it.
 *
 * Only the properties of the options OBJECT LITERAL itself are read. An inner
 * `t('fields.image.imageAlt', { index })` written as one of those property
 * VALUES contributes nothing, because its arguments are its own — which is the
 * whole difference between this and the regex that first measured the class.
 */
function interpolationOptions(node, source) {
  let object = null;
  for (const argument of node.arguments.slice(1)) {
    const inner = unwrapExpression(argument);
    if (!inner) return { readable: false };
    if (ts.isObjectLiteralExpression(inner)) {
      // `t(key, 'Default', { name })` is legal i18next; the first object wins,
      // the way `inlineDefaultValue` reads it.
      if (object === null) object = inner;
      continue;
    }
    // A positional default (`tt(key, 'Save')`) carries no options.
    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner) || ts.isTemplateExpression(inner)) continue;
    // `t(key, options)` — an options bag this parser cannot open.
    return { readable: false };
  }

  const names = new Set();
  if (object === null) return { readable: true, names };

  for (const property of object.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      if (!RESERVED_OPTION_NAMES.has(property.name.text)) names.add(property.name.text);
      continue;
    }
    // A spread, a method, an accessor: the name set is open, so do not judge it.
    if (!ts.isPropertyAssignment(property)) return { readable: false };
    if (ts.isComputedPropertyName(property.name)) {
      // The probe flag is the one computed name with a known meaning, and those
      // call sites returned before reaching here. Anything else is unreadable.
      return { readable: false };
    }
    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name)
        ? property.name.text
        : null;
    if (name === null) return { readable: false };
    // i18next reads interpolation data OUT of `replace` when it is present, so
    // the top-level names stop being the answer to this question entirely.
    if (name === 'replace') return { readable: false };
    if (RESERVED_OPTION_NAMES.has(name)) continue;
    names.add(name);
  }
  return { readable: true, names };
}

/**
 * The fallback written as this call's SIBLING, i.e. `t(key) || 'English'`
 * (objectui#4117), or `null` when the call is not in that position at all.
 *
 * `node.parent` is the whole mechanism, and the direction matters: only the
 * LEFT operand of `||`/`??` is this class. The mirror shape,
 * `someValue || t('key')`, is the healthy one — a runtime value falling back to
 * a translation — and `main` carries 94 of those.
 *
 * `optional` reports `t?.(key)`, where the call itself can evaluate to
 * `undefined` and the fallback is therefore LIVE. `literal` reports whether the
 * right operand is a static string or a template literal, which is the only
 * form this rule judges; `text` is that string, or the right operand's source
 * for a template, purely so the report can quote it.
 */
function siblingFallback(node, source) {
  let current = node;
  let parent = node.parent;
  while (
    parent &&
    (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent))
  ) {
    current = parent;
    parent = parent.parent;
  }
  if (!parent || !ts.isBinaryExpression(parent) || parent.left !== current) return null;
  const operator = parent.operatorToken.kind;
  if (operator !== ts.SyntaxKind.BarBarToken && operator !== ts.SyntaxKind.QuestionQuestionToken) return null;

  const right = unwrapExpression(parent.right);
  const text = staticString(right, source);
  // A template WITH substitutions is still a literal fallback — the whole point
  // of the five divergent rows this class was filed over. `staticString` cannot
  // fold it, so read it as source; the verdict is "delete", never "compare".
  const isTemplate = !!right && ts.isTemplateExpression(right);
  return {
    operator: operator === ts.SyntaxKind.BarBarToken ? '||' : '??',
    optional: !!node.questionDotToken,
    literal: text !== null || isTemplate,
    text: text !== null ? text : right ? right.getText(source).replace(/\s+/g, ' ') : '',
  };
}

/** The literal head of a template key, i.e. everything before the first `${`. */
function staticHead(argument) {
  const inner = unwrapExpression(argument);
  // `t(`ns.${x}` as any)` is the same key shape as `t(`ns.${x}`)`; the cast is
  // there to satisfy a key type, and reading through it is what found the fifth
  // dead template family (`marketplace.disclosure.runtime.`).
  if (!inner || !ts.isTemplateExpression(inner)) return '';
  return inner.head.text;
}

// ── the analysis ─────────────────────────────────────────────────────────────

/**
 * @returns {{ findings: Array, counters: Record<string, number>, enKeyCount: number }}
 */
export function analyze(root) {
  const { leaves, branches, values } = collectEnKeys(root);
  const resolvesLeaf = (key) => leaves.has(key) || PLURAL_SUFFIXES.some((suffix) => leaves.has(key + suffix));
  // Materialised once, not inside the predicate: spreading a 2.6k-entry Set per
  // candidate head is the shape that made `all-locales-key-parity` quadratic
  // (7.51s -> 25ms once hoisted; see AGENTS.md 测试纪律).
  const everyPath = [...leaves, ...branches];
  const headMatches = (head) => everyPath.some((key) => key.startsWith(head));

  const registeredModules = new Set(EXCLUDED_TRANSLATORS.map((entry) => entry.module));
  const localScopes = EXCLUDED_TRANSLATORS.flatMap((entry) => entry.forwardedScope ?? []);
  const externallyFilled = new Map(
    EXTERNALLY_INTERPOLATED_HOLES.map((entry) => [entry.key, new Set(entry.holes)]),
  );

  const findings = [];
  const counters = {
    filesScanned: 0,
    callSites: 0,
    packCallSites: 0,
    literalKeys: 0,
    resolvedKeys: 0,
    dynamicKeySites: 0,
    probeSites: 0,
    skippedLocalTable: 0,
    skippedNotATranslator: 0,
    skippedMethodCall: 0,
    literalDefaultValues: 0,
    matchingDefaultValues: 0,
    computedDefaultValues: 0,
    unjudgedDefaultValues: 0,
    judgedInterpolation: 0,
    unjudgedInterpolation: 0,
    opaqueOptions: 0,
    siblingFallbacks: 0,
    judgedSiblingFallbacks: 0,
    computedSiblingFallbacks: 0,
    optionalCallFallbacks: 0,
    unjudgedSiblingFallbacks: 0,
  };

  for (const file of collectSourceFiles(root)) {
    counters.filesScanned += 1;
    const text = readFileSync(file, 'utf8');
    const relPath = relative(root, file).split('\\').join('/');
    const isLocalTableFile = registeredModules.has(relPath);

    // `createSafeTranslation` is the factory every pack-backed hook in this repo
    // is built from. If one is bound to a name this gate would not recognise as
    // a hook, every call through it silently leaves the checked surface — so say
    // so instead of skipping it.
    for (const match of text.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*createSafeTranslation\s*\(/g)) {
      if (!PACK_HOOK.test(match[1])) {
        const line = text.slice(0, match.index).split('\n').length;
        findings.push({
          reason: 'unrecognised-hook',
          file: relPath,
          line,
          column: 1,
          detail: match[1],
        });
      }
    }

    // `?\.` is not decoration: `packages/app-shell/src/layout/ContextSelectors.tsx`
    // spells EVERY call `t?.(…)` because its `t` is an optional prop, so it holds
    // no `t(` at all and this pre-filter used to drop the whole file — silently,
    // out of all five classes at once (objectui#4117).
    if (!/\btt?\s*(?:\?\.)?\s*\(/.test(text)) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const bindings = collectBindings(root, file, source);

    // A file's provenance: which table its own `t` reaches. A forwarded `t`
    // inherits it, because the parser cannot follow the value across modules.
    let provenance = localScopes.some((dir) => relPath.startsWith(dir)) || isLocalTableFile ? 'local' : null;
    for (const binding of bindings) {
      if (binding.kind === 'packHook' && provenance === null) provenance = 'pack';
      if (binding.kind === 'import' && registeredModules.has(binding.detail)) provenance = 'local';
    }

    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        let name = null;
        let isMethod = false;
        if (ts.isIdentifier(callee)) name = callee.text;
        else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name) && callee.name.text === 't') {
          name = 't';
          isMethod = true;
        }

        if (name === 't' || name === 'tt') {
          counters.callSites += 1;
          const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source));
          const at = { file: relPath, line: line + 1, column: character + 1 };

          if (isMethod) {
            // `someObject.t(...)` — the receiver's type is unknowable here.
            counters.skippedMethodCall += 1;
            ts.forEachChild(node, visit);
            return;
          }

          const binding = bindingAt(bindings, source, name, node.getStart(source));
          const kind = binding ? binding.kind : 'forwarded'; // no declaration in this file = it came from outside

          if (kind === 'import' && !registeredModules.has(binding.detail)) {
            findings.push({ reason: 'unregistered-translator', ...at, detail: binding.detail });
            ts.forEachChild(node, visit);
            return;
          }
          if (kind === 'import' || kind === 'localFunction' || (kind === 'forwarded' && provenance === 'local')) {
            counters.skippedLocalTable += 1;
            ts.forEachChild(node, visit);
            return;
          }
          if (kind === 'other') {
            counters.skippedNotATranslator += 1;
            ts.forEachChild(node, visit);
            return;
          }

          // PACK: `packHook`, or a forwarded translator in a non-local file.
          counters.packCallSites += 1;

          let isProbe = false;
          let returnsObjects = false;
          for (const argument of node.arguments.slice(1)) {
            if (!ts.isObjectLiteralExpression(argument)) continue;
            for (const property of argument.properties) {
              if (!ts.isPropertyAssignment(property)) continue;
              if (ts.isComputedPropertyName(property.name) && PROBE_FLAG_NAMES.test(property.name.expression.getText(source))) {
                isProbe = true;
              }
              if (
                ts.isIdentifier(property.name) &&
                property.name.text === 'returnObjects' &&
                property.initializer.kind === ts.SyntaxKind.TrueKeyword
              ) {
                returnsObjects = true;
              }
            }
          }
          if (isProbe) {
            // Deliberate convention-key miss — excluded by the flag, not by path.
            counters.probeSites += 1;
            ts.forEachChild(node, visit);
            return;
          }

          const argument = node.arguments[0];
          const { keys, dynamic } = literalKeysOf(argument, source);
          for (const key of keys) {
            counters.literalKeys += 1;
            if (resolvesLeaf(key) || (returnsObjects && branches.has(key))) counters.resolvedKeys += 1;
            else findings.push({ reason: 'missing-key', ...at, detail: key });
          }

          // objectui#3810 — the inline default is dead code the moment the key
          // exists, so it must not say something else. Deliberately narrow: one
          // literal key, whose `en` leaf is a plain string. A key `en` does not
          // define is `missing-key`'s territory and is NOT reported here too;
          // keeping the two classifications disjoint is what lets either output
          // be read on its own.
          // The single `en` value this call site renders, or `undefined` when
          // there is not exactly one that this parser could read as a string.
          // Shared by classes 3 and 4: both judge a call site against the
          // sentence the pack actually serves it, and both decline together.
          const key = !dynamic && keys.length === 1 ? keys[0] : null;
          const enValue = key !== null && !returnsObjects ? values.get(key) : undefined;

          const inlineDefault = inlineDefaultValue(node, source);
          if (inlineDefault.present && inlineDefault.text === null) {
            counters.computedDefaultValues += 1;
          } else if (inlineDefault.present) {
            counters.literalDefaultValues += 1;
            if (enValue === undefined) {
              // No single static key, or a key whose `en` leaf this parser could
              // not read as a string — including the plural families, where
              // there is no one form to compare against. Counted, never failed.
              counters.unjudgedDefaultValues += 1;
            } else if (enValue === inlineDefault.text) {
              counters.matchingDefaultValues += 1;
            } else {
              findings.push({ reason: 'default-value-drift', ...at, detail: key, expected: enValue, actual: inlineDefault.text });
            }
          }

          // objectui#3845 — what this call site passes must be what the `en`
          // value has holes for, in both directions. Judged on the same
          // preconditions as class 3, plus a readable option-name set.
          if (enValue === undefined) {
            counters.unjudgedInterpolation += 1;
          } else {
            const options = interpolationOptions(node, source);
            if (!options.readable) {
              counters.opaqueOptions += 1;
            } else {
              const downstream = externallyFilled.get(key) ?? new Set();
              const holes = new Set(
                [...holesOf(enValue)].filter((hole) => !RESERVED_OPTION_NAMES.has(hole) && !downstream.has(hole)),
              );
              const inert = [...options.names].filter((option) => !holes.has(option)).sort();
              const unfilled = [...holes].filter((hole) => !options.names.has(hole)).sort();
              counters.judgedInterpolation += 1;
              if (inert.length > 0 || unfilled.length > 0) {
                findings.push({ reason: 'interpolation-parity', ...at, detail: key, expected: enValue, inert, unfilled });
              }
            }
          }

          // objectui#4117 — the fallback spelled as a SIBLING of the call
          // rather than as one of its arguments. Existence is the defect, so
          // there is nothing to compare; every abstention below is a case where
          // "the right operand cannot render" stops being true.
          const sibling = siblingFallback(node, source);
          if (sibling !== null) {
            counters.siblingFallbacks += 1;
            if (sibling.optional) {
              // `t?.(key)` is `undefined` when the prop is absent, so the
              // fallback is LIVE. Not a parser limitation — a real path.
              counters.optionalCallFallbacks += 1;
            } else if (enValue === undefined || enValue === '') {
              // No single readable value — or one that is itself falsy, which is
              // the one way a non-optional `t()` can let `||` through.
              counters.unjudgedSiblingFallbacks += 1;
            } else if (!sibling.literal) {
              // `t(key) || label` renders a runtime value, not a second copy of
              // the sentence. Same abstention as a computed `defaultValue`.
              counters.computedSiblingFallbacks += 1;
            } else {
              counters.judgedSiblingFallbacks += 1;
              findings.push({
                reason: 'dead-sibling-fallback',
                ...at,
                detail: key,
                expected: enValue,
                actual: sibling.text,
                operator: sibling.operator,
              });
            }
          }

          if (dynamic) {
            counters.dynamicKeySites += 1;
            const head = staticHead(argument);
            if (head && !headMatches(head)) {
              findings.push({ reason: 'missing-prefix', ...at, detail: head });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return { findings, counters, enKeyCount: leaves.size };
}

// ── baseline ─────────────────────────────────────────────────────────────────

export function readBaseline(root) {
  const file = join(root, 'scripts/i18n-call-site-key-baseline.json');
  if (!existsSync(file)) return { missingKeys: {}, missingPrefixes: {} };
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  return { missingKeys: parsed.missingKeys ?? {}, missingPrefixes: parsed.missingPrefixes ?? {} };
}

/**
 * Split findings against the baseline. `unexpected` fails the build; `stale`
 * fails it too — a baseline entry whose defect is gone must be deleted, so the
 * file can only shrink.
 */
export function applyBaseline(findings, baseline) {
  const unexpected = [];
  const seenKeys = new Set();
  const seenPrefixes = new Set();

  for (const finding of findings) {
    if (finding.reason === 'missing-key' && Object.hasOwn(baseline.missingKeys, finding.detail)) {
      seenKeys.add(finding.detail);
      continue;
    }
    if (finding.reason === 'missing-prefix' && Object.hasOwn(baseline.missingPrefixes, finding.detail)) {
      seenPrefixes.add(finding.detail);
      continue;
    }
    unexpected.push(finding);
  }

  const stale = [
    ...Object.keys(baseline.missingKeys).filter((key) => !seenKeys.has(key)).map((key) => ({ kind: 'missingKeys', entry: key })),
    ...Object.keys(baseline.missingPrefixes).filter((p) => !seenPrefixes.has(p)).map((entry) => ({ kind: 'missingPrefixes', entry })),
  ];

  return { unexpected, stale };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HINTS = {
  'missing-key':
    'The key exists in no locale pack. Add it to `packages/i18n/src/locales/en.ts`' +
    ' — that is the source of truth, and adding it there makes' +
    ' `packages/i18n/src/__tests__/all-locales-key-parity.test.ts` demand the same key' +
    ' in the other nine packs, which is the point. An inline' +
    ' `t(key, { defaultValue: "…" })` is NOT a fix: it renders English at this one' +
    ' call site and leaves the string untranslatable everywhere (objectui#3517).',
  'missing-prefix':
    'No key in `en` begins with this template literal\'s static head, so every value the' +
    ' substitution can take is missing. Add the whole family to' +
    ' `packages/i18n/src/locales/en.ts`.',
  'unregistered-translator':
    'This file imports a `t` from a module this gate does not know. If that module is a' +
    ' pack-backed re-export, it should be called through a `use*Translation` hook so its' +
    ' keys are checked; if it is a module-local label table like' +
    ' `packages/app-shell/src/views/metadata-admin/i18n.ts`, register it in' +
    ' EXCLUDED_TRANSLATORS with a reason.',
  'unrecognised-hook':
    '`createSafeTranslation(...)` bound to a name outside the `use*Translation` /' +
    ' `use*Translate` / `use*T` convention. Every call through it would leave this' +
    ' gate\'s checked surface silently — rename it to the convention.',
  'default-value-drift':
    'The key EXISTS in `en`, so i18next serves the pack value and this inline' +
    ' `defaultValue` never renders — but it says something else, which misleads every' +
    ' later reader of this component and becomes the visible copy the day the key is' +
    ' renamed (objectui#3810). Fix it at the CALL SITE: copy the `en` value in' +
    ' byte-for-byte, ellipsis and capitalisation included. Do NOT edit' +
    ' `packages/i18n/src/locales/en.ts` to match the call site — the pack value is what' +
    ' users read today, and changing it makes `scripts/check-i18n-en-drift.mjs` demand' +
    ' the same change in the other nine packs. If the pack value is genuinely the wrong' +
    ' copy for this spot, that is a copy change in its own PR, or the call site is asking' +
    ' for the wrong key.',
  'interpolation-parity':
    'The arguments this call site passes are not the holes the `en` value has (objectui#3845).' +
    ' An INERT argument is one i18next drops on the floor — no hole to receive it, no warning,' +
    ' and the intent behind it disappears. An UNFILLED hole is worse: i18next leaves the braces' +
    ' in place and the user reads a literal `{{name}}`. Fix it at the CALL SITE by default —' +
    ' delete the argument nothing consumes, or pass the one the sentence asks for. Editing' +
    ' `packages/i18n/src/locales/en.ts` to add or drop a hole is a COPY change: it changes what' +
    ' users read and obliges the other nine packs through `scripts/check-i18n-en-drift.mjs`, so' +
    ' it needs to be a deliberate decision in its own right rather than a way to silence this.' +
    ' If the hole is filled by whatever CONSUMES the translated string rather than by i18next' +
    ' (a label handed to a component that substitutes it later), register the key in' +
    ' EXTERNALLY_INTERPOLATED_HOLES with the file that does the substitution — and note that' +
    ' those keys must still NOT be passed the argument, or i18next consumes the hole before the' +
    ' consumer gets to see it.',
  'dead-sibling-fallback':
    'The key EXISTS in `en`, and this fallback is written as the call\'s SIBLING' +
    ' (`t(key) || \'English\'`) rather than as an argument — so it is dead on every path, not just' +
    ' the provider one (objectui#4117). With a provider the pack wins. WITHOUT one, react-i18next\'s' +
    ' not-ready `t` returns the KEY, which is truthy, so `||` skips this string too and the user' +
    ' reads a raw `console.objectView.delete` — strictly worse than an inline `defaultValue`, which' +
    ' at least renders English there. DELETE the operator and the right-hand string; do NOT align it' +
    ' with the `en` value, because aligning it would bless a second fallback spelling when the point' +
    ' is that there is one (`defaultValue`, governed by `default-value-drift`). If this call site' +
    ' genuinely needs English on a provider-less host, that is `t(key, { defaultValue: \'…\' })`.' +
    ' Note the mirror shape `someValue || t(key)` is HEALTHY and is not reported: only the LEFT' +
    ' operand of `||`/`??` is this class.',
};

/** JSON-quoted, with every non-ASCII byte escaped — `...` vs `…` must be visible. */
const quote = (text) =>
  JSON.stringify(text).replace(/[^\x20-\x7e]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const root = resolve(scriptDir, '..');
  const { findings, counters, enKeyCount } = analyze(root);

  // Guard against a refactor quietly emptying the comparison: with no keys and
  // no call sites every assertion below is trivially satisfied. Same reason
  // `all-locales-key-parity.test.ts` opens with a size assertion.
  if (enKeyCount < 2000 || counters.packCallSites < 1000) {
    console.error(
      `The scan collapsed: ${enKeyCount} en keys and ${counters.packCallSites} pack-backed call sites.` +
        ' Expected thousands of both — the extractor or the file walk is broken, and an' +
        ' empty comparison would pass while asserting nothing.',
    );
    process.exit(1);
  }

  const { unexpected, stale } = applyBaseline(findings, readBaseline(root));

  console.log(
    `Scanned ${counters.filesScanned} files, ${counters.callSites} t()/tt() call sites: ` +
      `${counters.packCallSites} pack-backed (${counters.resolvedKeys}/${counters.literalKeys} literal keys resolve), ` +
      `${counters.dynamicKeySites} dynamic-key (report-only), ${counters.probeSites} probe-flagged, ` +
      `${counters.skippedLocalTable} module-local table, ${counters.skippedNotATranslator} not a translator, ` +
      `${counters.skippedMethodCall} method call.`,
  );
  console.log(
    `Inline defaults: ${counters.literalDefaultValues} literal ` +
      `(${counters.matchingDefaultValues} match their en value, ${counters.unjudgedDefaultValues} not comparable), ` +
      `${counters.computedDefaultValues} computed (report-only).`,
  );
  console.log(
    `Interpolation parity: ${counters.judgedInterpolation} call sites compared against their en value's holes, ` +
      `${counters.unjudgedInterpolation} with no single comparable en value, ${counters.opaqueOptions} with an ` +
      `unreadable option set, ${EXTERNALLY_INTERPOLATED_HOLES.length} key(s) whose holes are filled downstream.`,
  );
  console.log(
    `Sibling fallbacks: ${counters.siblingFallbacks} call site(s) sit left of a ||/?? — ` +
      `${counters.judgedSiblingFallbacks} judged, ${counters.computedSiblingFallbacks} with a non-literal ` +
      `right operand, ${counters.optionalCallFallbacks} an optional call (fallback is live), ` +
      `${counters.unjudgedSiblingFallbacks} with no single comparable en value.`,
  );

  // Split by class before printing: the two key classes say "en does not define
  // this", the drift class says "en defines it differently", the parity class
  // says "en defines it with different holes", and one paragraph cannot honestly
  // introduce all three.
  const drift = unexpected.filter((finding) => finding.reason === 'default-value-drift');
  const parity = unexpected.filter((finding) => finding.reason === 'interpolation-parity');
  const siblings = unexpected.filter((finding) => finding.reason === 'dead-sibling-fallback');
  const VALUE_CLASSES = new Set(['default-value-drift', 'interpolation-parity', 'dead-sibling-fallback']);
  const keyFindings = unexpected.filter((finding) => !VALUE_CLASSES.has(finding.reason));

  if (unexpected.length === 0 && stale.length === 0) {
    console.log(
      `Every in-scope call-site key resolves against the en pack (${enKeyCount} keys), every` +
        ' literal inline defaultValue matches the value the pack serves, every call site passes' +
        ' exactly the arguments that value has holes for, and no call site carries a literal' +
        ' fallback beside itself.',
    );
    process.exit(0);
  }

  if (keyFindings.length > 0) {
    const distinct = new Set(keyFindings.map((f) => `${f.reason} :: ${f.detail}`));
    console.error(
      `\n${keyFindings.length} call site${keyFindings.length === 1 ? '' : 's'} reference${keyFindings.length === 1 ? 's' : ''} ` +
        `a key the en pack does not define (${distinct.size} distinct):`,
    );
    for (const finding of keyFindings) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column}  [${finding.reason}]  ${finding.detail}`);
    }
  }

  if (drift.length > 0) {
    const distinct = new Set(drift.map((finding) => finding.detail));
    console.error(
      `\n${drift.length} inline defaultValue${drift.length === 1 ? '' : 's'} contradict${drift.length === 1 ? 's' : ''} ` +
        `the en value of a key that EXISTS (${distinct.size} distinct key${distinct.size === 1 ? '' : 's'}) — ` +
        'the pack value is what renders, so the call site is stating a sentence nobody sees:',
    );
    for (const finding of drift) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column}  [${finding.reason}]  ${finding.detail}`);
      console.error(`      en renders: ${quote(finding.expected)}`);
      console.error(`      call site:  ${quote(finding.actual)}`);
    }
  }

  if (parity.length > 0) {
    const distinct = new Set(parity.map((finding) => finding.detail));
    console.error(
      `\n${parity.length} call site${parity.length === 1 ? '' : 's'} pass${parity.length === 1 ? 'es' : ''} ` +
        `arguments that do not match the holes in the en value (${distinct.size} distinct ` +
        `key${distinct.size === 1 ? '' : 's'}) — an inert argument is dropped in silence, an ` +
        'unfilled hole renders its own braces to the user:',
    );
    for (const finding of parity) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column}  [${finding.reason}]  ${finding.detail}`);
      console.error(`      en renders: ${quote(finding.expected)}`);
      if (finding.inert.length > 0) console.error(`      inert (passed, no hole):     ${finding.inert.join(', ')}`);
      if (finding.unfilled.length > 0) console.error(`      unfilled (hole, no argument): ${finding.unfilled.join(', ')}`);
    }
  }

  if (siblings.length > 0) {
    const distinct = new Set(siblings.map((finding) => finding.detail));
    console.error(
      `\n${siblings.length} call site${siblings.length === 1 ? '' : 's'} carr${siblings.length === 1 ? 'ies' : 'y'} ` +
        `a literal fallback as the call's SIBLING (${distinct.size} distinct ` +
        `key${distinct.size === 1 ? '' : 's'}) — the key exists, so nothing can ever reach the right ` +
        'operand; delete it:',
    );
    for (const finding of siblings) {
      console.error(`  ${finding.file}:${finding.line}:${finding.column}  [${finding.reason}]  ${finding.detail}`);
      console.error(`      en renders:  ${quote(finding.expected)}`);
      console.error(`      dead ${finding.operator} operand: ${quote(finding.actual)}`);
    }
  }

  for (const reason of Object.keys(HINTS)) {
    if (unexpected.some((finding) => finding.reason === reason)) console.error(`\n${reason}: ${HINTS[reason]}`);
  }

  if (stale.length > 0) {
    console.error(
      `\n${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} stale — the defect is gone, so the` +
        ' entry must go too (this file is a ratchet; it only shrinks):',
    );
    for (const entry of stale) console.error(`  ${entry.kind}: ${entry.entry}`);
  }

  console.error('\nSee the header of scripts/check-i18n-call-site-keys.mjs.');
  process.exit(1);
}
