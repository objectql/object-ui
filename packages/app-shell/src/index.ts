/**
 * @object-ui/app-shell
 *
 * Minimal Application Shell for ObjectUI
 * Framework-agnostic rendering engine for third-party integration
 */

// Components
export { AppShell } from './components/AppShell';

// Providers
export { AdapterProvider, useAdapter } from './providers/AdapterProvider';
export { MetadataProvider, useMetadata, useMetadataItem } from './providers/MetadataProvider';
export { ExpressionProvider, useExpressionContext, evaluateVisibility } from './providers/ExpressionProvider';

// Hooks
export { useObjectActions } from './hooks/useObjectActions';
export { useUrlOverlay } from './hooks/useUrlOverlay';
export type { UseUrlOverlayOptions, UrlOverlayControls } from './hooks/useUrlOverlay';
export { useSettleSignal } from './hooks/useSettleSignal';
export type { SettleSignalState } from './hooks/useSettleSignal';
export {
  getPendingRequests,
  isIdle,
  subscribeSettle,
  whenIdle,
  withSettleSignal,
  installSettleSignalGlobal,
  type ObjectUiGlobal,
} from './observability/settleSignal';
export { useRecentItems } from './hooks/useRecentItems';

// Types
export type {
  AppShellProps,
} from './types';

export type {
  MetadataState,
  MetadataContextValue,
  MetadataTypeStatus,
} from './providers/MetadataProvider';

export type {
  ExpressionContextValue,
} from './providers/ExpressionProvider';

export type {
  RecentItem,
} from './hooks/useRecentItems';

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
  LoadingFallback,
} from './console/ConsoleShell';

// Runtime AI-availability signal — the single source of truth every AI entry
// point gates on (FAB, /ai routes, designer "Ask AI"). Server-pushed, no
// build-time edition flag. See ./hooks/useAiSurface.
export { useAiSurfaceEnabled } from './hooks/useAiSurface';
export type { AiSurfaceState } from './hooks/useAiSurface';

// Layout chrome
export {
  ConsoleLayout,
  AppHeader,
  AppSidebar,
  UnifiedSidebar,
  AppSwitcher,
  ConnectionStatus,
  ActivityFeed,
  LocaleSwitcher,
  ModeToggle,
  AuthPageLayout,
} from './layout';
export type { ActivityItem } from './layout';

// Top-level chrome (dialogs, providers, error boundaries)
export {
  CommandPalette,
  KeyboardShortcutsDialog,
  OnboardingWalkthrough,
  ConditionalAuthWrapper,
  ConsoleToaster,
  RouteFader,
  toastWithUndo,
  type ToastWithUndoOptions,
  ErrorBoundary,
  LoadingScreen,
  ThemeProvider,
  useTheme,
} from './chrome';

// Observability — Sentry integration, opt-in via VITE_SENTRY_DSN
export { initSentry, captureError, setSentryUser, getSentry } from './observability';

// Runtime configuration pushed by the server at boot. Consumers fetch
// `/api/v1/runtime/config` via `initRuntimeConfig()` before first render
// and read upstream cloud URL + capability flags from `getRuntimeConfig()`.
export {
  initRuntimeConfig,
  getRuntimeConfig,
  getCloudBase,
  getProductName,
  getProductShortName,
  isRuntimeConfigInitialised,
  resetRuntimeConfigForTesting,
} from './runtime-config';
export type { RuntimeConfig, RuntimeFeatures, RuntimeBranding } from './runtime-config';

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
} from './views';
export type { RecordFormPageProps } from './views';

// Hooks
export {
  useFavorites,
  useMetadataService,
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
} from './hooks';
export type { FavoriteItem } from './hooks';

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
} from './context';
export type { UserDataAdapter, UserStateKind, CommandPaletteContextValue } from './context';

// Default page implementations (consumers can partial-override slots)
export { AppContent as DefaultAppContent } from './console/AppContent';
export { MarketplacePage } from './console/marketplace/MarketplacePage';
export { MarketplacePackagePage } from './console/marketplace/MarketplacePackagePage';
export { MarketplaceInstalledPage } from './console/marketplace/MarketplaceInstalledPage';
export { LoginPage as DefaultLoginPage } from './console/auth/LoginPage';
export { RegisterPage as DefaultRegisterPage } from './console/auth/RegisterPage';
export { ForgotPasswordPage as DefaultForgotPasswordPage } from './console/auth/ForgotPasswordPage';
export { HomeLayout as DefaultHomeLayout, HomeLayout } from './console/home/HomeLayout';
export { HomePage as DefaultHomePage, HomePage } from './console/home/HomePage';
export { OrganizationsLayout as DefaultOrganizationsLayout } from './console/organizations/OrganizationsLayout';
export { OrganizationsPage as DefaultOrganizationsPage } from './console/organizations/OrganizationsPage';

export { OrganizationLayout as DefaultOrganizationLayout } from './console/organizations/manage/OrganizationLayout';
export { MembersPage as DefaultMembersPage } from './console/organizations/manage/MembersPage';
export { InvitationsPage as DefaultInvitationsPage } from './console/organizations/manage/InvitationsPage';
export { SettingsPage as DefaultSettingsPage } from './console/organizations/manage/SettingsPage';
export { AcceptInvitationPage as DefaultAcceptInvitationPage } from './console/organizations/manage/AcceptInvitationPage';
export {
  AiChatPage as DefaultAiChatPage,
  AiChatPage,
  hydratedMessagesToChatMessages,
} from './console/ai/AiChatPage';
export { ConversationsSidebar } from './console/ai/ConversationsSidebar';
// Conversation-history hydration helpers — reused by the public read-only
// share page (`/s/:token`) so a shared transcript renders identically to the
// live chat (tool cards included) instead of dumping raw envelopes.
export {
  toUIMessages,
  aiMessageRowsToServerMessages,
  type HydratedUIMessage,
  type RawAiMessageRow,
} from './hooks/useChatConversation';

// Phase 3b: Component nav registry — plugins use this to register
// admin/setup UI surfaces that are addressable from App metadata via
// `{ type: 'component', componentRef: 'ns:name' }` nav items.
export {
  registerAppComponent,
  getAppComponent,
  listAppComponents,
  componentRefToUrlSegments,
  urlSegmentsToComponentRef,
} from './services/componentRegistry';
export type { AppComponentRegistryEntry } from './services/componentRegistry';
// Side-effect import: registers built-in admin components
// (metadata:directory, metadata:resource) at module load.
import './services/builtinComponents';
// SDUI widget for the metadata-driven Cloud Connection page (cloud ADR-0008).
import './console/cloud-connection/CloudConnectionPanel';
import './console/marketplace/InstalledListWidget';

// Phase 3c — generic metadata admin engine. Re-exported so plugins
// can call `registerMetadataResource()` to override the per-type
// list / edit / create components, and host apps can compose the
// page primitives directly when needed.
export {
  MetadataDirectoryPage,
  MetadataResourceRouter,
  MetadataResourceListPage,
  MetadataResourceEditPage,
  MetadataResourceHistoryPage,
  MetadataDiagnosticsPage,
  MetadataQuickFind,
  MetadataPageShell,
  SchemaForm,
  LayeredDiff,
  registerMetadataResource,
  getMetadataResource,
  listMetadataResources,
  resolveResourceConfig,
  useMetadataClient,
  useMetadataTypes,
  useTypesIndex,
  useGlobalDiagnostics,
  matchesQuery,
  registerMetadataPreview,
  getMetadataPreview,
  listMetadataPreviewTypes,
  registerMetadataInspector,
  getMetadataInspector,
  listMetadataInspectorTypes,
} from './views/metadata-admin';
export type {
  MetadataResourceConfig,
  MetadataDomain,
  RichMetadataTypeEntry,
  MetadataPreview,
  MetadataPreviewProps,
  MetadataSelection,
  MetadataInspector,
  MetadataInspectorProps,
} from './views/metadata-admin';

// AI assistant bus — connects the metadata designers to the global chat.
export {
  assistantBus,
  useAssistant,
  useRegisterAssistantEditor,
  requestAssistantOpen,
} from './assistant/assistantBus';
export type {
  AssistantSnapshot,
  AssistantEditorContext,
  AssistantEditorField,
} from './assistant/assistantBus';
export { RemediationOverlay } from './console/RemediationOverlay';
