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
 * The legacy `AppMenuItem` type is retained for backward compatibility but new
 * configurations should use `NavigationItem` and the `navigation` / `areas` fields.
 */

// Spec 17.0.0-rc.1 gave the spec's own `NavigationItem` a real type — it is no
// longer the `z.ZodType<any>` erasure objectstack#4171 was filed about. That
// removed the ORIGINAL reason this stayed a local interface, but not the
// remaining ones (#3177 triage), and they were never caused by `any`:
//
//   1. Shape. The spec models navigation as a discriminated union of nine
//      `$strict` variants with a `superRefine` exclusivity rule; this is one
//      flat, all-optional shape. Converging is a breaking change for every
//      consumer that reads a target field without narrowing — the verdict
//      already recorded in `__tests__/navigation-spec-parity.test.ts`.
//   2. Three semantics the spec has at NEITHER tier: `visible: boolean` (the
//      spec takes only a CEL string / Expression envelope, yet
//      `menuItemToNavigationItem` below inverts legacy `AppMenuItem.hidden` into
//      a boolean), `pinned` (backs `useNavPins` + `FavoritesProvider`), and the
//      legacy `defaultOpen` spelling. Binding deletes all three from the type
//      while their implementations keep running.
//   3. A separator carrying a `label`; the spec's separator branch declares none.
//
// So the symbol stays local and the KEYS come off the spec one by one — the
// `badgeVariant` precedent (objectstack#4115), widened here to every key with a
// precise spec counterpart. That is the part of the burn-down that is safe
// today: a restated enum or payload shape can drift, and now cannot.
// `spec-derived-unions.test.ts` pins the three blockers above, each written so
// it fails the day the spec closes it.
import type {
  NavigationArea as SpecNavigationArea,
  NavigationItem as SpecNavigationItem,
  ObjectNavItem as SpecObjectNavItem,
  UrlNavItem as SpecUrlNavItem,
  ActionNavItem as SpecActionNavItem,
  ComponentNavItem as SpecComponentNavItem,
} from '@objectstack/spec/ui';
import type { BaseSchema } from './base.js';

// ============================================================================
// Unified Navigation Model (aligned with @objectstack/spec)
// ============================================================================

/**
 * Navigation item type — determines the target and required fields.
 *
 * The MEMBERSHIP list is the spec's, read off the discriminant of its nav-item
 * union rather than restated (#3177). A hand-written copy of a spec vocabulary
 * is the objectstack#4115 failure class — `ChartType` carried 7 of 19 members,
 * `ActionType` was missing `form` — and this one had drifted into an identical
 * nine-member copy that nothing checked.
 *
 * Deriving also makes a future spec addition LOUD instead of silent: exhaustive
 * consumers (`NAV_TYPE_META` in `plugin-designer`'s `NavigationDesigner` is a
 * `Record< NavigationItemType, … >`) stop compiling until the new variant is
 * handled, which is where a renderer gap belongs — not in a dead `default:`.
 */
export type NavigationItemType = SpecNavigationItem['type'];

/**
 * Unified Navigation Item
 * 
 * The single navigation primitive used across ObjectUI and @objectstack/spec.
 * Replaces the legacy `AppMenuItem` for application navigation trees.
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
   *
   * Derived from the spec's own object-nav variant (#3177) — a restated
   * two-member enum is one spec release away from drifting.
   */
  recordMode?: NonNullable<SpecObjectNavItem['recordMode']>;

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
   *
   * Shape derived from the spec's object-nav variant (#3177).
   */
  filters?: SpecObjectNavItem['filters'];

  /**
   * Auto-run deep link (for type: 'object') — the name of an action on the
   * target object that the list surface runs ONCE on arrival, through the same
   * execute path as a click (so param dialogs, confirms and entitlement gates
   * all still apply). Use for "take me straight into create" entries: a
   * welcome-page CTA that should land the user IN the create dialog rather than
   * on the list, hunting for a second button.
   *
   * Landing surface only: `runAction` describes the LIST surface, so it is
   * ignored when `recordId` wins the precedence chain and the entry resolves to
   * a record detail page instead. `NavigationRenderer.resolveHref` encodes it
   * as the reserved `?runAction=` search param — {@link NAV_RUN_ACTION_PARAM}
   * in `@object-ui/layout` is that param name's ONE definition, and the list
   * toolbar reads it back through the same constant.
   *
   * The reference is validated at AUTHORING time, not here: `defineStack`'s
   * cross-reference walk rejects a name no action declares ("deep-link
   * references action '…' (via runAction)"). A client that arrives holding a
   * name no action on the toolbar answers to runs nothing and — deliberately —
   * does not consume the param, so a reload with fresher metadata can still
   * honour it (the #4123 "arming is destructive" rule).
   *
   * Shape derived from the spec's object-nav variant (#3177); declared by
   * `ObjectNavItemSchema.runAction` since objectstack#7253.
   */
  runAction?: SpecObjectNavItem['runAction'];

  /** Target dashboard name (for type: 'dashboard') */
  dashboardName?: string;

  /** Target page name (for type: 'page') */
  pageName?: string;

  /** Target report name (for type: 'report') */
  reportName?: string;

  /** Target URL (for type: 'url') */
  url?: string;

  /**
   * Link target (for type: 'url').
   *
   * Derived from the spec's url-nav variant (#3177). The spec declares it
   * `.default('_self')`, so it is REQUIRED in that schema's output and optional
   * here — objectui reads a plain object and never parses, so the default is
   * never applied and the key is genuinely absent. `NonNullable` takes the
   * member list without importing that requiredness.
   */
  target?: NonNullable<SpecUrlNavItem['target']>;

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
   *
   * Shape derived from the spec's component-nav variant (#3177); the page
   * variant declares the identical shape.
   */
  params?: SpecComponentNavItem['params'];

  // -- Grouping --

  /** Child navigation items (for type: 'group') */
  children?: NavigationItem[];

  // -- Visibility & Permissions --

  /**
   * Visibility expression — boolean or expression string e.g. "${user.role === 'admin'}".
   *
   * NOT derived (#3177): the spec takes a CEL string on input and an Expression
   * envelope `{ dialect, source }` on output — `boolean` is absent at BOTH
   * tiers. `NavigationRenderer`'s `evalVis(item.visible)` honours the boolean,
   * and `menuItemToNavigationItem` produces one when mapping legacy
   * `AppMenuItem.hidden`. Pinned in `spec-derived-unions.test.ts`, which fails the
   * day the spec accepts a boolean and this can come off it.
   */
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

  /** Badge text or count — derived from the spec's nav-item base (#3177). */
  badge?: NonNullable<SpecObjectNavItem['badge']>;

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
   *
   * Derived from the spec's action-nav variant (#3177). This is a structured
   * payload rather than a scalar, so a restatement is exactly the kind that
   * goes stale unnoticed — which is how it came to be stripped in the first
   * place (objectstack#4115).
   */
  actionDef?: NonNullable<SpecActionNavItem['actionDef']>;

  /**
   * Whether this item is pinned. objectui-only; the spec has no counterpart at
   * either tier, so NOT derived (#3177). `useNavPins` and `FavoritesProvider`
   * are built on it. Pinned in `spec-derived-unions.test.ts`, which fails the
   * day the spec claims the name — at which point the two meanings have to be
   * reconciled rather than silently shadowed.
   */
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
 * `icon` and `description` flow in **by reference**, so a key the spec adds or
 * retypes cannot silently diverge here. The hand copy this replaces had already
 * lost `order` and `description` once (objectui#3088).
 *
 * `order`, `visible` and `requiredPermissions` were area-level keys until spec
 * 17.0.0 retired them (`AREA_VISIBLE_RETIRED` /
 * `AREA_REQUIRED_PERMISSIONS_RETIRED`): an area is a layout grouping, not an
 * access boundary — gate the navigation ITEM or the app instead.
 *
 * Worth stating plainly, because the retirement's own rationale says an area
 * "carries no gate of its own": objectui DID gate on them —
 * `AppSchemaRenderer`'s area switcher filtered areas by `visible` and
 * `requiredPermissions`. That filter is gone, and the gating it did now happens
 * one level down in `NavigationRenderer`, which is where the spec moved it.
 * The premise mismatch is recorded in objectui#3311. Per that issue's ruling,
 * area visibility is now DERIVED rather than authored: `AppSchemaRenderer`
 * hides an area from the switcher when none of its items survive the
 * item-level guards (`hasVisibleNavigationItems` in `@object-ui/layout`), so
 * the pre-17 "fully gated area disappears" UX is back without any authorable
 * area-level key.
 *
 * One key is pinned locally, for a reason that outlives a spec release:
 *
 *  - `navigation` — objectui's own {@link NavigationItem}, not the spec's.
 *    Spec 17.0.0-rc.1 gave the spec's item a real type, so this is no longer
 *    the `any` erasure objectstack#4171 was filed about — and it is still not
 *    bindable, for the three reasons the module header above records
 *    (`visible: boolean`, `pinned` / `defaultOpen`, a separator carrying a
 *    `label`). Precision is not equivalence: this is case 2c in the guard's
 *    header, and the umbrella verdict lives with the element type in
 *    `__tests__/spec-derived-unions.test.ts`, which is where the blockers are
 *    pinned one by one.
 *
 * Drift guard: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface NavigationArea extends Omit<SpecNavigationArea, 'navigation'> {
  /** Navigation items within this area (see the `navigation` note above). */
  navigation: NavigationItem[];
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
  menu?: AppMenuItem[];

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
   * Required permissions (ObjectStack Spec v2.0.1)
   * Permissions required to access this application
   */
  requiredPermissions?: string[];
}

// ============================================================================
// Legacy AppMenuItem (backward compat — prefer NavigationItem)
// ============================================================================

/**
 * Navigation Menu Item
 * @deprecated Use `NavigationItem` instead.
 */
export interface AppMenuItem {
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
  children?: AppMenuItem[];

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
// AppMenuItem → NavigationItem Transform
// ============================================================================

/**
 * Convert a legacy `AppMenuItem` to a `NavigationItem`.
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
  item: AppMenuItem,
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
  /**
   * RETIRED (objectui#7344; the objectui#6182 ruling of 2026-08-25 — the
   * handler-expression string dialect is not a supported authoring form — in
   * the objectui#6124 shape). Nothing reads `AppComponentSchema.actions[]`, so
   * no value here could ever run. The zod twin refuses the key by name; author
   * behaviour as a node type (an `action:button` node with a declared action)
   * instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onClick?: never;
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
  items?: AppMenuItem[];
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
