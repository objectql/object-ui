/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { icons, type LucideIcon } from 'lucide-react';

/**
 * THE icon-name seam (objectui#5935). One tokeniser, one rename map, one
 * lookup into lucide's runtime `icons` record — for the whole repo.
 *
 * ## What this module does, and the line it does not cross
 *
 * Its whole contract is `name -> component`, and `null` when nothing matches.
 * ⛔ It does NOT decide what a surface draws when the answer is `null`. That
 * is the maintainer ruling of 2026-09-03 (objectui#5935, comment 5523286738,
 * verbatim 「同意你的建议」, option C), taken over the 2026-08-31 shape that
 * would have given this function an `onUnresolvable: 'placeholder' | 'null'`
 * parameter. The reason that parameter is absent is measured, not stylistic:
 * the tree has FOUR unresolvable behaviours, not two —
 *
 *   - `null`                          — this module's callers by default,
 *                                       `plugin-list/TabBar`, `plugin-view/ViewSwitcher`
 *   - `SquareDashed` placeholder+warn — `renderers/basic/icon.tsx` (objectui#5631,
 *                                       maintainer 2026-08-22, 一字不动)
 *   - an `Inbox` fallback glyph       — `plugin-detail/RelatedList`, `plugin-list/ListView`
 *   - a 3-character name chip         — `app-shell` `previews/ActionPreview`
 *
 * — so a two-valued knob could not have expressed the tree it was meant to
 * consolidate, and widening it to four would have published a presentation
 * decision on a lookup function. Each call site keeps its own fallback, at the
 * call site, visibly. `resolveIcon(x) ?? Inbox` is not a hidden divergence: it
 * is local and there is nothing for it to disagree with, unlike the three
 * tokenisers this seam replaced.
 *
 * ## ⛔ A new icon-rendering container does NOT bring its own resolver
 *
 * Ruling point 4 of 2026-08-31 (comment 5472612351, verbatim 「同意」):
 * 「本裁定后新容器 ⛔ 不得再自带解析器,一律走 seam」. This is mechanically
 * enforced, not merely asked for — `scripts/check-lucide-icon-record-names.mjs`
 * rediscovers every module that named-imports lucide's `icons` record and
 * indexes it, and fails when the discovered set differs from its declared
 * census in EITHER direction. That census is now this file alone. A container
 * that hand-rolls a lookup turns the gate red on the commit that adds it.
 *
 * ## The tokeniser is MEASURED, not chosen
 *
 * `split(/[-_\s]+/)` with `Home -> House` applied universally, established by
 * the pre-dispatch enumeration required by the 2026-08-31 ruling
 * (objectui#5935, comment 5522254814) — four independent instruments, each
 * with a control that fired in the same run: a cross-product upper bound over
 * every authored name x all seven surfaces, a bound-free differential over
 * 8,298 spellings derived from all 1,767 live record keys, an AST sweep over
 * 349,813 string literals (25 forking literals, ALL in the same direction),
 * and the objectui#5631 pin. Its regression set is EMPTY in all three readings.
 *
 * ⛔ `split('-')` — what five of the seven sites used — is not adoptable: it
 * regresses 4,748 name-surface pairs in the bound-free space, stripping the two
 * regex surfaces of every snake_case and space-separated spelling they resolve
 * today. `split(/[-_\s]/)` is byte-identical to the adopted spelling over
 * 51,449 hostile spellings, and `.filter(Boolean)` is inert in this pipeline
 * (capitalising the empty string yields the empty string, and joining it
 * contributes nothing) — three spellings, two behaviours, one adopted.
 *
 * Why widening cannot regress anything, structurally: NO key of the record
 * contains `_`, whitespace or `-` (measured: 0 of 1767, with a firing control —
 * 95 keys contain a digit). So whenever splitting on `-` alone produces a live
 * key, that key contained no `_` and no whitespace, so no hyphen-token did
 * either, so splitting further changes nothing. The old resolving sets are
 * strict SUBSETS of this one.
 *
 * ## The module path stays `renderers/action/`
 *
 * It is where the shared resolver already lived and where sixteen importers,
 * the gate's declared census and three suites already point. Moving it would
 * be churn priced in merge conflicts against a card whose acceptance criterion
 * is that nothing observable moves.
 */

/**
 * The ONE rename map: names lucide RETIRED from its runtime `icons` record.
 *
 * ⛔ Not a general alias table and not an author-facing compatibility layer —
 * every entry is a spelling lucide itself renamed, kept so a name that used to
 * resolve still does. `Home` is not a key of the record; `House` is.
 */
const iconNameMap: Record<string, string> = {
  Home: 'House',
};

/**
 * The ONE tokeniser: `"arrow-right"`, `"arrow_right"` and `"arrow right"` all
 * become `"ArrowRight"`. Module-private on purpose — the only ways out of this
 * file are `resolveIcon` (the seam) and `describeIconLookup` (diagnostics), so
 * no caller can re-implement half the pipeline against it.
 */
function toPascalCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * The lookup this seam performs, exposed for DIAGNOSTICS only.
 *
 * `renderers/basic/icon.tsx` names both halves in its objectui#5631 warning
 * (`lookup: "Home" -> "House"`), and that message is under a maintainer ruling
 * 一字不动. Without this it would need its own copy of the tokeniser and the
 * map to keep saying the same thing — which is precisely the duplication this
 * card removed. ⛔ It decides nothing: no call site can change what resolves by
 * reading it.
 */
export function describeIconLookup(name: string): { pascal: string; key: string } {
  const pascal = toPascalCase(name);
  return { pascal, key: iconNameMap[pascal] || pascal };
}

/**
 * Resolve an authored Lucide icon name to its component.
 *
 * Accepts kebab-case, snake_case, space-separated and PascalCase spellings.
 * Returns `null` when the name is absent or names no live glyph — deciding what
 * to draw instead belongs to the caller (see the module docblock).
 */
export function resolveIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  return (icons as Record<string, LucideIcon>)[describeIconLookup(name).key] ?? null;
}
