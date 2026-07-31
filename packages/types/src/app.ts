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

import type { BaseSchema } from './base';

import type { NavigationItemInput as SpecNavigationItemInput } from '@objectstack/spec/ui';

// ============================================================================
// Unified Navigation Model (aligned with @objectstack/spec)
// ============================================================================

/**
 * Navigation item type — derived from the spec union rather than restated, so a
 * variant added there cannot go missing here (objectstack#4171).
 */
export type NavigationItemType = SpecNavigationItemInput['type'];

/**
 * Unified Navigation Item — the spec's contract, plus the UI-only state the
 * shell derives at render time.
 *
 * Was a 134-line local interface. objectstack#4171 established the rule that a
 * spec-named symbol must be an IMPORT, not a re-declaration — but until
 * objectstack#4171/#4221/#4227 the spec's `NavigationItem` resolved to `any`
 * (its recursive schema was annotated `z.ZodType<any>`, and then
 * `z.ZodType<NavigationItem>` with `Input` still defaulting to `unknown`), so
 * binding to it would have traded a precise type for one that constrains
 * nothing. Both halves are fixed now, so the fork can go.
 *
 * `pinned` deliberately does NOT move to the spec. It is not authored: it comes
 * from the user's favorites (FavoritesProvider → localStorage) and is injected
 * into the tree by `useNavPins.applyPins` on every render. The spec describes
 * what an AUTHOR writes; this type is what the RENDERER sees. Keeping it here,
 * named as runtime state, is the honest split.
 *
 * `defaultOpen` is gone: the spec's key is `expanded`. Nothing in this repo ever
 * wrote it (every other `defaultOpen` hit is a shadcn component's own prop), and
 * its one writer — objectstack's `account.app.ts` — was corrected in #4171.
 * `NavigationRenderer` keeps reading it as a legacy fallback for third-party
 * metadata authored before that.
 */
export type NavigationItem = SpecNavigationItemInput & {
  /** Runtime-only, set by `useNavPins.applyPins` — never authored, never in the spec. */
  pinned?: boolean;
};

/**
 * Navigation Area — a business-domain partition of navigation items.
 * 
 * Inspired by Salesforce Lightning App → Area → Tab model and
 * Microsoft Power Apps Area → Group → Subarea pattern.
 * 
 * Each area contains an independent navigation tree, allowing large
 * enterprise applications to organise navigation by domain (e.g.
 * Sales, Service, Marketing).
 */
export interface NavigationArea {
  /** Unique identifier */
  id: string;

  /** Display label (plain string per @objectstack/spec v4 protocol) */
  label: string;

  /** Icon name (Lucide) */
  icon?: string;

  /** Navigation items within this area */
  navigation: NavigationItem[];

  /** Visibility expression */
  visible?: boolean | string;

  /** Required permissions to see this area */
  requiredPermissions?: string[];
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
/**
 * Legacy `MenuItem.hidden` (a boolean) → the spec's `visible`, which is a CEL
 * PREDICATE, not a boolean. `hidden: true` becomes the constant-false predicate;
 * anything else omits the key, since visible-by-default is the schema's own
 * behaviour. Emitting a bare `false` here produced metadata the spec rejects —
 * invisible while this file kept its own looser `NavigationItem`.
 */
function hiddenToPredicate(hidden: boolean | string | undefined): string | undefined {
  if (hidden === true || hidden === 'true') return 'false';
  // A legacy `hidden` that is itself an expression inverts into one.
  if (typeof hidden === 'string' && hidden !== '' && hidden !== 'false') return `!(${hidden})`;
  return undefined;
}

export function menuItemToNavigationItem(
  item: MenuItem,
  index: number = 0,
): NavigationItem {
  const id = `migrated_${index}`;

  if (item.type === 'separator') {
    // The spec's separator is a pure divider: `type` / `id` / `order` only.
    // A legacy MenuItem separator's `label` has nowhere to go, and `.strict()`
    // (objectstack#4165) rejects it outright.
    return { id, type: 'separator' };
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
      visible: hiddenToPredicate(item.hidden),
      badge: item.badge,
      expanded: true,
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
      visible: hiddenToPredicate(item.hidden),
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
    visible: hiddenToPredicate(item.hidden),
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
