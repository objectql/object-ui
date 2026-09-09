/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Which field kinds the `summaryFields` chip beside the record H1 may draw
 * with the field's OWN cell renderer, and which it may not (objectui#8464).
 *
 * ## Why this set exists at all
 *
 * The chip's display was `String(val)` with four families special-cased, so an
 * object-valued summary field printed the literal `[object Object]` beside the
 * H1 — and, because the chip's accessible name is built from that same string,
 * in its accessible name too. The fix routes such a value through
 * `getCellRenderer`, the way `HeaderHighlight` one band below already does.
 *
 * ⚠️ That route is NOT free, and this set is the measurement that says so. A
 * Badge is a `whitespace-nowrap rounded-full` pill — a much smaller surface
 * than a cell — and 15 of the 53 registered types draw something a pill cannot
 * host. Measured, not assumed: every registered type was rendered through
 * `getCellRenderer` INSIDE the real chip Badge against the object value
 * `{ id: 'acct-1', name: 'Acme Corp' }`, and the DOM inside the pill counted.
 * The instrument is `__tests__/summaryChip.badgeFitCensus-8464.test.tsx`,
 * which re-derives the whole table and fails if this set stops matching it.
 *
 * ## The four measured refusals
 *
 * | class                         | types                                                  | what the pill got                                     |
 * |-------------------------------|--------------------------------------------------------|-------------------------------------------------------|
 * | a pill inside a pill          | `select` `status` `multiselect` `radio` `checkboxes` `tags` | `SelectCellRenderer`'s own `Badge` — one `rounded-full` node nested in the chip's own |
 * | an avatar composite           | `user`                                                  | TWO `rounded-full` nodes (Radix `Avatar.Root` + `AvatarFallback`) and the initials glued onto the name: `ACAcme Corp` |
 * | an image and no text          | `image` `avatar` `signature`                            | an `<img>` and `textContent === ''` — a pill with nothing to say, and nothing for the accessible name |
 * | a "No value" face             | `boolean` `toggle` `datetime` `repeater` (`EmptyValue`), `date` (`formatDate`'s own em-dash, objectui#8581) | the chip is drawn only AFTER `hasCellValue` called the value FILLED; a renderer answering "empty" one band later re-opens exactly the cross-band contradiction objectui#8394 closed |
 *
 * The other 38 types draw plain inline text inside the pill — `Acme Corp` for
 * the nameable families, the JSON literal for `location` / `geolocation` /
 * `address` / `json` / `object` / `composite` / `record` behind objectui#8481's
 * declared json-literal fence, and the value-independent faces (`password`,
 * `secret`, `vector`, `grid`).
 *
 * ## What the refused kinds get instead — NOT a stringifier written here
 *
 * They fall to `coerceToSafeValue`, `@object-ui/fields`' single documented
 * answer to "what text does a cell draw for a value that is not a string".
 * objectui#8596 ruled `select` / `status` / `multiselect` / `radio` /
 * `checkboxes` / `tags` / `user` onto exactly that text for an object value, so
 * for 7 of these 15 the chip is BYTE-EQUAL to its own cell. ⛔ Nothing here
 * invents a renderer-side format (AGENTS.md #0.1): every kind lands either on
 * its own renderer or on the one coercion this repo already had.
 */
export const CHIP_UNFIT_RENDERER_TYPES: ReadonlySet<string> = new Set<string>([
  // a pill inside a pill
  'select',
  'status',
  'multiselect',
  'radio',
  'checkboxes',
  'tags',
  // an avatar composite
  'user',
  // an image and no text
  'image',
  'avatar',
  'signature',
  // a "No value" face for a value the band above called filled
  'boolean',
  'toggle',
  'date',
  'datetime',
  'repeater',
]);

/**
 * May the chip draw `rendererType` with the field's own cell renderer?
 *
 * Takes the type ALREADY resolved through `resolveCellRendererType`, because
 * that is the key `getCellRenderer` dispatches on — asking this question of the
 * authored spelling would answer for a renderer the chip is not about to use.
 */
export function chipTakesCellRenderer(rendererType: string): boolean {
  return !CHIP_UNFIT_RENDERER_TYPES.has(rendererType);
}
