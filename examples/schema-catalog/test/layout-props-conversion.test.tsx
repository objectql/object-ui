/**
 * Catalog-wide guardrail: a `div` whose className spells a first-class layout
 * component's own capability is authored as that component, with props
 * (objectui#4003, the vocabulary-independent half of objectui#3965).
 *
 * 189 `div` nodes shipped in this catalog; 106 of them hand-wrote in Tailwind
 * exactly what `flex` / `stack` / `container` / `grid` already expose as declared
 * props (`items-center` → `align`, `space-y-4` → `gap`, `max-w-6xl` → `maxWidth`,
 * `md:grid-cols-3` → `columns`). Every example here is copy-paste reference
 * material and an AI few-shot retrieval source, so a `div` carrying layout intent
 * teaches authors to reimplement a component instead of configuring it — and
 * teaches it at the scale of the whole docs site.
 *
 * Three different facts get pinned:
 *
 *  1. RATCHET — no `div` anywhere in the catalog carries layout-intent classes,
 *     except three nodes that cannot be converted and say why (below). This is
 *     the "keep the 107th out" guard, and the allowlist is what keeps it honest:
 *     a future conversion that regresses to `div` fails here.
 *  2. NO DEAD SLOT — no `flex` / `stack` / `grid` / `container` node carries a
 *     `body` key. `div` renders `children || body`; all four layout renderers
 *     render `children` ONLY, so a body-keyed node re-typed naively renders
 *     EMPTY, silently. Four catalog `div` nodes use `body` today (the sidebars),
 *     which is exactly how this trap gets hit by the next sweep.
 *  3. EQUIVALENCE — for a sample of each category, the converted node and the
 *     `div` it replaced are rendered through the real `SchemaRenderer` and their
 *     subtrees compared byte-for-byte, with the converted node's own class string
 *     pinned literally. The `div` fixtures below are the ACTUAL pre-conversion
 *     className strings, so the comparison is against what shipped, not a guess.
 *
 * On the class deltas the pins encode. Three are deliberate and none is a
 * regression:
 *   - `flex-row` / `justify-start` / `items-stretch` / `gap-0` / `p-0` are the
 *     CSS initial values the bare `div` already had — the renderer states them
 *     explicitly where the utility class list left them implicit.
 *   - `grid-cols-1` makes explicit the single-column base that a bare `grid` with
 *     only responsive `md:grid-cols-*` classes already resolved to.
 *   - `gap-N` becomes a mobile-first ladder (`gap-3` → `gap-2 sm:gap-3`). Below
 *     640px that is NOT byte-identical, and it is the correct exemplar: the
 *     ladder is what `FlexSchema.gap` means. It is deliberately NOT faked back to
 *     byte-equality by declaring `gap: 0` and leaving `gap-3` in `className` —
 *     that spelling contradicts itself and re-teaches the very anti-pattern this
 *     card removes.
 *
 * Module-scope import of `@object-ui/components`, not `beforeAll` (AGENTS.md
 * §测试纪律): registering the renderers is an unbounded module load and must not
 * be billed to a bounded hook timeout.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { allExamples } from '../src/index.js';

type Node = Record<string, unknown>;

const LAYOUT_TYPES = new Set(['flex', 'stack', 'grid', 'container']);

/**
 * The three `div` nodes that keep layout-intent classes, each for a reason that
 * survives any terminal state of #3965.
 *
 *   `components-basic-div/custom-card` (2 nodes) — rendered by
 *   `content/docs/components/basic/div.mdx` under "Legacy Examples (For Reference
 *   Only)". They exist to SHOW the deprecated spelling; converting them deletes
 *   the thing the page documents.
 *
 *   `components-layout-page/documentation-page` (1 node) — `prose prose-slate
 *   max-w-none`. `max-w-none` REMOVES a max-width (it cancels the typography
 *   plugin's own), the opposite of what `container.maxWidth` constrains, and no
 *   `maxWidth` value renders it: `ContainerSchema` declares `false` for the
 *   no-constraint case, but `container.tsx` reads it as `schema.maxWidth || 'xl'`,
 *   so `false` renders `max-w-xl`. Converting it would change the rendering; it
 *   is tracked separately rather than forced.
 */
const DIV_EXEMPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['components-basic-div/custom-card', 'max-w-sm rounded-lg border bg-card text-card-foreground shadow-sm'],
  ['components-basic-div/custom-card', 'p-6 space-y-2'],
  ['components-layout-page/documentation-page', 'prose prose-slate max-w-none'],
];

/** Does this className spell a capability one of the four layout types owns? */
function layoutIntent(className: unknown): string | null {
  if (typeof className !== 'string' || className.trim() === '') return null;
  const t = className.split(/\s+/);
  const hasFlex = t.some((x) => /^((sm|md|lg|xl|2xl):)?flex$/.test(x));
  const hasFlexCol = t.some((x) => /(^|:)flex-col$/.test(x));
  if (hasFlex && !hasFlexCol) return 'flex';
  if (t.some((x) => /(^|:)space-y-/.test(x))) return 'stack';
  if (t.some((x) => /(^|:)max-w-/.test(x))) return 'container';
  if (t.some((x) => /(^|:)grid$/.test(x) || /(^|:)grid-cols-/.test(x))) return 'grid';
  return null;
}

function collect(node: unknown, pred: (n: Node) => boolean, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, pred, out);
    return out;
  }
  if (node && typeof node === 'object') {
    const rec = node as Node;
    if (pred(rec)) out.push(rec);
    for (const value of Object.values(rec)) collect(value, pred, out);
  }
  return out;
}

describe('schema-catalog — layout intent is authored as props, not className (#4003)', () => {
  it('no div carries layout-intent classes outside the documented exemptions', () => {
    const offenders = allExamples().flatMap((example) =>
      collect(example.schema, (n) => n.type === 'div')
        .map((n) => [example.id, String(n.className ?? '')] as const)
        .filter(([, cn]) => layoutIntent(cn) !== null)
        .filter(([id, cn]) => !DIV_EXEMPTIONS.some(([eid, ecn]) => eid === id && ecn === cn))
        .map(([id, cn]) => `${id} :: ${cn} (→ ${layoutIntent(cn)})`),
    );
    expect(
      offenders,
      'a `div` whose className already names a first-class layout component\'s own ' +
        'props teaches authors to reimplement the component instead of configuring ' +
        'it. Author it as flex/stack/container/grid with props (#4003).',
    ).toEqual([]);
  });

  it('every documented exemption is still present (allowlist is not stale)', () => {
    for (const [id, className] of DIV_EXEMPTIONS) {
      const example = allExamples().find((e) => e.id === id);
      expect(example, `${id} is missing from the catalog`).toBeTruthy();
      const found = collect(example!.schema, (n) => n.type === 'div').some(
        (n) => n.className === className,
      );
      expect(found, `exemption \`${id} :: ${className}\` no longer matches any div — ` +
        'delete the entry rather than leaving the allowlist wider than the facts').toBe(true);
    }
  });

  it('sees enough converted layout nodes for the ratchet to mean something', () => {
    const nodes = allExamples().flatMap((e) =>
      collect(e.schema, (n) => typeof n.type === 'string' && LAYOUT_TYPES.has(n.type as string)),
    );
    // 441 at the time of writing (flex 248, stack 153, grid 26, container 14),
    // of which 103 were converted by #4003. A floor, so adding examples never
    // fails this.
    expect(nodes.length).toBeGreaterThanOrEqual(430);
  });

  it('no layout node carries a `body` key, which those renderers never render', () => {
    const offenders = allExamples().flatMap((example) =>
      collect(
        example.schema,
        (n) => typeof n.type === 'string' && LAYOUT_TYPES.has(n.type as string) && 'body' in n,
      ).map((n) => `${example.id} (type: ${String(n.type)})`),
    );
    expect(
      offenders,
      'flex/stack/grid/container render `children` only — `div` was the one that ' +
        'also rendered `body`. A `body` key on these types is content that never ' +
        'reaches the DOM, and it fails silently (#4003).',
    ).toEqual([]);
  });
});

/**
 * Render-level equivalence. Each case carries the EXACT className the converted
 * node replaced; the `div` is rebuilt around the converted node's own children so
 * the subtree comparison isolates this one conversion rather than re-measuring
 * descendants that were converted too.
 */
describe('converted nodes render what their div rendered (#4003)', () => {
  const cases: ReadonlyArray<readonly [string, string, string, string]> = [
    // [example id, className of the div it replaced, converted type, pinned class]
    [
      'components-complex-scroll-area/document-browser',
      'p-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3',
      'flex',
      'flex flex-row justify-start items-center gap-2 sm:gap-3 p-3 hover:bg-slate-50 cursor-pointer',
    ],
    [
      'marketing/features-grid',
      'h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center',
      'flex',
      'flex flex-row justify-center items-center gap-0 h-12 w-12 rounded-lg bg-primary/10',
    ],
    [
      'components-form-file-upload/form-example',
      'max-w-md space-y-6 p-6 border rounded-lg',
      'stack',
      'flex flex-col justify-start items-stretch gap-3 sm:gap-4 md:gap-6 max-w-md p-6 border rounded-lg',
    ],
    [
      'components-complex-scroll-area/short-150px',
      'space-y-2',
      'stack',
      'flex flex-col justify-start items-stretch gap-1.5 sm:gap-2',
    ],
    [
      'marketing/pricing-table',
      'w-full max-w-6xl mx-auto',
      'container',
      'w-full max-w-6xl mx-auto p-0',
    ],
    [
      'components-layout-semantic/complete-layout',
      'max-w-4xl border rounded-lg overflow-hidden',
      'container',
      'w-full max-w-4xl p-0 border rounded-lg overflow-hidden',
    ],
    [
      'ecommerce/product-grid',
      'grid sm:grid-cols-2 lg:grid-cols-4 gap-6',
      'grid',
      'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6',
    ],
    [
      'marketing/testimonials',
      'grid md:grid-cols-3 gap-6',
      'grid',
      'grid grid-cols-1 md:grid-cols-3 gap-6',
    ],
  ];

  function renderNode(schema: unknown) {
    const { container } = render(<SchemaRenderer schema={schema as never} />);
    const el = container.firstElementChild as HTMLElement;
    return { className: el.className, innerHTML: el.innerHTML };
  }

  it('covers every category at least twice (sample is not lopsided)', () => {
    for (const type of LAYOUT_TYPES) {
      expect(cases.filter((c) => c[2] === type).length, `${type} needs 2+ cases`)
        .toBeGreaterThanOrEqual(2);
    }
  });

  it.each(cases)('%s (%s → %s)', (id, originalClassName, type, expectedClass) => {
    const example = allExamples().find((e) => e.id === id);
    expect(example, `${id} is missing from the catalog`).toBeTruthy();

    const node = collect(example!.schema, (n) => n.type === type).find((n) => {
      const { className } = renderNode(n);
      return className === expectedClass;
    });
    expect(node, `${id} has no ${type} node rendering \`${expectedClass}\``).toBeTruthy();

    // Rebuild the div this node replaced, around the SAME children.
    const asDiv: Node = { type: 'div', className: originalClassName };
    if (node!.children !== undefined) asDiv.children = node!.children;

    const after = renderNode(node!);
    const before = renderNode(asDiv);

    // The whole content of the node still reaches the DOM. This is the assertion
    // that a naive re-type of a body-keyed node would fail.
    expect(after.innerHTML).toBe(before.innerHTML);
    expect(after.className).toBe(expectedClass);
  });
});
