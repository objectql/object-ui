/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The address value shape, and the ONE formatting rule every address surface
 * renders it with.
 *
 * This module exists because the rule had exactly one implementation and only
 * one consumer could reach it (objectui#4037). `AddressField`'s readonly branch
 * collapsed a stored address to a formatted line, while the display (read)
 * registry the detail page uses mapped `address` straight to `JsonCellRenderer`
 * — so the same stored value rendered as `Street, City, State ZIP, Country` in
 * a readonly form and as `{"street":"…","city":"…"}` on the detail page.
 *
 * The fix keeps ONE definition rather than a second copy next to the renderer:
 * a duplicated rule is a rule that drifts, and two spellings of the same
 * address on two surfaces of one app is the very failure the issue reports.
 *
 * Deliberately pure — no React, no component imports — so the eager
 * `@object-ui/fields` barrel can use it for cell rendering without pulling
 * `AddressField` (and its inputs) out of the lazily-loaded widget chunk.
 */

/**
 * Address data structure — the part names of `@objectstack/spec`'s
 * `AddressSchema`, which is what the platform stores and what
 * `/api/v1/data/**` serves back.
 *
 * The postal code is spelled `postalCode` (objectstack#5143). `AddressField`
 * used to read and write `zipCode`, a key that appears nowhere in the spec, so
 * the stored postal code never reached the input — and whatever the user then
 * typed into that apparently-empty box was written under a key
 * `AddressValueSchema` strips: lost outright on a new record, and on an
 * existing one silently discarded while the stale stored value survived. (A
 * postal code nobody touched did survive an unrelated edit, because the write
 * spread the whole stored object through; the issue's account of that half is
 * corrected in `AddressField.postalCode.test.tsx`.) One name, on both sides:
 * the contract's.
 */
export interface AddressValue {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * The shape written by builds up to and including 17.0.0-rc.1, whose postal
 * code landed under `zipCode` (objectstack#5143). Read-time compatibility ONLY,
 * and deliberately not part of {@link AddressValue}: authoring code must not be
 * able to spell `zipCode`, and nothing here ever writes it back — the first
 * edit of any part normalizes the record onto `postalCode` (see
 * `AddressField`'s `handleFieldChange`). This is not a producer alias to be
 * honoured forever; it exists to carry data THIS widget mis-wrote, and can go
 * once no such data remains.
 */
export type LegacyAddressValue = AddressValue & { zipCode?: string };

/** Postal code of a stored address, preferring the canonical key. */
export function readPostalCode(addr: AddressValue): string | undefined {
  return addr.postalCode ?? (addr as LegacyAddressValue).zipCode;
}

/**
 * One address part, normalized for joining: absent, non-string and
 * whitespace-only parts all collapse to `''` so the caller's `filter(Boolean)`
 * drops them. This is what keeps a partial address free of dangling separators
 * and of the string `undefined`.
 */
function part(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * Formats a stored address as a single line: `Street, City, State ZIP, Country`.
 *
 * Ordering and separators are NOT invented here — they are the rule
 * `AddressField` already applied in its readonly branch, and the sub-field set
 * its inputs expose (street / city / state / postalCode / country). Missing
 * parts are dropped rather than spaced over, so a street-only address is
 * `"中策路 1 号"` and never `", , ,"`.
 *
 * Returns `''` when no part is usable — callers decide what an empty address
 * looks like (an `EmptyValue` placeholder for the cell renderer), and a value
 * carrying no recognized part at all is NOT silently blanked: see
 * `AddressCellRenderer`, which falls back to JSON so unknown data stays visible.
 */
export function formatAddress(addr: AddressValue): string {
  // State and postal code share one comma-delimited group, space-separated
  // inside it ("CA 94102"); either one alone occupies the group by itself.
  const stateAndPostal = [part(addr.state), part(readPostalCode(addr))]
    .filter(Boolean)
    .join(' ');
  return [part(addr.street), part(addr.city), stateAndPostal, part(addr.country)]
    .filter(Boolean)
    .join(', ');
}
