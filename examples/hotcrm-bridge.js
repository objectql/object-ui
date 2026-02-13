/**
 * HotCRM Metadata Bridge
 *
 * Extracts objects and apps from the hotcrm submodule plugins so they
 * can be merged into the ObjectUI console as a real-world metadata example.
 *
 * This file is intentionally JavaScript (.js) so that TypeScript's `tsc`
 * uses the companion .d.ts file for type information without traversing
 * into the hotcrm source tree (which targets a different @objectstack/spec
 * version and would produce type errors in strict mode).
 *
 * Vite / esbuild handle the actual .ts → .js transpilation at bundle time.
 */

// @ts-nocheck
import { CRMPlugin } from './hotcrm/packages/crm/src/plugin.ts';
import { FinancePlugin } from './hotcrm/packages/finance/src/plugin.ts';
import { MarketingPlugin } from './hotcrm/packages/marketing/src/plugin.ts';
import { ProductsPlugin } from './hotcrm/packages/products/src/plugin.ts';
import { SupportPlugin } from './hotcrm/packages/support/src/plugin.ts';
import { HRPlugin } from './hotcrm/packages/hr/src/plugin.ts';

const allPlugins = [
  CRMPlugin,
  FinancePlugin,
  MarketingPlugin,
  ProductsPlugin,
  SupportPlugin,
  HRPlugin,
];

/** All objects extracted from every HotCRM plugin (map values → flat array). */
export const hotcrmObjects = allPlugins.flatMap((plugin) =>
  Object.values(plugin.objects || {}),
);

/** All app definitions extracted from every HotCRM plugin. */
export const hotcrmApps = allPlugins.flatMap(
  (plugin) => plugin.apps || [],
);

/**
 * Merge hotcrm objects into an existing array, skipping any whose `name`
 * already exists in `existing` so that seed-data-bearing objects are kept.
 */
export function mergeObjects(existing, hotcrm) {
  const existingNames = new Set(existing.map((o) => o.name));
  const unique = hotcrm.filter((o) => !existingNames.has(o.name));
  return [...existing, ...unique];
}
