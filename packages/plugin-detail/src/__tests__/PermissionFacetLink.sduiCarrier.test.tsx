/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression for objectui#3307 — `field:permission-facet-link` was the only
 * `field:` registration in the repo that bypassed `withFieldCarrier`.
 *
 * `SchemaRenderer` (the SDUI path) hands every registered component the
 * authored node as `schema` and never passes `field`; the form and inline-edit
 * hosts pass `field`. Since objectui#3233 the field-widget contract carries
 * metadata on `field` ONLY, and the translation happens once at the
 * registration seam via `withFieldCarrier`. A raw registration therefore works
 * under the form hosts but reads `field === undefined` under SDUI — the widget
 * renders, silently, an anonymous summary (`field?.name` empty, no facet
 * branch selected). Exactly the failure class the carrier exists to prevent.
 *
 * The behavioral test below goes through the REAL registration (imported from
 * `../index`), the real `SchemaRenderer`, and the real widget. The asserted
 * text is data (capability names), not translation copy, so the test does not
 * depend on i18n configuration. Removing `withFieldCarrier` from the
 * registration makes it fail: `field?.name` falls to `''`, the widget takes
 * the anonymous default branch, and renders the bare count "2" instead of the
 * capability chips.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer } from '@object-ui/react';

// Module scope, not a hook (AGENTS.md 测试纪律 / objectui#3010): importing the
// package index executes its registration side-effects, so the entry under
// test is the very one production resolves.
import '../index';

afterEach(() => {
  cleanup();
});

describe('field:permission-facet-link — SDUI path delivers `field` (objectui#3307)', () => {
  it('converges the authored node onto `field` (field?.name non-empty end to end)', () => {
    // The SDUI shape: `schema` only — no `field` anywhere in these props.
    render(
      <MemoryRouter>
        <SchemaRenderer
          schema={
            {
              type: 'field:permission-facet-link',
              name: 'system_permissions',
              label: 'System Permissions',
              value: ['manage_users', 'view_reports'],
            } as any
          }
        />
      </MemoryRouter>,
    );

    // The capability-chip branch renders IFF `field?.name === 'system_permissions'`,
    // i.e. the authored node reached the widget as `field`. The chip labels are
    // the facet's own data.
    expect(screen.getByText('manage_users')).toBeInTheDocument();
    expect(screen.getByText('view_reports')).toBeInTheDocument();
    // …and NOT the anonymous default-branch summary (bare count "2") that a
    // raw registration produced when `field?.name` came up empty.
    expect(screen.queryByText('2')).toBeNull();
  });

  it('is registered through the carrier adapter, not raw', () => {
    // Cheap seam pin: the registry entry itself is the `withFieldCarrier`
    // wrapper. The behavioral test above is the authority; this one makes a
    // future raw re-registration fail with an unmistakable message.
    const entry = ComponentRegistry.get('field:permission-facet-link') as
      | { displayName?: string }
      | undefined;
    expect(entry).toBeTruthy();
    expect(entry?.displayName).toMatch(/^FieldCarrier\(/);
  });
});
