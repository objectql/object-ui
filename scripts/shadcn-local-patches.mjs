/**
 * Declarative local patches for the regenerated Shadcn primitives.
 *
 * ## Why this file exists
 *
 * `packages/components/src/ui/**` is a No-Touch zone (AGENTS.md Commandment
 * #7): every file in it is overwritten by `pnpm shadcn:update` from the
 * upstream registry. That is fine for the 99% of those files we take as-is,
 * and `shadcn-sync.js` already protects hand edits *defensively* — it counts
 * `localOnlyLines` and REFUSES to overwrite a diverged file.
 *
 * Refusal is not enough for a patch that must never silently disappear:
 *
 *   1. `--force` bypasses the refusal by design, and takes the edit with it.
 *   2. A type-check cannot see the loss. Upstream drops a local addition *and*
 *      its usages consistently, so the regenerated file still compiles — this
 *      is the `command.tsx` failure mode documented in `shadcn-sync.js`.
 *   3. Nothing declares WHICH lines were load-bearing, so a reviewer staring
 *      at a post-sync diff has no way to tell a deliberate fix from drift.
 *
 * So the edits that MUST survive regeneration are declared here as data, and
 * the sync script re-applies them on every write. The patch is no longer a
 * hand edit someone has to remember to re-do; it is part of what "sync" means.
 *
 * ## Declared = enforced
 *
 * Every patch carries `marker` (what the patched file must contain) and
 * `find`/`occurrences` (the upstream anchor it needs). That makes three
 * different regressions loud instead of silent:
 *
 *   - `verifyLocalPatches()` — the file on disk lost its marker (a forced
 *     sync, a bad merge, a hand edit). Offline, so it can gate every PR.
 *   - `applyLocalPatches()` on freshly fetched upstream — the anchor is gone
 *     or has moved, i.e. the patch will NOT survive the next regeneration.
 *     `shadcn:check` reports this before anyone runs `--update`.
 *   - `applyLocalPatches()` during `--update` — same, and the write is
 *     refused rather than producing a file with the patch quietly missing.
 *
 * ## Adding a patch
 *
 * Keep the payload OUT of `src/ui/`. A patch should be a one-line reference to
 * code that lives somewhere the sync never touches (here: `src/lib/`), because
 * a small anchored reference survives upstream churn far better than an
 * inlined implementation, and the implementation itself stays reviewable and
 * unit-testable in a normal file.
 */

/**
 * @typedef {object} LocalPatch
 * @property {string}  id          Stable identifier, used in messages.
 * @property {string}  issue       Tracking issue for the divergence.
 * @property {string}  reason      Why this edit exists, in prose.
 * @property {string}  find        Literal upstream anchor (NOT a regex).
 * @property {string}  replace     Literal replacement.
 * @property {string}  marker      Substring that proves the patch is applied.
 * @property {number}  occurrences Exact number of `find` hits expected.
 */

/**
 * The i18n patch, shared by `sheet` and `dialog`.
 *
 * Both primitives auto-render an icon-only close button whose ONLY accessible
 * name is a hardcoded English `sr-only` span, so under zh/ja/es every drawer
 * and modal in the console announced "Close" in English (objectstack#5505).
 *
 * The two patches per file are deliberately the smallest possible edit: add an
 * import, swap one element. All of the actual i18n behaviour — the safe
 * translation hook, the English fallback, the defaults map — lives in
 * `packages/components/src/lib/close-label.tsx`, which the sync never
 * regenerates.
 *
 * @param {string} primitive Human-readable primitive name, for the reason text.
 * @returns {LocalPatch[]}
 */
function i18nCloseLabelPatches(primitive) {
  return [
    {
      id: `${primitive.toLowerCase()}-i18n-close-import`,
      issue: 'objectstack#5505',
      reason:
        `Imports the shared translated close label used by ${primitive}Content's ` +
        'auto-rendered close button. Anchored on the `cn` import, which every ' +
        'Shadcn component carries.',
      find: 'import { cn } from "../lib/utils"',
      replace:
        'import { cn } from "../lib/utils"\nimport { CloseSrLabel } from "../lib/close-label"',
      marker: 'from "../lib/close-label"',
      occurrences: 1,
    },
    {
      id: `${primitive.toLowerCase()}-i18n-close-label`,
      issue: 'objectstack#5505',
      reason:
        `${primitive}Content's close button is icon-only (lucide X), so this ` +
        'sr-only span IS the control\'s accessible name. Upstream hardcodes the ' +
        'English literal; CloseSrLabel resolves `common.close` for the session ' +
        'locale and falls back to "Close" when no I18nProvider is mounted.',
      find: '<span className="sr-only">Close</span>',
      replace: '<CloseSrLabel />',
      marker: '<CloseSrLabel />',
      occurrences: 1,
    },
  ];
}

/**
 * The sidebar collapse-persistence patch (objectui#4234).
 *
 * `SidebarProvider` writes `sidebar_state` on every toggle and never reads it
 * back, so a collapsed sidebar returns expanded after a reload — the cookie is
 * present and correct, and nothing consults it. Upstream closes the loop in a
 * **server component** (read the cookie there, pass it down as `defaultOpen`),
 * a step a pure SPA like the console does not have, so the read must happen
 * client-side inside the provider itself.
 *
 * Fixing it at a call site instead was rejected on the issue: passing a
 * cookie-derived `defaultOpen` from one shell leaves every other SPA consumer
 * of this primitive broken.
 *
 * As with the i18n patches above, the payload stays OUT of `src/ui/`: all of
 * the parsing lives in `packages/components/src/lib/sidebar-cookie.ts`, and the
 * primitive gets two anchored one-liners. The lazy `useState` initialiser (not
 * a mount effect) is the point — the state must be right on the FIRST render,
 * because the reported symptom is measured at first paint and a mount-then-
 * collapse effect would still flash expanded.
 *
 * @type {LocalPatch[]}
 */
const sidebarCookieReadPatches = [
  {
    id: 'sidebar-cookie-read-import',
    issue: 'objectui#4234',
    reason:
      'Imports the cookie reader that restores the persisted collapse state. ' +
      'Anchored on the `cn` import, which every Shadcn component carries.',
    find: 'import { cn } from "../lib/utils"',
    replace:
      'import { cn } from "../lib/utils"\nimport { readSidebarStateCookie } from "../lib/sidebar-cookie"',
    marker: 'from "../lib/sidebar-cookie"',
    occurrences: 1,
  },
  {
    id: 'sidebar-cookie-read-initial-state',
    issue: 'objectui#4234',
    reason:
      "Seeds the provider's uncontrolled state from the `sidebar_state` cookie " +
      'that its own `setOpen` writes, so a collapsed sidebar survives a reload. ' +
      'A lazy initialiser rather than an effect: the value must be correct on ' +
      'the first render, not applied after one expanded paint. Precedence is ' +
      'cookie > `defaultOpen`; the controlled `open` prop still wins, because ' +
      'it is applied downstream of this state (`openProp ?? _open`). ' +
      'SIDEBAR_COOKIE_NAME is passed in so the cookie name keeps exactly one ' +
      'spelling — the write side\'s.',
    find: 'const [_open, _setOpen] = React.useState(defaultOpen)',
    replace:
      'const [_open, _setOpen] = React.useState(() => readSidebarStateCookie(SIDEBAR_COOKIE_NAME) ?? defaultOpen)',
    marker: 'readSidebarStateCookie(SIDEBAR_COOKIE_NAME)',
    occurrences: 1,
  },
];

/**
 * Component name (as tracked in `shadcn-components.json`) → patches it needs.
 *
 * @type {Record<string, LocalPatch[]>}
 */
export const LOCAL_PATCHES = {
  sheet: i18nCloseLabelPatches('Sheet'),
  dialog: i18nCloseLabelPatches('Dialog'),
  sidebar: sidebarCookieReadPatches,
};

/** Components that carry at least one declared patch. */
export function patchedComponents() {
  return Object.keys(LOCAL_PATCHES);
}

/** Count non-overlapping literal occurrences of `needle` in `haystack`. */
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/**
 * Re-apply every declared patch for `name` to `content`.
 *
 * Idempotent: a patch whose `marker` is already present is reported as
 * `already` and the content is left alone, so running this over an
 * already-patched local file is a no-op rather than a double application.
 *
 * A patch whose marker is absent AND whose anchor does not appear exactly
 * `occurrences` times is a HARD failure — it means upstream restructured the
 * code the patch depends on. Callers must refuse to write in that case: a
 * silently-unapplied patch is precisely the regression this module exists to
 * prevent.
 *
 * @param {string} name    Component name, e.g. `sheet`.
 * @param {string} content File content to patch.
 * @returns {{ content: string, applied: LocalPatch[], already: LocalPatch[],
 *             failed: Array<LocalPatch & { found: number }> }}
 */
export function applyLocalPatches(name, content) {
  const patches = LOCAL_PATCHES[name] || [];
  const applied = [];
  const already = [];
  const failed = [];
  let out = content;

  for (const patch of patches) {
    if (out.includes(patch.marker)) {
      already.push(patch);
      continue;
    }

    const found = countOccurrences(out, patch.find);
    if (found !== patch.occurrences) {
      // Anchor gone or duplicated. Either way we must not guess: applying a
      // patch to the wrong place is worse than refusing to apply it.
      failed.push({ ...patch, found });
      continue;
    }

    out = out.split(patch.find).join(patch.replace);
    applied.push(patch);
  }

  return { content: out, applied, already, failed };
}

/**
 * Which declared patches are MISSING from `content`.
 *
 * Pure string containment against `marker`, so this needs no network and no
 * registry access — it is the check that can run on every PR and catch a
 * patch that was reverted by a forced sync, a bad merge or a hand edit.
 *
 * @param {string} name
 * @param {string} content
 * @returns {LocalPatch[]} empty when the file carries every declared patch
 */
export function verifyLocalPatches(name, content) {
  return (LOCAL_PATCHES[name] || []).filter((patch) => !content.includes(patch.marker));
}

/**
 * Human-readable explanation of a violated or unappliable patch.
 *
 * Shared by the sync script's several failure paths so the operator always
 * gets the id, the tracking issue and the reason — not just "something
 * changed".
 *
 * @param {string} name
 * @param {LocalPatch & { found?: number }} patch
 * @returns {string[]} lines to print
 */
export function describePatchFailure(name, patch) {
  const lines = [
    `  [${patch.id}] declared for ${name}.tsx (${patch.issue})`,
    `    why: ${patch.reason}`,
  ];
  if (typeof patch.found === 'number') {
    lines.push(
      `    anchor expected ${patch.occurrences}x, found ${patch.found}x: ${JSON.stringify(patch.find)}`,
    );
  } else {
    lines.push(`    missing marker: ${JSON.stringify(patch.marker)}`);
  }
  return lines;
}
