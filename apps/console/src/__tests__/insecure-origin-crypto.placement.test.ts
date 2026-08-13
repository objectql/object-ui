/**
 * objectui#4563 — the shim's PLACEMENT is the fix, not just its code.
 *
 * A `crypto.randomUUID` fallback that runs after a consumer has already called
 * the missing method fixes nothing. The guarantee the console relies on is
 * purely ordering: `index.html` loads the shim from a `script type="module"`
 * placed ahead of the `/src/main.tsx` entry, and module scripts are deferred
 * and executed in DOCUMENT ORDER — so the shim evaluates before the
 * application's first import, hence before every consumer in its module graph.
 *
 * That ordering is one line in an HTML file with nothing else defending it:
 * moving the tag below the entry, renaming the module, or dropping the tag
 * during an unrelated `index.html` edit all leave a green build that crashes on
 * a LAN IP exactly as before. This test is what makes that regression loud.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const INDEX_HTML = path.resolve(import.meta.dirname, '../../index.html');
const SHIM_SRC = '/src/insecure-origin-crypto.ts';
const APP_ENTRY = '/src/main.tsx';

describe('apps/console/index.html — insecure-origin crypto shim placement', () => {
  const html = readFileSync(INDEX_HTML, 'utf8');

  it('loads the shim as a module script', () => {
    expect(html).toContain(`<script type="module" src="${SHIM_SRC}"></script>`);
  });

  it('still loads the application entry as a module script', () => {
    // Both must be `type="module"`: document-order execution is guaranteed
    // between deferred module scripts, and a classic script would break it.
    expect(html).toContain(`<script type="module" src="${APP_ENTRY}"></script>`);
  });

  it('runs the shim BEFORE the application entry', () => {
    // Compare SCRIPT TAG positions, never raw string positions: both paths are
    // also named in the explanatory HTML comment above the shim tag, so
    // `html.indexOf(APP_ENTRY)` finds the COMMENT first and the ordering
    // assertion inverts while the real markup is correct. (Measured — this
    // test failed exactly that way before the tag-based lookup.)
    const shimAt = html.indexOf(`<script type="module" src="${SHIM_SRC}">`);
    const entryAt = html.indexOf(`<script type="module" src="${APP_ENTRY}">`);

    expect(shimAt).toBeGreaterThan(-1);
    expect(entryAt).toBeGreaterThan(-1);
    expect(shimAt).toBeLessThan(entryAt);
  });

  it('keeps the shim ahead of every script tag that is not the shim itself', () => {
    // Stronger than the pairwise check above: nothing at all may be scheduled
    // to run before the shim except the inline head scripts that precede it,
    // which are pinned here by name so a new one cannot be added silently.
    // The regex only matches real `<script ...>` tags, so HTML comments that
    // mention either path cannot perturb the ordering.
    const tags = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
    const shimIndex = tags.findIndex((tag) => tag.includes(SHIM_SRC));
    const entryIndex = tags.findIndex((tag) => tag.includes(APP_ENTRY));

    expect(shimIndex).toBeGreaterThan(-1);
    expect(entryIndex).toBe(tags.length - 1);
    expect(shimIndex).toBeLessThan(entryIndex);

    // Everything before the shim is an inline classic script (early branding,
    // the `window.process` polyfill) — no module, and nothing with a `src`.
    for (const tag of tags.slice(0, shimIndex)) {
      expect(tag).not.toContain('src=');
      expect(tag).not.toContain('type="module"');
    }
  });
});
