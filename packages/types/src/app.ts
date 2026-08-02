/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Application Schema
 * 
 * Defines the metadata structure for a complete application, including
 * global layout, navigation menus, and routing configuration.
 * 
 * ## Navigation Model
 * 
 * ObjectUI uses a unified `NavigationItem` model aligned with @objectstack/spec.
 * The legacy `MenuItem` type is retained for backward compatibility but new
 * configurations should use `NavigationItem` and the `navigation` / `areas` fields.
 */

// The spec's own `NavigationItem` erases to `any` (its schema is declared
// `z.ZodType<any>` to carry the recursive group variant), so objectui keeps a
// real interface. Its per-variant types ARE properly typed, though, so the
// fields below are derived from one of them rather than restated.
import type {
  NavigationArea as SpecNavigationArea,
  ObjectNavItem as SpecObjectNavItem,
} from '@objectstack/spec/ui';
import type { BaseSchema } from './base';

// ============================================================================
// Unified Navigation Model (aligned with @objectstack/spec)
// ============================================================================

/**
 * Navigation item type — determines the target and required fields.
 */
export type NavigationItemType =
  | 'object'
  | 'dashboard'
  | 'page'
  | 'report'
  | 'url'
  | 'component'
  | 'group'
  | 'separator'
  | 'action';

/**
 * Unified Navigation Item
 * 
 * The single navigation primitive used across ObjectUI and @objectstack/spec.
 * Replaces the legacy `MenuItem` for application navigation trees.
 * 
 * Supports typed navigation targets (object, dashboard, page, report, url),
 * nested groups, visibility expressions, RBAC permissions, and UX enhancements
 * like badges, pinning, and sort ordering.
 */
export interface NavigationItem {
  /** Unique identifier */
  id: string;

  /** Navigation item type */
  type: NavigationItemType;

  /** Display label (plain string per @objectstack/spec v4 protocol) */
  label: string;

  /** Icon name (Lucide) */
  icon?: string;

  // -- Type-specific target fields --

  /** Target object name (for type: 'object') */
  objectName?: string;

  /** Target view name (for type: 'object') — opens a specific named list view e.g. 'calendar', 'pipeline' */
  viewName?: string;

  /**
   * Target record id (for type: 'object') — when set, the nav item
   * opens a single record's detail page instead of a list view.
   *
   * Supports template variables resolved at render time by the shell:
   *   - `{current_user_id}` → currently signed-in user's id
   *   - `{current_org_id}`  → currently active organization's id
   *
   * If the template can't be resolved (e.g. signed-out pre-render),
   * the item falls back to opening the list view.
   *
   * When both `recordId` and `viewName` are set, `recordId` wins.
   */
  recordId?: string;

  /**
   * Record opening mode when `recordId` is set. Defaults to `'view'`.
   * Use `'edit'` to land directly on the edit form (e.g. "Edit my profile").
   */
  recordMode?: 'view' | 'edit';

  /**
   * URL filter conditions (for type: 'object') — the entry targets the
   * parameterized bare data surface `/:objectName/data` with each entry
   * serialized as a `filter[<field>]=<value>` search param (equality),
   * instead of anchoring to a saved view. Use for one-off / parameterized
   * slices ("My open tickets" without authoring a view); slices worth
   * curating belong in a named view via `viewName`.
   *
   * Values support the same template variables as `recordId`
   * (`{current_user_id}`, `{current_org_id}`); entries whose template can't
   * be resolved are dropped from the URL.
   *
   * Precedence within `type: 'object'`: `recordId` → `filters` → `viewName`.
   */
  filters?: Record<string, string>;

  /** Target dashboard name (for type: 'dashboard') */
  dashboardName?: string;

  /** Target page name (for type: 'page') */
  pageName?: string;

  /** Target report name (for type: 'report') */
  reportName?: string;

  /** Target URL (for type: 'url') */
  url?: string;

  /** Link target (for type: 'url') */
  target?: '_blank' | '_self';

  /**
   * Target component reference (for type: 'component') — a colon-joined
   * `ComponentRegistry` key (e.g. `metadata:resource`, `setup:permission_matrix`)
   * identifying a first-party UI shipped with the platform. Routed to
   * `/component/<ns>/<name>`. Mirrors `@objectstack/spec` `ComponentNavItem`.
   */
  componentRef?: string;

  /**
   * Extra parameters (for type: 'component' | 'page') — serialised as
   * querystring so the same component/page can be reused across nav entries
   * with different inputs (e.g. `params: { type: 'object' }`). String values
   * support the same template variables as `recordId`.
   */
  params?: Record<string, unknown>;

  // -- Grouping --

  /** Child navigation items (for type: 'group') */
  children?: NavigationItem[];

  // -- Visibility & Permissions --

  /** Visibility expression — boolean or expression string e.g. "${user.role === 'admin'}" */
  visible?: boolean | string;

  /** Required permissions to see/access this item */
  requiredPermissions?: string[];

  /**
   * Runtime capability gate — name of an object that must be registered
   * in the runtime's SchemaRegistry for this entry to render. Used to
   * hide cloud-only nav entries (e.g. `sys_app`, `sys_package`) in
   * single-project runtimes that don't register those objects.
   */
  requiresObject?: string;

  /**
   * Runtime capability gate — name of a kernel service that must be
   * registered for this entry to render. Mirrors `requiresObject` for
   * service-bound features.
   */
  requiresService?: string;

  // -- UX Enhancements --

  /** Badge text or count */
  badge?: string | number;

  /**
   * Badge visual variant — derived from the spec's own nav-item variant
   * rather than restated (objectstack#4115). The hand-written union this
   * replaces was missing `'secondary'`, so a spec-valid badge was a type
   * error here and was rejected outright by `objectui validate`.
   */
  badgeVariant?: NonNullable<SpecObjectNavItem['badgeVariant']>;

  /**
   * Whether a `type: 'group'` item starts expanded. This is the spec's
   * field name and the one to author against.
   */
  expanded?: boolean;

  /**
   * @deprecated Legacy objectui spelling of {@link expanded}. `NavigationRenderer`
   * honours whichever is set (`expanded` wins), so existing app metadata keeps
   * working; new metadata should use `expanded`.
   */
  defaultOpen?: boolean;

  /**
   * Action payload for `type: 'action'` items. Without it the item names an
   * action it cannot invoke — and before this was declared, `objectui validate`
   * silently stripped it, so a broken action item validated clean.
   */
  actionDef?: { actionName: string; params?: Record<string, unknown> };

  /** Whether this item is pinned. objectui-only; the spec has no counterpart. */
  pinned?: boolean;

  /** Sort order weight (lower = higher) */
  order?: number;
}

/**
 * Navigation Area — a business-domain partition of navigation items.
 *
 * Inspired by Salesforce Lightning App → Area → Tab model and
 * Microsoft Power Apps Area → Group → Subarea pattern.
 *
 * Each area contains an independent navigation tree, allowing large
 * enterprise applications to organise navigation by domain (e.g.
 * Sales, Service, Marketing).
 *
 * DERIVED from `@objectstack/spec/ui` (objectstack#4115): `id`, `label`,
 * `icon`, `order`, `description` and `requiredPermissions` flow in **by
 * reference**, so a key the spec adds or retypes cannot silently diverge here.
 * The hand copy this replaces had already lost `order` and `description` once
 * (objectui#3088).
 *
 * Two keys are pinned locally, each for a reason that outlives a spec release:
 *
 *  - `navigation` — the spec's `NavigationArea.navigation` is `any[]`, because
 *    its `NavigationItemSchema` is declared `z.ZodType<any>` to carry the
 *    recursive group variant. Inheriting it would delete the navigation tree's
 *    typing outright — the case-2 erasure the guard's header warns about
 *    (objectstack#4171, tracked for objectui in objectui#3162). Keeping
 *    `NavigationItem[]` is what preserves it.
 *  - `visible` — objectui's wire contract is the bare predicate
 *    (`boolean | string`), while the spec's parsed shape is the
 *    `ExpressionInput` envelope (`{ dialect, source }`). Same divergence, and
 *    the same reason, as `SelectOption.visibleWhen` (objectui#3090).
 *
 * Drift guard: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface NavigationArea
  extends Omit<SpecNavigationArea, 'navigation' | 'visible'> {
  /** Navigation items within this area (see the `navigation` note above). */
  navigation: NavigationItem[];

  /** Visibility expression (see the `visible` note above). */
  visible?: boolean | string;
}

// ============================================================================
// Application Schema
// ============================================================================

/**
 * Top-level Application Configuration (app.json)
 */
export interface AppComponentSchema extends BaseSchema {
  type: 'app';
  
  /**
   * Application Name (System ID)
   */
  name?: string;

  /**
   * Display Title
   */
  title?: string;

  /**
   * Display Label (used in navigation and app switcher)
   */
  label?: string;

  /**
   * Application Description
   */
  description?: string;

  /**
   * Icon name (Lucide) for app switcher and navigation
   */
  icon?: string;

  /**
   * Logo URL or Icon name
   */
  logo?: string;

  /**
   * Favicon URL
   */
  favicon?: string;

  /**
   * Branding configuration
   */
  branding?: BrandingConfig;

  /**
   * Whether the application is active (visible in app switcher)
   * @default true
   */
  active?: boolean;

  /**
   * Global Layout Strategy
   * - sidebar: Standard admin layout with left sidebar
   * - header: Top navigation bar only
   * - empty: No layout, pages are responsible for their own structure
   * @default "sidebar"
   */
  layout?: 'sidebar' | 'header' | 'empty';

  /**
   * Global Navigation Menu
   * @deprecated Use `navigation` instead. Retained for backward compatibility.
   */
  menu?: MenuItem[];

  /**
   * Unified navigation tree (aligned with @objectstack/spec NavigationItem model).
   * Takes precedence over `menu` when both are present.
   */
  navigation?: NavigationItem[];

  /**
   * Navigation areas / business-domain partitions.
   * When provided, the sidebar displays an area switcher and renders
   * the selected area's navigation tree.
   */
  areas?: NavigationArea[];

  /**
   * Global Actions (User Profile, Settings, etc)
   */
  actions?: AppAction[];

  /**
   * Home page ID (ObjectStack Spec v2.0.1)
   * Default page to navigate to after login
   */
  homePageId?: string;

  /**
   * Required permissions (ObjectStack Spec v2.0.1)
   * Permissions required to access this application
   */
  requiredPermissions?: string[];
}

// ============================================================================
// Legacy MenuItem (backward compat — prefer NavigationItem)
// ============================================================================

/**
 * Navigation Menu Item
 * @deprecated Use `NavigationItem` instead.
 */
export interface MenuItem {
  /**
   * Item Type
   */
  type?: 'item' | 'group' | 'separator';

  /**
   * Display Label
   */
  label?: string;

  /**
   * Icon Name (Lucide)
   */
  icon?: string;

  /**
   * Target Path (Route)
   */
  path?: string;

  /**
   * External Link
   */
  href?: string;

  /**
   * Child Items (Submenu)
   */
  children?: MenuItem[];

  /**
   * Badge / Count
   */
  badge?: string | number;

  /**
   * Visibility Condition
   */
  hidden?: boolean | string;
}

// ============================================================================
// MenuItem → NavigationItem Transform
// ============================================================================

/**
 * Convert a legacy `MenuItem` to a `NavigationItem`.
 * 
 * Mapping rules:
 * - `type: 'item'` → inferred from `href` (url) or `path` (page)
 * - `type: 'group'` → `type: 'group'`
 * - `type: 'separator'` → `type: 'separator'`
 * - `hidden` → `visible` (inverted)
 * - `path` → `pageName` (last segment) or kept as-is for url
 * - `href` → `url` with `target: '_blank'`
 */
export function menuItemToNavigationItem(
  item: MenuItem,
  index: number = 0,
): NavigationItem {
  const id = `migrated_${index}`;

  if (item.type === 'separator') {
    return {
      id,
      type: 'separator',
      label: item.label || '',
    };
  }

  if (item.type === 'group') {
    return {
      id,
      type: 'group',
      label: item.label || '',
      icon: item.icon,
      children: (item.children || []).map((child, i) =>
        menuItemToNavigationItem(child, index * 100 + i),
      ),
      visible: item.hidden !== undefined ? !item.hidden : undefined,
      badge: item.badge,
      defaultOpen: true,
    };
  }

  // Default: 'item' type — infer target from href / path
  if (item.href) {
    return {
      id,
      type: 'url',
      label: item.label || '',
      icon: item.icon,
      url: item.href,
      target: '_blank',
      visible: item.hidden !== undefined ? !item.hidden : undefined,
      badge: item.badge,
    };
  }

  // Path-based item → treat as page navigation
  return {
    id,
    type: 'page',
    label: item.label || '',
    icon: item.icon,
    pageName: item.path || '',
    visible: item.hidden !== undefined ? !item.hidden : undefined,
    badge: item.badge,
  };
}

// ============================================================================
// App Creation Wizard Types
// ============================================================================

/**
 * Wizard step identifier for app creation flow.
 */
export type AppWizardStepId = 'basic' | 'objects' | 'navigation' | 'branding';

/**
 * App wizard step definition.
 */
export interface AppWizardStep {
  /** Step identifier */
  id: AppWizardStepId;

  /** Display label */
  label: string;

  /** Step description */
  description?: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Whether the step is optional */
  optional?: boolean;
}

/**
 * Branding configuration for an application.
 */
export interface BrandingConfig {
  /** Logo URL or base64 data URI */
  logo?: string;

  /** Primary brand color (hex) */
  primaryColor?: string;

  /** Favicon URL */
  favicon?: string;

  /** Font family override */
  fontFamily?: string;
}

/**
 * Object selection entry for the wizard.
 */
export interface ObjectSelection {
  /** Object name (snake_case) */
  name: string;

  /** Display label (singular) */
  label: string;

  /** Plural display label — preferred for list-style nav entries (falls back to `label`) */
  pluralLabel?: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Whether this object is selected */
  selected: boolean;
}

/**
 * App creation wizard draft state — represents the in-progress
 * application configuration before it is finalized into an AppSchema.
 */
export interface AppWizardDraft {
  /** App name (snake_case, validated) */
  name: string;

  /** Display title */
  title: string;

  /** Description */
  description?: string;

  /** App icon name (Lucide) */
  icon?: string;

  /** Template to start from */
  template?: string;

  /** Layout strategy */
  layout: 'sidebar' | 'header' | 'empty';

  /** Selected business objects */
  objects: ObjectSelection[];

  /** Navigation tree being built */
  navigation: NavigationItem[];

  /** Branding configuration */
  branding: BrandingConfig;
}

/**
 * Editor mode for the app designer.
 */
export type EditorMode = 'edit' | 'preview' | 'code';

/**
 * Validate an app name is snake_case.
 * Pattern: starts with lowercase letter, followed by lowercase letters/digits,
 * with optional underscore-separated segments (no trailing/leading/double underscores).
 */
export function isValidAppName(name: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name);
}

/**
 * Convert an AppWizardDraft to an AppSchema.
 */
export function wizardDraftToAppSchema(draft: AppWizardDraft): AppComponentSchema {
  return {
    type: 'app',
    name: draft.name,
    title: draft.title,
    label: draft.title,
    description: draft.description,
    icon: draft.icon,
    logo: draft.branding.logo,
    favicon: draft.branding.favicon,
    branding: draft.branding,
    layout: draft.layout,
    navigation: draft.navigation,
  };
}

// ============================================================================
// Application Actions
// ============================================================================

/**
 * Application Header/Toolbar Action
 */
export interface AppAction {
  type: 'button' | 'dropdown' | 'user';
  label?: string;
  icon?: string;
  onClick?: string;
  /**
   * User Avatar URL (for type='user')
   */
  avatar?: string;
  /**
   * Additional description (e.g. email for user)
   */
  description?: string;
  /**
   * Dropdown Menu Items (for type='dropdown' or 'user')
   */
  items?: MenuItem[];
  /**
   * Keyboard shortcut
   */
  shortcut?: string;
  /**
   * Button variant
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}
