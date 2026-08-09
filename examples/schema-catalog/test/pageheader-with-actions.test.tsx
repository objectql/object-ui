/**
 * The PageHeader docs demo renders the COMPONENT, not a hand-rolled header
 * (objectui#3787).
 *
 * `layout-page-header/pageheader-with-actions` is the only runnable example on
 * `content/docs/layout/page-header.mdx`. It used to be a `div`/`text`/`button`
 * tree carrying Tailwind classes copied out of `PageHeader.tsx` — so the page
 * documenting the component shipped a copy-paste reference that told authors
 * (AI authors included) to bypass it, it exercised none of `page-header`'s
 * rendering, and it held a third, already-drifted copy of the component's
 * spacing numbers (objectui#3786 fixed the second copy, in the prose).
 *
 * Four things are pinned here, and they are different facts:
 *
 *  1. SHAPE — the example's root node is a `page-header`, and it contains none
 *     of the class strings that only exist inside `PageHeader.tsx`. This is the
 *     regression that would fire if anyone hand-rolls the header again.
 *  2. RENDER — driven through the real `SchemaRenderer`, the node produces the
 *     header: an `<h1>` title, the subtitle, and BOTH schema children in the
 *     right-hand slot.
 *  3. VALIDATE — the same JSON, put through the manifest the app really builds
 *     from the live registry, draws no `not-a-container` diagnostic (#3900).
 *  4. VALIDATE, PROPS — the same JSON draws no `unknown-prop` either, and an
 *     array-valued `navigation-renderer.items` draws no `type-mismatch` (#3972).
 *     Same lie as (3) on the prop face instead of the containment face.
 *
 * (2) and (3) are two halves of one contradiction that used to be live. The
 * render path never consults `isContainer` — `SchemaRenderer` strips `children`
 * from the React props but always passes the whole node as `schema`, and
 * `PageHeader` re-introduces `schema.children` itself — so the header rendered
 * its children correctly while `packages/layout/src/index.ts` omitted
 * `isContainer: true` from the registration. The flag's consumers are elsewhere:
 * `sdui-parser`'s `not-a-container` diagnostic, the Studio palette, and the
 * react-page tag map. So the omission never blocked anything; it made the
 * VALIDATOR contradict the docs, the demo and the render — an author following
 * this very page got a warning telling them their working schema was invalid.
 * #3900 added the flag (maintainer ruling, route A: `children` is a base
 * property of every protocol node, not a `PageHeaderProps` key, so declaring it
 * mints no authoring surface outside the spec). (3) is what keeps the two faces
 * from drifting apart again in either direction.
 *
 * Module-scope imports, not `beforeAll` (AGENTS.md §测试纪律): the child
 * `button` node resolves through `@object-ui/components`' registration
 * side-effects, and paying that cost at import time keeps it out of every
 * test/hook timeout budget.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer } from '@object-ui/react';
import { registerLayout } from '@object-ui/layout';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import type { Diagnostic, SchemaElement } from '@object-ui/sdui-parser';
import { getExample } from '../src/index.js';

const EXAMPLE_ID = 'layout-page-header/pageheader-with-actions';

/**
 * Class strings that exist to style the header and live in `PageHeader.tsx`
 * (`:210`, `:211`, `:231`, `:233`). Their presence in the example JSON is the
 * signature of a hand-rolled copy — the defect, not a styling choice.
 */
const COMPONENT_OWNED_CLASSES = [
  'text-2xl',
  'tracking-tight',
  'text-muted-foreground',
  'pb-4',
];

beforeAll(() => {
  registerLayout();
});

/**
 * The manifest the running app validates against, built the way the app builds
 * it — keyed by every KNOWN registry tag (bare and namespaced) rather than by
 * `getAllConfigs()`, whose `.type` is always the namespaced form. Mirrors
 * `getJsxManifest()` in `packages/components/src/renderers/layout/page.tsx`
 * (module-private, hence the four lines here): key it off `getAllConfigs()`
 * instead and the bare `page-header` tag authors write is absent from the
 * manifest, so every assertion below would pass on `unknown-component` and
 * never reach the containment check at all.
 */
const diagnose = (schema: unknown): Diagnostic[] => {
  const configs = ComponentRegistry.getKnownTypes().map((t) => {
    const meta = ComponentRegistry.getMeta(t);
    return { type: t, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
  });
  const manifest = manifestFromConfigs(configs as unknown as Parameters<typeof manifestFromConfigs>[0]);
  return validateTree(schema as SchemaElement, manifest).diagnostics;
};

describe('the page-header docs demo uses the page-header component (#3787)', () => {
  it('is rooted at a `page-header` node', () => {
    const schema = getExample(EXAMPLE_ID).schema as { type?: string };
    expect(schema.type).toBe('page-header');
  });

  it('declares title/subtitle on the component instead of restating its classes', () => {
    const schema = getExample(EXAMPLE_ID).schema as Record<string, unknown>;
    expect(schema.title).toBe('Users');
    expect(schema.subtitle).toBe('Manage your team members and permissions');
    // The third copy of the spacing/typography numbers (#3786) is gone, and
    // stays gone: re-hand-rolling the header re-introduces these strings.
    const json = JSON.stringify(schema);
    for (const cls of COMPONENT_OWNED_CLASSES) {
      expect(json, `example JSON should not restate \`${cls}\``).not.toContain(cls);
    }
  });

  it('renders the real header: h1 title, subtitle, and both children in the action slot', () => {
    const { container } = render(
      <SchemaRenderer schema={getExample(EXAMPLE_ID).schema as never} />,
    );

    // The title is the document heading — the page's Accessibility section
    // claims an `<h1>`, and the hand-rolled demo it replaces emitted a `span`.
    const h1 = container.querySelector('h1');
    expect(h1?.textContent).toBe('Users');
    expect(screen.getByText('Manage your team members and permissions')).toBeTruthy();

    // Both children reach the right-hand slot. This held even while the
    // registration omitted `isContainer` — the render path never reads the flag
    // (see the module header), which is why the omission was invisible here and
    // only the validator complained.
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add User' })).toBeTruthy();
  });

  it('renders the container spacing the docs Styling section states (#3786)', () => {
    // Pins the CODE side of the three Container bullets in
    // `content/docs/layout/page-header.mdx`: `pb-4` with no responsive
    // variant, `gap-3` on the outer column, and a `border-b`. Changing any of
    // them turns this red, which is the prompt to update that section — the
    // doc drifted precisely because nothing was watching. (Mechanising the
    // prose itself is the separate decision #3786 deferred.)
    const { container } = render(
      <SchemaRenderer schema={getExample(EXAMPLE_ID).schema as never} />,
    );
    const root = container.querySelector('[data-obj-type="page-header"]');
    const cls = root?.className ?? '';

    expect(cls).toContain('gap-3');
    expect(cls).toContain('pb-4');
    expect(cls).toContain('border-b');
    // No responsive padding variant — the doc used to promise `pb-8` on desktop.
    expect(cls).not.toMatch(/\b(sm|md|lg|xl):pb-/);
  });
});

/**
 * The validator agrees with the docs, the demo and the render (#3900).
 *
 * Two directions, and BOTH are load-bearing. Asserting only the first would
 * leave the suite green if someone silenced the containment check outright, or
 * flipped `isContainer` on by default — the test would then be measuring
 * nothing. The second case is the control that keeps the first one meaningful.
 */
describe('the documented demo validates clean of `not-a-container` (#3900)', () => {
  const CONTAINMENT = 'not-a-container';

  it('reports no `not-a-container` for the demo the docs page ships', () => {
    const schema = getExample(EXAMPLE_ID).schema as { children?: unknown[] };
    const diagnostics = diagnose(schema);

    // Reachability BEFORE the absence — an empty result proves nothing if the
    // containment branch never ran. Two ways it silently would not:
    // `validateTree` reports `unknown-component` and returns before the
    // containment check when the tag is missing from the manifest, and the
    // branch is guarded by `node.children?.length`, so a demo that lost its
    // children would satisfy the assertion below for the wrong reason.
    expect(diagnostics.filter((d) => d.code === 'unknown-component')).toEqual([]);
    expect(schema.children?.length ?? 0).toBeGreaterThan(0);

    // Filtered by code, not asserted against an empty diagnostic list. When this
    // was written the demo's `icon` drew a live `unknown-prop` — the same lie as
    // #3900 on the prop face — which #3972 has since fixed and pins in the
    // describe below. The filter stays: this test owns the CONTAINMENT fact only,
    // so a future diagnostic on another key belongs to that key's pin, not here.
    expect(diagnostics.filter((d) => d.code === CONTAINMENT)).toEqual([]);
  });

  it('still reports `not-a-container` for a component that genuinely takes none', () => {
    // The control. `navigation-renderer` (registered in the SAME file as the
    // #3900 change) is driven entirely by its `items` prop and never reads
    // `schema.children`, so children under it ARE an authoring mistake and the
    // author must still hear about it. If this component ever legitimately
    // becomes a container, this assertion goes red — move the control to
    // another childless registration rather than deleting it.
    // `items` is deliberately omitted (it is not `required`, so its absence
    // draws nothing): this control is about containment only. It used to have a
    // second reason — writing `items: []` ALSO drew a `type-mismatch`, because the
    // registration declared that prop `type: 'object'` while
    // `NavigationRendererProps.items` is `NavigationItem[]`. That defect is fixed
    // (#3972) and pinned in the describe below; the omission here is now about
    // keeping this control single-fact, nothing more.
    const codes = diagnose({
      type: 'navigation-renderer',
      children: [{ type: 'button', label: 'Nope' }],
    }).map((d) => d.code);

    expect(codes).toContain(CONTAINMENT);
  });
});

/**
 * The prop face of the same agreement (#3972).
 *
 * `registerLayout()`'s `inputs` lists are what `sdui-parser` validates a node's
 * top-level props against, so a key the renderer reads and `inputs` omits comes
 * back as `unknown-prop`, and a key declared with the wrong `type` comes back as
 * `type-mismatch` — on CORRECT authoring, both times. Two keys were in that
 * state: `page-header.icon` (rendered at `PageHeader.tsx:224-226`, declared by the
 * spec, written by the demo below) and `navigation-renderer.items` (declared
 * `object`, actually `NavigationItem[]`).
 *
 * Every assertion here comes in pairs, positive then control, because "no
 * diagnostic" is exactly what a silenced check also looks like: if `unknown-prop`
 * or `type-mismatch` were removed from `validate.ts`, or `inputs` were widened to
 * accept anything, the positive halves would all still pass. The controls are
 * chosen so they can only stay green while the check is still working.
 */
describe('the declaration face matches what the renderers read (#3972)', () => {
  const codesFor = (schema: unknown): string[] => diagnose(schema).map((d) => d.code);

  it('draws no `unknown-prop` on the demo the docs page ships', () => {
    const schema = getExample(EXAMPLE_ID).schema as Record<string, unknown>;

    // Reachability first: the demo must still WRITE `icon`, otherwise the absence
    // below is satisfied by a fixture that stopped exercising the key. (The docs
    // page documents `icon` in its Component Props block, so a demo without one
    // is its own defect.)
    expect(schema.icon).toBe('users');
    expect(diagnose(schema).filter((d) => d.code === 'unknown-component')).toEqual([]);

    expect(diagnose(schema).filter((d) => d.code === 'unknown-prop')).toEqual([]);
  });

  it('still draws `unknown-prop` for a key the declaration deliberately withholds', () => {
    // The control, and it is a real key rather than a nonsense one: `description`
    // is the legacy alias `PageHeader.tsx:143` still READS, which objectui#3226
    // removed from `inputs` on purpose so the registry stops teaching a second
    // dialect for `subtitle`. It must keep drawing `unknown-prop` — that warning
    // is the narrowing doing its job. If this goes green, either the alias was
    // re-declared or the check stopped running, and the assertion above is then
    // measuring nothing.
    const schema = { ...(getExample(EXAMPLE_ID).schema as Record<string, unknown>), description: 'x' };
    expect(codesFor(schema)).toContain('unknown-prop');
  });

  it('accepts the `actions` array the docs page documents', () => {
    // `actions` is read at `PageHeader.tsx:119` / `:192-196` and declared by the
    // spec, so it was `unknown-prop` for the same reason `icon` was. Type matters
    // as much as presence here: it is declared `array`, matching the canonical
    // `page:header`, so the array form authors write validates clean…
    expect(codesFor({ type: 'page-header', title: 'Users', actions: ['export'] })).toEqual([]);
    // …and a non-array is now reported instead of silently accepted.
    expect(codesFor({ type: 'page-header', title: 'Users', actions: { export: true } })).toContain(
      'type-mismatch',
    );
  });

  it('accepts an array-valued `navigation-renderer.items`, and reports an object', () => {
    expect(codesFor({ type: 'navigation-renderer', items: [] })).toEqual([]);
    expect(
      codesFor({
        type: 'navigation-renderer',
        items: [{ id: 'home', type: 'object', label: 'Home', objectName: 'home' }],
      }),
    ).toEqual([]);

    // The control, and the direction is inverted rather than absent: this exact
    // object shape was the ONLY one that validated clean before #3972, so the pin
    // is not "a diagnostic disappeared" but "the two shapes swapped verdicts".
    // The message is asserted too — a `type-mismatch` still saying "expected an
    // object" would mean the declaration never moved.
    const objectValued = diagnose({ type: 'navigation-renderer', items: { home: {} } });
    expect(objectValued.map((d) => d.code)).toContain('type-mismatch');
    expect(objectValued.find((d) => d.code === 'type-mismatch')?.message).toContain(
      'expected an array',
    );
  });
});
