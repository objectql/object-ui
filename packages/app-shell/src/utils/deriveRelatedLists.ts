/**
 * deriveRelatedLists — the read-side mirror of `attachInlineSubforms`.
 *
 * Where `inlineEdit: true` on a child's `master_detail`/`lookup` field pulls
 * that child INTO the parent's entry form (write side), the detail-page
 * RELATED LIST is the read-side counterpart: a child collection surfaced on the
 * parent's record DETAIL page. Both intents live on the relationship in the
 * data model — not in a hand-authored page.
 *
 * This helper scans every object for fields whose `reference`/`reference_to`
 * points back at the parent object and produces one related-list descriptor per
 * eligible FK. The detail page (`RecordDetailView`) feeds these into the
 * `record:related_list` renderers (and the legacy `DetailView.related`).
 *
 * Rules (kept in lockstep with the relationship-level `relatedList` spec flag):
 *   - Owned children (`master_detail`) and `lookup` children are SHOWN by
 *     default. Set `relatedList: false` on the FK field to suppress a noisy
 *     association/audit link; set `relatedList: 'primary'` to mark a CORE
 *     relationship — the detail page promotes it to its own tab (the tab-vs-
 *     Related split is decided downstream in `buildDefaultTabs`).
 *   - `relatedListTitle` / `relatedListColumns` on the FK field override the
 *     derived title / columns (columns default to the child object's own list
 *     columns when omitted — resolved by the renderer).
 *   - Audit FKs (`created_by` / `updated_by` / `owner_id`) are skipped — they
 *     exist on virtually every object and would balloon the detail page into
 *     dozens of duplicate cards.
 *   - ONE related list per eligible FK. A child may point at the parent through
 *     MORE THAN ONE relationship (e.g. `opportunity.primary_account` +
 *     `opportunity.partner_account`); each surfaces as its own list. When a
 *     child appears more than once and gave no explicit `relatedListTitle`, the
 *     FK's label is suffixed to disambiguate ("Opportunity · Partner Account").
 *   - Self-references are allowed (e.g. `account.parent_account` → `account`):
 *     the parent record lists the records whose self-FK points back at it
 *     ("Child Accounts"). Suppress with `relatedList: false` if unwanted.
 *   - Owned (`master_detail`) children are ordered before plain `lookup`
 *     children, preserving discovery order within each group.
 *   - Object-level READ permission gates the whole list (objectui#2359): the
 *     relationship graph says nothing about the CURRENT USER, so callers pass
 *     a `canRead` predicate (wired from `usePermissions().can`) and children
 *     the user cannot read are dropped — no header, no empty grid, no "New"
 *     button that would 403 on save. Data access was always enforced
 *     server-side; this closes the UI/DX gap.
 */

/** Audit/ownership FKs that exist on nearly every object — never related lists. */
const AUDIT_FK_FIELDS = new Set(['created_by', 'updated_by', 'owner_id']);

export interface DerivedRelatedList {
  /** Child object name (the `api` for the related list query). */
  childObject: string;
  /** Best-effort human label for the child object. */
  childLabel: string;
  /** FK field on the child pointing back at this parent. */
  referenceField: string;
  /** Title override from `relatedListTitle` (else derive from the object label). */
  title?: string;
  /** Explicit columns override from `relatedListColumns` (else auto-derived by the renderer). */
  columns?: any[];
  /** True when the child→parent link is a `master_detail` (owned) relationship. */
  isOwned: boolean;
  /**
   * True when the FK declares `relatedList: 'primary'`. A prominence hint
   * (ADR-0085): the detail page promotes this relationship to its OWN tab,
   * while non-primary lists collapse into a single "Related" tab.
   */
  isPrimary: boolean;
}

interface ObjectLike {
  name?: string;
  label?: string;
  fields?: Record<string, any> | any[];
}

/** Normalize an object's `fields` (record or array) into `[name, def]` pairs. */
function fieldEntries(fields: ObjectLike['fields']): Array<[string, any]> {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields
      .filter((f) => f && (f.name != null))
      .map((f) => [String(f.name), f] as [string, any]);
  }
  return Object.entries(fields);
}

export interface DeriveRelatedListsOptions {
  /**
   * Object-level READ gate for the current user (objectui#2359). Return
   * `false` to drop every related list whose child object the user cannot
   * read. Omit (or leave undefined) while permissions are still loading —
   * the derivation then stays purely relationship-driven, so lists never
   * flicker out during the fail-closed loading window.
   */
  canRead?: (objectName: string) => boolean;
}

/**
 * Derive the detail-page related lists for `objectDef` from the full object
 * registry. Returns owned (`master_detail`) children first, then `lookup`
 * children; deterministic and side-effect free (safe to memoize).
 */
export function deriveRelatedLists(
  objectDef: ObjectLike | null | undefined,
  objects: ObjectLike[] | null | undefined,
  options?: DeriveRelatedListsOptions,
): DerivedRelatedList[] {
  if (!objectDef?.name || !Array.isArray(objects) || objects.length === 0) return [];
  const parentName = objectDef.name;

  // Working entries carry the FK label so we can disambiguate multi-FK children
  // after the full sweep; it is stripped from the returned descriptors.
  type Working = DerivedRelatedList & { _fkLabel: string };
  const owned: Working[] = [];
  const referenced: Working[] = [];

  const canRead = options?.canRead;

  for (const child of objects) {
    if (!child?.name) continue;
    // Permission gate: a related list surfaces the CHILD object's records, so
    // it requires read access on the child — the FK's mere existence does not
    // grant the current user anything (objectui#2359).
    if (canRead && !canRead(child.name)) continue;
    for (const [fieldName, fieldDef] of fieldEntries(child.fields)) {
      if (!fieldDef) continue;
      const type = fieldDef.type;
      if (type !== 'lookup' && type !== 'master_detail') continue;
      if ((fieldDef.reference_to || fieldDef.reference) !== parentName) continue;
      if (AUDIT_FK_FIELDS.has(fieldName)) continue;
      // Explicit opt-out lives on the relationship.
      if (fieldDef.relatedList === false) continue;

      const entry: Working = {
        childObject: child.name,
        childLabel: child.label || child.name,
        referenceField: fieldName,
        isOwned: type === 'master_detail',
        isPrimary: fieldDef.relatedList === 'primary',
        _fkLabel: (typeof fieldDef.label === 'string' && fieldDef.label) || fieldName,
        ...(typeof fieldDef.relatedListTitle === 'string' && fieldDef.relatedListTitle
          ? { title: fieldDef.relatedListTitle }
          : {}),
        ...(Array.isArray(fieldDef.relatedListColumns) && fieldDef.relatedListColumns.length > 0
          ? { columns: fieldDef.relatedListColumns }
          : {}),
      };
      // NO `break`: a child object may reference this parent through several FKs.
      (entry.isOwned ? owned : referenced).push(entry);
    }
  }

  const all = [...owned, ...referenced];
  // Multi-FK disambiguation: when a child object points here through more than
  // one relationship and gave no explicit title, suffix the FK label so the two
  // lists are distinguishable (e.g. "Opportunity · Partner Account").
  const counts: Record<string, number> = {};
  for (const r of all) counts[r.childObject] = (counts[r.childObject] || 0) + 1;

  return all.map(({ _fkLabel, ...rest }) => {
    if (!rest.title && counts[rest.childObject] > 1) {
      return { ...rest, title: `${rest.childLabel} · ${_fkLabel}` };
    }
    return rest;
  });
}
