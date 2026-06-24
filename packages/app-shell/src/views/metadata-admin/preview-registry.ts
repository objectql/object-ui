// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataPreviewRegistry — per-type "Preview" tab renderers for the
 * metadata-admin engine.
 *
 * The Preview tab is opt-in: a type only gets a Preview tab when its
 * type id is registered here. This matches the philosophy used for
 * `DesignerTab` and the bespoke `EditPage` in `registry.ts` — generic
 * by default, escape hatch when a type benefits from a richer surface.
 *
 * The renderer receives the **current draft** (not the saved layered
 * record), so users see their unsaved edits live. Drafts can be
 * incomplete or invalid — implementations must defensively read fields.
 *
 *   registerMetadataPreview('page', PagePreview);
 *   const Preview = getMetadataPreview('page');
 *   if (Preview) <Preview type="page" name="crm_welcome" draft={draft} />;
 *
 * If the type isn't registered, the engine simply omits the tab — no
 * empty "preview not available" surface is shown.
 */

import type { ComponentType } from 'react';

/**
 * Identifies a sub-element selected inside a preview surface.
 *
 *   { kind: 'widget', id: 'metric_revenue', label: 'Revenue (KPI)' }
 *
 * `kind` is preview-defined (dashboard uses 'widget'; page may use
 * 'block'; view may use 'column'). The host (`ResourceEditPage`) is
 * agnostic — it only forwards the value to the registered inspector.
 */
export interface MetadataSelection {
  kind: string;
  id: string;
  label?: string;
}

export interface MetadataPreviewProps {
  /** The metadata type, e.g. 'page', 'dashboard'. */
  type: string;
  /** The item's primary-key name. May be empty string in create mode. */
  name: string;
  /**
   * The live draft from the Form tab. Implementations should treat this
   * as immutable and untrusted (validation may be in progress).
   */
  draft: Record<string, unknown>;
  /**
   * Optional: apply a shallow patch to the draft. When omitted, the
   * preview surface is read-only (legacy behavior). When provided, the
   * preview may offer in-place edits (Airtable-style column management,
   * inline rename, etc.) — implementations should respect `editing`
   * before exposing mutating affordances.
   */
  onPatch?: (patch: Record<string, unknown>) => void;
  /**
   * Optional: the last *published* version of this item, for previews
   * that offer a review/diff mode (e.g. the object designer diffing an
   * AI-authored draft against what's live). Undefined in create mode or
   * when no published baseline exists.
   */
  baseline?: Record<string, unknown>;
  /**
   * Optional: whether the host is in edit mode. Previews that ship
   * editing affordances should render them in a disabled/hidden state
   * when `editing === false`.
   */
  editing?: boolean;
  /**
   * Optional: BCP-47 locale code (e.g. 'en', 'zh-CN') for previews that
   * render localized labels. Defaults are derived from the host locale.
   */
  locale?: string;
  /**
   * Optional: the currently selected sub-element (e.g. a dashboard
   * widget). Previews use this to render selection chrome (highlight
   * ring, keyboard focus) and the host uses it to swap the inspector
   * to a scoped sub-form. `null` means "nothing selected → show the
   * top-level form".
   */
  selection?: MetadataSelection | null;
  /**
   * Optional: notify the host that the user picked (or cleared) a
   * sub-element. Pair with {@link MetadataPreviewProps.selection} and
   * a registered inspector (`registerMetadataInspector`) to get the
   * "click widget → edit widget in the right panel" pattern.
   */
  onSelectionChange?: (selection: MetadataSelection | null) => void;
  /**
   * Optional: server-computed validation diagnostics for the current draft
   * (the layered record's `_diagnostics`, kept in sync with live client-side
   * issues). Each entry carries a dotted JSON path so a preview can map it onto
   * the offending sub-element. Used by the flow preview's Problems panel +
   * on-canvas badges; ignored by previews that don't surface diagnostics.
   */
  diagnostics?: Array<{ path?: string; message: string; severity?: 'error' | 'warning' }>;
}

export type MetadataPreview = ComponentType<MetadataPreviewProps>;

const REGISTRY = new Map<string, MetadataPreview>();

/**
 * Register (or replace) the Preview tab renderer for a metadata type.
 * Idempotent — re-registering overwrites the previous entry so app
 * authors can swap implementations from their plugin bootstrap.
 */
export function registerMetadataPreview(type: string, component: MetadataPreview): void {
  REGISTRY.set(type, component);
}

/** Look up the registered preview for a type, if any. */
export function getMetadataPreview(type: string): MetadataPreview | undefined {
  return REGISTRY.get(type);
}

/** Snapshot of registered preview types (diagnostics). */
export function listMetadataPreviewTypes(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}
