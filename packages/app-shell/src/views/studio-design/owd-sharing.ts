// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared org-wide-default (OWD) helpers for the Studio authoring surfaces.
 *
 * The per-object Settings tab (`ObjectSettingsPanel`) and the package-level
 * OWD overview (`PackageOwdOverviewPanel`) both edit the SAME record-sharing
 * baseline — `sharingModel` / `externalSharingModel` (ADR-0090 D1/D4/D11).
 * This module is the single home for the pieces they must agree on: the
 * canonical value set, the D11 "external ≤ internal" width comparison, and
 * the master-object derivation used for `controlled_by_parent` rows. Pure and
 * DOM-free, so both surfaces can share one validated implementation.
 */

import { readFields } from '../metadata-admin/previews/object-fields-io.js';

/**
 * The four canonical OWD values (ADR-0090 D4). The legacy `read` / `read_write`
 * / `full` aliases are rejected at authoring time, so authoring surfaces only
 * ever offer these.
 */
export const OWD_MODELS = [
  'private',
  'public_read',
  'public_read_write',
  'controlled_by_parent',
] as const;
export type OwdModel = (typeof OWD_MODELS)[number];

/**
 * Relative WIDTH of the three org-wide-visible models — the D11 axis for
 * "external must never be wider than internal". `controlled_by_parent` is
 * deliberately absent: it delegates the baseline to the master record, so it
 * has no place on the private < read < write ordering (mirrors the
 * comparison ObjectSettingsPanel implemented inline).
 */
export const OWD_WIDTH: Record<string, number> = {
  private: 0,
  public_read: 1,
  public_read_write: 2,
};

/**
 * True when `external` sits WIDER than `internal` on the OWD_WIDTH axis — the
 * ADR-0090 D11 violation the publish linter rejects. Values off the axis
 * (unset, `controlled_by_parent`) never trip it.
 */
export function isExternalWider(
  internal: string | undefined,
  external: string | undefined,
): boolean {
  return (
    !!external &&
    external in OWD_WIDTH &&
    !!internal &&
    internal in OWD_WIDTH &&
    OWD_WIDTH[external] > OWD_WIDTH[internal]
  );
}

/**
 * The master (parent) object a `controlled_by_parent` child inherits its
 * baseline from: the `reference` target of the object's first master-detail
 * field. Returns undefined when the object declares none (an authoring error
 * the lint catches — surfaced here so the overview can still render the row).
 */
export function deriveMasterObject(fields: unknown): string | undefined {
  for (const e of readFields(fields).entries) {
    if ((e.def.type ?? '') === 'master_detail') {
      const ref = e.def.reference;
      if (typeof ref === 'string' && ref) return ref;
    }
  }
  return undefined;
}

/**
 * The OWD baseline a BRAND-NEW object starts from, and the models it can
 * actually choose at creation.
 *
 * `OWD_DEFAULT` is `'private'` because that is what the platform itself
 * treats as the recommended baseline, in two independent places:
 *   - the framework's own minimal create body seeds `sharingModel: 'private'`
 *     (`@objectstack/spec` `kernel/metadata-create-seeds.ts`), on the stated
 *     grounds that the runtime already resolves an absent value to `private`
 *     (fail-closed, ADR-0090 D1) so making it explicit changes no tenant's
 *     effective sharing;
 *   - the `security-owd-unset` rule's own fix-it hint calls `'private'` the
 *     "recommended default".
 * It is a PRE-SELECTED, VISIBLE choice on the create form — not a value
 * written behind the author's back. The ADR's requirement is that the
 * baseline be authored, and an author who sees the control, reads the gloss
 * and accepts the default has authored it.
 *
 * `OWD_CREATE_MODELS` deliberately OMITS `controlled_by_parent`: it derives
 * access from a master relation, and a just-created object has no
 * master-detail field yet, so offering it would trade the `security-owd-unset`
 * publish wall for the `security-controlled-by-parent-no-relation` one. The
 * lint's own hint draws the same line — "If the object has no master, its
 * baseline is its own decision — use sharingModel: 'private' (owner +
 * shares), 'public_read', or 'public_read_write'." The full four-value set
 * stays available in the object's Settings tab, where the object may since
 * have gained the master-detail field that makes the fourth value authorable.
 */
export const OWD_CREATE_MODELS = ['private', 'public_read', 'public_read_write'] as const;
export type OwdCreateModel = (typeof OWD_CREATE_MODELS)[number];

/**
 * Typed as `OwdCreateModel`, not `OwdModel`: the default has to be a value the
 * create surface can actually offer. Widening it to the full four-value set
 * would let a future edit default new objects to `controlled_by_parent`, which
 * a just-created object has no master relation to derive from.
 */
export const OWD_DEFAULT: OwdCreateModel = 'private';
