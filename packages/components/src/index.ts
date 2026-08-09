/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// NOTE: Do NOT `import './index.css'` here.
//
// `index.css` is a standalone Tailwind v4 entry (`@import 'tailwindcss'`).
// In Vite library `build`, that import is extracted to `dist/index.css` and
// dropped from the JS bundle automatically — consumers explicitly load it
// via `@import '@object-ui/components/style.css'` (see README).
//
// In a pnpm monorepo dev server, however, the workspace package is resolved
// to its `src/`, so the import would be evaluated and Vite would inject a
// SECOND, partial Tailwind stylesheet (its `@source` only scans
// `packages/components/src`, missing every other package's classes). That
// second sheet is appended after the app's stylesheet, so any base utility
// it redeclares (e.g. `.inline-flex`) overrides media-query variants from
// the first sheet (e.g. `md:hidden`, `!top-14`) defined elsewhere — silently
// breaking responsive utilities and overrides used by `@object-ui/app-shell`,
// `@object-ui/auth`, etc.
//
// Apps must own the single Tailwind entrypoint and `@source`-scan every
// workspace package they consume (see `examples/console-starter/src/index.css`).
//
// We DO import `sidebar-fixes.css` below: it contains plain CSS overrides
// (no Tailwind directives) for shadcn sidebar utility classes that Tailwind
// v4 cannot compile correctly. Plain CSS is safe to inject from a workspace
// package because it doesn't trigger a second Tailwind build.
import './sidebar-fixes.css';

// Register all ObjectUI renderers (side-effects)
import './renderers'; 

// Export utils
export { cn } from './lib/utils';
export { renderChildren } from './lib/utils';
export { cva } from 'class-variance-authority';
export { getLazyIcon, isLucideIconName, LazyIcon, toKebabIconName } from './lib/lazy-icon';

// The member-action visibility gate — "did this action DECLARE a `visible` gate
// at all?", the single definition objectui#3492 established and PR #3816 /
// #3825 / #3836 applied to every member-action gate in this package and in
// `plugin-grid`. Since objectui#3850 the answer is "normalization still leaves a
// condition to evaluate" (so an empty-`source` envelope is NOT a gate, where the
// older `!= null && !== ''` counted every object), and this name is a re-export
// of core's one definition, `hasDeclaredPredicate`.
//
// Exported because the family has a member OUTSIDE these packages: app-shell's
// `DeclaredActionsBar` mounts an object's server-declared actions as plain JSX
// (no `SchemaRenderer` in front, so its own gate is the only one on that path),
// and asked truthiness — `visible: false` rendered a live Approve/Reject button
// (objectui#3835). A re-export, not a copy: five gates in three packages asking
// one question must not drift into five answers, which is exactly the shape
// objectui#3142 had to unpick for `locations` in these same files. app-shell
// already depends on this package, so the direction costs nothing new.
export { hasDeclaredVisibilityGate } from './renderers/action/visibility-gate';

// Export placeholder registration
export { registerPlaceholders } from './renderers/placeholders';

// Export grid field-authoring context — a design surface (Studio) opts into the
// data-table "+ add field" column header by wrapping the table in the provider.
export {
  GridFieldAuthoringProvider,
  useGridFieldAuthoring,
  type GridFieldAuthoring,
} from './context/gridFieldAuthoring';

// Export raw Shadcn UI components
export * from './ui';
export * from './custom';

// Export the notification surfaces — one per spec `displayType` (#3014).
export * from './notifications';
// Spec position → sonner position ids, shared with the console's toast bridge.
export { TOASTER_POSITIONS } from './renderers/feedback/toaster';

// Export hooks
export { useConfigDraft } from './hooks/use-config-draft';
export type { UseConfigDraftOptions, UseConfigDraftReturn } from './hooks/use-config-draft';
export { useIsMobile } from './hooks/use-mobile';
export { useResizeObserver } from './hooks/use-resize-observer';
export type { ElementSize } from './hooks/use-resize-observer';
export { useExportJob } from './hooks/use-export-job';
export type { UseExportJobOptions, UseExportJobReturn } from './hooks/use-export-job';
export { useRelatedCount, useRelatedCountVersion, RelatedCountStore } from './hooks/related-count-store';

// Export config panel types
export type {
  ControlType,
  ConfigField,
  ConfigSection,
  ConfigPanelSchema,
} from './types/config-panel';

// Export an init function to ensure components are registered
// This is a workaround for bundlers that might tree-shake side-effect imports
export function initializeComponents() {
  // This function exists to ensure the import side-effects above are executed
  // Simply importing this module should register all components
  return true;
}

// Debug panel (tree-shakeable — only included when imported)
export * from './debug';

// Platform share-link dialog (Notion / Figma-style "anyone with the link")
export * from './share';
