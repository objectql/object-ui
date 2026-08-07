import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectBrokenLinks, collectSiteRoutes, routeExists, siteUrlExists, stripCode } from '../check-doc-links.mjs';

/**
 * objectui#3479 — the behaviour test for `scripts/check-doc-links.mjs`.
 *
 * The gate was wired into CI by #3450 (see `docs-links-workflow.test.ts`, which
 * pins the wiring). What nothing pinned was what it actually *checked*: its
 * `routeExists()` opened with an early `return true` for any href not starting
 * with `/docs`, so every relative link in the tree was waved through unresolved.
 * 33 references to 16 non-existent targets had accumulated behind it.
 *
 * These tests pin the two halves that early return hid, in the two shapes the
 * site actually resolves:
 *
 *   - a RELATIVE href names the target FILE, extension included — that is what
 *     fumadocs' `source.resolveHref` looks up (its page index is keyed by source
 *     file path *with* extension), via `createRelativeLink` in
 *     `apps/site/app/docs/[[...slug]]/page.tsx`;
 *   - an ABSOLUTE `/docs/...` href names an extensionless ROUTE — `resolveHref`
 *     never touches it, so it reaches the browser verbatim.
 *
 * The A-class defect in #3479 is exactly the first shape violated: 13 links
 * spelled `../plugins/plugin-*.md` while every one of those files is `.mdx`.
 *
 * objectui#3490 removed the two waivers those checks were still built on — a
 * non-`/docs` absolute href was waved through unchecked, and a relative href was
 * judged purely as a path on disk. Both answered "does a file exist?" when the
 * question is "does the site serve this URL?", and 18 live 404s had collected
 * behind them. The gate now enumerates `apps/site/app` + `apps/site/public` as
 * its truth source for absolute hrefs, and rejects relative hrefs that resolve
 * out of the docs collection. The describes at the bottom pin both.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoots: string[] = [];

/**
 * The default site fixture: the shapes the real `apps/site/app` uses — a route
 * group serving `/`, a plain segment, an optional catch-all, a nested route
 * handler — plus one static file under `public/`.
 */
const SITE_FIXTURE: Record<string, string> = {
  'apps/site/app/(home)/page.tsx': 'export default () => null',
  'apps/site/app/playground/page.tsx': 'export default () => null',
  'apps/site/app/docs/[[...slug]]/page.tsx': 'export default () => null',
  'apps/site/app/api/search/route.ts': 'export const GET = () => null',
  'apps/site/public/img/guide/shot.png': 'PNG',
};

/** Materialises `{ 'content/docs/guide/a.md': '...' }` into a throwaway repo. */
function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-doc-links-'));
  tempRoots.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

/** Docs-only sugar: keys are relative to `content/docs`, site fixture implied. */
function docsRootWith(files: Record<string, string>): string {
  const prefixed = Object.fromEntries(Object.entries(files).map(([rel, body]) => [`content/docs/${rel}`, body]));
  return path.join(repoWith({ ...SITE_FIXTURE, ...prefixed }), 'content/docs');
}

function scan(repo: string): { file: string; href: string; line: number; reason: string }[] {
  return collectBrokenLinks(path.join(repo, 'content/docs'), path.join(repo, 'apps/site'));
}

/** The hrefs reported broken, in file order. */
function brokenHrefs(files: Record<string, string>): string[] {
  const docsRoot = docsRootWith(files);
  const repo = path.resolve(docsRoot, '../..');
  return scan(repo).map((item) => item.href);
}

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

const FENCE = '```';

describe('relative hrefs are resolved — the hole objectui#3479 closed', () => {
  it('reports a relative link whose target does not exist', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[gone](./nowhere.md)',
      }),
    ).toEqual(['./nowhere.md']);
  });

  it('reports the #3479 A-class shape: link says .md, file is .mdx', () => {
    // The single assertion that dies if the `startsWith('/docs') -> return true`
    // early return ever comes back. 13 of the 16 broken targets were this.
    expect(
      brokenHrefs({
        'guide/plugins.md': '[Charts](../plugins/plugin-charts.md)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual(['../plugins/plugin-charts.md']);
  });

  it('accepts the same link once it names the real file', () => {
    expect(
      brokenHrefs({
        'guide/plugins.md': '[Charts](../plugins/plugin-charts.mdx)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual([]);
  });

  it('accepts a relative link to a real .md file', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[b](./b.md)',
        'guide/b.md': '# B',
      }),
    ).toEqual([]);
  });

  it('accepts the extensionless-route spelling of a relative link', () => {
    // Not the recommended form — it misses fumadocs' resolver and only works by
    // browser URL-relative resolution — but it is not a broken link, and this
    // gate does not invent style rules.
    expect(
      brokenHrefs({
        'guide/plugins.md': '[Charts](../plugins/plugin-charts)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual([]);
  });

  it('accepts a relative link to a directory index', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[plugins](../plugins)',
        'plugins/index.md': '# Plugins',
      }),
    ).toEqual([]);
  });

  it('rejects a relative link to a directory that has no index page', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[plugins](../plugins)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual(['../plugins']);
  });

  it('resolves relative to the linking file, not the docs root', () => {
    // `./b.md` from `guide/a.md` is `guide/b.md` — a root-relative reading would
    // look for `b.md` at the top level and call a valid link broken.
    expect(
      brokenHrefs({
        'guide/a.md': '[b](./b.md)',
        'guide/b.md': '# B',
        'b.md': '# decoy at the root',
      }),
    ).toEqual([]);

    expect(
      brokenHrefs({
        'guide/a.md': '[b](./b.md)',
        'b.md': '# only at the root',
      }),
    ).toEqual(['./b.md']);
  });

  it('ignores the fragment and query when resolving', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[b](./b.md#a-section) and [c](./b.md?x=1)',
        'guide/b.md': '# B',
      }),
    ).toEqual([]);
  });
});

describe('absolute /docs hrefs stay strict — they are routes, not files', () => {
  it('accepts an extensionless route', () => {
    expect(
      brokenHrefs({
        'guide/a.md': '[plugins](/docs/plugins/plugin-charts)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual([]);
  });

  it('rejects a /docs route carrying a file extension, even when that file exists', () => {
    // `next.config.mjs` rewrites only `/docs/:path*.mdx` (to the raw-markdown
    // llms route); `/docs/guide/b.md` is a 404 on the site whatever is on disk.
    // A relative-link check that resolved absolute hrefs on the filesystem too
    // would quietly bless both.
    expect(
      brokenHrefs({
        'guide/a.md': '[b](/docs/guide/b.md)',
        'guide/b.md': '# B',
      }),
    ).toEqual(['/docs/guide/b.md']);
  });

  it('accepts /docs itself when the root has an index page', () => {
    expect(brokenHrefs({ 'index.md': '[home](/docs)' })).toEqual([]);
  });

  it('is checked before the site-route table, so the /docs rule stays the strict one', () => {
    // `/docs/[[...slug]]` is a real route in the site fixture, so the generic
    // route matcher would accept `/docs/guide/b.md`. It must not get the chance:
    // the extension makes it a 404, and the `/docs` branch above owns that call.
    expect(
      brokenHrefs({
        'guide/a.md': '[b](/docs/guide/b.md)',
        'guide/b.md': '# B',
      }),
    ).toEqual(['/docs/guide/b.md']);
  });
});

describe('external and non-path hrefs are left alone', () => {
  it('skips schemes, in-page anchors and empty targets', () => {
    expect(
      brokenHrefs({
        'guide/a.md': [
          '[web](https://example.com/nope)',
          '[mail](mailto:a@b.c)',
          '[tel](tel:+1000)',
          '[anchor](#section)',
        ].join('\n\n'),
      }),
    ).toEqual([]);
  });
});

describe('code is stripped before scanning — markdown syntax quoted in code is not a link', () => {
  it('blanks a fenced block but keeps every newline, so line numbers stay true', () => {
    const source = ['before', FENCE + 'tsx', '[x](./nowhere.md)', FENCE, 'after'].join('\n');
    const stripped = stripCode(source);

    expect(stripped.split('\n')).toHaveLength(source.split('\n').length);
    expect(stripped).toHaveLength(source.length);
    expect(stripped.split('\n')[0]).toBe('before');
    expect(stripped.split('\n')[2].trim()).toBe('');
    expect(stripped.split('\n')[4]).toBe('after');
  });

  it('blanks an inline code span', () => {
    expect(stripCode('- **Links**: `[text](url)`').trim()).toBe('- **Links**:');
  });

  it('does not report the fenced JSX false positive main carries', () => {
    // content/docs/guide/notifications.md:54 — inside a ```tsx fence,
    // `toast[n.severity](n.title, { description: n.message })` matches the link
    // regex with an "href" of `n.title, { description: n.message }`.
    expect(
      brokenHrefs({
        'guide/notifications.md': [
          FENCE + 'tsx',
          'onToast={(n) => toast[n.severity](n.title, { description: n.message })}',
          FENCE,
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('does not report the inline-code false positive main carries', () => {
    // content/docs/fields/rich-text.mdx:47 documents the syntax itself.
    expect(
      brokenHrefs({
        'fields/rich-text.mdx': '- **Links**: `[text](url)`\n- **Images**: `![alt](url)`',
      }),
    ).toEqual([]);
  });

  it('still reports a real link on a line that also contains code', () => {
    expect(
      brokenHrefs({
        'guide/a.md': 'Use `[text](url)` to write [this](./nowhere.md).',
      }),
    ).toEqual(['./nowhere.md']);
  });

  it('closes a fence only on a matching, bare marker', () => {
    const source = [FENCE, '[x](./nowhere.md)', FENCE + 'ts', '[y](./nowhere.md)', FENCE].join('\n');
    expect(stripCode(source).replace(/\s/g, '')).toBe('');
  });
});

describe('the repo it guards', () => {
  it('has no broken internal docs links', () => {
    // The other half of objectui#3479: the extended check must land GREEN, not
    // arrive with a backlog it merely describes.
    const broken = scan(repoRoot);
    const report = broken.map((b) => `${path.relative(repoRoot, b.file)}:${b.line} -> ${b.href}`);
    expect(report).toEqual([]);
  });

  it('exposes routeExists with the context the scan gives it', () => {
    const root = docsRootWith({ 'guide/a.md': '# A', 'plugins/plugin-charts.mdx': '# Charts' });
    const fromFile = path.join(root, 'guide/a.md');

    expect(routeExists('../plugins/plugin-charts.mdx', { fromFile, docsRoot: root })).toBe(true);
    expect(routeExists('../plugins/plugin-charts.md', { fromFile, docsRoot: root })).toBe(false);
  });

  it('reads the real apps/site tree as its route truth source', () => {
    // The coupling objectui#3490 deliberately bought, pinned against the actual
    // site: the enumerator must understand this router's shapes (a `(home)`
    // group serving `/`, dot-named literal segments, an optional catch-all) and
    // must NOT invent the prefixes the 17 dead links assumed.
    const site = collectSiteRoutes(path.join(repoRoot, 'apps/site'));

    for (const served of ['/', '/playground', '/llms.txt', '/docs/guide/expressions', '/logo.svg']) {
      expect([served, siteUrlExists(served, site)]).toEqual([served, true]);
    }
    for (const dead of ['/spec/component.md', '/protocol/overview', '/api/core', '/api/react', '/examples/crm']) {
      expect([dead, siteUrlExists(dead, site)]).toEqual([dead, false]);
    }
  });
});

describe('absolute non-/docs hrefs are resolved against the site — objectui#3490 B-class', () => {
  it('reports the shape all 17 dead links had: a prefix the router has no segment for', () => {
    // The assertion that dies if `if (cleanHref.startsWith('/')) return true;`
    // ever comes back. `/spec`, `/protocol`, `/examples` are not route segments
    // in apps/site/app, and never were.
    expect(
      brokenHrefs({
        'guide/a.md': [
          '[spec](/spec/component-package.md)',
          '[protocol](/protocol/overview)',
          '[example](/examples/crm)',
        ].join('\n\n'),
      }),
    ).toEqual(['/spec/component-package.md', '/protocol/overview', '/examples/crm']);
  });

  it('reports a sibling of a real segment — /api exists, /api/core does not', () => {
    // The near-miss that makes prefix-allowlisting useless: the fixture has
    // `app/api/search/route.ts`, so `/api` is a real path prefix. It is not a
    // route, and neither is `/api/core`.
    expect(
      brokenHrefs({ 'guide/a.md': '[core](/api/core) and [search](/api/search)' }),
    ).toEqual(['/api/core']);
  });

  it('accepts a static file under public/ — the 3 /img links in #3490 were fine', () => {
    expect(brokenHrefs({ 'guide/a.md': '![shot](/img/guide/shot.png)' })).toEqual([]);
  });

  it('reports a public/ path that does not exist', () => {
    expect(brokenHrefs({ 'guide/a.md': '![gone](/img/guide/missing.png)' })).toEqual(['/img/guide/missing.png']);
  });

  it('accepts a plain route and the site root, trailing slash or not', () => {
    expect(brokenHrefs({ 'guide/a.md': '[p](/playground) [q](/playground/) [home](/)' })).toEqual([]);
  });

  it('refuses to judge an absolute href with no route table rather than waving it through', () => {
    // A silent `true` here is exactly how the 18 accumulated. Callers that skip
    // the truth source get an error, not a green.
    const docsRoot = docsRootWith({ 'guide/a.md': '# A' });
    expect(() => routeExists('/spec/component.md', { fromFile: path.join(docsRoot, 'guide/a.md'), docsRoot })).toThrow(
      /site route table/,
    );
  });
});

describe('the route table follows Next.js segment semantics', () => {
  function tableFor(files: Record<string, string>) {
    return collectSiteRoutes(path.join(repoWith(files), 'apps/site'));
  }

  it('drops route groups, skips private and slot folders, and needs a page or route file', () => {
    const site = tableFor({
      'apps/site/app/(marketing)/pricing/page.tsx': 'x',
      'apps/site/app/_internal/secret/page.tsx': 'x',
      'apps/site/app/components/Thing.tsx': 'x',
      'apps/site/app/feed/route.ts': 'x',
    });

    expect(siteUrlExists('/pricing', site)).toBe(true);
    expect(siteUrlExists('/(marketing)/pricing', site)).toBe(false);
    expect(siteUrlExists('/_internal/secret', site)).toBe(false);
    expect(siteUrlExists('/components', site)).toBe(false);
    expect(siteUrlExists('/feed', site)).toBe(true);
  });

  it('matches dynamic, catch-all and optional catch-all segments by arity', () => {
    const site = tableFor({
      'apps/site/app/blog/[slug]/page.tsx': 'x',
      'apps/site/app/og/[...slug]/page.tsx': 'x',
      'apps/site/app/wiki/[[...slug]]/page.tsx': 'x',
    });

    expect(siteUrlExists('/blog/hello', site)).toBe(true);
    expect(siteUrlExists('/blog', site)).toBe(false);
    expect(siteUrlExists('/blog/a/b', site)).toBe(false);

    expect(siteUrlExists('/og/a', site)).toBe(true);
    expect(siteUrlExists('/og/a/b', site)).toBe(true);
    expect(siteUrlExists('/og', site)).toBe(false);

    expect(siteUrlExists('/wiki', site)).toBe(true);
    expect(siteUrlExists('/wiki/a/b', site)).toBe(true);
  });
});

describe('relative hrefs may not leave the collection — objectui#3490 A-class', () => {
  it('reports a link out of content/docs even though the file is really there', () => {
    // `guide/data-source.md:202` pointed at `../../../packages/data-objectstack/
    // README.md#...`. The file exists, so `lychee --offline` and the pre-#3490
    // check both passed it; the site still 404s, because fumadocs can only
    // resolve inside the docs page index. The fixture materialises the target,
    // so this test fails if existence is ever allowed to decide the verdict.
    const repo = repoWith({
      ...SITE_FIXTURE,
      'content/docs/guide/data-source.md': '[adapter README](../../../packages/data-objectstack/README.md#batch)',
      'packages/data-objectstack/README.md': '# Adapter',
    });

    expect(fs.existsSync(path.join(repo, 'packages/data-objectstack/README.md'))).toBe(true);
    expect(scan(repo).map((item) => [item.href, item.reason])).toEqual([
      ['../../../packages/data-objectstack/README.md#batch', 'escapes-collection'],
    ]);
  });

  it('still accepts relative links that stay inside the collection', () => {
    expect(
      brokenHrefs({
        'guide/plugins.md': '[Charts](../plugins/plugin-charts.mdx) and [self](./plugins.md)',
        'plugins/plugin-charts.mdx': '# Charts',
      }),
    ).toEqual([]);
  });

  it('labels each failure with the check that rejected it', () => {
    const repo = repoWith({
      ...SITE_FIXTURE,
      'content/docs/guide/a.md': [
        '[out](../../../elsewhere/README.md)',
        '[site](/spec/component.md)',
        '[docs](/docs/guide/a.md)',
        '[rel](./nowhere.md)',
      ].join('\n\n'),
    });

    expect(scan(repo).map((item) => item.reason)).toEqual([
      'escapes-collection',
      'site-route',
      'docs-route',
      'relative',
    ]);
  });
});
