import { test, expect } from '@playwright/test';
import { CONSOLE_BASE, waitForReactMount } from './helpers';

/**
 * objectui#2628 — the window BEFORE `LoadingScreen` mounts must not be a pure
 * white page.
 *
 * These run against the same production build the rest of this directory uses,
 * which is what makes them worth anything: the gap is the download and
 * evaluation of the real chunk graph (2.21 MB over 64 requests, measured on
 * this build), and a dev server does not have it.
 *
 * ⚠️ WHAT THESE CAN AND CANNOT SEE. Playwright has no frame buffer, so nothing
 * here reads pixels. Two things are observable and both are load-bearing:
 *
 *   1. ORDER — `first-contentful-paint` against the moment React first commits
 *      into `#root`. Before this fix those were the SAME event (the first
 *      content in the document was React's), so `fcp < reactMount` is false by
 *      construction on the old shell and true only when something paints ahead
 *      of the bundle. That is the timing claim, in the only form a browser will
 *      state it.
 *   2. CAUSE — with every script blocked, the page still renders the indicator.
 *      A component-level test cannot distinguish "the skeleton exists" from
 *      "the skeleton can paint during the gap"; blocking the bundle is what
 *      separates them, because the gap IS the bundle.
 *
 * The pixel-level reading — CDP `Page.startScreencast`, every frame classified
 * white/not — is recorded in the pull request rather than here: it needs a
 * throttled network profile per run and is chromium-only.
 */

interface BootProbe {
  fcp?: number;
  reactMountAt?: number;
  splashPresentAtMount?: boolean;
}

declare global {
  interface Window {
    __bootProbe?: BootProbe;
  }
}

const SPLASH = '#boot-splash';

test.describe('Console boot indicator', () => {
  test('ships the indicator in the HTML document, not in a JS chunk', async ({ page, baseURL }) => {
    // The artifact-level half of the argument, read off the SERVED bytes: the
    // gap being covered is the load of the JavaScript, so an indicator that
    // travels with the JavaScript becomes visible exactly when it is no longer
    // needed. It has to be in the document itself.
    const response = await page.request.get(`${baseURL}${CONSOLE_BASE}/`);
    expect(response.ok()).toBe(true);
    // Comments stripped FIRST: the prose in `index.html` describes this markup
    // and contains the literal string `<div id="boot-splash">`, so a raw search
    // finds the COMMENT and passes without ever seeing the element.
    const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, '');

    // All three parts must travel in the document: the element, the rules that
    // give it a shape and a non-white canvas, and the script that themes it.
    expect(html).toContain('id="boot-splash"');
    expect(html).toMatch(/<style\b[^>]*>[\s\S]*?#boot-splash[\s\S]*?<\/style>/);
    expect(html).toContain('installBootSplash');

    // The script stays a CLASSIC inline script — `type="module"` is deferred
    // and `src=` is a chunk, and either one runs after the frame it governs.
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    const boot = scripts.find((match) => (match[2] ?? '').includes('installBootSplash'));
    expect(boot, 'no inline installBootSplash script in the served document').toBeDefined();
    expect(boot?.[1]).not.toContain('type="module"');
    expect(boot?.[1]).not.toContain('src=');

    // ...and it precedes the element it configures, so the first painted frame
    // already carries the right canvas colour.
    //
    // NOTE the comparison this deliberately does NOT make: the application
    // entry is NOT after the splash in the built document. Vite hoists
    // `<script type="module">` into `<head>`, ahead of `<body>` entirely
    // (measured: entry at 7925, element at 8626). That is harmless because a
    // module script is DEFERRED — it cannot execute before the parser is done —
    // and asserting document order against it would fail on the artifact while
    // passing against the source, which is the reverse of useful.
    expect(html.indexOf('installBootSplash')).toBeLessThan(html.indexOf('id="boot-splash"'));
  });

  test('renders the indicator with the app bundle blocked', async ({ page }) => {
    // Deterministic version of the window this card is about: no script ever
    // arrives, so nothing React could have drawn is on screen. Whatever is
    // visible here is visible during the real gap too.
    await page.route('**/*.js', (route) => route.abort());

    await page.goto(`${CONSOLE_BASE}/`);
    const splash = page.locator(SPLASH);
    await expect(splash).toBeVisible();

    // Something occupies the middle of the viewport — not the bare body.
    const centreTag = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}` : null;
    });
    expect(centreTag).not.toBeNull();
    expect(centreTag).not.toBe('body');
    expect(centreTag).not.toBe('html');

    // And the canvas it draws on is the app's own background token, resolved
    // from the inline <style> — not the user agent's white.
    const background = await splash.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
    expect(background).not.toBe('rgb(255, 255, 255)');

    // The mark itself has real geometry, so "not white" is not just a tinted
    // empty page.
    const tile = page.locator(`${SPLASH} .boot-splash-tile`);
    const box = await tile.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });

  test('paints content BEFORE React mounts, and hands over without a gap', async ({
    page,
    browserName,
  }) => {
    // WebKit does not implement the Paint Timing API, so this reading is not
    // available there. Skipping is the honest outcome — the other two tests in
    // this file still run on every browser.
    test.skip(browserName === 'webkit', 'no Paint Timing API in WebKit');

    await page.addInitScript(() => {
      const probe: BootProbe = {};
      window.__bootProbe = probe;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint' && probe.fcp === undefined) {
              probe.fcp = entry.startTime;
            }
          }
        }).observe({ type: 'paint', buffered: true });
      } catch {
        /* reported as an undefined fcp below, never as a pass */
      }
      // Registered from an init script, so it is ahead of the page's own
      // handoff observer and sees the DOM as React leaves it, before the
      // splash is torn down.
      const observer = new MutationObserver(() => {
        const root = document.getElementById('root');
        if (!root || !root.firstChild) return;
        observer.disconnect();
        probe.reactMountAt = performance.now();
        probe.splashPresentAtMount = document.getElementById('boot-splash') !== null;
      });
      // `document`, NOT `document.documentElement`: an init script runs at
      // document-start, where there is no `<html>` element yet and the
      // observe() call throws. (Measured — it made this probe time out.)
      observer.observe(document, { childList: true, subtree: true });
    });

    await page.goto(`${CONSOLE_BASE}/`);
    await waitForReactMount(page);

    // A paint follows the commit we just observed; on a REGRESSED build the
    // first contentful paint IS that one, so it has not been reported yet at
    // this instant. Waiting for it here is what makes the failure below say
    // "fcp did not precede the commit" instead of "there was no fcp" — the
    // second sentence is true on a regression but names the wrong subject.
    await page
      .waitForFunction(() => window.__bootProbe?.fcp !== undefined, null, { timeout: 15_000 })
      .catch(() => {
        /* absence is graded by the assertion below, which says what it means */
      });

    const probe = await page.evaluate(() => window.__bootProbe);
    expect(probe?.fcp, 'no first-contentful-paint was reported').toBeDefined();
    expect(probe?.reactMountAt, "React's first commit was not observed").toBeDefined();

    const fcp = probe?.fcp ?? Number.POSITIVE_INFINITY;
    const mount = probe?.reactMountAt ?? 0;
    expect(
      fcp,
      `first-contentful-paint (${Math.round(fcp)}ms) must precede React's first commit ` +
        `(${Math.round(mount)}ms). Equal or later means nothing painted during the bundle ` +
        `load and the white frame of objectui#2628 is back.`,
    ).toBeLessThan(mount);

    // The window is covered for its whole length: the indicator was still up at
    // the instant React committed, so there is no frame between the two.
    expect(
      probe?.splashPresentAtMount,
      'the boot indicator was already gone when React committed — that gap is a white frame',
    ).toBe(true);

    // ...and it is gone immediately afterwards, so `LoadingScreen` never shares
    // the screen with a second indicator.
    await expect(page.locator(SPLASH)).toHaveCount(0);
  });
});
