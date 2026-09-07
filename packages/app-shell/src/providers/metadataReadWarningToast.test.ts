/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The RENDERER half of the metadata read-warning chain (objectui#7741): an
 * event becomes the message a user without devtools can act on.
 *
 * The connection between the adapter's channel and this renderer is
 * `AdapterProvider.readWarningSink.test.tsx`'s; the classification that decides
 * whether an event exists at all is `data-objectstack`'s
 * `listImportMappings.test.ts`. This file owns only the wording and the
 * branching, over events it writes by hand.
 */

import { describe, it, expect, vi } from 'vitest';
import type { MetadataReadWarningEvent } from '@object-ui/data-objectstack';
import {
  emitMetadataReadWarning,
  type MetadataReadWarningSink,
} from './metadataReadWarningToast';

/** The provider-less English fallback, which is what `t` resolves to here. */
const t = (key: string, options?: Record<string, unknown>): string => {
  const raw = String(options?.defaultValue ?? key);
  return raw.replace(/\{\{(\w+)\}\}/g, (_m, hole: string) => String(options?.[hole] ?? `{{${hole}}}`));
};

function sink() {
  return { warning: vi.fn() } satisfies MetadataReadWarningSink;
}

const REFUSED: MetadataReadWarningEvent = {
  operation: 'listImportMappings',
  kind: 'mapping',
  objectName: 'crm_plant_cost',
  reason: 'refused',
  code: 'UNAUTHENTICATED',
  status: 401,
  message: 'authentication required',
};

describe('emitMetadataReadWarning (objectui#7741)', () => {
  it('names the object the empty list is about', () => {
    const s = sink();

    emitMetadataReadWarning(REFUSED, t, s);

    const [title] = s.warning.mock.calls[0];
    expect(title).toContain('crm_plant_cost');
  });

  it('⭐ says the list is empty because it could not be READ, not because it is empty', () => {
    // The whole point of the surface. A message that merely reported an error
    // would leave the user's actual question — "are there no saved mappings?" —
    // unanswered, which is the ambiguity that produced objectstack#14026.
    const s = sink();

    emitMetadataReadWarning(REFUSED, t, s);

    const [, options] = s.warning.mock.calls[0];
    expect(options.description).toContain('could not be read');
    expect(options.description).toContain('not because nothing is registered');
  });

  it('gives a refusal a remedy that names a person, not a retry', () => {
    const s = sink();

    emitMetadataReadWarning(REFUSED, t, s);

    const [, options] = s.warning.mock.calls[0];
    expect(options.description).toContain('Sign in again');
  });

  it('gives an unreadable answer the retry remedy instead', () => {
    const s = sink();

    emitMetadataReadWarning({ ...REFUSED, reason: 'unreadable', code: undefined, status: 500, message: 'metadata store unavailable' }, t, s);

    const [, options] = s.warning.mock.calls[0];
    expect(options.description).toContain('Try again');
    expect(options.description).not.toContain('Sign in again');
  });

  it("carries the server's own words verbatim, so the user has evidence to paste", () => {
    const s = sink();

    emitMetadataReadWarning(REFUSED, t, s);

    const [, options] = s.warning.mock.calls[0];
    expect(options.description).toContain('UNAUTHENTICATED');
    expect(options.description).toContain('HTTP 401');
    expect(options.description).toContain('authentication required');
  });

  it('adds no detail line at all when the failure declared nothing', () => {
    const s = sink();

    emitMetadataReadWarning(
      { operation: 'listImportMappings', kind: 'mapping', objectName: 'task', reason: 'unreadable' },
      t,
      s,
    );

    const [, options] = s.warning.mock.calls[0];
    // One line — the remedy — and no trailing empty parenthesis pretending the
    // server said something.
    expect(options.description).not.toContain('\n');
    expect(options.description).not.toContain('HTTP');
  });

  it('refuses an unhandled reason rather than rendering the wrong remedy', () => {
    // Unreachable for a type-checked caller; reachable for a JS one, because
    // the event type is published. The caller swallows, so the failure mode is
    // "no toast", never "a toast naming the wrong fix".
    const s = sink();

    expect(() =>
      emitMetadataReadWarning(
        { ...REFUSED, reason: 'exploded' as unknown as MetadataReadWarningEvent['reason'] },
        t,
        s,
      ),
    ).toThrow(/no remedy for reason/);
  });

  it('uses the warning tier and the long duration, like its advisory sibling', () => {
    const s = sink();

    emitMetadataReadWarning(REFUSED, t, s);

    const [, options] = s.warning.mock.calls[0];
    expect(options.duration).toBe(10_000);
  });
});
