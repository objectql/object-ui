// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `resolveSubmitRedirect` — objectui#4190, against the shape objectstack#7496
 * ruled and objectstack#7657 landed in `@objectstack/spec` (17.0.0 GA).
 *
 * ## What is pinned here, and what it is pinned AGAINST
 *
 * The module asks the spec's schema for its shape verdict instead of restating
 * the rule, so a table of hand-written expectations would pin this file's
 * opinion rather than the contract. Both accept/refuse suites therefore use the
 * REAL `FormViewSchema` as the oracle — `specAccepts()` below is the same parse
 * an authoring door performs — and assert that the two verdicts agree. That
 * makes these tests a drift detector for the contract, not for a copy of it:
 * if a later spec release widens or narrows the ruled shape, they follow it, and
 * they fail only if the renderer and the door ever disagree about one value.
 *
 * The strong pin is `emits a path the contract still accepts`: ruling point 2
 * requires every interpolated value to be URL-escaped when the redirect is
 * built, so the oracle is turned on the OUTPUT — whatever this module emits,
 * hostile record values and all, must still be a value the contract would
 * accept.
 *
 * ## Reverse verification — measured, and NOT what the obvious reading predicts
 *
 * Deleting the escape (interpolating the raw value) turns 10 tests red across
 * this file and `FormPage.redirect.test.tsx`, and WHICH assertion catches each
 * value is the part worth writing down, because re-parsing the emitted string is
 * necessary and **not sufficient**:
 *
 *   - the schema oracle catches only values whose raw form breaks the ruled shape
 *     ANYWHERE in the string — a backslash, whitespace, a control character. Those
 *     checks are not anchored to the start, so they still fire mid-path.
 *   - an address or a script scheme is NOT caught by it. Raw-interpolated,
 *     `/t/{{record.slug}}` becomes `/t/https://evil.example/steal`, which starts
 *     with `/` and carries no leading scheme — a perfectly spec-valid relative
 *     path that goes somewhere the author did not write. Only
 *     `toContain(encodeURIComponent(hostile))` sees that: the harm is injected
 *     path STRUCTURE, and relative-only has nothing to say about it.
 *   - a brace pair in the record trips the unresolved-interpolation backstop
 *     instead, refusing rather than emitting a token-bearing URL.
 *
 * So the two assertions in that block are not belt-and-braces; they cover
 * disjoint halves of "escaped enough", and dropping the second one would leave
 * the escape pinned only for the values the contract happens to reject twice.
 *
 * Deleting the whole parse and returning the url verbatim inverts the refusal
 * suite: every out-of-contract case goes red at once, which is the change
 * detector for this module's reason to exist. Deleting the CALL SITE instead
 * (restoring the browser-level navigation in `FormPage`) leaves this entire file
 * green — the module would simply be unused — which is why the mechanism is
 * pinned next to the rendered page and not here.
 *
 * Control characters below are written as escape sequences on purpose — a raw
 * one makes the whole file read as binary to grep, and this repo has paid for
 * that four times.
 */

import { describe, expect, it } from 'vitest';
import { FormViewSchema } from '@objectstack/spec/ui';
import { resolveSubmitRedirect } from './submitRedirect';

/**
 * The contract's verdict on one authored value — the same minimal parse the
 * module performs, spelled out here independently so the test states the
 * question rather than borrowing the module's answer.
 */
function specAccepts(url: string): boolean {
  return FormViewSchema.safeParse({ submitBehavior: { kind: 'redirect', url } }).success;
}

/** Values the ruling allows: rooted, relative, optionally interpolated. */
const IN_CONTRACT = [
  '/thanks',
  '/objects/lead',
  '/thanks?ref=42',
  '/thanks%20you',
  '/thanks?ref={{record.id}}',
  '/t/{{record.slug}}/done',
  '/thanks?a={{record.id}}&b={{record.status}}',
];

/**
 * Values the ruling refuses, one per family the spec's check defends. Named by
 * what each one would have done had it been followed.
 */
const OUT_OF_CONTRACT: Array<[label: string, url: string]> = [
  ['an absolute URL — the open redirect the ruling closed', 'https://example.com/thanks'],
  ['a script scheme, the same refusal for a stronger reason', 'javascript:alert(1)'],
  ['a data scheme', 'data:text/html,<h1>hi</h1>'],
  ['protocol-relative: another origin despite the leading slash', '//example.com/thanks'],
  ['a backslash, which browsers normalise to a slash while resolving', '/\\example.com'],
  ['whitespace, stripped before resolving and hiding the real start', '/ thanks'],
  ['a tab, same smuggle in a form that is easy to miss', '/\u0009thanks'],
  ['document-relative, so one form lands in different places', 'thanks'],
  ['empty — not a destination at all', ''],
  ['a single-brace near-miss of the token spelling', '/thanks?x={record.id}'],
  ['a token whose field segment is not field grammar', '/thanks?x={{record.Id}}'],
  ['a token with inner spacing', '/thanks?x={{ record.id }}'],
];

describe('the shape verdict is the contract’s, for every family', () => {
  it.each(IN_CONTRACT)('accepts %j, and so does the schema', (url) => {
    expect(specAccepts(url)).toBe(true);
    expect(resolveSubmitRedirect(url, {}).ok).toBe(true);
  });

  it.each(OUT_OF_CONTRACT)('refuses %s', (_label, url) => {
    // Direction first: the contract itself rejects this value. A fixture that
    // the schema accepted would make the refusal below this module's private
    // opinion, which is the thing these tests exist to rule out.
    expect(specAccepts(url)).toBe(false);

    const verdict = resolveSubmitRedirect(url, { id: 'r1' });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // Refusals are quotable: the author gets the spec's own prescription, which
    // names the key and cites the ruling it comes from, so the sentence read
    // here is the one the authoring door would have said. An empty or generic
    // message would be a silent drop wearing an error's clothes.
    expect(verdict.refusal).toMatch(/`(submitBehavior\.)?url`/);
    expect(verdict.refusal).toContain('#7496');
    expect(verdict.refusal.length).toBeGreaterThan(40);
  });

  it('points an absolute destination at the surface that IS declared for one', () => {
    const verdict = resolveSubmitRedirect('https://example.com/thanks', {});
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal).toContain('RELATIVE');
    // The ruling's alternative for a deliberately external destination.
    expect(verdict.refusal).toContain("{ type: 'url', url }");
  });
});

describe('interpolation — the consumer’s half of the ruling', () => {
  it('substitutes a declared field from the record just written', () => {
    expect(resolveSubmitRedirect('/thanks?ref={{record.id}}', { id: 'task-42' })).toEqual({
      ok: true,
      path: '/thanks?ref=task-42',
    });
  });

  it('substitutes every occurrence, not just the first', () => {
    expect(
      resolveSubmitRedirect('/r/{{record.id}}/x/{{record.id}}', { id: '7' }),
    ).toEqual({ ok: true, path: '/r/7/x/7' });
  });

  it('renders numbers and booleans, which JSON records legitimately carry', () => {
    expect(resolveSubmitRedirect('/t?n={{record.n}}&b={{record.b}}', { n: 42, b: true })).toEqual({
      ok: true,
      path: '/t?n=42&b=true',
    });
  });

  /**
   * A blank optional field is DATA, not an authoring defect, and this layer is
   * explicitly not the one that judges whether a token names a declared field —
   * that needs the object declaration, which `@objectstack/lint`'s
   * reference-integrity family holds. Emptying is the honest answer here;
   * refusing would be this renderer overreaching on the schema's behalf.
   */
  it('leaves an absent or null value empty rather than refusing', () => {
    expect(resolveSubmitRedirect('/t?ref={{record.note}}', { note: null })).toEqual({
      ok: true,
      path: '/t?ref=',
    });
    expect(resolveSubmitRedirect('/t?ref={{record.missing}}', {})).toEqual({
      ok: true,
      path: '/t?ref=',
    });
  });

  it('leaves a non-scalar empty — a flat token has no object form to write', () => {
    expect(resolveSubmitRedirect('/t?ref={{record.owner}}', { owner: { id: 'u1' } })).toEqual({
      ok: true,
      path: '/t?ref=',
    });
  });

  it('escapes the value: a token is a value, never new path structure', () => {
    expect(resolveSubmitRedirect('/t/{{record.slug}}/done', { slug: 'a/b' })).toEqual({
      ok: true,
      path: '/t/a%2Fb/done',
    });
    expect(resolveSubmitRedirect('/t?q={{record.q}}', { q: 'a b&c=d' })).toEqual({
      ok: true,
      path: '/t?q=a%20b%26c%3Dd',
    });
  });

  /**
   * THE pin for ruling point 2. Every one of these record values is an attempt
   * to turn an accepted relative path into something else — an address, a
   * traversal onto another origin, a control-character smuggle — and the oracle
   * is the contract itself: whatever this module emits must still be a value the
   * authoring door would accept.
   */
  it.each([
    ['an absolute address', 'https://evil.example/steal'],
    ['a protocol-relative address', '//evil.example/steal'],
    ['a backslash traversal', '\\\\evil.example'],
    ['a script scheme', 'javascript:alert(1)'],
    ['whitespace', ' leading space'],
    ['a control character', '\u0001'],
    ['a brace pair that looks like a token', '{{record.id}}'],
  ])('emits a path the contract still accepts, with %s in the record', (_label, hostile) => {
    const verdict = resolveSubmitRedirect('/t/{{record.slug}}?ref={{record.slug}}', {
      slug: hostile,
    });
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(specAccepts(verdict.path)).toBe(true);
    // And the hostile value is still THERE, escaped — refusing to interpolate
    // would be a different bug from interpolating unsafely.
    expect(verdict.path).toContain(encodeURIComponent(hostile));
  });

  it('never emits an unresolved interpolation', () => {
    for (const url of IN_CONTRACT) {
      const verdict = resolveSubmitRedirect(url, { id: 'x', slug: 's', status: 'open' });
      expect(verdict.ok).toBe(true);
      if (!verdict.ok) continue;
      expect(verdict.path).not.toContain('{');
      expect(verdict.path).not.toContain('}');
    }
  });
});
