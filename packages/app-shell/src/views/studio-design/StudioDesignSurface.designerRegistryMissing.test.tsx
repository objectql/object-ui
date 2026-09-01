// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#6795 part C — what the studio-design pillars SAY when the designer
 * registries are unpopulated (维护者 2026-08-30, 第 5 场总监席决裁批 #4:「同意」).
 *
 * ## The mechanism these pins exist to hold
 *
 * `preview-registry` / `inspector-registry` / `default-inspector-registry` are
 * plain `Map`s filled by a module-scope side effect in
 * `views/metadata-admin/index.ts`, reached statically through the package
 * barrel. Every consumer reads them **during render, with no subscription** and
 * gets `undefined` when the registration has not run. Measured on the card:
 *
 *     fallback before registration: true
 *     still fallback after registration: true
 *     late inspector rendered: false
 *
 * ⇒ a consumer that reads an empty registry **never recovers**. That is why
 * every message pinned here states a fact and ⛔ never promises recovery — no
 * "loading…", no "try again", no spinner. Promising recovery would replace one
 * false statement with another. Making recovery real is part A of #6795, which
 * the ruling deferred to the maintainer's sequencing surface.
 *
 * ⛔ `Suspense` cannot repair any of this and must not be proposed: these are
 * synchronous reads returning `undefined`, and Suspense catches a *thrown
 * promise*. Triage fenced this explicitly; it is mechanical, not stylistic.
 *
 * ## Why the states are reachable at all
 *
 * They are unreachable in production **only by accident** — the eager
 * registration part A wants to remove is what keeps them so. That is precisely
 * why they can silently re-rot, and why they are pinned here rather than left
 * to the browser.
 *
 * ## ⚠️ This file must never register a designer
 *
 * Its whole subject is the empty-registry branch, so every test below asserts
 * the registries are empty FIRST — a zero that is not asserted is not a
 * reading. The populated-registry contrast lives in
 * {@link file://./StudioDesignSurface.designerRegistryPartial.test.tsx}, a
 * separate file because these `Map`s are module state shared by a whole file.
 */

import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const objectDef = {
  name: 'showcase_task',
  label: 'Task',
  fields: [{ name: 'title', label: 'Title', type: 'text' }],
};

const NAV = [{ id: 'nav_page', type: 'page', label: 'Home', pageName: 'home_page' }];

const mockClient = {
  save: vi.fn(async () => ({})),
  list: vi.fn(async (type: string) => {
    if (type === 'app') return [{ name: 'acme_app', label: 'Acme' }];
    if (type === 'object') return [{ name: 'showcase_task', label: 'Task' }];
    if (type === 'flow') return [{ name: 'nightly', label: 'Nightly' }];
    return [];
  }),
  listDrafts: vi.fn(async () => []),
  layered: vi.fn(async (type: string, name: string) => {
    if (type === 'app') return { effective: { name: 'acme_app', label: 'Acme', navigation: NAV } };
    if (type === 'object') return { effective: objectDef, code: objectDef };
    if (type === 'page') return { effective: { name: 'home_page', label: 'Home' } };
    if (type === 'flow') return { effective: { name: 'nightly', label: 'Nightly', steps: [] } };
    return { effective: { name } };
  }),
  getDraft: vi.fn(async () => null),
  get: vi.fn(async () => undefined),
};

vi.mock('../metadata-admin/useMetadata', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../metadata-admin/useMetadata')>();
  return { ...mod, useMetadataClient: () => mockClient, useMetadataTypes: () => ({ entries: [] }) };
});

vi.mock('./packages-io', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./packages-io')>();
  return { ...mod, fetchPackages: vi.fn(async () => []) };
});

vi.mock('@object-ui/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@object-ui/react')>();
  return { ...mod, useAdapter: () => ({}) };
});

import { AutomationsPillar, DataPillar, InterfacesPillar } from './StudioDesignSurface';
import { listMetadataPreviewTypes } from '../metadata-admin/preview-registry';
import { listMetadataInspectorTypes, getMetadataInspector } from '../metadata-admin/inspector-registry';
import { getMetadataDefaultInspector } from '../metadata-admin/default-inspector-registry';
import { getStudioCanvasPreview } from './studio-canvas-preview';

afterEach(cleanup);

/**
 * Assert the registries really are empty — **with a control that MUST hit**.
 *
 * `studio-canvas-preview` registers `object` at module scope in the very file
 * the control reads from, so a defined control proves the module graph loaded
 * and the query mechanism works. Without it the three zeros below would be
 * indistinguishable from a failed import, and a probe that renders a consumer
 * without proving the registry is empty has measured nothing.
 */
function assertRegistriesEmptyWithControl(): void {
  expect(getStudioCanvasPreview('object')).toBeTypeOf('function'); // control — MUST hit
  expect(listMetadataPreviewTypes()).toEqual([]);
  expect(listMetadataInspectorTypes()).toEqual([]);
  expect(getMetadataInspector('object')).toBeUndefined();
  expect(getMetadataInspector('flow')).toBeUndefined();
  expect(getMetadataDefaultInspector('object')).toBeUndefined();
}

describe('Data pillar field rail — a field click must never be a no-op (#6795 C, site 1)', () => {
  /**
   * ⭐ The site the card never listed, and the real silent failure. The rail's
   * guard read `(fieldSel.kind === 'group' || inspector)`, so a selected FIELD
   * with `getMetadataInspector('object')` undefined dropped the whole `aside`:
   * measured count **0**. Clicking a field did literally nothing while the
   * designer above went on saying "click a field to edit its properties".
   */
  it('opens the rail and names the missing inspector instead of swallowing the click', async () => {
    assertRegistriesEmptyWithControl();

    render(
      <MemoryRouter initialEntries={['/studio/com.example.showcase/data']}>
        <DataPillar packageId="com.example.showcase" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Form' }));
    const card = (await screen.findByText('Title')).closest('.cursor-grab') as HTMLElement;
    expect(card).toBeTruthy();
    fireEvent.click(card);

    // The regression this pin exists for: the aside used to be absent entirely.
    const rail = await waitFor(() => {
      const el = document.querySelector('aside');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(rail).toHaveTextContent('Field properties');
    expect(rail).toHaveTextContent(
      'No field inspector is registered in this session, so this field’s properties cannot be edited here.',
    );
    // ⛔ The measured mechanism forbids promising recovery.
    expect(rail.textContent ?? '').not.toMatch(/loading|try again/i);
  });
});

describe('Interfaces pillar — the canvas must not blame the roadmap (#6795 C, site 2)', () => {
  /**
   * The retired copy — "{type} shows a read-only preview for now; design support
   * is in progress." — was false twice over: this branch renders **no** preview
   * at all, and page design support **exists**. It blamed the platform's roadmap
   * for a chunk that did not load.
   */
  it('says the designers are unregistered, not that design support is in progress', async () => {
    assertRegistriesEmptyWithControl();

    render(
      <MemoryRouter initialEntries={['/studio/com.acme.app/interfaces']}>
        <InterfacesPillar packageId="com.acme.app" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTitle('page · home_page'));
    await waitFor(() => expect(screen.getByTestId('canvas-mode-toggle')).toBeInTheDocument(), {
      timeout: 4000,
    });

    await screen.findByText(
      'No metadata designers are registered in this session, so page cannot be previewed or designed here.',
    );
    expect(document.body.textContent ?? '').not.toContain('design support is in progress');
    expect(document.body.textContent ?? '').not.toContain('read-only preview');
  });

  /**
   * The other half of the same tableau: the rail told the author to click a
   * canvas that is not rendered. An instruction that cannot be followed is a
   * worse empty state than no instruction.
   */
  it('does not tell the author to click a canvas that is not there', async () => {
    assertRegistriesEmptyWithControl();

    render(
      <MemoryRouter initialEntries={['/studio/com.acme.app/interfaces']}>
        <InterfacesPillar packageId="com.acme.app" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTitle('page · home_page'));
    await waitFor(() => expect(screen.getByTestId('canvas-mode-toggle')).toBeInTheDocument(), {
      timeout: 4000,
    });

    await screen.findByText(
      'No metadata designers are registered in this session, so there is nothing to edit here.',
    );
    expect(document.body.textContent ?? '').not.toContain('Click a block on the canvas');
  });
});

describe('Automations pillar — the fourth site, found by sweeping (#6795 C, site 4)', () => {
  /**
   * Not on the card and not in the ruling's list of three: found by sweeping
   * every studio-design consumer that reads a metadata registry during render.
   * Same class as the Interfaces rail — with the registries unpopulated the
   * canvas degrades to a raw JSON dump, and BOTH the header chip ("Visual
   * orchestration · click a node to configure") and the rail ("Click a node on
   * the canvas, and its configuration appears here") went on instructing the
   * author to click nodes that are not rendered.
   */
  it('replaces both "click a node" instructions with the reason there are no nodes', async () => {
    assertRegistriesEmptyWithControl();

    render(
      <MemoryRouter initialEntries={['/studio/com.acme.app/automations']}>
        <AutomationsPillar packageId="com.acme.app" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('Nightly'));

    await waitFor(
      async () => {
        const hits = await screen.findAllByText(
          'No metadata designers are registered in this session, so this flow cannot be designed here.',
        );
        // Both the canvas header chip AND the rail — the two false instructions.
        expect(hits.length).toBe(2);
      },
      { timeout: 4000 },
    );
    expect(document.body.textContent ?? '').not.toContain('click a node to configure');
    expect(document.body.textContent ?? '').not.toContain('Click a node on the canvas');
  });
});
