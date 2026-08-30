/**
 * @object-ui/app-shell
 *
 * Minimal Application Shell for ObjectUI
 * Framework-agnostic rendering engine for third-party integration
 */

// Components
export { AppShell } from './components/AppShell.js';

// Providers
export { AdapterProvider, useAdapter } from './providers/AdapterProvider.js';
export { MetadataProvider, useMetadata, useMetadataItem } from './providers/MetadataProvider.js';
export { ExpressionProvider, useExpressionContext, evaluateVisibility } from './providers/ExpressionProvider.js';
/**
 * The `user` normalisation `ExpressionProvider` is fed with — exported so every
 * console surface that mounts the provider publishes the SAME `current_user`
 * shape (objectui#6110). It supplies the defaults a predicate needs in order to
 * evaluate to FALSE rather than FAULT: an absent `positions` makes
 * `'x' in current_user.positions` an unbound-key fault, which fails OPEN, so a
 * second mount site re-deriving this by hand would reintroduce exactly the
 * asymmetry #6010's parity pin exists to refuse.
 *
 * objectui#6515 — that is exactly what `RecordFormPage` did, because the
 * normaliser used to live in `console/AppContent.js` and the view is
 * `lazy()`-loaded BY that module. The specifier below moved to the leaf module
 * beside the provider it feeds; the NAME published from this entry did not.
 * `console/AppContent.js` re-exports it too, for importers already reaching it
 * there.
 */
export { buildExpressionUser } from './providers/expressionUser.js';

// Hooks
export { useObjectActions } from './hooks/useObjectActions.js';
export { useUrlOverlay } from './hooks/useUrlOverlay.js';
export type { UseUrlOverlayOptions, UrlOverlayControls } from './hooks/useUrlOverlay.js';
export { useSettleSignal } from './hooks/useSettleSignal.js';
export type { SettleSignalState } from './hooks/useSettleSignal.js';
export {
  getPendingRequests,
  isIdle,
  subscribeSettle,
  whenIdle,
  withSettleSignal,
  installSettleSignalGlobal,
  type ObjectUiGlobal,
} from './observability/settleSignal.js';
export { useRecentItems } from './hooks/useRecentItems.js';

// Types
export type {
  AppShellProps,
} from './types.js';

export type {
  MetadataCacheState,
  MetadataContextValue,
  MetadataTypeStatus,
} from './providers/MetadataProvider.js';

export type {
  ExpressionContextValue,
} from './providers/ExpressionProvider.js';

export type {
  RecentItem,
} from './hooks/useRecentItems.js';

// Console building blocks — compose these in your App.tsx to build the console
// routing tree. See examples/console-starter/src/App.tsx for a minimal example.
export {
  ConsoleShell,
  ConnectedShell,
  RequireOrganization,
  RequireAiSurface,
  AuthenticatedRoute,
  RootRedirect,
  SystemRedirect,
  // objectui#2794 — the stable `/setup` deep link into platform administration,
  // plus the pure policy behind it and the identifiers it resolves by.
  SetupRedirect,
  resolveSetupAppPath,
  SETUP_APP_PACKAGE_ID,
  SETUP_APP_NAME,
  LoadingFallback,
} from './console/ConsoleShell.js';

// Host-app route policy (ADR-0048) — which app's `/apps/<segment>/…` URL a
// framework-owned, app-INDEPENDENT page should build, and the two predicates it
// is defined in terms of. Published from the package root (objectui#4280)
// because the resolution order in `resolveHostAppSegment`'s docblock is one
// hard-won definition, and a consumer that cannot import it re-derives it: the
// console shipped a documented copy of steps 1–2 for exactly this reason
// (objectui#4109 / PR #4279), which is the "two readers of one prose contract"
// shape #3367 / #3842 record. `./utils/appRoute` is the contract.
export { resolveHostAppSegment, appRouteSegment, filterActiveApps } from './utils/index.js';
// objectui#5178 — the Approval Center's timeline reads the same `via_override`
// verdict the record page's approval panel does.
export {
  isOverrideOnlyViewer,
  actionAdmittedByOverride,
  isOverrideDecision,
  bypassedApproverNames,
  isViaOverrideRow,
} from './utils/index.js';

// Runtime AI-availability signal — the single source of truth every AI entry
// point gates on (FAB, /ai routes, designer "Ask AI"). Server-pushed, no
// build-time edition flag. See ./hooks/useAiSurface.
export { useAiSurfaceEnabled } from './hooks/useAiSurface.js';
export type { AiSurfaceState } from './hooks/useAiSurface.js';

// Layout chrome
export {
  ConsoleLayout,
  ConsoleNotificationBanners,
  AppHeader,
  AppSidebar, // @deprecated — use UnifiedSidebar; see AppSidebar's own JSDoc (objectui#5720, objectui#5817)
  UnifiedSidebar,
  AppSwitcher,
  ConnectionStatus,
  ActivityFeed,
  LocaleSwitcher,
  ModeToggle,
  PreviewBadge,
  AuthPageLayout,
} from './layout/index.js';
export type { ActivityItem, PreviewBadgeProps } from './layout/index.js';

// Top-level chrome (dialogs, providers, error boundaries)
export {
  CommandPalette,
  KeyboardShortcutsDialog,
  OnboardingWalkthrough,
  ConditionalAuthWrapper,
  ConsoleToaster,
  presentNotificationToast,
  RouteFader,
  RedirectWithSplash,
  type RedirectWithSplashProps,
  toastWithUndo,
  type ToastWithUndoOptions,
  ErrorBoundary,
  LoadingScreen,
  ThemeProvider,
  useTheme,
} from './chrome/index.js';

// Observability — Sentry integration, configured by the runtime on
// `/api/v1/runtime/config` (objectstack#12681). No build-time DSN.
export { initSentry, captureError, setSentryUser, getSentry } from './observability/index.js';

// Runtime configuration pushed by the server at boot. Consumers fetch
// `/api/v1/runtime/config` via `initRuntimeConfig()` before first render
// and read upstream cloud URL + capability flags from `getRuntimeConfig()`.
export {
  initRuntimeConfig,
  getRuntimeConfig,
  getCloudBase,
  getProductName,
  getProductShortName,
  getPlatformStage,
  getBrandColor,
  getLogoUrl,
  getFaviconUrl,
  getPwaDescription,
  getPwaThemeColor,
  isRuntimeConfigInitialised,
  // The fail-closed reading of the runtime's client error-reporting sink.
  // Exported so no consumer has to write its own `?.` chain against the
  // payload — one loose truthiness dialect is all it takes to re-open
  // objectui#5522. (Replaces `isClientErrorReportingAllowed`, removed with the
  // permission boolean it read — objectstack#12681.)
  getClientErrorReporting,
  resetRuntimeConfigForTesting,
} from './runtime-config.js';
export type {
  AppShellRuntimeConfig,
  RuntimeFeatures,
  RuntimeBranding,
  RuntimeTelemetry,
  RuntimeClientErrorReporting,
  PlatformStage,
} from './runtime-config.js';

// Standard inner-SPA views
export {
  ObjectView,
  RecordDetailView,
  RecordFormPage,
  DashboardView,
  PageView,
  ReportView,
  SearchResultsPage,
  ViewConfigPanel,
  DeclaredActionsBar,
  FlowRunner,
} from './views/index.js';
export type {
  RecordFormPageProps,
  DeclaredActionsBarProps,
  FlowRunnerProps,
  ScreenFlowState,
  ScreenSpec,
  ScreenFieldSpec,
} from './views/index.js';

// Hooks
export {
  useFavorites,
  useMetadataService,
  useNavActionDispatch,
  useNavPins,
  useNavigationSync,
  NavigationSyncEffect,
  addNavigationItem,
  removeNavigationItems,
  renameNavigationItems,
  navigationEqual,
  generateNavId,
  useResponsiveSidebar,
  useActionModal,
} from './hooks/index.js';
export type { FavoriteItem } from './hooks/index.js';

// Context providers
export {
  NavigationProvider,
  useNavigationContext,
  FavoritesProvider,
  RecentItemsProvider,
  CommandPaletteProvider,
  useCommandPalette,
  UserStateAdaptersProvider,
  useUserStateAdapter,
  useAttachUserStateAdapters,
} from './context/index.js';
export type { UserDataAdapter, UserStateKind, CommandPaletteContextValue } from './context/index.js';

// Default page implementations (consumers can partial-override slots)
export { AppContent as DefaultAppContent } from './console/AppContent.js';
export { MarketplacePage } from './console/marketplace/MarketplacePage.js';
export { MarketplacePackagePage } from './console/marketplace/MarketplacePackagePage.js';
export { MarketplaceInstalledPage } from './console/marketplace/MarketplaceInstalledPage.js';
export { LoginPage as DefaultLoginPage } from './console/auth/LoginPage.js';
export { RegisterPage as DefaultRegisterPage } from './console/auth/RegisterPage.js';
export { ForgotPasswordPage as DefaultForgotPasswordPage } from './console/auth/ForgotPasswordPage.js';
export { HomeLayout as DefaultHomeLayout, HomeLayout } from './console/home/HomeLayout.js';
export { HomePage as DefaultHomePage, HomePage } from './console/home/HomePage.js';
export { OrganizationsLayout as DefaultOrganizationsLayout } from './console/organizations/OrganizationsLayout.js';
export { OrganizationsPage as DefaultOrganizationsPage } from './console/organizations/OrganizationsPage.js';

export { OrganizationLayout as DefaultOrganizationLayout } from './console/organizations/manage/OrganizationLayout.js';
export { MembersPage as DefaultMembersPage } from './console/organizations/manage/MembersPage.js';
export { InvitationsPage as DefaultInvitationsPage } from './console/organizations/manage/InvitationsPage.js';
export { SettingsPage as DefaultSettingsPage } from './console/organizations/manage/SettingsPage.js';
export { AcceptInvitationPage as DefaultAcceptInvitationPage } from './console/organizations/manage/AcceptInvitationPage.js';
export {
  AiChatPage as DefaultAiChatPage,
  AiChatPage,
  hydratedMessagesToChatMessages,
} from './console/ai/AiChatPage.js';
export { ConversationsSidebar } from './console/ai/ConversationsSidebar.js';
// Conversation-history hydration helpers — reused by the public read-only
// share page (`/s/:token`) so a shared transcript renders identically to the
// live chat (tool cards included) instead of dumping raw envelopes.
export {
  toUIMessages,
  aiMessageRowsToServerMessages,
  type HydratedUIMessage,
  type RawAiMessageRow,
} from './hooks/useChatConversation.js';

// Phase 3b: Component nav registry — plugins use this to register
// admin/setup UI surfaces that are addressable from App metadata via
// `{ type: 'component', componentRef: 'ns:name' }` nav items.
export {
  registerAppComponent,
  getAppComponent,
  listAppComponents,
  componentRefToUrlSegments,
  urlSegmentsToComponentRef,
} from './services/componentRegistry.js';
export type { AppComponentRegistryEntry } from './services/componentRegistry.js';
// Side-effect import: registers built-in admin components
// (metadata:directory, metadata:resource) at module load.
import './services/builtinComponents.js';
// SDUI widget for the metadata-driven Cloud Connection page (cloud ADR-0008).
import './console/cloud-connection/CloudConnectionPanel.js';
import './console/marketplace/InstalledListWidget.js';
import './console/connect/ConnectAgentWidget.js';
// SDUI widget for the Cloud Welcome page's state-aware onboarding next-step.
import './console/home/CloudOnboardingNext.js';
// SDUI widget: read-only admin diagnostic for the env's effective AI model
// (cloud#797) — fetches GET /api/v1/ai/effective-model.
import './console/diagnostics/CloudAiModelStatus.js';
// `record:attachments` — schema-addressable Attachments panel referenced by
// synthesized record pages when `enable.files: true` (objectstack#4358).
import './views/record-attachments-renderer.js';
// `record:approvals` — schema-addressable approval panel referenced by
// synthesized record pages when the record has approval requests (#3461).
import './views/record-approvals-renderer.js';
// `global:search` / `global:notifications` — the two spec `PageComponentType`
// members the 2026-08-26 ruling on objectstack#12183 kept declared because both
// data sources shipped (objectui#6757). Registered here, not in
// `@object-ui/components`, because they read this package's providers and feeds;
// without these two imports an authored page draws the "Component Placeholder"
// scaffold for `global:search` and a red unknown-type panel for
// `global:notifications`.
import './views/global-search-renderer.js';
import './views/global-notifications-renderer.js';
// The metadata-admin engine's five load-time registrations (built-in anchors,
// default JSONSchemas, the datasource resource, built-in previews, built-in
// inspectors). objectui#6776 moved them OUT of `views/metadata-admin/index.ts`
// into this leaf so the page barrel became shakeable; the bare import lives
// HERE, on the package entry, and must not be moved onto the page barrel —
// `scripts/vite-declared-lazy-views.ts` reads a bare import as "this module is
// not pure" and the whole eager closure comes back. See the leaf's own header.
import './views/metadata-admin/register-builtins.js';

// Phase 3c — generic metadata admin engine. Re-exported so plugins
// can call `registerMetadataResource()` to override the per-type
// list / edit / create components, and host apps can compose the
// page primitives directly when needed.
//
// ⚠️ These 25 runtime re-exports name the LEAF modules, never
// `./views/metadata-admin/index.js` (objectui#6776). The names and their types
// are unchanged — an out-of-package consumer imports exactly what it imported
// before — but a named re-export is an ordinary STATIC EDGE, and the console's
// entry imports this barrel, so pointing them at the page barrel made that
// barrel (and every page, preview and inspector it reaches) eager on every
// console page load, past the six `lazy()` declarations `AppContent` writes for
// it. The 11 TYPE-ONLY re-exports below are erased at build and carry no edge;
// they are grouped separately for that reason and not because they are less
// public.
export { MetadataDirectoryPage } from './views/metadata-admin/DirectoryPage.js';
export { MetadataResourceRouter } from './views/metadata-admin/ResourceRouter.js';
export { MetadataResourceListPage } from './views/metadata-admin/ResourceListPage.js';
export { MetadataResourceEditPage } from './views/metadata-admin/ResourceEditPage.js';
export { MetadataResourceHistoryPage } from './views/metadata-admin/ResourceHistoryPage.js';
export { MetadataDiagnosticsPage } from './views/metadata-admin/DiagnosticsPage.js';
export { MetadataQuickFind } from './views/metadata-admin/QuickFind.js';
export { PageShell as MetadataPageShell } from './views/metadata-admin/PageShell.js';
export { SchemaForm } from './views/metadata-admin/SchemaForm.js';
export { LayeredDiff } from './views/metadata-admin/LayeredDiff.js';
export {
  registerMetadataResource,
  getMetadataResource,
  listMetadataResources,
  resolveResourceConfig,
} from './views/metadata-admin/registry.js';
export {
  useMetadataClient,
  useMetadataTypes,
  useTypesIndex,
  useGlobalDiagnostics,
  matchesQuery,
} from './views/metadata-admin/useMetadata.js';
export {
  registerMetadataPreview,
  getMetadataPreview,
  listMetadataPreviewTypes,
} from './views/metadata-admin/preview-registry.js';
export {
  registerMetadataInspector,
  getMetadataInspector,
  listMetadataInspectorTypes,
} from './views/metadata-admin/inspector-registry.js';
export type {
  MetadataResourceConfig,
  MetadataDomain,
} from './views/metadata-admin/registry.js';
export type { RichMetadataTypeEntry } from './views/metadata-admin/useMetadata.js';
export type {
  MetadataPreview,
  MetadataPreviewProps,
  MetadataSelection,
} from './views/metadata-admin/preview-registry.js';
export type {
  MetadataInspector,
  MetadataInspectorProps,
} from './views/metadata-admin/inspector-registry.js';
// The form authoring surface, in ONE declaration per layer: the field
// (objectui#5040 / #5542) and the two containers above it (objectui#5596).
// `apps/console` renders the same authored `FormView` documents this package's
// metadata-admin does; before it could import these names it kept its own
// hand-written copies of all three shapes. See the note on the re-export in
// `views/metadata-admin/index.ts`.
export type {
  FormFieldSpec,
  FormSectionSpec,
  FormViewSpec,
} from './views/metadata-admin/form-spec.js';

// Studio WYSIWYG design surface (ADR-0080) — the open-source design surface.
// The left AI copilot is an injected `aiSlot`; OSS renders three zones.
export {
  StudioDesignSurface,
  type StudioDesignSurfaceProps,
} from './views/studio-design/StudioDesignSurface.js';
// Per-type canvas renderers for the Studio design surface. Register an override
// (e.g. a custom `object` records surface) without forking StudioDesignSurface.
export {
  registerStudioCanvasPreview,
  getStudioCanvasPreview,
  listStudioCanvasPreviewTypes,
  StudioObjectRecordsCanvas,
} from './views/studio-design/studio-canvas-preview.js';
export type {
  StudioCanvasPreview,
  StudioCanvasPreviewProps,
} from './views/studio-design/studio-canvas-preview.js';
// The builder's front door: pick/create a writable package → pillar builder.
// Standalone at `/studio` and embedded via the `studio:builder` component ref.
export { BuilderLanding } from './views/studio-design/BuilderLanding.js';

// Setup › Packaged automation (ADR-0126 §7.4) — on/off + clone for the flows
// installed packages ship. Reached through the `automation:packaged` component
// ref registered in `services/builtinComponents`; exported so a host app can
// compose the page directly.
export { PackagedAutomationPage } from './views/setup/PackagedAutomationPage.js';

// AI assistant bus — connects the metadata designers to the global chat.
export {
  assistantBus,
  useAssistant,
  useRegisterAssistantEditor,
  requestAssistantOpen,
} from './assistant/assistantBus.js';
export type {
  AssistantSnapshot,
  AssistantEditorContext,
  AssistantEditorField,
} from './assistant/assistantBus.js';
export { RemediationOverlay } from './console/RemediationOverlay.js';
