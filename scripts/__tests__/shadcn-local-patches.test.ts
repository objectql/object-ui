import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494. (On a
// multi-line import the directive never worked anyway: TS reports the missing
// declaration at the SPECIFIER line, not at the `import {` the comment guards.)
import {
  LOCAL_PATCHES,
  applyLocalPatches,
  verifyLocalPatches,
  patchedComponents,
  describePatchFailure,
} from '../shadcn-local-patches.mjs';

/**
 * objectstack#5505 — the Shadcn `Sheet`/`Dialog` primitives shipped a hardcoded
 * English `Close` sr-only span, which (being icon-only buttons) IS their
 * accessible name, so every drawer and modal announced "Close" under zh/ja/es.
 *
 * `packages/components/src/ui/**` is regenerated from the upstream registry, so
 * the fix could not simply be typed into those files — the next
 * `pnpm shadcn:update` would revert it, silently and compilably. The fix is
 * therefore DECLARED in `scripts/shadcn-local-patches.mjs` and re-applied by
 * the sync itself.
 *
 * This file is the enforcement half of that contract, and it is deliberately
 * offline: the registry is not reachable from CI (nor from the sandbox this was
 * written in), so a test that needed the network could not gate anything. Every
 * assertion below is pure string work over a fixture or over the files on disk.
 *
 * It covers three separate regressions:
 *
 *   1. the patch stops being applied to the files we ship  (`describe` #3)
 *   2. the patch engine stops applying it to fresh upstream (`describe` #1)
 *   3. the patch silently no-ops against changed upstream   (`describe` #2)
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const uiDir = path.join(repoRoot, 'packages/components/src/ui');

/**
 * The components carrying the i18n close-label patch family.
 *
 * The registry is a general mechanism and now holds an unrelated family too
 * (`sidebar`, objectui#4234), so the close-label assertions below must iterate
 * THIS list and not `patchedComponents()` — the latter would assert one
 * family's ids and marker on every patched primitive. Derived rather than
 * hardcoded so a third `Sheet`-like primitive is picked up automatically.
 */
const closeLabelComponents = patchedComponents().filter((name: string) =>
  LOCAL_PATCHES[name].some((p: { marker: string }) => p.marker === '<CloseSrLabel />'),
);

/**
 * A faithful excerpt of what the registry serves for `dialog`, AFTER
 * `rewriteRegistryImports` (so `@/lib/utils` already reads `../lib/utils`).
 * This is the exact shape the patch engine sees during `--update`.
 */
const UPSTREAM_DIALOG = `"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "../lib/utils"

const DialogContent = React.forwardRef((props, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} {...props}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
`;

describe('shadcn local patches — application to fresh upstream (objectstack#5505)', () => {
  it.each(closeLabelComponents)('%s declares the i18n close patch', (name: string) => {
    const ids = LOCAL_PATCHES[name].map((p: { id: string }) => p.id);
    expect(ids).toEqual([`${name}-i18n-close-import`, `${name}-i18n-close-label`]);
  });

  /** The other declared family: the sidebar collapse-persistence patch. */
  it('sidebar declares the cookie-read patch', () => {
    const ids = LOCAL_PATCHES.sidebar.map((p: { id: string }) => p.id);
    expect(ids).toEqual(['sidebar-cookie-read-import', 'sidebar-cookie-read-initial-state']);
  });

  /**
   * The third family: the slider thumb pass-through (objectui#3318).
   *
   * The root half is listed here on purpose. It is easy to read
   * `slider-thumb-root-split` as bookkeeping next to the delivery patch and
   * drop it, and the result compiles and renders: the object is simply
   * String()-ed onto the wrapper as `thumbprops="[object Object]"`, and the id
   * it also leaves behind gives the row two elements answering to one id.
   */
  it('slider declares the thumb pass-through patches', () => {
    const ids = LOCAL_PATCHES.slider.map((p: { id: string }) => p.id);
    expect(ids).toEqual([
      'slider-thumb-import',
      'slider-thumb-props-type',
      'slider-thumb-root-split',
      'slider-thumb-aria-delivery',
    ]);
  });

  it('applies the slider family to fresh upstream, and is idempotent', () => {
    // The upstream shape the registry serves, after `rewriteRegistryImports`.
    // `aria-label` on the thumb is upstream's OWN hand-written bridge — the
    // anchor the delivery patch replaces, and the standing evidence that the
    // thumb cannot be addressed from outside the primitive.
    const upstream = `"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "../lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex", className)}
    {...props}
  >
    <SliderPrimitive.Track />
    <SliderPrimitive.Thumb
      className="block h-5 w-5"
      aria-label={props["aria-label"]}
    />
  </SliderPrimitive.Root>
))
`;

    const once = applyLocalPatches('slider', upstream);
    expect(once.failed).toEqual([]);
    expect(once.applied).toHaveLength(4);
    expect(verifyLocalPatches('slider', once.content)).toEqual([]);
    // The thumb takes the routed props and the wrapper does not take the raw
    // `props` object any more — the two halves that must land together.
    expect(once.content).toContain('{...splitSliderThumbProps(props).thumb}');
    expect(once.content).toContain('{...splitSliderThumbProps(props).root}');
    expect(once.content).not.toContain('aria-label={props["aria-label"]}');

    const twice = applyLocalPatches('slider', once.content);
    expect(twice.applied).toEqual([]);
    expect(twice.content).toBe(once.content);
  });

  it('refuses when upstream restructures the thumb away', () => {
    // A future registry drop of the hand-written `aria-label` bridge takes the
    // delivery patch's anchor with it. That must be a hard failure the operator
    // sees, not a sync that quietly ships an unreachable thumb again.
    const withoutThumbAnchor = `import { cn } from "../lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    {...props}
  >
    <SliderPrimitive.Thumb className="block" />
  </SliderPrimitive.Root>
))
`;

    const result = applyLocalPatches('slider', withoutThumbAnchor);

    expect(result.failed.map((p: { id: string }) => p.id)).toEqual([
      'slider-thumb-aria-delivery',
    ]);
    expect(result.failed[0].found).toBe(0);
  });

  it('turns an unpatched upstream file into the translated form', () => {
    const result = applyLocalPatches('dialog', UPSTREAM_DIALOG);

    expect(result.failed).toEqual([]);
    expect(result.applied).toHaveLength(2);
    // The English literal is GONE — this is the actual user-visible defect.
    expect(result.content).not.toContain('<span className="sr-only">Close</span>');
    expect(result.content).toContain('<CloseSrLabel />');
    expect(result.content).toContain('import { CloseSrLabel } from "../lib/close-label"');
    // The anchor line itself survives; the import is added beside it.
    expect(result.content).toContain('import { cn } from "../lib/utils"');
  });

  it('is idempotent — re-running over already-patched content changes nothing', () => {
    const once = applyLocalPatches('dialog', UPSTREAM_DIALOG);
    const twice = applyLocalPatches('dialog', once.content);

    expect(twice.content).toBe(once.content);
    expect(twice.applied).toEqual([]);
    expect(twice.already).toHaveLength(2);
    expect(twice.failed).toEqual([]);
  });

  it('leaves components with no declared patches untouched', () => {
    const input = 'const Button = () => null\n';
    const result = applyLocalPatches('button', input);

    expect(result.content).toBe(input);
    expect(result.applied).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});

describe('shadcn local patches — loud failure when upstream moves (objectstack#5505)', () => {
  it('refuses (does not silently no-op) when the label anchor is gone', () => {
    // A plausible future upstream: the close button keeps its shape but the
    // label text changes. The old anchor no longer matches.
    const moved = UPSTREAM_DIALOG.replace(
      '<span className="sr-only">Close</span>',
      '<span className="sr-only">Close dialog</span>',
    );

    const result = applyLocalPatches('dialog', moved);

    expect(result.failed.map((p: { id: string }) => p.id)).toEqual(['dialog-i18n-close-label']);
    expect(result.failed[0].found).toBe(0);
    // Critically: the content is NOT silently returned as "fine". A caller that
    // ignored `failed` would ship an untranslated primitive again.
    expect(result.content).not.toContain('<CloseSrLabel />');
  });

  it('refuses when the import anchor is gone', () => {
    const moved = UPSTREAM_DIALOG.replace(
      'import { cn } from "../lib/utils"',
      'import { cn, cva } from "../lib/utils"',
    );

    const result = applyLocalPatches('dialog', moved);

    expect(result.failed.map((p: { id: string }) => p.id)).toEqual(['dialog-i18n-close-import']);
  });

  it('refuses when the anchor became AMBIGUOUS rather than absent', () => {
    // Two close buttons upstream: patching "the" span is no longer well
    // defined, so guessing is worse than stopping. `occurrences` pins this.
    const doubled = UPSTREAM_DIALOG.replace(
      '<span className="sr-only">Close</span>',
      '<span className="sr-only">Close</span>\n      <span className="sr-only">Close</span>',
    );

    const result = applyLocalPatches('dialog', doubled);

    expect(result.failed.map((p: { id: string }) => p.id)).toEqual(['dialog-i18n-close-label']);
    expect(result.failed[0].found).toBe(2);
  });

  it('explains a failure with id, issue and reason — not just "changed"', () => {
    const moved = UPSTREAM_DIALOG.replace('<span className="sr-only">Close</span>', '');
    const [failure] = applyLocalPatches('dialog', moved).failed;

    const text = describePatchFailure('dialog', failure).join('\n');

    expect(text).toContain('dialog-i18n-close-label');
    expect(text).toContain('objectstack#5505');
    expect(text).toContain('accessible name');
  });
});

describe('shipped primitives still carry every declared patch (objectstack#5505)', () => {
  /**
   * The PR gate. If a future forced sync, hand edit or bad merge drops the
   * patch from the files we actually ship, this goes red — offline, on every
   * PR, without needing anyone to run `pnpm shadcn:check` against the network.
   */
  it.each(patchedComponents())('%s.tsx carries its declared patches', (name: string) => {
    const content = fs.readFileSync(path.join(uiDir, `${name}.tsx`), 'utf-8');

    const missing = verifyLocalPatches(name, content);
    expect(
      missing.map((p: { id: string }) => p.id),
      `${name}.tsx lost declared patch(es); re-apply with: node scripts/shadcn-sync.js --update ${name}`,
    ).toEqual([]);
  });

  /**
   * The negative assertion the issue asked for, at the source level: the
   * English literal must not be back in the file under any spelling of the
   * span. Rendering-level negatives live in
   * `packages/components/src/__tests__/sheet-dialog-close-i18n.test.tsx`.
   *
   * Scoped to `closeLabelComponents` (see the top of this file), NOT to
   * `patchedComponents()`: "contains `<CloseSrLabel />`" is simply false for
   * the unrelated `sidebar` family.
   */
  it.each(closeLabelComponents)('%s.tsx has no hardcoded English close label', (name: string) => {
    const content = fs.readFileSync(path.join(uiDir, `${name}.tsx`), 'utf-8');

    expect(content).not.toMatch(/<span className="sr-only">\s*Close\s*<\/span>/);
    expect(content).toContain('<CloseSrLabel />');
  });

  /** The derivation above must never silently select nothing. */
  it('still covers the close-label primitives', () => {
    expect(closeLabelComponents).toEqual(['sheet', 'dialog']);
  });
});
