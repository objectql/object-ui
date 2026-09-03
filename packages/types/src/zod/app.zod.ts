/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Application Schema Zod Validators
 * 
 * Zod validation schemas for top-level application configuration.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/app
 * @packageDocumentation
 */

import { z } from 'zod';
import {
  AppSchema as SpecAppSchema,
  AppContextSelectorSchema as SpecAppContextSelectorSchema,
  NavigationAreaSchema as SpecNavigationAreaSchema,
} from '@objectstack/spec/ui';
import { BaseSchema, specFieldsExcept } from './base.zod.js';
import { handlerKeyRefusal } from './tombstone.zod.js';

// ============================================================================
// Unified NavigationItem Schema
// ============================================================================

/**
 * Navigation Item Type enum
 */
export const NavigationItemTypeSchema = z.enum([
  'object', 'dashboard', 'page', 'report', 'url', 'component', 'group', 'separator', 'action',
]);

/**
 * Navigation Item Schema — unified model aligned with @objectstack/spec.
 */
export const NavigationItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  // Declared optional so a bare `{ type: 'separator' }` — which the spec
  // accepts, and which carries no identity or text by definition — validates
  // here too (objectstack#4115). Every OTHER type still requires both; that is
  // re-imposed by the refinement below rather than by the field declarations,
  // because this is one flat shape and not the spec's discriminated union.
  id: z.string().optional().describe('Unique identifier'),
  type: NavigationItemTypeSchema.describe('Navigation item type'),
  label: z.string().optional().describe('Display label'),
  icon: z.string().optional().describe('Icon name (Lucide)'),

  // Type-specific target fields
  objectName: z.string().optional().describe('Target object name (type: object)'),
  viewName: z.string().optional().describe('Target view name (type: object) — named list view e.g. calendar, pipeline'),
  recordId: z.string().optional().describe('Target record id (type: object) — opens a single record. Supports template variables {current_user_id}, {current_org_id}.'),
  recordMode: z.enum(['view', 'edit']).optional().describe('Record opening mode when recordId is set (default: view)'),
  filters: z.record(z.string(), z.string()).optional().describe('URL filter conditions (type: object) — targets the /:objectName/data bare surface via filter[<field>]=<value> params instead of a saved view. Values support {current_user_id}/{current_org_id}. Precedence: recordId → filters → viewName.'),
  // Declared here for the same reason `requiresObject` / `actionDef` are: this
  // schema STRIPS unknown keys, so an entry deep-linking into an action would
  // have validated clean through `objectui validate` with the deep link thrown
  // away (the objectstack#4115 failure class). Spec: `ObjectNavItemSchema.runAction`.
  runAction: z.string().optional().describe('Auto-run deep link (type: object) — name of an action on the target object that the list surface runs once on arrival. Ignored when recordId wins precedence (that resolves to a record page, not the list). Encoded as the reserved ?runAction= search param.'),
  dashboardName: z.string().optional().describe('Target dashboard name (type: dashboard)'),
  pageName: z.string().optional().describe('Target page name (type: page)'),
  reportName: z.string().optional().describe('Target report name (type: report)'),
  url: z.string().optional().describe('Target URL (type: url)'),
  target: z.enum(['_blank', '_self']).optional().describe('Link target (type: url)'),
  componentRef: z.string().optional().describe('Target component reference (type: component) — colon-joined ComponentRegistry key e.g. metadata:resource, routed to /component/<ns>/<name>'),
  params: z.record(z.string(), z.unknown()).optional().describe('Extra parameters (type: component | page) — serialised as querystring; string values support {current_user_id}/{current_org_id}'),

  // Grouping
  children: z.array(z.lazy(() => NavigationItemSchema)).optional().describe('Child items (type: group)'),

  // Action payload (type: 'action'). Undeclared until objectstack#4115: the
  // schema strips unknown keys, so an action item validated clean while its
  // entire payload was thrown away.
  actionDef: z.object({
    actionName: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  }).optional().describe('Action payload (type: action)'),

  // Visibility & Permissions
  visible: z.union([z.boolean(), z.string()]).optional().describe('Visibility expression'),
  requiredPermissions: z.array(z.string()).optional().describe('Required permissions'),
  // Runtime capability gates. `NavigationRenderer` has always honoured these
  // and `NavigationItem` has always declared them — only this schema lagged,
  // so `objectui validate` silently dropped them (objectstack#4115).
  requiresObject: z.string().optional().describe('Object that must be registered for this entry to render'),
  requiresService: z.string().optional().describe('Kernel service that must be registered for this entry to render'),

  // UX Enhancements
  badge: z.union([z.string(), z.number()]).optional().describe('Badge text or count'),
  badgeVariant: z.enum(['default', 'secondary', 'destructive', 'outline']).optional().describe('Badge variant'),
  expanded: z.boolean().optional().describe('Group default expanded state (spec field name)'),
  /** @deprecated legacy objectui spelling of `expanded`; the renderer honours either. */
  defaultOpen: z.boolean().optional().describe('Group default expanded state (legacy alias of `expanded`)'),
  pinned: z.boolean().optional().describe('Pinned item'),
  order: z.number().optional().describe('Sort order weight'),
}).superRefine((item, ctx) => {
  // Identity and text are required for every real destination; only the
  // separator — a rule, not an entry — is exempt. Declaring the fields
  // optional above is what lets `{ type: 'separator' }` through, so without
  // this an id-less `type: 'object'` item would validate too.
  if (item.type === 'separator') return;
  for (const key of ['id', 'label'] as const) {
    if (typeof item[key] !== 'string' || item[key] === '') {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `\`${key}\` is required for navigation items of type '${item.type}'`,
      });
    }
  }
}));

/**
 * Navigation Area Schema — business-domain partition of navigation, DERIVED
 * from `@objectstack/spec/ui` (objectstack#4115).
 *
 * `icon` and `description` flow in **by reference** through
 * {@link specFieldsExcept}; `id` and `label` are taken from the spec's own
 * shape too, re-stated only to keep them required (the helper `.partial()`s
 * what it carries, deliberately, so a future spec field cannot become required
 * and invalidate stored objectui apps). `objectui validate` silently dropped
 * `order` and `description` until objectui#3088 — restating this shape by hand
 * is what let that happen.
 *
 * One key is pinned locally, matching the TS twin in `app.ts`:
 *  - `navigation` — objectui's `NavigationItemSchema`. ⚠️ The reason is NO LONGER
 *    "the spec's is `z.ZodType<any>` and would validate nothing". That was true
 *    when this was written and is false now: objectstack#4171 landed, and spec
 *    17.2.0 declares `NavigationItemSchema: z.ZodType<NavigationItem,
 *    NavigationItemInput>` — measured precise in the BUILT dist, not just in
 *    source (objectui#3162 batch 8).
 *
 *    What blocks the burn-down now is SHAPE, not precision. The spec models
 *    navigation as a discriminated union of `.strict()` variants; objectui keeps
 *    one flat, all-optional object that deliberately accepts more. Measured
 *    against spec 17.2.0, referencing the spec's schema would make `objectui
 *    validate` REJECT metadata this renderer accepts today: `pinned`,
 *    `defaultOpen` and a separator carrying `label` all fail `unrecognized_keys`,
 *    `visible: boolean` fails `invalid_union`, and a one-character `id` fails
 *    `too_small`. Pinned by `__tests__/navigation-spec-parity.test.ts`.
 *
 *    Converging on the union is a breaking change for every consumer that reads
 *    fields off `NavigationItem` without narrowing — tracked separately, and
 *    deliberately not smuggled into a ledger burn-down.
 *
 * `order`, `visible` and `requiredPermissions` were AREA-level keys until
 * `@objectstack/spec` 17.0.0 retired them (`AREA_VISIBLE_RETIRED` /
 * `AREA_REQUIRED_PERMISSIONS_RETIRED`): an area is a layout grouping, not an
 * access boundary, so gating belongs on the navigation ITEM (`visible` /
 * `requiredPermissions`, both still there) or on the app.
 *
 * Note the retirement's rationale ("an area carries no gate of its own") did
 * NOT hold here: `AppSchemaRenderer`'s area switcher filtered areas by
 * `visible` / `requiredPermissions`. That filter is gone and the gating moved
 * down to `NavigationRenderer` — see objectui#3311 for the premise mismatch.
 * Following the spec is still right: its area object is `.strict()`, so a
 * v17-valid app cannot carry these keys, and keeping them locally would have
 * meant accepting areas the platform rejects.
 *
 * Drift guard: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export const NavigationAreaSchema = specFieldsExcept(SpecNavigationAreaSchema.shape, [
  'id',
  'label',
  'navigation',
] as const).extend({
  id: SpecNavigationAreaSchema.shape.id.describe('Unique identifier'),
  label: SpecNavigationAreaSchema.shape.label.describe('Display label'),
  navigation: z.array(NavigationItemSchema).describe('Navigation items within area'),
});

// ============================================================================
// Legacy MenuItem Schema (backward compat)
// ============================================================================

/**
 * Menu Item Schema - Navigation menu item
 * @deprecated Use NavigationItemSchema instead.
 */
export const MenuItemSchema: z.ZodType<any> = z.lazy(() => z.object({
  type: z.enum(['item', 'group', 'separator']).optional().describe('Item type'),
  label: z.string().optional().describe('Display label'),
  icon: z.string().optional().describe('Icon name (Lucide)'),
  path: z.string().optional().describe('Target path (route)'),
  href: z.string().optional().describe('External link'),
  children: z.array(MenuItemSchema).optional().describe('Child items (submenu)'),
  badge: z.union([z.string(), z.number()]).optional().describe('Badge or count'),
  hidden: z.union([z.boolean(), z.string()]).optional().describe('Visibility condition'),
}));

// ============================================================================
// App Action Schema
// ============================================================================

/**
 * App Action Schema - Application header/toolbar action
 */
export const AppActionSchema = z.object({
  type: z.enum(['button', 'dropdown', 'user']).describe('Action type'),
  label: z.string().optional().describe('Action label'),
  icon: z.string().optional().describe('Icon name'),
  // RETIRED (objectui#7344 — the objectui#6182 ruling: the handler-expression
  // string dialect is not an authoring form; the objectui#6124 shape). Nothing
  // reads `AppComponentSchema.actions[]`, so the key refuses by name.
  onClick: handlerKeyRefusal('onClick', 'retired', 'Click handler'),
  avatar: z.string().optional().describe('User avatar URL (for type="user")'),
  description: z.string().optional().describe('Additional description (e.g., email for user)'),
  items: z.array(MenuItemSchema).optional().describe('Dropdown menu items (for type="dropdown" or "user")'),
  shortcut: z.string().optional().describe('Keyboard shortcut'),
  variant: z.enum(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']).optional().describe('Button variant'),
  size: z.enum(['default', 'sm', 'lg', 'icon']).optional().describe('Button size'),
});

// ============================================================================
// App Schema
// ============================================================================

/**
 * App Context Selector Schema — sidebar/topbar scope dropdown whose selected
 * value is injected into nav items as a `{<id>}` template var.
 *
 * DERIVED from `@objectstack/spec/ui` (objectstack#4115): every spec key
 * (`id`/`icon`/`optionsSource`/`includeAll`/`allValue`/`persist`/`placement`,
 * including its defaults) flows in **by reference**, so a key the spec adds or
 * retypes cannot silently diverge here. Before this derivation the local hand
 * copy was a full restatement carrying the spec's own symbol name.
 *
 * One pinned divergence, kept deliberately:
 *  - `label` is widened to accept objectui's i18n label envelope
 *    (`{ default, translations }` / any record) as well as the spec's plain
 *    string. `AppContextSelectors` (@object-ui/app-shell) renders it through
 *    `resolveI18nLabel`, so narrowing to the spec's `z.string()` would reject
 *    localized selectors the renderer already supports.
 *
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export const AppContextSelectorSchema = SpecAppContextSelectorSchema.extend({
  label: z.union([z.string(), z.record(z.string(), z.any())])
    .describe('Dropdown label — plain string or objectui i18n label envelope'),
});

/**
 * App Schema - Top-level application configuration
 */
/**
 * Spec-owned App fields, flowing in **by reference** (objectstack#4115).
 *
 * `BaseSchema` is `.passthrough()` while the spec's `AppSchema` is strict, so
 * before this derivation 23 spec-only keys rode through objectui completely
 * unvalidated — `branding`, `sharing`, `embed`, `objects`, `apis`,
 * `requiredPermissions`, `homePageId` (itself retired in spec 17.0.0),
 * `protection` and the whole
 * `_lock*`/`_package*`/`_provenance` package-lock envelope. A typo in any of
 * them (`brading: {…}`) was invisible, and a packaged app round-tripped
 * through this schema lost nothing only by luck.
 *
 * Omitted, each for a stated reason:
 *  - `name`/`label`/`description` — component-envelope keys owned by BaseSchema;
 *  - `navigation`/`areas`/`contextSelectors` — objectui's element schemas are
 *    their own ledger entries (they drift from the spec's on `badgeVariant`,
 *    `expanded`/`defaultOpen`, `visible` and target-field requiredness);
 *    migrating them is a separate, larger decision.
 *
 * `.partial()` guarantees no *future* spec field can become required and
 * silently invalidate stored objectui apps.
 */
const SpecAppFields = specFieldsExcept(SpecAppSchema.shape, [
  'name',
  'label',
  'description',
  'navigation',
  'areas',
  'contextSelectors',
] as const);

/**
 * App Schema — the objectui app-shell renderer node, derived from
 * `@objectstack/spec/ui` `AppSchema` (see {@link SpecAppFields}). The drift
 * guard is `__tests__/page-app-dashboard-spec-parity.test.ts`.
 */
export const AppComponentSchema = BaseSchema.extend(SpecAppFields.shape).extend({
  type: z.literal('app'),
  name: z.string().optional().describe('Application name (system ID)'),
  title: z.string().optional().describe('Display title'),
  description: z.string().optional().describe('Application description'),
  logo: z.string().optional().describe('Logo URL or icon name'),
  favicon: z.string().optional().describe('Favicon URL'),
  layout: z.enum(['sidebar', 'header', 'empty']).optional().default('sidebar').describe('Global layout strategy'),
  menu: z.array(MenuItemSchema).optional().describe('Legacy navigation menu (deprecated, use navigation)'),
  navigation: z.array(NavigationItemSchema).optional().describe('Unified navigation tree'),
  areas: z.array(NavigationAreaSchema).optional().describe('Navigation areas (business-domain partitions)'),
  contextSelectors: z.array(AppContextSelectorSchema).optional().describe('App-level scope dropdowns injected into nav items as {<id>} vars'),
  actions: z.array(AppActionSchema).optional().describe('Global actions (user profile, settings, etc.)'),
});

/**
 * Export type inference helpers
 */
export type NavigationItemSchemaType = z.infer<typeof NavigationItemSchema>;
export type NavigationAreaSchemaType = z.infer<typeof NavigationAreaSchema>;
export type MenuItemSchemaType = z.infer<typeof MenuItemSchema>;
export type AppActionSchemaType = z.infer<typeof AppActionSchema>;
export type AppSchemaType = z.infer<typeof AppComponentSchema>;
