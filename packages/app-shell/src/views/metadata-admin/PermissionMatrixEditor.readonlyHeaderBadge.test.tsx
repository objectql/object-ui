// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The PageShell header badge must report the gate that actually governs the
 * screen — objectui#4036, B-half of the objectstack#5768 split ruling.
 *
 * Measured on a dogfood run: `/studio/com.example.showcase/access` rendered the
 * permission set's title row as
 *
 *   权限集 · showcase_contributor · 安全 · 可写 · 已授权对象 5 · 字段覆盖 3 · 历史
 *                                        ^^^^
 *
 * while all 207 permission checkboxes and 发布 below it were disabled with the
 * read-only-package tooltip. Both renderings answer "can you write this?" and
 * they disagreed, because they read different inputs:
 *
 *   • the CONTROLS read `!!resolved.allowOrgOverride && !readOnly` — the type
 *     registry AND the host package gate, which is the right answer;
 *   • the BADGE read `entry.allowOrgOverride` alone. `permission` is one of the
 *     15 overlay-allowed types, so that flag is true and the badge said
 *     "writable" no matter which package you were in.
 *
 * This suite pins the display side only. The gating assertions here are
 * CONTROLS: the B-half ruling explicitly keeps Studio's blanket package-level
 * read-only intact ("Studio 维持包级只读") pending the per-type A-half review,
 * so a fix that made anything editable would be the wrong fix even though the
 * badge assertions would still pass.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const server = {
  set: {
    name: 'showcase_contributor',
    label: 'Contributor',
    objects: { a_account: { allowRead: true } },
    fields: {},
  } as Record<string, unknown>,
};

let clientImpl: any;

function makeClient() {
  return {
    layered: async () => ({
      effective: server.set,
      code: null,
      overlay: null,
      overlayScope: null,
    }),
    getDraft: async () => null,
    list: async (type: string) =>
      type === 'object' ? [{ item: { name: 'a_account', label: 'Account' } }] : [],
    get: async (type: string) =>
      type === 'object' ? { fields: [{ name: 'name', label: 'Name' }] } : null,
    save: async (_t: string, _n: string, payload: Record<string, unknown>) => payload,
  } as any;
}

// The type registry says this type IS overlay-allowed — the exact condition the
// defect needed. `permission` really is in the server's overlay-allowed list.
vi.mock('./useMetadata', () => ({
  useMetadataClient: () => clientImpl,
  useMetadataTypes: () => ({
    loading: false,
    error: null,
    entries: [{ type: 'permission', label: 'Permission', allowOrgOverride: true }],
  }),
}));
vi.mock('./AssignedUsersSection', () => ({ AssignedUsersSection: () => null }));

import { PermissionMatrixEditPage } from './PermissionMatrixEditor';

afterEach(cleanup);

async function renderMatrix(props?: { readOnly?: boolean }) {
  clientImpl = makeClient();
  render(
    <MemoryRouter>
      <PermissionMatrixEditPage
        type="permission"
        name="showcase_contributor"
        packageId="com.example.showcase"
        embedded
        {...props}
      />
    </MemoryRouter>,
  );
  await screen.findByText('Account');
}

/**
 * The header badge, addressed structurally rather than by text. The identity
 * strip below the header carries its own read-only badge ("Read-only", the
 * Studio package wording) and the header carries the metadata-admin badge-slot
 * wording ("read-only"); matching on text alone would silently pass by finding
 * the wrong one the day either string moves.
 */
function headerBadgeTexts(): string[] {
  const header = document.querySelector('.border-b.bg-background');
  return Array.from(header?.querySelectorAll('[class*="rounded-"]') ?? [])
    .map((el) => (el.textContent ?? '').trim())
    .filter(Boolean);
}

describe('PermissionMatrixEditPage — header writability badge vs the package gate (#4036)', () => {
  it('read-only package: the header does NOT claim the set is writable', async () => {
    await renderMatrix({ readOnly: true });

    // The defect, stated directly: an overlay-allowed TYPE inside a read-only
    // PACKAGE must not advertise writability anywhere on the screen.
    expect(headerBadgeTexts()).not.toContain('writable');
    expect(screen.queryByText('writable', { exact: true })).toBeNull();
  });

  it('read-only package: the header reports read-only, naming the package as the reason', async () => {
    await renderMatrix({ readOnly: true });

    expect(headerBadgeTexts()).toContain('read-only');
    // Reuses the wording the Studio top bar and the identity strip already use
    // for this gate, so the screen gives one reason, not two.
    const badge = screen.getByText('read-only', { exact: true });
    expect(badge).toHaveAttribute('title', expect.stringContaining('Read-only package'));
  });

  it('CONTROL — writable package: the header still reports writable', async () => {
    await renderMatrix();

    expect(headerBadgeTexts()).toContain('writable');
    expect(screen.queryByText('read-only', { exact: true })).toBeNull();
  });

  it('CONTROL — gating is untouched: read-only still disables every control and hides Save', async () => {
    await renderMatrix({ readOnly: true });

    // The A-half review must find the surface exactly as policy-consistent as
    // this PR leaves it: display-side coherence only, no loosening.
    expect(screen.queryByRole('button', { name: /^Save$/ })).toBeNull();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box).toBeDisabled();
  });

  it('CONTROL — gating is untouched: a writable package keeps Save and live checkboxes', async () => {
    await renderMatrix();

    expect(screen.getByRole('button', { name: /^Save$/ })).toBeEnabled();
    expect(screen.getByLabelText('a_account Read')).toBeEnabled();
  });
});
