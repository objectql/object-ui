import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectBrokenLinks, routeExists, stripCode } from '../check-doc-links.mjs';

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
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoots: string[] = [];

/** Materialises `{ 'guide/a.md': '...' }` into a throwaway docs root. */
function docsRootWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-doc-links-'));
  tempRoots.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

/** The hrefs reported broken, in file order. */
function brokenHrefs(files: Record<string, string>): string[] {
  return collectBrokenLinks(docsRootWith(files)).map((item: { href: string }) => item.href);
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

  it('waves through site routes outside the docs collection', () => {
    // `/api/core`, `/img/...`, `/spec/...` are not in this collection and cannot
    // be resolved from `content/docs` alone.
    expect(
      brokenHrefs({
        'guide/a.md': '[api](/api/core) ![shot](/img/guide/x.png)',
      }),
    ).toEqual([]);
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
    const broken = collectBrokenLinks(path.join(repoRoot, 'content/docs')) as {
      file: string;
      href: string;
      line: number;
    }[];
    const report = broken.map((b) => `${path.relative(repoRoot, b.file)}:${b.line} -> ${b.href}`);
    expect(report).toEqual([]);
  });

  it('exposes routeExists with the context the scan gives it', () => {
    const root = docsRootWith({ 'guide/a.md': '# A', 'plugins/plugin-charts.mdx': '# Charts' });
    const fromFile = path.join(root, 'guide/a.md');

    expect(routeExists('../plugins/plugin-charts.mdx', { fromFile, docsRoot: root })).toBe(true);
    expect(routeExists('../plugins/plugin-charts.md', { fromFile, docsRoot: root })).toBe(false);
  });
});
