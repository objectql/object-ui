/**
 * objectui#5064 — `dashboardComponents` map parity pin.
 *
 * The map is the package's "Standard Export Protocol - for manual
 * integration": iterating it feeds each key straight into
 * `ComponentRegistry.register(type, component)`. That contract is invisible
 * to every static gate — the export-name check is green because the export
 * exists, and a wrong key vocabulary compiles because the keys are runtime
 * strings into `register(type: string, …)`. Until objectui#5064 the map
 * carried 11 PascalCase component class names, so the documented loop
 * registered 11 types no schema author writes while the 8 real types went
 * unregistered by it. This file is the missing dynamic check: the map's keys
 * must be exactly the schema types the barrel's side-effect registration
 * claims, and each value must be the very component registered for that type
 * (for the two `object-*` types that is the internal data-source-gate
 * wrapper, not the exported widget).
 */
import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
// Side-effect import: the package barrel runs the eight
// `ComponentRegistry.register(...)` calls, and is also where
// `dashboardComponents` is defined.
import { dashboardComponents } from '../index';

/** The 8 schema types read off the `ComponentRegistry.register` call sites. */
const REGISTERED_TYPES = [
  'dashboard',
  'metric',
  'metric-card',
  'object-metric',
  'pivot',
  'object-pivot',
  'dashboard-grid',
  'object-data-table',
];

describe('dashboardComponents map parity (objectui#5064)', () => {
  it('keys are exactly the 8 schema types the barrel registers', () => {
    expect(Object.keys(dashboardComponents).sort()).toEqual(
      [...REGISTERED_TYPES].sort(),
    );
  });

  it('each value is the exact component registered for its type', () => {
    for (const [type, component] of Object.entries(dashboardComponents)) {
      // Bare-type lookup resolves the back-compat fallback entry, which holds
      // the same component reference the barrel registered.
      expect(ComponentRegistry.get(type), `type "${type}"`).toBe(component);
    }
  });

  it('the pre-#5064 vocabulary stays gone: no PascalCase class-name keys', () => {
    // Schema types in this repo are lower-kebab; a key starting with an
    // uppercase letter is a component class name leaking back in.
    const classNameKeys = Object.keys(dashboardComponents).filter((key) =>
      /^[A-Z]/.test(key),
    );
    expect(classNameKeys).toEqual([]);
  });
});
