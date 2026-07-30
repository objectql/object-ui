/* ADR-0080: headless dump of the public-tier component manifest.
 * Registers everything the console does, then serializes getPublicConfigs().
 *
 * Two lists have to agree here, and nothing used to check them:
 *   - `src/register-plugins.ts` — what the console actually ships, most of it
 *     registered LAZILY (the chunk loads on first use).
 *   - the eager imports below — what this dump loads so the manifest carries
 *     each block's real `inputs`.
 *
 * Importing the former means a plugin the console lazy-registers but this file
 * forgets to import eagerly survives as a `lazy: true` stub and
 * `assertFullyLoaded` fails the build — instead of that block landing in the
 * manifest with no props, which would make every prop an author writes on it
 * an `unknown-prop` diagnostic downstream. Eager registration wins over a stub,
 * so the manifest itself is unchanged; this only makes the drift detectable. */
import '../src/register-plugins';

import '@object-ui/components';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-report';
import '@object-ui/plugin-tree';
import { ComponentRegistry } from '@object-ui/core';
import { assertFullyLoaded, manifestFromConfigs } from '@object-ui/sdui-parser';

const out = document.getElementById('out')!;
const win = window as unknown as { __MANIFEST?: string; __MANIFEST_ERROR?: string };

try {
  const configs = ComponentRegistry.getPublicConfigs() as never;
  assertFullyLoaded(configs);
  const json = JSON.stringify(manifestFromConfigs(configs), null, 2);
  out.textContent = json;
  win.__MANIFEST = json;
} catch (err) {
  // Surface the failure instead of leaving `__MANIFEST` unset — the dump script
  // waits for one of these two, and would otherwise just time out with no clue.
  const message = err instanceof Error ? err.message : String(err);
  out.textContent = message;
  win.__MANIFEST_ERROR = message;
}
