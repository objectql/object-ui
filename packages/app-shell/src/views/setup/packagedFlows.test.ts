// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Which flows Setup › Packaged automation lists (ADR-0126 §7.4).
 *
 * The scoping rule is the part of that page most worth measuring directly.
 * Its hard case is not "does a package ship this" but the counterexample: a
 * TENANT-authored overlay bound to a package carries a real `_packageId`, so
 * every two-clause shortcut classifies it as packaged. cloud#970 measured that
 * misread on a Studio-authored artifact after a kernel rebuild; here it would
 * put a tenant's own flow behind an install-wide switch.
 */

import { describe, expect, it } from 'vitest';

import {
  envelopeData,
  envelopeRefused,
  isPackagedFlowItem,
  joinPackagedFlows,
  readMetadataItems,
  readRuntimeStates,
} from './packagedFlows';

/** A packaged flow metadata item — loader-introduced, real package id. */
function packagedItem(name: string, label: string) {
  return { name, label, _packageId: 'com.objectstack.crm', _provenance: 'package' };
}

describe('isPackagedFlowItem', () => {
  it('accepts a loader-introduced item', () => {
    expect(isPackagedFlowItem({ _packageId: 'com.objectstack.crm', _provenance: 'package' })).toBe(true);
    // A package id with no provenance is still a code artifact — the server's
    // test excludes provenance `'org'`, it does not require `'package'`.
    expect(isPackagedFlowItem({ _packageId: 'com.objectstack.crm' })).toBe(true);
  });

  it('refuses the tenant overlay bound to a package — the cloud#970 counterexample', () => {
    expect(isPackagedFlowItem({ _packageId: 'app.crm', _provenance: 'org' })).toBe(false);
  });

  it('refuses the overlay-bound-to-no-package sentinel and unpackaged items', () => {
    expect(isPackagedFlowItem({ _packageId: 'sys_metadata' })).toBe(false);
    expect(isPackagedFlowItem({ name: 'my_flow' })).toBe(false);
    expect(isPackagedFlowItem({ _packageId: '' })).toBe(false);
    expect(isPackagedFlowItem(null)).toBe(false);
    expect(isPackagedFlowItem(undefined)).toBe(false);
  });
});

describe('joinPackagedFlows', () => {
  it('lists only registered flows a package ships, labelled from the metadata item', () => {
    const rows = joinPackagedFlows(
      [
        { name: 'pkg_notify', enabled: false },
        { name: 'tenant_flow', enabled: true },
        { name: 'overlay_flow', enabled: true },
      ],
      [
        packagedItem('pkg_notify', 'Notify owner'),
        { name: 'tenant_flow', label: 'Mine', _packageId: 'sys_metadata' },
        { name: 'overlay_flow', label: 'Mine too', _packageId: 'app.crm', _provenance: 'org' },
        // Packaged, but the engine never registered it — no row, because both
        // actions the page offers go through the engine.
        packagedItem('pkg_dormant', 'Dormant'),
      ],
    );

    expect(rows).toEqual([{ name: 'pkg_notify', label: 'Notify owner', enabled: false }]);
  });

  it('falls back to the machine name when the packaged item has no label', () => {
    const rows = joinPackagedFlows(
      [{ name: 'pkg_notify', enabled: true }],
      [{ name: 'pkg_notify', _packageId: 'com.objectstack.crm', _provenance: 'package' }],
    );
    expect(rows[0]).toEqual({ name: 'pkg_notify', label: 'pkg_notify', enabled: true });
  });

  it('treats an omitted `enabled` as on — an engine that reports none has nothing disabled', () => {
    const rows = joinPackagedFlows([{ name: 'pkg_notify' }], [packagedItem('pkg_notify', 'Notify')]);
    expect(rows[0].enabled).toBe(true);
  });

  it('orders by label, then by machine name', () => {
    const rows = joinPackagedFlows(
      [{ name: 'b_flow' }, { name: 'a_flow' }, { name: 'c_flow' }],
      [packagedItem('b_flow', 'Alpha'), packagedItem('a_flow', 'Zulu'), packagedItem('c_flow', 'Alpha')],
    );
    expect(rows.map((r) => r.name)).toEqual(['b_flow', 'c_flow', 'a_flow']);
  });

  it('ignores rows and items with no usable name', () => {
    const rows = joinPackagedFlows(
      [{ name: '' }, { enabled: true }, { name: 'pkg_notify' }],
      [{ name: '', _packageId: 'p' }, null, packagedItem('pkg_notify', 'Notify')],
    );
    expect(rows.map((r) => r.name)).toEqual(['pkg_notify']);
  });
});

describe('envelope readers', () => {
  it('reads the runtime list wrapped or bare, and nothing else', () => {
    expect(readRuntimeStates({ data: { flows: [{ name: 'a' }] } })).toEqual([{ name: 'a' }]);
    expect(readRuntimeStates({ flows: [{ name: 'b' }] })).toEqual([{ name: 'b' }]);
    expect(readRuntimeStates({ flows: 'nope' })).toEqual([]);
    expect(readRuntimeStates(null)).toEqual([]);
  });

  it('reads the metadata list as a bare array or `{ items }`', () => {
    expect(readMetadataItems([{ name: 'a' }])).toEqual([{ name: 'a' }]);
    expect(readMetadataItems({ items: [{ name: 'b' }] })).toEqual([{ name: 'b' }]);
    expect(readMetadataItems({ items: 3 })).toEqual([]);
    expect(readMetadataItems(null)).toEqual([]);
  });

  it('narrows `data` and spots an envelope refusal under a 2xx', () => {
    expect(envelopeData({ data: { enabled: false } })).toEqual({ enabled: false });
    expect(envelopeData({ data: [1, 2] })).toEqual({});
    expect(envelopeData(null)).toEqual({});
    expect(envelopeRefused({ success: false })).toBe(true);
    expect(envelopeRefused({ success: true })).toBe(false);
    expect(envelopeRefused(null)).toBe(false);
  });
});
