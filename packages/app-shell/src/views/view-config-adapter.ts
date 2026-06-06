// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * view-config-adapter — bridges the runtime ObjectView's flat view shape and
 * the studio inspector's ViewItem draft shape.
 *
 * The runtime ObjectView keeps the active view as a FLAT NamedListView:
 *
 *   { id, label, type, columns, filter, sort, … }
 *
 * (read from the metadata overlay via the adapter's `listViews`).
 *
 * The studio {@link ViewVariantInspector} authors a canonical ViewItem draft
 * (ADR-0017, "Object has-many View"):
 *
 *   { name, object, viewKind: 'list' | 'form', label, config: { type, … } }
 *
 * where the inspector reads/writes the view BODY under `draft.config` and the
 * bound object additionally lives at `config.data.object` for list views.
 *
 * This adapter converts both ways so the runtime panel can host the studio
 * inspector: edits are kept as a ViewItem draft while the panel is open, then
 * flattened back to the runtime view shape on update / save / create (which
 * persist via the metadata draft/publish model).
 */

/** View `type`s that belong to the FORM family (no column list). */
const FORM_FAMILY_TYPES = new Set(['form', 'detail']);

/** Runtime flat view — the shape ObjectView's `activeView` carries. */
export interface RuntimeView {
  id: string;
  label?: string;
  type?: string;
  columns?: unknown[];
  filter?: unknown[];
  sort?: unknown[];
  [key: string]: unknown;
}

/** Studio ViewItem draft — the shape {@link ViewVariantInspector} consumes. */
export interface InspectorViewDraft {
  name: string;
  object: string;
  viewKind: 'list' | 'form';
  label?: string;
  config: Record<string, unknown>;
}

/** True when a view `type` denotes a form-family view. */
function isFormFamilyType(type: unknown): boolean {
  return typeof type === 'string' && FORM_FAMILY_TYPES.has(type);
}

/**
 * Convert a flat runtime view into a studio inspector draft.
 *
 * The whole flat view is denormalised into `config` (so view-type sub-blocks,
 * filter, sort, toolbar flags, … all round-trip), with the bound object
 * mirrored into `config.data.object` — the list body's render binding the
 * inspector reads first. `id` maps to the draft's `name`; the top-level
 * `object` is the canonical FK both list and form inspectors fall back to.
 */
export function runtimeViewToInspectorDraft(
  activeView: RuntimeView,
  objectName: string,
): InspectorViewDraft {
  const type = (activeView.type as string) || 'grid';
  const viewKind: 'list' | 'form' = isFormFamilyType(type) ? 'form' : 'list';
  const label = activeView.label;
  const existingData =
    activeView.data && typeof activeView.data === 'object'
      ? (activeView.data as Record<string, unknown>)
      : undefined;

  return {
    name: activeView.id,
    object: objectName,
    viewKind,
    label,
    config: {
      ...activeView,
      type,
      label,
      columns: Array.isArray(activeView.columns) ? activeView.columns : [],
      data: { ...existingData, object: objectName },
    },
  };
}

/**
 * Flatten a studio inspector draft back into the runtime flat view the
 * ObjectView save / update / create handlers consume.
 *
 * The inspector-only `data` wrapper is dropped (the runtime view binds its
 * object via `objectName`, not `config.data.object`); everything else in
 * `config` is preserved. `id` is restored from `draft.name`, and the label
 * prefers the canonical top-level value.
 */
export function inspectorDraftToRuntimeView(
  draft: InspectorViewDraft,
): RuntimeView {
  const config = (draft.config ?? {}) as Record<string, unknown>;
  // Drop the inspector-only `data` wrapper; keep every other body field.
  const body = { ...config };
  delete body.data;
  return {
    ...body,
    id: draft.name,
    label: draft.label ?? (config.label as string | undefined),
  };
}
