/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RelatedRecordActionsContext — host-provided CRUD + action handlers for the
 * child collections ("related lists") rendered on a record DETAIL page.
 *
 * The `record:related_list` renderer (in `@object-ui/plugin-detail`) knows the
 * child object name, the FK back to the parent, and the parent id — but it
 * lives in a low-level package with no access to the console's SPA router, the
 * create/edit form routes, or the per-object CRUD affordances / permissions.
 * Those all live in the app shell.
 *
 * So the host (e.g. `RecordDetailView`) provides this context; the renderer
 * calls {@link RelatedRecordActionsValue.resolve} for its child object and
 * wires whatever handlers come back onto the `RelatedList` (New / Edit / Delete
 * / row-click-to-open, plus the child object's own row actions). A handler that
 * is OMITTED means the capability is unavailable (permission or lifecycle
 * affordance denied, or no host routing) — the related list simply hides that
 * affordance. When no provider is present at all (e.g. the Studio designer, or
 * a standalone embedded renderer) the related list stays read-only, which is
 * the correct graceful fallback.
 */

import React, { createContext, useContext } from 'react';

/** A child-object action surfaced in a related list's row menu. */
export interface RelatedRowActionDef {
  /** Stable action name (matches the object's action metadata). */
  name: string;
  /** Display label (already localized by the host). */
  label?: string;
  /** Lucide icon name (kebab-case). */
  icon?: string;
  /** Visual emphasis for the menu item. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  /** Confirmation prompt shown before the action runs. */
  confirmText?: string;
  /** Any remaining action metadata (target, params, …) is preserved. */
  [k: string]: unknown;
}

/**
 * CRUD + action handlers for a single related list's child object, resolved by
 * the host for a specific child object + parent relationship. Every handler is
 * optional: an omitted handler hides its affordance in the list.
 */
export interface RelatedRecordHandlers {
  /** Open the child record's detail page (查看详情). */
  onView?: (recordId: string | number, record?: unknown) => void;
  /**
   * Open a create form for a new child record. The host pre-links it to the
   * parent (via the relationship field + parent id passed to `resolve`), so no
   * argument is needed here (增).
   */
  onCreate?: () => void;
  /** Open an edit form for an existing child record (改). */
  onEdit?: (recordId: string | number, record?: unknown) => void;
  /**
   * Delete a child record (删). Returns a promise so the list can refresh once
   * the deletion resolves.
   */
  onDelete?: (recordId: string | number, record?: unknown) => void | Promise<void>;
  /** Child object row-level actions (`locations: ['list_item']`), localized. */
  rowActions?: RelatedRowActionDef[];
  /** Execute one of {@link rowActions} against a specific child row. */
  onRowAction?: (action: RelatedRowActionDef, record: unknown) => void | Promise<void>;
}

/** Input to {@link RelatedRecordActionsValue.resolve}. */
export interface ResolveRelatedRecordActionsInput {
  /** Child object machine name (the related list's `api`). */
  objectName: string;
  /** FK field on the child pointing back at the parent record. */
  relationshipField?: string;
  /** Primary-key value of the parent record (used to pre-link new children). */
  parentId?: string | number | null;
}

export interface RelatedRecordActionsValue {
  /**
   * Resolve the CRUD + action handlers for a child object. Implementations
   * should be stable (memoized) so consumers can safely depend on the returned
   * identity.
   */
  resolve: (input: ResolveRelatedRecordActionsInput) => RelatedRecordHandlers;
}

const RelatedRecordActionsContext = createContext<RelatedRecordActionsValue | null>(null);

export const RelatedRecordActionsProvider: React.FC<{
  value: RelatedRecordActionsValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <RelatedRecordActionsContext.Provider value={value}>
    {children}
  </RelatedRecordActionsContext.Provider>
);

/**
 * Consume the host-provided related-record actions. Returns `null` when no
 * host wired the provider (embedded / designer contexts) — callers must treat
 * that as "read-only related list".
 */
export function useRelatedRecordActions(): RelatedRecordActionsValue | null {
  return useContext(RelatedRecordActionsContext);
}
