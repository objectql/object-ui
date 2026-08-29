/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `ui` layout primitives DECLARE the containment they render (objectui#6740).
 *
 * `flex` renders `schema.children` and always has, but its registration omitted
 * `isContainer` while `grid`, `card`, `container` and `stack` — same directory,
 * same namespace — all declared it. The render path never reads the flag, so
 * nothing was broken at runtime; the consumers are elsewhere, and the gap made
 * them contradict the renderer.
 *
 * MEASURED on b76ca6764, through the mechanism rather than the property: the
 * manifest built the way the app builds it, with a `flex` node carrying children
 * put through `validateTree`, returned `["not-a-container"]`, while `grid` /
 * `card` / `container` under the identical probe returned `[]`. Downstream,
 * objectstack's three shipped `examples/app-showcase` html pages drew 232
 * diagnostics of which 32 were warnings — every one of them `not-a-container` on
 * `flex`, and `flex` the only source of them.
 *
 * WHY THIS FILE PINS FOUR COMPONENTS AND NOT ONE. The defect's shape is "three
 * declare it and one does not". A pin covering only `flex` would let the next
 * registration rot exactly the same way and stay green while it did, so the
 * assertion is over the family. `stack` rides along for the same reason.
 *
 * WHY THROUGH `validateTree` AND NOT `getConfig(t).isContainer`. The property is
 * only interesting because a mechanism reads it; asserting the literal would
 * stay green if the containment check were removed, mis-keyed, or fed a manifest
 * the tag is missing from — the three ways this fact dies without anyone
 * noticing. The reachability controls below exist for the same reason.
 */

import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, AdapterCtx } from '@object-ui/react';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';

// Module scope, not a hook: this import IS the registration (AGENTS.md
// §测试纪律 — an unbounded module load must not be billed to a bounded window).
import '../renderers';

const CONTAINMENT = 'not-a-container';

/** The four `ui` layout registrations whose whole job is to hold children. */
const LAYOUT_CONTAINERS = ['flex', 'grid', 'card', 'container'] as const;

/**
 * The manifest the running app validates against, built the way the app builds
 * it — keyed by every KNOWN registry tag rather than by `getAllConfigs()`, whose
 * `.type` is always the namespaced form. Mirrors `getJsxManifest()` in
 * `renderers/layout/page.tsx:462` (module-private, hence the four lines here).
 * Key it off `getAllConfigs()` instead and the bare `flex` tag authors write is
 * absent from the manifest, so every assertion below would pass on
 * `unknown-component` without ever reaching the containment check.
 */
const diagnose = (schema: unknown): Diagnostic[] => {
  const configs = ComponentRegistry.getKnownTypes().map((t) => {
    const meta = ComponentRegistry.getMeta(t);
    return { type: t, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
  });
  const manifest = manifestFromConfigs(configs as unknown as Parameters<typeof manifestFromConfigs>[0]);
  return validateTree(schema as SchemaElement, manifest).diagnostics;
};

const withChildren = (type: string) => ({
  type,
  children: [{ type: 'text', content: 'child' }],
});

describe('the ui layout primitives accept children without warning (objectui#6740)', () => {
  it.each(LAYOUT_CONTAINERS)('`%s` with children draws no `not-a-container`', (type) => {
    const diagnostics = diagnose(withChildren(type));

    // Reachability BEFORE absence — an empty result proves nothing if the
    // containment branch never ran. Two ways it silently would not: an
    // unresolved tag reports `unknown-component` and never reaches the check,
    // and the branch is guarded by `node.children?.length`.
    expect(diagnostics.filter((d) => d.code === 'unknown-component')).toEqual([]);
    expect(withChildren(type).children.length).toBeGreaterThan(0);

    // Filtered by code, not against an empty list: this file owns the
    // CONTAINMENT fact only, so a future diagnostic on some other key belongs
    // to that key's pin rather than here.
    expect(diagnostics.filter((d) => d.code === CONTAINMENT)).toEqual([]);
  });

  it('still reports `not-a-container` for a component that genuinely takes none', () => {
    // The control that keeps every assertion above meaningful. Without it the
    // suite would stay green if the containment check were deleted outright, or
    // if `isContainer` were defaulted on — either of which turns this file into
    // a measurement of nothing. `badge` is a leaf: it renders its own label and
    // never reads `schema.children`, so children under it ARE an authoring
    // mistake the author must still hear about.
    //
    // If `badge` ever legitimately becomes a container, this goes red — move the
    // control to another childless registration rather than deleting it.
    const codes = diagnose(withChildren('badge')).map((d) => d.code);
    expect(codes).toContain(CONTAINMENT);
  });
});

describe('the declaration reaches the consumers that read it (objectui#6740)', () => {
  it.each(LAYOUT_CONTAINERS)('`%s` reports as a container on the public tier', (type) => {
    // The second consumer, and the reason it is pinned rather than left
    // implicit: `renderers/layout/react-page.tsx:77` builds the JSX scope of
    // every `kind:'react'` page with `if (!tag || cfg.isContainer) continue;`,
    // reading THIS predicate off `getPublicConfigs()` — not off `getMeta()`.
    // While `flex` omitted the flag it was the one layout primitive of the five
    // still injected there, contradicting
    // `content/docs/guide/react-pages.md` ("Layout containers are deliberately
    // not injected … `<flex>`, `<grid>`, `<card>` and friends have no injected
    // wrapper"). Declaring it lines `flex` up with its four siblings.
    const cfg = ComponentRegistry.getPublicConfigs().find((c: { type: string }) => c.type === type);
    expect(cfg, `\`${type}\` is not in the public tier`).toBeTruthy();
    expect((cfg as { isContainer?: boolean }).isContainer).toBe(true);
  });

  it('leaf blocks stay injectable into a react page — containers are the only ones dropped', () => {
    // The direction control for the assertion above. If this were empty or all
    // falsy, "containers are excluded" would be indistinguishable from
    // "everything is excluded", and the pin would be measuring the wrong fact.
    for (const leaf of ['badge', 'button', 'image', 'icon']) {
      const cfg = ComponentRegistry.getPublicConfigs().find((c: { type: string }) => c.type === leaf);
      expect(cfg, `\`${leaf}\` is not in the public tier`).toBeTruthy();
      expect((cfg as { isContainer?: boolean }).isContainer).toBeFalsy();
    }
  });
});

describe('flex still renders its children (objectui#6740)', () => {
  it('renders children through the real SchemaRenderer, as it always did', async () => {
    // The scope guard for acceptance "nothing else about flex changes". The
    // render path does not consult `isContainer` — `SchemaRenderer` passes the
    // whole node as `schema` and `flex` re-reads `schema.children` itself —
    // so declaring the flag must leave this untouched.
    const { container } = render(
      <AdapterCtx.Provider value={null as never}>
        <SchemaRenderer
          schema={{
            type: 'flex',
            direction: 'col',
            children: [{ type: 'badge', label: 'kept' }],
          } as never}
        />
      </AdapterCtx.Provider>,
    );

    await waitFor(() => expect(container.querySelector('[data-obj-type="flex"]')).toBeTruthy());
    const root = container.querySelector('[data-obj-type="flex"]');
    expect(root?.className).toContain('flex-col');
    expect(container.textContent).toContain('kept');
  });
});
