/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from './useExpression';
// Session scope for filter placeholders ({current_user_id}/{current_org_id}).
export * from './useFilterScope';
export * from './useActionRunner';
export * from './useNavigationOverlay';
export * from './usePageVariables';
export * from './usePageVariableActionBridge';
export * from './useViewData';
// PageComponentSchema.dataSource — the spec's per-element data binding.
export * from './useElementDataSource';
export * from './useDynamicApp';
export * from './useDiscovery';
export * from './useFocusTrap';
export * from './useFocusManagement';
export * from './useKeyboardShortcuts';
export * from './useCrudShortcuts';
export * from './useReducedMotion';
export * from './useAnimation';
export * from './useDensityMode';
export * from './useViewSharing';
export * from './useClientNotifications';
export * from './useOffline';
export * from './usePerformance';
export * from './usePerformanceBudget';
export * from './usePageTransition';
export * from './useViewTransition';
export * from './useETagCache';
export * from './useSchemaPersistence';
export * from './useGlobalUndo';
export * from './useDebugMode';
export * from './useActionEngine';
// The ONE application of `useObjectLabel`'s action resolvers over the three
// authored strings an action carries (label / confirmText / successMessage).
export * from './useActionTextLocalizer';
export * from './useCapabilityGate';
// The analytics label net's React glue, consumed by BOTH plugin-dashboard's
// `DatasetWidget` and plugin-report's dataset block (objectui#4389). It lives
// here rather than in `@object-ui/core` because it reads `SchemaRendererContext`
// — see the file header for the measured dependency direction.
export * from './useDatasetDimensionLabels';
export * from './useDataRefresh';
export * from './usePageAssignment';
export * from './useRecordSearch';
