/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Retirement pin — `field:capability-multiselect` (objectui#3308, ADR-0049
 * enforce-or-remove).
 *
 * The key was registered on ONE path only: `registerFields()`, whose sole caller
 * is the docs site. The live path (`registerAllFields()`, run at module import)
 * never had it, because `fieldWidgetMap` never listed it — so a field authored
 * with `widget: 'capability-multiselect'` resolved to nothing in every real app
 * while a code comment advertised it as usable from a record form. Nothing
 * stamped the hint either: ADR-0056 P1 stamps `permission-facet-link` on all six
 * `sys_permission_set` facets (including `system_permissions`), and P2 put the
 * capability editor in Studio.
 *
 * What this pins:
 *   1. the key is absent after importing the package (the live path), AND
 *   2. absent after `registerFields()` too — the retirement covers the docs
 *      path, which is where the key actually used to come from. Asserting only
 *      (1) would have passed on `origin/main` and pinned nothing.
 *   3. `registerFields()` still registers every OTHER key it used to — the
 *      retirement subtracts exactly one name, it does not thin the docs path.
 *
 * `CapabilityMultiSelectField` the component is deliberately NOT asserted gone:
 * Studio's `PermissionMatrixEditor` imports and renders it directly, which is
 * ADR-0056 P2's design. Only the widget NAME is retired.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

// Importing the entry runs `registerAllFields()` at module load — the live path.
import { registerFields, registerAllFields, FORM_FIELD_TYPES } from '../index';

const RETIRED = 'capability-multiselect';

/**
 * Every key `registerFields()` registered before the retirement, minus the
 * retired one. Spelled out rather than derived so a future edit that silently
 * drops a docs-path registration fails here instead of passing vacuously.
 */
const DOCS_PATH_KEYS = [
  'text', 'textarea', 'number', 'boolean', 'select', 'date', 'datetime', 'time',
  'email', 'phone', 'url',
  'currency', 'percent', 'password', 'markdown', 'html', 'lookup', 'master_detail',
  'file', 'image', 'location',
  'formula', 'summary', 'auto_number',
  'user', 'owner',
  'object', 'vector', 'grid',
  'color', 'slider', 'rating', 'code', 'avatar', 'address', 'geolocation',
  'signature', 'qrcode',
] as const;

describe('capability-multiselect widget retirement (objectui#3308)', () => {
  it('is absent on the live registerAllFields() path', () => {
    registerAllFields();
    expect(ComponentRegistry.get(`field:${RETIRED}`)).toBeUndefined();
    expect(ComponentRegistry.get(RETIRED)).toBeUndefined();
  });

  it('is not in fieldWidgetMap, so no bare field type can reach it either', () => {
    expect(FORM_FIELD_TYPES).not.toContain(RETIRED);
  });

  describe('after the docs-site registerFields() path runs', () => {
    beforeAll(() => {
      registerFields();
    });

    it('still does not register the retired key', () => {
      expect(ComponentRegistry.get(`field:${RETIRED}`)).toBeUndefined();
      expect(ComponentRegistry.get(RETIRED)).toBeUndefined();
    });

    it('registers every other docs-path key (retirement subtracts exactly one)', () => {
      for (const key of DOCS_PATH_KEYS) {
        expect(
          ComponentRegistry.get(`field:${key}`),
          `field:${key} must survive the retirement`,
        ).toBeTruthy();
      }
      expect(DOCS_PATH_KEYS).toHaveLength(38);
    });
  });
});
