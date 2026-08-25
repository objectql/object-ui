/**
 * objectui#2628 — the console's pre-React boot indicator.
 *
 * These tests grade THE SHIPPED ARTIFACT, following the pattern
 * `insecure-origin-crypto.test.ts` established for this file: the fix is markup
 * plus one inline classic script in `apps/console/index.html`, so the tests
 * read that file through `?raw` and execute the script itself. There is
 * deliberately no TypeScript copy of the logic — a testable duplicate that can
 * drift from the one that ships would be graded green while the real bootstrap
 * rots.
 *
 * ⚠️ WHAT THIS FILE CANNOT SEE. The claim in objectui#2628 is a TIMING one —
 * "no pure-white frame in the window before `LoadingScreen` mounts" — and a
 * jsdom/happy-dom test has no compositor, no frames and no clock that means
 * anything. What is provable here is the STRUCTURE that makes the timing claim
 * possible: the indicator is in the HTML document rather than in the JS chunk
 * whose load IS the window, it is ahead of the module entry, it needs no
 * network to decide its colours, and it is torn down exactly on React's first
 * commit. The timing itself is measured in `e2e/console-boot-indicator.spec.ts`
 * (first-contentful-paint strictly before React mounts, against the real
 * production build) and, pixel-by-pixel, by the CDP screencast run recorded in
 * the pull request. Three instruments, three different things — none of them a
 * substitute for the others.
 */
import indexHtml from '../../index.html?raw';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const SPLASH_ID = 'boot-splash';
const SCRIPT_MARKER = 'installBootSplash';
const THEME_STORAGE_KEY = 'vite-ui-theme';
const APP_ENTRY = '/src/main.tsx';

/** Every `<script>` open tag plus its inline body, in document order. */
function scriptsOf(html: string) {
  return [
    // Comments first: prose describing a script tag parses as one, and this
    // file's comments describe several.
    ...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g),
  ].map((match) => ({ attrs: match[1] ?? '', body: match[2] ?? '' }));
}

/**
 * The boot-splash script exactly as it ships. Extraction is by the IIFE's name,
 * so renaming or deleting it fails here rather than silently testing nothing.
 */
function extractBootSplashSource(html: string = indexHtml): string {
  const found = scriptsOf(html).filter((script) => script.body.includes(SCRIPT_MARKER));
  if (found.length !== 1) {
    throw new Error(
      `expected exactly 1 inline \`${SCRIPT_MARKER}\` script in index.html, found ${found.length}`,
    );
  }
  return found[0]?.body ?? '';
}

describe('apps/console/index.html — boot splash ships in the DOCUMENT', () => {
  it('puts the indicator in the HTML body, not in a bundled chunk', () => {
    // The whole point of objectui#2628: the gap being covered IS the load of
    // the JavaScript, so an indicator delivered BY that JavaScript cannot paint
    // during it. This assertion is the artifact-level half of that argument —
    // the element is in the document the server returns.
    const body = indexHtml.slice(indexHtml.indexOf('<body>'));
    expect(body).toContain(`id="${SPLASH_ID}"`);
  });

  it('styles it from an inline <style>, so no stylesheet request gates the paint', () => {
    const styles = [...indexHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1] ?? '');
    expect(styles.some((css) => css.includes(`#${SPLASH_ID}`))).toBe(true);
  });

  it('paints the element BEFORE the application entry in document order', () => {
    const splashAt = indexHtml.indexOf(`id="${SPLASH_ID}"`);
    const entryAt = indexHtml.indexOf(APP_ENTRY);
    expect(splashAt).toBeGreaterThan(-1);
    expect(entryAt).toBeGreaterThan(-1);
    expect(splashAt).toBeLessThan(entryAt);
  });

  it('keeps the script a CLASSIC inline script that runs before every `src` script', () => {
    // `type="module"` is deferred and `src=` is a bundled chunk; either turns a
    // parse-time decision into one that happens after the window it governs.
    const all = scriptsOf(indexHtml);
    const index = all.findIndex((script) => script.body.includes(SCRIPT_MARKER));
    expect(index).toBeGreaterThan(-1);
    expect(all[index]?.attrs).not.toContain('type="module"');
    expect(all[index]?.attrs).not.toContain('src=');
    all.forEach((script, i) => {
      if (!script.attrs.includes('src=')) return;
      expect(
        i,
        `script #${i} (${script.attrs.trim()}) is scheduled before the #2628 boot splash`,
      ).toBeGreaterThan(index);
    });
  });

  it('ships no user-facing copy — there is no locale pack to translate it with', () => {
    // The i18n packs live in the bundle this markup is waiting for, so any
    // string here would be untranslatable English in a ten-language product,
    // and a product name would mean waiting for `GET /api/v1/runtime/config`.
    // `LoadingScreen` carries the copy the moment React mounts.
    // Comments first, and from `<body>` — the head carries prose ABOUT this
    // element, and matching that instead would grade the wrong text.
    const body = indexHtml.slice(indexHtml.indexOf('<body>')).replace(/<!--[\s\S]*?-->/g, '');
    const splash = body.slice(body.indexOf(`id="${SPLASH_ID}"`));
    const markup = splash.slice(0, splash.indexOf('<div id="root">'));
    const text = markup
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    expect(text).toBe('');
  });

  it('does not fetch anything to decide what to draw', () => {
    const source = extractBootSplashSource();
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('XMLHttpRequest');
  });
});

describe('apps/console/index.html — boot splash behaviour', () => {
  let matchMediaSpy: ReturnType<typeof vi.fn> | undefined;

  function mountDocument(): void {
    document.documentElement.removeAttribute('data-boot-theme');
    document.body.innerHTML = `<div id="${SPLASH_ID}"></div><div id="root"></div>`;
  }

  function stubPrefersDark(dark: boolean): void {
    matchMediaSpy = vi.fn((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? dark : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal('matchMedia', matchMediaSpy);
  }

  /** Execute the shipped script against the current document. */
  function runBootSplash(): void {
    // eslint-disable-next-line no-new-func
    new Function(extractBootSplashSource())();
  }

  beforeEach(() => {
    localStorage.clear();
    mountDocument();
    stubPrefersDark(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-boot-theme');
    document.body.innerHTML = '';
  });

  it('marks the boot canvas light when nothing is stored and the OS is light', () => {
    runBootSplash();
    expect(document.documentElement.getAttribute('data-boot-theme')).toBe('light');
  });

  it('marks it dark when the OS prefers dark and no explicit choice is stored', () => {
    stubPrefersDark(true);
    runBootSplash();
    expect(document.documentElement.getAttribute('data-boot-theme')).toBe('dark');
  });

  it("honours ThemeProvider's own storage key for an explicit dark choice", () => {
    // The same key `ThemeProvider` writes. A dark-theme user who saw a LIGHT
    // first frame would get the flash this card exists to remove, just in the
    // other direction.
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    runBootSplash();
    expect(document.documentElement.getAttribute('data-boot-theme')).toBe('dark');
  });

  it('honours an explicit light choice over a dark OS preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    stubPrefersDark(true);
    runBootSplash();
    expect(document.documentElement.getAttribute('data-boot-theme')).toBe('light');
  });

  it("treats the spec's `auto` and the provider's `system` as following the OS", () => {
    for (const stored of ['auto', 'system']) {
      document.documentElement.removeAttribute('data-boot-theme');
      localStorage.setItem(THEME_STORAGE_KEY, stored);
      stubPrefersDark(true);
      runBootSplash();
      expect(
        document.documentElement.getAttribute('data-boot-theme'),
        `stored theme \`${stored}\` should follow the OS`,
      ).toBe('dark');
    }
  });

  it('leaves the splash up while #root is still empty', async () => {
    runBootSplash();
    // A mutation elsewhere in the document must not be mistaken for a mount.
    document.body.appendChild(document.createElement('span'));
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById(SPLASH_ID)).not.toBeNull();
  });

  it("removes the splash on React's first commit into #root", async () => {
    runBootSplash();
    document.getElementById('root')!.appendChild(document.createElement('div'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById(SPLASH_ID)).toBeNull();
    // The attribute is scoped to the boot window; leaving it behind would let
    // it collide with the `light`/`dark` class ThemeProvider owns.
    expect(document.documentElement.hasAttribute('data-boot-theme')).toBe(false);
  });

  it('survives a browser with no localStorage access', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage blocked');
      });
    try {
      expect(() => runBootSplash()).not.toThrow();
      expect(document.documentElement.getAttribute('data-boot-theme')).toBe('light');
    } finally {
      getItem.mockRestore();
    }
  });
});
