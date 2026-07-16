// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * StudioCanvasPreviewRegistry — per-type canvas renderers for the Studio
 * design surface.
 *
 * Why a *second* registry alongside `MetadataPreviewRegistry`
 * (`../metadata-admin/preview-registry`): the SAME metadata type is rendered
 * differently depending on the SURFACE it appears in. An `object` in the Data
 * pillar (metadata-admin) is the field-form DESIGNER (`ObjectPreview` →
 * `ObjectFormCanvas`); an `object` in the Studio design canvas is the runtime
 * records GRID — schema editing belongs to the Data pillar, so the app-builder
 * canvas shows objects as the running app does, not a field editor.
 *
 * A single type-keyed registry can't express that `(type, surface)` split,
 * which is why the object branch used to be a hardcoded special-case inside
 * `StudioDesignSurface`. This registry is the missing surface dimension, scoped
 * to the Studio canvas: a sensible default is registered for `object` (below),
 * and downstream apps/plugins override it via `registerStudioCanvasPreview()`
 * without forking `StudioDesignSurface`.
 *
 * Resolution contract: if a type has no studio-canvas entry,
 * `getStudioCanvasPreview()` returns `undefined` and the surface falls back to
 * the generic `MetadataPreview` pipeline (`getMetadataPreview`) like every
 * other type. So this registry is purely additive — it only intercepts types
 * that opt in.
 *
 * NOTE (long-term): today only `object` needs a surface-specific override. If a
 * second surface ever needs per-type overrides, prefer folding this into a
 * `(type, surface)`-keyed lookup on the existing MetadataPreviewRegistry rather
 * than growing a third parallel registry.
 */

import * as React from 'react';
import { SchemaRenderer } from '@object-ui/react';

/**
 * Props handed to a Studio-canvas renderer. Intentionally a small, read-only
 * subset of {@link MetadataPreviewProps}: the Studio canvas renders objects as
 * a runtime surface, not an editable draft (schema editing is the Data
 * pillar's job), so there is no `onPatch`/`selection` here.
 */
export interface StudioCanvasPreviewProps {
  /** The metadata type, e.g. 'object'. */
  type: string;
  /** The item's primary-key name (e.g. the object's API name). */
  name: string;
  /**
   * The live draft from the design surface. Treat as immutable and untrusted
   * (validation may be in progress). Provided for renderers that need config
   * beyond the name; the default object renderer only needs `name`.
   */
  draft: Record<string, unknown>;
  /** Optional BCP-47 locale code (e.g. 'en', 'zh-CN') for localized labels. */
  locale?: string;
}

export type StudioCanvasPreview = React.ComponentType<StudioCanvasPreviewProps>;

const REGISTRY = new Map<string, StudioCanvasPreview>();

/**
 * Register (or replace) the Studio-canvas renderer for a metadata type.
 * Idempotent and last-write-wins, so an app can swap the default from its
 * plugin bootstrap.
 */
export function registerStudioCanvasPreview(type: string, component: StudioCanvasPreview): void {
  REGISTRY.set(type, component);
}

/** Look up the registered Studio-canvas renderer for a type, if any. */
export function getStudioCanvasPreview(type: string): StudioCanvasPreview | undefined {
  return REGISTRY.get(type);
}

/** Snapshot of registered Studio-canvas types (diagnostics/tests). */
export function listStudioCanvasPreviewTypes(): string[] {
  return Array.from(REGISTRY.keys()).sort();
}

/**
 * Default Studio-canvas renderer for `object` leaves: the runtime records grid,
 * exactly as the running app shows it (preview = runtime). Schema editing lives
 * in the Data pillar, so this is the object-view grid — NOT the field-form
 * designer that is the `object` entry in the MetadataPreviewRegistry.
 *
 * Exported so downstream renderers can compose/wrap it; override the default
 * wholesale via `registerStudioCanvasPreview('object', …)`.
 */
export function StudioObjectRecordsCanvas({ name }: StudioCanvasPreviewProps) {
  return <SchemaRenderer schema={{ type: 'object-view', objectName: name } as never} />;
}

// Side-effect: register the built-in defaults. Kept inline (rather than a
// separate `previews/` folder like metadata-admin) because there is exactly one
// default; downstream overrides run after this module loads and win.
registerStudioCanvasPreview('object', StudioObjectRecordsCanvas);
