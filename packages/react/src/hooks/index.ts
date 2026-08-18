/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from './useExpression.js';
// Session scope for filter placeholders ({current_user_id}/{current_org_id}).
export * from './useFilterScope.js';
export * from './useActionRunner.js';
export * from './useNavigationOverlay.js';
export * from './usePageVariables.js';
export * from './usePageVariableActionBridge.js';
export * from './useViewData.js';
// PageComponentSchema.dataSource — the spec's per-element data binding.
export * from './useElementDataSource.js';
export * from './useDynamicApp.js';
export * from './useDiscovery.js';
export * from './useFocusTrap.js';
export * from './useFocusManagement.js';
export * from './useKeyboardShortcuts.js';
export * from './useCrudShortcuts.js';
export * from './useReducedMotion.js';
export * from './useAnimation.js';
export * from './useDensityMode.js';
export * from './useViewSharing.js';
export * from './useClientNotifications.js';
export * from './useOffline.js';
export * from './usePerformance.js';
export * from './usePerformanceBudget.js';
export * from './usePageTransition.js';
export * from './useViewTransition.js';
export * from './useETagCache.js';
export * from './useSchemaPersistence.js';
export * from './useGlobalUndo.js';
export * from './useDebugMode.js';
export * from './useActionEngine.js';
// The ONE application of `useObjectLabel`'s action resolvers over the three
// authored strings an action carries (label / confirmText / successMessage).
export * from './useActionTextLocalizer.js';
export * from './useCapabilityGate.js';
// The analytics label net's React glue, consumed by BOTH plugin-dashboard's
// `DatasetWidget` and plugin-report's dataset block (objectui#4389). It lives
// here rather than in `@object-ui/core` because it reads `SchemaRendererContext`
// — see the file header for the measured dependency direction.
export * from './useDatasetDimensionLabels.js';
export * from './useDataRefresh.js';
export * from './usePageAssignment.js';
export * from './useRecordSearch.js';
