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
 * child collection. The detail page (`RecordDetailView`) feeds these into the
 * `record:related_list` renderers (and the legacy `DetailView.related`).
 *
 * Rules (kept in lockstep with the relationship-level `relatedList` spec flag):
 *   - Owned children (`master_detail`) and `lookup` children are SHOWN by
 *     default. Set `relatedList: false` on the FK field to suppress a noisy
 *     association/audit link.
 *   - `relatedListTitle` / `relatedListColumns` on the FK field override the
 *     derived title / columns.
 *   - Audit FKs (`created_by` / `updated_by` / `owner_id`) are skipped — they
 *     exist on virtually every object and would balloon the detail page into
 *     dozens of duplicate cards.
 *   - One related list per child object (deduped by child object name): the
 *     first non-audit, non-suppressed FK wins.
 *   - Owned (`master_detail`) children are ordered before plain `lookup`
 *     children, preserving discovery order within each group.
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

/**
 * Derive the detail-page related lists for `objectDef` from the full object
 * registry. Returns owned (`master_detail`) children first, then `lookup`
 * children; deterministic and side-effect free (safe to memoize).
 */
export function deriveRelatedLists(
  objectDef: ObjectLike | null | undefined,
  objects: ObjectLike[] | null | undefined,
): DerivedRelatedList[] {
  if (!objectDef?.name || !Array.isArray(objects) || objects.length === 0) return [];
  const parentName = objectDef.name;
  const owned: DerivedRelatedList[] = [];
  const referenced: DerivedRelatedList[] = [];
  const seenChild = new Set<string>();

  for (const child of objects) {
    if (!child?.name || child.name === parentName) continue;
    for (const [fieldName, fieldDef] of fieldEntries(child.fields)) {
      if (!fieldDef) continue;
      const type = fieldDef.type;
      if (type !== 'lookup' && type !== 'master_detail') continue;
      if ((fieldDef.reference_to || fieldDef.reference) !== parentName) continue;
      if (AUDIT_FK_FIELDS.has(fieldName)) continue;
      // Explicit opt-out lives on the relationship.
      if (fieldDef.relatedList === false) continue;
      // One related list per child object — the first eligible FK wins.
      if (seenChild.has(child.name)) continue;
      seenChild.add(child.name);

      const entry: DerivedRelatedList = {
        childObject: child.name,
        childLabel: child.label || child.name,
        referenceField: fieldName,
        isOwned: type === 'master_detail',
        ...(typeof fieldDef.relatedListTitle === 'string' && fieldDef.relatedListTitle
          ? { title: fieldDef.relatedListTitle }
          : {}),
        ...(Array.isArray(fieldDef.relatedListColumns) && fieldDef.relatedListColumns.length > 0
          ? { columns: fieldDef.relatedListColumns }
          : {}),
      };
      (entry.isOwned ? owned : referenced).push(entry);
      break; // move on to the next child object
    }
  }

  return [...owned, ...referenced];
}
