// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#7979 — `PackageFormDialog`'s `apiJson` reads the producer-marked
 * `error.userMessage`.
 *
 * This dialog held the FOURTH copy of the ADR-0112 failure-envelope ladder,
 * character for character the one `PackagesPage`'s `apiJson` had before
 * objectui#7959: `error.message || error || message || 'Request failed (n)'`.
 * It read the diagnostic and stopped, so a producer-marked `error.userMessage`
 * arrived on the wire with nowhere to appear and `error.code` never reached the
 * author at all. The rule now comes from ONE place —
 * `utils/apiErrorEnvelope.ts` (`readEnvelopeFailureText`), pinned in
 * `apiErrorEnvelope.test.ts` — and this file pins what THIS call site does with
 * it. Shape copied from `PackagesPage.envelopeUserMessage.test.tsx`.
 *
 * Driven through the DIALOG rather than by calling `apiJson` directly, because
 * `apiJson` is module-private and because what the card is about is what the
 * author reads: create/edit is where a person meets a refusal that names what
 * to fix, and the banner renders the caught `e.message` verbatim.
 *
 * ## ⚠️ Two rungs stay, and they are NOT the envelope
 *
 * A bare-string `error` and a top-level `message` are older runtimes' shapes,
 * live for this call site and for no other consumer of the rule. They stay
 * HERE, below the shared read — folding them into the shared helper would hand
 * every other consumer a tolerant dialect it never asked for. §6 pins that they
 * still work.
 *
 * ## ⚠️ Why no case here uses 403 or 409
 *
 * Unlike the page, this dialog's `catch` has two STATUS-driven arms in front of
 * the banner (409 → the localized "already exists" copy, 403 → the localized
 * capability copy, objectstack#8270). On those two statuses the envelope prose
 * is not what the person reads, whatever the ladder returned — so every case
 * about the ladder uses a status that reaches the `else` arm, and §8 pins the
 * arms themselves as untouched by this card.
 */

import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { PackageFormDialog } from './PackageFormDialog';
import { t } from './i18n';

// Only `useMetadataLocale` is replaced — the `t` resolver and both string
// tables stay real, so §8 asserts against the strings the product ships.
vi.mock('./i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMetadataLocale: () => 'en-US',
}));

/** The generic sentence the 5xx prose withhold substitutes (`INTERNAL_ERROR_MESSAGE`). */
const GENERIC = 'Internal server error';
/** A producer's marked text: what `userMessage` carries, written for the person. */
const MARKED = 'Publishing is temporarily unavailable. Nothing was changed.';
/** An ordinary unmarked refusal on this surface — a version rule, stated by the door. */
const VERSION = 'Version 1.2.0 is published; bump the version before saving.';
/** A second one — the namespace rule the card names as a create-time refusal. */
const NAMESPACE = 'Namespace `Acme CRM` is not a legal object-name namespace.';

/**
 * `apiJson` reads the body as TEXT and `JSON.parse`s it (not `res.json()`), so
 * the stub has to answer `text` — mirroring `PackageFormDialog.test.tsx`.
 */
function stubBody(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    })) as unknown as typeof fetch,
  );
}

/** A failure exactly as `sendError` writes it. */
const envelope = (error: Record<string, unknown>) => ({ success: false, error });

/** Fill the create form and submit it; returns what the error banner shows. */
async function bannerFor(status: number, body: unknown): Promise<string> {
  stubBody(status, body);
  render(<PackageFormDialog mode="create" open onOpenChange={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText(/package id/i), { target: { value: 'com.acme.new' } });
  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'New App' } });
  fireEvent.click(screen.getByTestId('package-form-submit'));
  const banner = await screen.findByTestId('package-form-error');
  return banner.textContent ?? '';
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PackageFormDialog / apiJson — the four combinations (#7979)', () => {
  /**
   * ⭐ GREEN with the fix reverted, and load-bearing for exactly that reason.
   * This reader already rendered `error.message`, so the unmarked refusal — the
   * overwhelmingly common case, and everything on the wire today — must come
   * through byte for byte. It is the pin that stops "prefer `userMessage`" from
   * being implemented as "read `userMessage` INSTEAD", which would have blanked
   * every ordinary refusal this dialog serves.
   *
   * Deliberately code-less: the code append is new behaviour and would make
   * this case red on revert, costing the guard its role. §5 covers the code.
   */
  it('§1 `message` only, no code — the unmarked refusal, byte for byte as before', async () => {
    expect(await bannerFor(422, envelope({ message: VERSION }))).toBe(VERSION);
  });

  it('§2 `userMessage` only — the marked sentence instead of `Request failed (503)`', async () => {
    const shown = await bannerFor(503, envelope({ code: 'SERVICE_UNAVAILABLE', userMessage: MARKED }));
    expect(shown).toBe(`${MARKED} (SERVICE_UNAVAILABLE)`);
    expect(shown).not.toContain('Request failed');
  });

  it('§3 both — the mark displaces the generic substitution', async () => {
    const shown = await bannerFor(500, envelope({ code: 'INTERNAL_ERROR', message: GENERIC, userMessage: MARKED }));
    expect(shown).toBe(`${MARKED} (INTERNAL_ERROR)`);
    expect(shown).not.toContain(GENERIC);
  });

  it('§4 neither — this dialog names the status its own way, unchanged', async () => {
    expect(await bannerFor(503, envelope({ code: 'SERVICE_UNAVAILABLE' }))).toBe('Request failed (503)');
  });
});

describe('PackageFormDialog / apiJson — how `code` composes', () => {
  it('§5 the code is appended to whichever prose won — the diagnostic', async () => {
    expect(await bannerFor(422, envelope({ code: 'INVALID_NAMESPACE', message: NAMESPACE }))).toBe(
      `${NAMESPACE} (INVALID_NAMESPACE)`,
    );
  });

  it('§5 the code is appended to whichever prose won — the mark', async () => {
    expect(await bannerFor(500, envelope({ code: 'STORAGE_UNAVAILABLE', message: GENERIC, userMessage: MARKED }))).toBe(
      `${MARKED} (STORAGE_UNAVAILABLE)`,
    );
  });

  it('§5 a marked body with no code renders the bare sentence', async () => {
    expect(await bannerFor(500, envelope({ message: GENERIC, userMessage: MARKED }))).toBe(MARKED);
  });

  it('§5 a non-string mark is not a mark — it falls through to the diagnostic', async () => {
    expect(await bannerFor(500, envelope({ code: 'INTERNAL_ERROR', message: GENERIC, userMessage: 42 }))).toBe(
      `${GENERIC} (INTERNAL_ERROR)`,
    );
  });

  it('§5 an empty-string mark is not a mark either', async () => {
    expect(await bannerFor(500, envelope({ code: 'INTERNAL_ERROR', message: GENERIC, userMessage: '' }))).toBe(
      `${GENERIC} (INTERNAL_ERROR)`,
    );
  });
});

describe('PackageFormDialog / apiJson — the legacy rungs below the envelope (GREEN with the fix reverted)', () => {
  it('§6 a bare-string `error` still reaches the banner', async () => {
    expect(await bannerFor(500, { success: false, error: 'metadata service unavailable' })).toBe(
      'metadata service unavailable',
    );
  });

  it('§6 a top-level `message` still reaches the banner', async () => {
    expect(await bannerFor(500, { success: false, message: 'metadata service unavailable' })).toBe(
      'metadata service unavailable',
    );
  });

  it('§6 a body with no readable prose anywhere still names the status', async () => {
    expect(await bannerFor(500, { success: false })).toBe('Request failed (500)');
  });
});

/**
 * ⚠️ Its own block, and NOT under the green-when-reverted heading above: this
 * one asserts the mark, so it goes RED on revert like §2/§3/§5.
 */
describe('PackageFormDialog / apiJson — the 200 that declares failure', () => {
  /**
   * ⭐ The failure trigger is `!res.ok || payload.success === false`, so a 200
   * that declares failure is a refusal too — and it is the arm a fix that
   * reached only for `!res.ok` would silently leave behind.
   */
  it('§7 a 200 that declares `success: false` is still a refusal, and now carries the mark', async () => {
    expect(await bannerFor(200, envelope({ code: 'INTERNAL_ERROR', message: GENERIC, userMessage: MARKED }))).toBe(
      `${MARKED} (INTERNAL_ERROR)`,
    );
  });
});

/**
 * The two localized arms this card did NOT touch, pinned so the scope is
 * visible rather than assumed. Both read `e.status`, so both are GREEN with the
 * fix reverted.
 *
 * ⚠️ Consequence worth stating rather than hiding: on 409 and 403 — the two
 * most likely refusals for create/edit — a producer-marked sentence still does
 * not reach the author, because the localized copy answers first
 * (objectstack#8270, a settled posture the deployment states in the user's
 * language). Whether the mark should outrank that copy is a question about the
 * ARMS, not about the ladder this card fixed; it is filed separately rather
 * than decided here.
 */
describe('PackageFormDialog — the status-driven arms in front of the banner are unchanged', () => {
  it('§8 a 409 still shows the localized "already exists" copy, mark or no mark', async () => {
    expect(await bannerFor(409, envelope({ code: 'RESOURCE_CONFLICT', message: GENERIC, userMessage: MARKED }))).toBe(
      t('engine.packages.create.exists', 'en-US'),
    );
  });

  it('§8 a 403 still shows the localized capability copy, mark or no mark', async () => {
    expect(await bannerFor(403, envelope({ code: 'FORBIDDEN', message: GENERIC, userMessage: MARKED }))).toBe(
      t('engine.packages.noCapability', 'en-US'),
    );
  });

  /**
   * The measured behaviour change beyond the banner text, recorded because it
   * is the only one: when the transport drops the status (`status: 0`), those
   * arms fall back to probing the MESSAGE, and the message they now probe is
   * whichever prose won. A marked refusal whose mark does not repeat the
   * diagnostic's wording therefore reaches the author verbatim instead of being
   * folded into the localized copy — which is what the envelope writer's rule
   * asks for ("a consumer that sees the field renders it verbatim"), and is
   * unreachable whenever a status is present.
   */
  it('§8 with no status at all, the probe reads whichever prose won', async () => {
    expect(
      await bannerFor(0, envelope({ message: "Package 'com.acme.new' already exists", userMessage: MARKED })),
    ).toBe(MARKED);
  });
});
