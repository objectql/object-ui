/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { IconSchema } from '@object-ui/types';
import { icons, SquareDashed } from 'lucide-react';
import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// Convert kebab-case to PascalCase for Lucide icon names
// e.g., "arrow-right" -> "ArrowRight", "home" -> "Home"
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Map of renamed icons in lucide-react (from old name to new name)
const iconNameMap: Record<string, string> = {
  'Home': 'House', // "Home" was renamed to "House" in lucide-react's icons object
};

/**
 * The glyph rendered when the requested one does not resolve (objectui#5631).
 *
 * ## Why a placeholder at all
 *
 * This branch used to `return null`. That made an unresolvable icon invisible
 * in two independent ways at once, which is the whole reason objectui#5631
 * existed long enough to be found by accident:
 *
 *   - **Invisible to a human.** Nothing rendered. No error boundary, no gap
 *     that reads as broken — just an absent glyph a reviewer's eye completes.
 *   - **Invisible to a gate.** A renderer that returns `null` spreads no
 *     attributes, so the DOM-leak sweep in
 *     `packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx` scanned
 *     an empty tree and reported no findings. An empty scan and a clean scan
 *     are the same reading. `ui:icon` was one of twelve targets that read clean
 *     for exactly that reason, and it only started reporting its fourteen
 *     leaked attributes once the sweep forced a resolvable name onto it.
 *
 * The maintainer ruling of 2026-08-22 (issue #5631, comment 5380754137) makes
 * ending that silence unconditional — it holds "regardless of the key
 * question", i.e. independent of *which* schema key names the glyph.
 *
 * ## Why a NAMED IMPORT and not a lookup in the `icons` record
 *
 * A placeholder that itself fails to resolve is the original bug again, one
 * level up, and silent in the same way. Every other lookup in this file goes
 * through lucide's runtime `icons` record, and lucide retires a spelling by
 * dropping it from that record while keeping the deprecated named export —
 * the objectui#5622 mechanism. Measured on the installed lucide-react 1.31.0:
 * `CircleHelp` and `HelpCircle`, the two obvious "unknown" glyphs, are BOTH
 * absent from the `icons` record while both still resolve as named exports.
 * Either one looked up the usual way would have rendered nothing.
 *
 * A direct named import removes the failure mode instead of dodging it: it is
 * resolved at build time, so if lucide ever retires this spelling the build
 * fails loudly rather than the placeholder silently becoming another `null`.
 * `SquareDashed` is currently both a named export and present in the record,
 * and it is used DIRECTLY in the placeholder branch below rather than through a
 * module-scope alias — an alias reads to `react-refresh/only-export-components`
 * as a second component declaration in a file that exports none.
 */

// Index signature on the parameter annotation, not on the `forwardRef` type
// argument — mechanism note on `action:bar` (objectui#4422), pinned by
// `__tests__/forwardref-props-annotation.guard.test.ts`.
const IconRenderer = forwardRef<SVGSVGElement, { schema: IconSchema; className?: string }>(
  ({ schema, className, ...props }: { schema: IconSchema; className?: string; [key: string]: any }, ref) => {
    // Extract designer-related props
    const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style,
      ...iconProps
    } = props;

    // Build size style
    const sizeStyle = schema.size ? { width: schema.size, height: schema.size } : undefined;

    // Merge classNames: schema color, schema className, prop className
    const mergedClassName = cn(
      schema.color,
      schema.className,
      className
    );

    // ⚠️ This renderer still reads the SDUI IDENTITY key `name` as its glyph
    // name. That collision IS objectui#5631, and the ruling's answer to it is
    // `schema.icon` — but the migration is not landed here; see the
    // `inputs` note on the registration below for what is still owed and why.
    //
    // `schema.name` is typed `string` but arrives from authored JSON, so it can
    // be absent at runtime. It used to reach `toPascalCase` unguarded, where
    // `undefined.split` threw and the SchemaErrorBoundary swallowed it — a
    // third way for this renderer to fail without saying so.
    const requested = typeof schema.name === 'string' ? schema.name : '';
    // Convert icon name to PascalCase for Lucide lookup
    const iconName = toPascalCase(requested);
    // Apply icon name mapping for renamed icons
    const mappedIconName = iconNameMap[iconName] || iconName;
    const Icon = requested ? (icons as any)[mappedIconName] : undefined;

    if (!Icon) {
      console.warn(
        `ui:icon: no lucide glyph resolves for ${requested ? `"${requested}"` : 'an absent icon name'}` +
          `${requested ? ` (lookup: "${iconName}"${mappedIconName !== iconName ? ` -> "${mappedIconName}"` : ''})` : ''}. ` +
          `Rendering a visible placeholder instead of nothing (objectui#5631). ` +
          `Note: this renderer reads the SDUI identity key \`name\` as its glyph name, ` +
          `so an ordinary authored identity such as "save_icon" lands here.`
      );

      // Same host element and the same authored box as a resolved icon, so the
      // gap is visible exactly where the glyph would have been. `role`/
      // `aria-label` sit BEFORE the spread so an author can still override
      // them; the marker attribute sits AFTER it so nothing can clobber the
      // one hook a gate uses to find this branch.
      return (
        <SquareDashed
          ref={ref}
          role="img"
          aria-label={requested ? `Unresolved icon: ${requested}` : 'Unresolved icon'}
          className={mergedClassName}
          style={{ ...sizeStyle, ...style }}
          {...iconProps}
          // Apply designer props
          {...{
            'data-obj-id': dataObjId,
            'data-obj-type': dataObjType,
            'data-objectui-icon-unresolved': requested || '(none)',
          }}
        />
      );
    }

    return (
      <Icon 
        ref={ref} 
        className={mergedClassName}
        style={{ ...sizeStyle, ...style }}
        {...iconProps}
        // Apply designer props
        {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType }}
      />
    );
  }
);

IconRenderer.displayName = 'IconRenderer';

ComponentRegistry.register('icon',
  IconRenderer,
  {
    namespace: 'ui',
    label: 'Icon',
    // objectui#5622 — `face-slightly-smiling`, NOT `smile`, in BOTH places
    // below. Every lookup in this file goes through lucide's runtime `icons`
    // record, and lucide retires a spelling by dropping it from that record
    // while keeping it as a deprecated named export. `Smile` is gone from the
    // record, so this component's own declared default resolved to nothing:
    // the palette entry's glyph was blank and an `icon` dropped in from the
    // palette rendered nothing plus the `console.warn` below. The two spots
    // must move together — repairing one alone leaves either the default
    // rendering nothing or the palette glyph blank.
    //
    // `face-slightly-smiling` is the record's own spelling of the SAME glyph
    // object (`Smile === FaceSlightlySmiling` is true on the installed
    // lucide), so the palette looks exactly as it did — this is a spelling
    // repair, not a redesign of the default.
    icon: 'face-slightly-smiling',
    category: 'basic',
    inputs: [
      // ⚠️ objectui#5631 — this entry STILL declares `name`, and that is
      // deliberate in this change rather than an oversight.
      //
      // The 2026-08-22 ruling is that `icon` is the glyph key and `name` is
      // identity always, which makes this entry owed a rename to `icon`. It is
      // NOT renamed here because the resolver above still reads `name`, and a
      // declared input list that advertises a key the resolver does not read is
      // the same defect this card is about, pointing the other way. The two
      // must move together, with the corpus migration — see the PR body's sweep
      // reading for the measured population that blocks it.
      { name: 'name', type: 'string', label: 'Icon Name', defaultValue: 'face-slightly-smiling' },
      { name: 'size', type: 'number', label: 'Size (px)' },
      { name: 'color', type: 'string', label: 'Color Class' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
