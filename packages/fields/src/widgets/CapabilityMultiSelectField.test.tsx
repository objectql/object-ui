/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * CapabilityMultiSelectField (ADR-0056 P2, epic #2398).
 *
 * Proves the two properties P2 depends on:
 *  1. the stored value parses tolerantly into a capability-name list, and
 *  2. every edit emits a JSON-**string** array of names — byte-equivalent to
 *     the `sys_permission_set.system_permissions` textarea storage, so the
 *     round-trip through the picker never changes the on-disk shape.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CapabilityMultiSelectField, parseCapabilityNames } from './CapabilityMultiSelectField';

describe('parseCapabilityNames', () => {
  it('parses the canonical JSON-string array', () => {
    expect(parseCapabilityNames('["setup.access","studio.access"]')).toEqual([
      'setup.access',
      'studio.access',
    ]);
  });

  it('treats empty / null / undefined as no selection', () => {
    expect(parseCapabilityNames('')).toEqual([]);
    expect(parseCapabilityNames('   ')).toEqual([]);
    expect(parseCapabilityNames(null)).toEqual([]);
    expect(parseCapabilityNames(undefined)).toEqual([]);
    expect(parseCapabilityNames('[]')).toEqual([]);
  });

  it('tolerates an already-parsed array', () => {
    expect(parseCapabilityNames(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('falls back to comma-splitting a non-JSON legacy string', () => {
    expect(parseCapabilityNames('setup.access, studio.access')).toEqual([
      'setup.access',
      'studio.access',
    ]);
  });
});

const CAPS = [
  { name: 'manage_users', label: 'Manage Users', description: 'Manage users', scope: 'platform', active: true },
  { name: 'studio.access', label: 'Studio Access', description: 'Enter Studio', scope: 'platform', active: true },
  { name: 'manage_org_users', label: 'Manage Org Users', description: 'Org members', scope: 'org', active: true },
];

function mockDataSource(rows = CAPS) {
  return { find: vi.fn().mockResolvedValue({ data: rows }) } as any;
}

describe('CapabilityMultiSelectField', () => {
  it('renders capabilities grouped by scope with human labels', async () => {
    render(
      <CapabilityMultiSelectField
        value={'["studio.access"]'}
        onChange={vi.fn()}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource()}
      />,
    );
    // group headers
    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    // labels, not raw names
    expect(screen.getByRole('button', { name: 'Studio Access' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Manage Users' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('emits a JSON-string array when a capability is toggled on', async () => {
    const onChange = vi.fn();
    render(
      <CapabilityMultiSelectField
        value={'["studio.access"]'}
        onChange={onChange}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Manage Users' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0];
    // The emitted value must be a JSON *string* (not a raw array), byte-equal
    // to the textarea storage contract.
    expect(typeof emitted).toBe('string');
    expect(JSON.parse(emitted)).toEqual(['studio.access', 'manage_users']);
  });

  it('removes a capability (and keeps emitting a JSON string) when toggled off', async () => {
    const onChange = vi.fn();
    render(
      <CapabilityMultiSelectField
        value={'["studio.access","manage_users"]'}
        onChange={onChange}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource()}
      />,
    );
    // Chip labels now resolve through the i18n bundle (objectui#2600 B5), so an
    // async translation-settle can re-render the chips between findBy and the
    // click — re-query at click time so we act on the live node, not a detached one.
    await screen.findByRole('button', { name: 'Studio Access' });
    fireEvent.click(screen.getByRole('button', { name: 'Studio Access' }));
    const emitted = onChange.mock.calls[0][0];
    expect(typeof emitted).toBe('string');
    expect(JSON.parse(emitted)).toEqual(['manage_users']);
  });

  it('preserves an unknown/legacy selected name not in the registry', async () => {
    render(
      <CapabilityMultiSelectField
        value={'["studio.access","legacy.custom"]'}
        onChange={vi.fn()}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource()}
      />,
    );
    // The unknown name still renders as a (selected) chip so it is not dropped.
    const legacy = await screen.findByRole('button', { name: 'legacy.custom' });
    expect(legacy).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders selected labels as read-only badges when readonly', async () => {
    render(
      <CapabilityMultiSelectField
        value={'["studio.access"]'}
        onChange={vi.fn()}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource()}
        readonly
      />,
    );
    // No toggle buttons in readonly mode.
    expect(await screen.findByText('Studio Access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Users' })).not.toBeInTheDocument();
  });

  // objectui#2600 B5 — curated platform caps get a localized label; package/
  // admin-authored caps keep whatever label the registry served.
  it('localizes curated capability labels but preserves registry labels for others', async () => {
    render(
      <CapabilityMultiSelectField
        value={'[]'}
        onChange={vi.fn()}
        field={{ name: 'system_permissions' } as any}
        dataSource={mockDataSource([
          // Registry sends a shorter label; the curated client map wins.
          { name: 'manage_org_users', label: 'Manage Org Users', description: 'Org members', scope: 'org', active: true },
          // Not a curated platform capability — its registry label is kept.
          { name: 'export_data', label: 'Export Data', description: 'Export', scope: 'org', active: true },
        ])}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Manage Organization Users' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage Org Users' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
  });
});
