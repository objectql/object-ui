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
 * Two things are pinned here, and they are different facts:
 *
 *  1. SHAPE — the example's root node is a `page-header`, and it contains none
 *     of the class strings that only exist inside `PageHeader.tsx`. This is the
 *     regression that would fire if anyone hand-rolls the header again.
 *  2. RENDER — driven through the real `SchemaRenderer`, the node produces the
 *     header: an `<h1>` title, the subtitle, and BOTH schema children in the
 *     right-hand slot.
 *
 * (2) is worth a test rather than an eyeball because the registration for
 * `page-header` (`packages/layout/src/index.ts`) does NOT declare
 * `isContainer: true`, which reads like children could not reach the slot.
 * They do: `isContainer` is registry metadata that the render path never
 * consults (its consumers are `sdui-parser`'s `not-a-container` diagnostic, the
 * Studio palette, and the react-page tag map). `SchemaRenderer` strips
 * `children` from the React props but always passes the whole node as `schema`,
 * and `PageHeader` re-introduces `schema.children` itself. That is a load-
 * bearing coincidence of two files, so it gets a pin.
 *
 * Module-scope imports, not `beforeAll` (AGENTS.md §测试纪律): the child
 * `button` node resolves through `@object-ui/components`' registration
 * side-effects, and paying that cost at import time keeps it out of every
 * test/hook timeout budget.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { registerLayout } from '@object-ui/layout';
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

    // Both children reach the right-hand slot despite the registration not
    // declaring `isContainer` — see the module header.
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
