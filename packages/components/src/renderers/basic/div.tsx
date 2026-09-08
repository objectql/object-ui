/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import { isHtmlTierNode } from '@object-ui/sdui-parser';
import type { DivSchema } from '@object-ui/types';
import { renderChildren } from '../../lib/utils';
import { forwardRef } from 'react';

/**
 * Deprecated types already reported in this module instance — the notice is a
 * property of the TYPE, not of the node, so one report per page load is the
 * whole signal. Mirrors the warn-once machinery in `layout/containers.tsx`.
 */
const _warnedDeprecations = new Set<string>();

/**
 * Report the deprecation ONCE per type per module load.
 *
 * The renderer used to warn on every single render, which turns any page with
 * many `div` nodes into a console flood: the docs schema-catalog index renders
 * 400+ example thumbnails and produced ~190 identical notices, burying the
 * real errors underneath (it twice cost a browser-verification run the signal
 * it was looking for — objectui#3965, discovered during #3903 / PR #3964).
 *
 * The deprecation itself is unchanged and still fires in dev builds; only the
 * repetition is dropped. Order matters: the production check returns BEFORE the
 * seen-set is marked, so a production render never suppresses the dev notice.
 */
function warnDeprecatedOnce(type: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (_warnedDeprecations.has(type)) return;
  _warnedDeprecations.add(type);
  console.warn(message);
}

/**
 * The notice, including WHICH AUTHORING SURFACE it is about.
 *
 * Scope is part of the message, not decoration. This type is deprecated on the
 * JSON surface and simultaneously a permanent, first-class tag of the
 * `kind:'html'` tier — an author there writes the plain box tag and our own
 * parser maps it straight through, and no other spelling exists for them to
 * migrate to. A notice that says the type is deprecated FULL STOP is therefore
 * false for one of its two readers, and it was the reader who could do nothing
 * about it who kept receiving it (objectui#4000).
 *
 * ## The guidance was RE-RULED in objectui#6877 — it is no longer #4000's bytes
 *
 * objectui#4000 recorded the migration guidance as "byte-for-byte what it was",
 * and that pin was right for as long as the guidance was merely INCOMPLETE. It
 * became FALSE when the neutral `box` container landed (objectui#3965 /
 * PR #6878). Measured through the real `SchemaRenderer`, on a node carrying an
 * authored `className` and one text child — every replacement the old bullets
 * named changes the rendered result:
 *
 *   card       + `rounded-lg border bg-card text-card-foreground shadow-sm`,
 *              and the children move inside an extra `CardContent` element
 *              (1 element becomes 2)
 *   flex       + `flex flex-row justify-start items-start gap-1.5 sm:gap-2`
 *   container  + `w-full max-w-xl mx-auto p-2 sm:p-3 md:p-4`
 *   stack      + `flex flex-col justify-start items-stretch gap-1.5 sm:gap-2`
 *   grid       + `grid grid-cols-2 gap-4`
 *
 * and four of those five — `flex`, `container`, `stack`, `grid` — read
 * `children` ONLY, so a node that authored `body` loses its content SILENTLY,
 * at an unchanged element count. `box` is the one class-transparent swap, and
 * the old text never named it.
 *
 * That is why this is worth a re-ruling rather than a nice-to-have. Deprecation
 * guidance is followed LITERALLY, by humans and by generating models reading
 * the console alike, so a notice naming only non-drop-in replacements
 * manufactures exactly the conversions objectui#3965 measured and rejected.
 *
 * ⚠️ `box` is not unconditionally drop-in either, and the text below says so
 * instead of selling it as one: it too reads `children` only, so `body` content
 * has to move first. A recommendation that is true WITH a caveat beats a
 * cleaner one that is false — trading one false recommendation for another
 * would be worse than leaving the old text alone.
 *
 * The four surfaces that state this guidance move in ONE stroke: this notice,
 * the declaration below, `content/docs/components/basic/div.mdx`, and the
 * `components-basic-div` catalog category. They are held together by
 * `__tests__/div-guidance-names-box.test.tsx` (objectui#6877) and, for the
 * first two, by `__tests__/deprecation-guidance-agreement.test.tsx`
 * (objectui#6823).
 *
 * ⛔ `span`'s notice is a SEPARATE judgement and is deliberately untouched:
 * `box` is a block-level container, and nothing about the inline replacement
 * story changed. The same pin file asserts that this edit did not sweep it in.
 *
 * ## Quoting convention — load-bearing, not style
 *
 * Inside the bullets, DOUBLE QUOTES mean "component type name" and nothing
 * else; property names take backticks. The objectui#6823 agreement test reads
 * the offered alternatives out of both statements as their double-quoted runs,
 * so a `"body"` written with the wrong quotes would arrive as a component type
 * this notice claims to offer.
 */
const DIV_DEPRECATION_NOTICE =
  '[ObjectUI] The "div" component is deprecated for JSON-authored pages. Please use Shadcn components instead:\n' +
  '  - For a plain wrapper the drop-in swap is "box": same element, your `className` verbatim, no layout of its own.\n' +
  '  - Reach for "card", "flex", "container", "stack", or "grid" only when you want their layout — each injects classes of its own, and "card" also moves children into an extra element.\n' +
  '  - Move any `body` content into `children` first: every replacement above except "card" reads `children` only, so a blind retype drops it silently at an unchanged element count.\n' +
  '  This applies to JSON-authored nodes. In a kind:\'html\' page the tag is part of that tier\'s own\n' +
  '  vocabulary, is compiled straight through, and is not reported here.\n' +
  'See documentation at https://www.objectui.org/docs/components for alternatives.';

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const DivRenderer = forwardRef<HTMLDivElement, { schema: DivSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: DivSchema; className?: string; [key: string]: any }, ref) => {
    // Deprecation notice — JSON-authored nodes only (objectui#4000), once per
    // module load (objectui#3965, see warnDeprecatedOnce).
    //
    // ORDER, same discipline as the production early-return inside
    // warnDeprecatedOnce: the exemption is checked BEFORE the seen-set is
    // marked. An html-tier node rendering first must not latch the guard, or it
    // would swallow the notice a JSON-authored node earns later on the same
    // page — silencing exactly the reader this notice is for.
    //
    // The test is provenance, established by the producer (the parser stamps
    // what it emits), not a guess about the node's shape here.
    if (!isHtmlTierNode(schema)) {
      warnDeprecatedOnce('div', DIV_DEPRECATION_NOTICE);
    }

    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...divProps
    } = props;
    
    return (
    <div 
        ref={ref}
        className={className} 
        {...divProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    >
      {renderChildren(schema.children || schema.body)}
    </div>
  );
  }
);

ComponentRegistry.register('div',
  DivRenderer,
  {
    namespace: 'ui',
    label: 'Container (Deprecated)',
    /**
     * The MACHINE-READABLE statement of the deprecation above (objectui#6674).
     *
     * Until this key existed, the only two statements that this type is
     * deprecated were `DIV_DEPRECATION_NOTICE` — a string literal inside a
     * renderer — and the word inside `label`. Neither can be consulted by a
     * gate, a test or a type, which is why a deprecated type could be authored
     * 85 times across 27 shipped exemplars with every check in the repository
     * green: both gates that touch component types ask whether the type
     * RESOLVES, and this one resolves.
     *
     * `surfaces` carries the objectui#4000 ruling rather than restating it in a
     * second place: the `isHtmlTierNode` exemption ABOVE and this list are the
     * same fact, and `__tests__/div-deprecation-provenance.test.tsx` pins them
     * to each other so neither can move alone.
     *
     * ⛔ Declaring this deprecates NOTHING NEW and fails NO build. The catalog
     * ratchet (`examples/schema-catalog/test/deprecated-component-types.test.ts`,
     * objectui#6732) freezes the existing stock and refuses growth; draining it
     * is objectui#3965's worklist.
     */
    deprecated: {
      surfaces: ['json'],
      /**
       * Re-ruled with the notice above in objectui#6877 — the two are asserted
       * to offer the SAME set of alternatives (objectui#6823), so they cannot
       * be moved one at a time. Same quoting convention: double quotes are
       * component type names, backticks are property names.
       */
      replacement:
        'author "box" for a plain wrapper — the one drop-in swap; reach for "card", "flex", "container", "stack" or "grid" only when you want their layout, and move `body` content into `children` first',
    },
    inputs: [
      { name: 'className', type: 'string' }
    ],
    defaultProps: {
      className: 'p-2 sm:p-4 border border-dashed border-gray-300 rounded min-h-[100px]'
    }
  }
);
