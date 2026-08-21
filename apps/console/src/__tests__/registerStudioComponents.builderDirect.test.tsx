// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#5486 — `studio:builder` must render the builder on the FIRST
 * commit, not behind a Suspense boundary that defers nothing.
 *
 * ## What this measures, and why it is not a source-text check
 *
 * `registerStudioComponents.tsx` used to register a `lazy()` wrapper around
 * `import('@object-ui/app-shell')` — the same barrel the line above it imports
 * statically, and the same barrel `App.tsx` pulls `BuilderLanding` from to
 * render `/studio` full-screen. The `import()` therefore moved nothing; it
 * bought a permanent `INEFFECTIVE_DYNAMIC_IMPORT` build warning and a loading
 * fallback that no user could ever see, while telling every future reader that
 * the builder was code-split.
 *
 * A regex over this file for `lazy(` would pin one spelling of the mistake.
 * What is pinned here instead is the PROPERTY the mistake produced: a deferred
 * element is absent from React's first commit. So the subject assertion uses
 * `getByTestId` with no `await` — reinstating any lazy boundary in front of
 * the registered component turns that red, whatever it is spelled like.
 *
 * ## Counter-probe
 *
 * "Present on the first commit" is only evidence if ABSENCE on the first
 * commit is something this harness can actually observe — otherwise the
 * subject assertion passes for every possible registration and measures
 * nothing. `LazyControl` below is a deliberately deferred component rendered
 * through the same `render()` in the same environment: it must be MISSING when
 * the subject is found, and must then appear once awaited. A harness that
 * cannot tell the two apart fails on the control, not silently on the subject.
 *
 * ## Deliberately NOT asserted
 *
 * That the builder is EAGER in the bundle. It is — `App.tsx` imports it
 * statically — but that fact lives in `App.tsx`, outside this card's surface,
 * and asserting it here would quietly pin a second file's shape. The build's
 * own `INEFFECTIVE_DYNAMIC_IMPORT` output is the instrument for that, and the
 * PR records the before/after reading.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Suspense, lazy } from 'react';
import type { ComponentType } from 'react';

type Registration = { ref: string; label?: string; source?: string; component: ComponentType<any> };

const { registrations } = vi.hoisted(() => ({ registrations: [] as Registration[] }));

// Mocked at the specifier the module under test imports, so the entry
// exercised below is the production registration itself, not a re-creation.
// `BuilderLanding` stands in for the real page: what this file measures is
// WHEN it renders, which its internals cannot change.
vi.mock('@object-ui/app-shell', () => ({
  registerAppComponent: (entry: Registration) => {
    registrations.push(entry);
  },
  BuilderLanding: () => <div data-testid="builder-landing" />,
}));

// Side-effect import, exactly as `main.tsx` performs it.
import '../registerStudioComponents';

/** Counter-probe: a genuinely deferred component, for contrast. */
const LazyControl = lazy(async () => ({ default: () => <div data-testid="lazy-control" /> }));

function entryFor(ref: string): Registration {
  const found = registrations.find((r) => r.ref === ref);
  if (!found) throw new Error(`no registration for ${ref}; saw: ${registrations.map((r) => r.ref).join(', ') || '(none)'}`);
  return found;
}

describe('studio:builder registration (objectui#5486)', () => {
  it('renders the builder on the first commit, with no Suspense boundary in front of it', async () => {
    const Builder = entryFor('studio:builder').component;

    // SEPARATE boundaries on purpose. Sharing one would let the control's
    // suspension blank the subject as well, and the subject assertion would
    // then be measuring the control rather than the registration.
    render(
      <>
        <Suspense fallback={<div data-testid="builder-fallback" />}>
          <Builder />
        </Suspense>
        <Suspense fallback={<div data-testid="control-fallback" />}>
          <LazyControl />
        </Suspense>
      </>,
    );

    // Subject — no `await`. A `lazy()` wrapper in front of `BuilderLanding`
    // would have committed the fallback here instead.
    expect(screen.getByTestId('builder-landing')).toBeInTheDocument();

    // ...and no fallback was ever committed in its place.
    expect(screen.queryByTestId('builder-fallback')).not.toBeInTheDocument();

    // Counter-probe, first half: deferral IS observable at this moment — the
    // control has not arrived and ITS fallback is on screen, so the two
    // assertions above distinguish something rather than passing for anything.
    expect(screen.queryByTestId('lazy-control')).not.toBeInTheDocument();
    expect(screen.getByTestId('control-fallback')).toBeInTheDocument();

    // Counter-probe, second half: the control is not merely stuck. It
    // resolves, which is also what the builder would have done had it been
    // deferred — one commit too late.
    expect(await screen.findByTestId('lazy-control')).toBeInTheDocument();
  });

  it('addresses the ref the Studio app navigation names', () => {
    const entry = entryFor('studio:builder');
    expect(entry.source).toBe('@object-ui/console');
    expect(entry.label).toBe('应用构建');
  });
});
