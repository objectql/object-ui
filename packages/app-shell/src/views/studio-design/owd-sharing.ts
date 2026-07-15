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

import { readFields } from '../metadata-admin/previews/object-fields-io';

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
