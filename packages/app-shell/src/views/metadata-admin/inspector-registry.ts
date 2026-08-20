// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * MetadataInspectorRegistry — per-type "scoped sub-form" renderers.
 *
 * The inspector is the right-side property panel of the split editor.
 * By default, the inspector renders the generic `SchemaForm` bound to
 * the entire draft. When a type registers an inspector here AND the
 * preview emits a {@link MetadataSelection}, the host swaps the
 * generic form for the registered component so the user edits the
 * *selected sub-element* (e.g. one dashboard widget) instead of the
 * top-level metadata.
 *
 * Clearing the selection (Esc key, click background) drops back to
 * the generic form automatically.
 *
 * Example:
 *
 *   registerMetadataInspector('dashboard', DashboardWidgetInspector);
 *   // → preview emits onSelectionChange({kind:'widget', id:'kpi_1'})
 *   // → host renders <DashboardWidgetInspector ... /> on the right
 */
import type { ComponentType } from 'react';
import type { MetadataSelection } from './preview-registry.js';
import type { SupportedLocale } from './i18n.js';

export interface MetadataInspectorProps {
  /** Metadata type, e.g. 'dashboard'. */
  type: string;
  /** Item primary-key name (may be empty in create mode). */
  name: string;
  /** Current draft from the editor. Treat as immutable. */
  draft: Record<string, unknown>;
  /** The selection emitted by the matching preview. Never null here. */
  selection: MetadataSelection;
  /** Apply a shallow patch to the draft. */
  onPatch: (patch: Record<string, unknown>) => void;
  /** Clear the selection (returns the inspector to the top-level form). */
  onClearSelection: () => void;
  /**
   * Replace the current selection. Used by reorder buttons to follow
   * the moved item to its new index, and by other inspector affordances
   * that need to redirect the focused sub-element.
   */
  onSelectionChange?: (next: MetadataSelection | null) => void;
  /**
   * Report how many BLOCKING author-time issues the inspector is currently
   * showing — e.g. a CEL expression that does not parse (objectui#4306).
   *
   * The host owns Save, so only the host can refuse to write; an inspector that
   * renders a fault it cannot act on is how a malformed formula got saved and
   * published as the live field definition. Fires whenever the aggregate
   * changes, `0` when everything is clean.
   *
   * Optional — an inspector with nothing to block on simply never calls it.
   * Hosts must reset their own count when the selection changes or the
   * inspector unmounts rather than waiting for a final `0`, since a component
   * that has gone away cannot report anything.
   */
  onBlockingIssuesChange?: (count: number) => void;
  /** Whether the host is in edit mode. False → disable inputs. */
  readOnly: boolean;
  /** Active UI locale for i18n. */
  locale: SupportedLocale;
}

export type MetadataInspector = ComponentType<MetadataInspectorProps>;

const REGISTRY = new Map<string, MetadataInspector>();

export function registerMetadataInspector(
  type: string,
  component: MetadataInspector,
): void {
  REGISTRY.set(type, component);
}

export function getMetadataInspector(type: string): MetadataInspector | undefined {
  return REGISTRY.get(type);
}

export function listMetadataInspectorTypes(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}
