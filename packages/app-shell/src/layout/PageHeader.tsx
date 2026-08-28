/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * PageHeader Component
 *
 * Standardized page header used across console object/list/detail views.
 * Provides consistent typography, icon framing, and action grouping so
 * individual screens don't reinvent the title row.
 *
 * Layout:
 *   [accent hairline]
 *   [icon]  Title             [actions...]
 *           subtitle
 */

import * as React from 'react';
import { cn } from '@object-ui/components';

/**
 * Props of the app-shell `<PageHeader>` React component.
 *
 * Named `PageHeaderComponentProps`, not `PageHeaderProps`:
 * `@objectstack/spec/ui` exports a `PageHeaderProps` **zod schema** describing
 * the AUTHORED SDUI page-header node — `title: string`, `subtitle`, `icon`
 * (an icon NAME), `breadcrumb`, `actions: string[]` (action ids), `aria`. This
 * interface is the runtime React contract for the same visual element:
 * `React.ReactNode` in place of every string, `actions` as rendered elements
 * rather than ids, plus render-only knobs (`accentColor`, `sticky`,
 * `className`, `data-testid`) the authored schema has no reason to model.
 * Authored layer vs. rendered layer — two layers, one name, which is the
 * objectstack#4115 defect. `__tests__/spec-symbol-parity.test.ts` pins that the spec
 * does not own this name.
 *
 * `@object-ui/layout` carries the same collision (objectui#3161, batch 7) and
 * adopted this same name, so the two packages do not invent two dialects.
 */
export interface PageHeaderComponentProps {
  /** Page title (required, becomes <h1>). */
  title: React.ReactNode;
  /**
   * Optional secondary line shown beneath the title. `subtitle` is the only
   * spelling this component accepts.
   *
   * It used to be `description`, which made one concept carry two key names
   * one package apart: `@objectstack/spec/ui`'s `PageHeaderProps` declares
   * `subtitle` for the authored `page:header` node, and `@object-ui/layout`'s
   * `<PageHeader>` converged on `subtitle` in objectui#3789. This component is
   * the console's rendered layer of that same element, so it now spells the
   * secondary line the way the contract does (objectui#4761).
   *
   * The old spelling was NOT kept as an alias. It was never reachable outside
   * this package — `src/index.ts` does not re-export `PageHeader`, and the
   * `exports` map declares no subpath that could reach it — so nothing had to
   * be tolerated, and a renderer-side alias is exactly the second dialect
   * AGENTS.md #0.1 exists to prevent. `__tests__/PageHeader.subtitle.test.tsx`
   * pins both halves.
   */
  subtitle?: React.ReactNode;
  /**
   * Optional leading icon (already-instantiated React element).
   * The icon is auto-sized via CSS — pass it with whatever default sizing,
   * the chip will scale child `<svg>` elements to fit.
   */
  icon?: React.ReactNode;
  /** Right-aligned actions (buttons, dropdowns, etc.). */
  actions?: React.ReactNode;
  /**
   * CSS color used to tint the top hairline, icon chip background, and
   * icon stroke. Defaults to the Shadcn `--primary` token so the header
   * automatically follows the active app's branding.
   *
   * Accepts any CSS color value (e.g. `'#8b5cf6'`, `'hsl(280 70% 55%)'`,
   * `'var(--my-token)'`).
   */
  accentColor?: string;
  /**
   * When true, the header is `position: sticky; top: 0` and gains a
   * translucent backdrop blur so content scrolling underneath remains
   * partly visible. Opt-in — the default layout used by ObjectView already
   * pins the header by virtue of being the first child of a non-scrolling
   * flex column, so flipping this on there would be a no-op (or worse,
   * conflict with z-index of overlays).
   */
  sticky?: boolean;
  /** Additional className applied to the outer container. */
  className?: string;
  /** Optional data-testid for E2E selectors. */
  'data-testid'?: string;
}

/**
 * Reusable page header for the console.
 *
 * Mirrors Shadcn / Linear / Notion conventions: subtle border, comfortable
 * vertical padding, primary-tinted icon chip, monolithic action cluster on
 * the right with consistent gap.
 *
 * The accent color cascades through a CSS custom property
 * (`--page-header-accent`) so consumers can override it without rebuilding
 * Tailwind classes.
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  accentColor,
  sticky = false,
  className,
  'data-testid': testId,
}: PageHeaderComponentProps) {
  // Resolve accent → CSS var. Falls back to the Shadcn primary token so the
  // header follows whatever brand the active app has injected.
  const accent = accentColor || 'hsl(var(--primary))';
  const style = { '--page-header-accent': accent } as React.CSSProperties;

  return (
    <div
      style={style}
      className={cn(
        'relative shrink-0 border-b bg-background z-10',
        sticky &&
          'sticky top-0 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75',
        className,
      )}
      data-testid={testId ?? 'page-header'}
    >
      {/* Accent hairline — a 2px gradient strip that fades to transparent at
          both edges. Picks up the app's accent color, or the default primary
          token. Decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-80"
        style={{
          background:
            'linear-gradient(90deg, transparent, var(--page-header-accent), transparent)',
        }}
      />

      <div className="flex justify-between items-center gap-3 py-2.5 sm:py-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div
              className={cn(
                'shrink-0 inline-flex items-center justify-center rounded-lg',
                'h-9 w-9 sm:h-10 sm:w-10',
                // Auto-size any nested SVG so callers don't have to think
                // about sizing inside the chip.
                '[&_svg]:h-[18px] [&_svg]:w-[18px] sm:[&_svg]:h-5 sm:[&_svg]:w-5',
              )}
              style={{
                color: 'var(--page-header-accent)',
                background:
                  'linear-gradient(135deg, color-mix(in srgb, var(--page-header-accent) 18%, transparent), color-mix(in srgb, var(--page-header-accent) 6%, transparent))',
                boxShadow:
                  'inset 0 0 0 1px color-mix(in srgb, var(--page-header-accent) 22%, transparent)',
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-semibold tracking-tight text-foreground truncate leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block max-w-xl mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export default PageHeader;
