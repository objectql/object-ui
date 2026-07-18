/**
 * ObjectUI — light DOM test setup (default for the `dom` project)
 *
 * Just enough to render a React component with @testing-library: jsdom-ish
 * polyfills (via vitest.setup.base), jest-dom matchers, and RTL auto-cleanup.
 * It deliberately does NOT import @object-ui/components / fields /
 * plugin-dashboard / plugin-grid or re-register any widgets.
 *
 * Under `isolate: true` every setup import re-executes per test file, and the
 * old single DOM setup pulled those four package graphs into ~300 files that
 * mostly never render through the ComponentRegistry — ~3.3s of pure setup per
 * file. Tests that DO drive the registry (SchemaRenderer, or page / dashboard /
 * grid widgets) run in the `dom-heavy` project instead, which keeps the full
 * `vitest.setup.dom.tsx`. See `heavyDomTests` in vitest.config.mts.
 *
 * If a test renders a component that resolves other components by type and you
 * see "<type> not registered" or an element that never appears, it belongs in
 * `heavyDomTests`, not here.
 */

import './vitest.setup.base';
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL installs its auto-cleanup afterEach only on first import; with modules
// cached across files in a worker, later files would accumulate DOM nodes.
// Register cleanup here so every test file gets an unmount.
afterEach(() => {
  cleanup();
});

// jsdom/happy-dom do not implement Element.prototype.scrollIntoView; some
// components call it inside effects. Polyfill as a no-op so component tests
// don't throw inside React's commit phase.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
