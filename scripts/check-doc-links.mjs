#!/usr/bin/env node
/**
 * Rejects internal documentation links under `content/docs/**` that point nowhere.
 *
 * Run:  node scripts/check-doc-links.mjs   (also `pnpm docs:check-links`)
 * Exit: 0 = every internal link resolves, 1 = at least one does not
 *
 * ## Why this file changed (objectui#3479)
 *
 * The check used to look at exactly one kind of href: the absolute site route
 * `/docs/...`. Its `routeExists()` opened with
 *
 *     if (!cleanHref.startsWith('/docs')) return true;
 *
 * so every *relative* link (`./foo.md`, `../plugins/bar.mdx`) was waved through
 * without being resolved at all. Nothing else gated them either — the site build
 * does not fail on an unresolvable link, it just renders one — so they accrued
 * silently: 33 references to 16 non-existent targets by the time anyone ran
 * `lychee --offline` over the tree.
 *
 * The information needed to check them was already here. The scan walks every
 * file, so it knows the path each href was written in; a relative href is just
 * that directory plus the href.
 *
 * ## The two link forms, and why they are checked differently
 *
 * This is not a style preference — the site resolves the two forms through
 * different machinery, and each is only correct in its own shape.
 *
 * **Relative hrefs name a FILE, extension included.** `apps/site/app/docs/
 * [[...slug]]/page.tsx` renders MDX anchors through fumadocs'
 * `createRelativeLink(source, page)`, which calls `source.resolveHref(href,
 * page)`. That function only acts on hrefs starting with `./` or `../`: it joins
 * them onto `dirname(page.path)` and looks the result up in the page indexer —
 * and the indexer is keyed by **source file path including the extension**
 * (`createPageIndexer.scan()` stores `pathToPage.set(filePath, page)`). So
 * `../plugins/plugin-charts.mdx` resolves to the real page URL
 * `/docs/plugins/plugin-charts`, while `../plugins/plugin-charts.md` misses the
 * index, falls through unresolved, and reaches the browser verbatim as
 * `/docs/plugins/plugin-charts.md` — a 404, because `next.config.mjs` rewrites
 * only the `.mdx` suffix (to the raw-markdown `llms.mdx` route). That mismatch
 * — link says `.md`, file is `.mdx` — is what all 13 A-class links in #3479 were.
 *
 * An extensionless relative href (`../concepts/lazy-loading`) misses the indexer
 * too, and is *accidentally* right whenever browser URL-relative resolution
 * happens to land on the correct route. It is accepted below (it is not a broken
 * link, and rejecting a working form would be this gate over-reaching), but it
 * is the fragile spelling: it stops working the moment the target page moves,
 * with no resolver to notice.
 *
 * **Absolute hrefs name a ROUTE, extensionless.** `resolveHref` ignores them
 * entirely, so `/docs/guide/plugins` goes to the browser as written. All 297
 * absolute `/docs/...` links in the tree are extensionless, and that branch is
 * therefore kept strict: `/docs/guide/plugins.md` is NOT accepted just because
 * `guide/plugins.md` exists on disk, because that URL 404s on the site.
 *
 * Non-`/docs` absolute hrefs (`/spec/...`, `/api/...`, `/img/...`) are still
 * waved through: they are routes outside this collection and cannot be resolved
 * from `content/docs` alone.
 *
 * ## Code spans are stripped before scanning
 *
 * Required, not tidiness. Extending the scan to relative hrefs turns markdown's
 * own link syntax, quoted inside code, into false positives — `main` carries two
 * today:
 *
 *   - `content/docs/guide/notifications.md:54` — inside a ```tsx fence,
 *     `toast[n.severity](n.title, { description: n.message })` matches the link
 *     regex with an "href" of `n.title, { description: n.message }`.
 *   - `content/docs/fields/rich-text.mdx:47` — the inline code span
 *     `` `[text](url)` `` documents the syntax itself.
 *
 * Neither renders as an anchor, so neither is this gate's business. Blanking
 * fenced blocks and inline spans (padding with spaces, so reported line numbers
 * stay true) is what makes the relative-link check safe to turn on.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_ROUTE_PREFIX = '/docs';
const MARKDOWN_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;
/** A fence line: optional indent, 3+ backticks or tildes, optional info string. */
const FENCE_RE = /^\s*(`{3,}|~{3,})(.*)$/;
/** An inline code span on a single line: `like this`, ``or this``. */
const INLINE_CODE_RE = /(`+)[^`\n]*\1/g;
/** Any URI scheme (`https:`, `mailto:`, `tel:`) — not ours to resolve. */
const EXTERNAL_HREF_RE = /^(?:#|[a-zA-Z][a-zA-Z0-9+.-]*:)/;

const blank = (text) => text.replace(/[^\n]/g, ' ');

export function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Replaces every fenced block and inline code span with spaces, leaving the
 * byte length and every newline untouched so offsets — and therefore reported
 * line numbers — still line up with the original file.
 */
export function stripCode(source) {
  const out = [];
  let openFence = null;

  for (const line of source.split('\n')) {
    const fence = FENCE_RE.exec(line);

    if (openFence) {
      out.push(blank(line));
      const closes =
        fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length && fence[2].trim() === '';
      if (closes) openFence = null;
      continue;
    }

    if (fence) {
      openFence = fence[1];
      out.push(blank(line));
      continue;
    }

    out.push(line.replace(INLINE_CODE_RE, (match) => blank(match)));
  }

  return out.join('\n');
}

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** The extensionless-route spellings of `base`, as fumadocs would serve them. */
function routeCandidates(base) {
  return [`${base}.md`, `${base}.mdx`, path.join(base, 'index.md'), path.join(base, 'index.mdx')];
}

/**
 * Resolves one href.
 *
 * @param {string} href       the raw href as authored
 * @param {{ fromFile: string, docsRoot: string }} context
 */
export function routeExists(href, { fromFile, docsRoot }) {
  let cleanHref = href.split('#')[0].split('?')[0].trim();
  if (!cleanHref) return true; // pure in-page anchor or query
  try {
    cleanHref = decodeURI(cleanHref);
  } catch {
    /* keep the raw form — a malformed escape is checked as written */
  }

  if (cleanHref === DOCS_ROUTE_PREFIX || cleanHref.startsWith(`${DOCS_ROUTE_PREFIX}/`)) {
    const routePath = cleanHref.slice(DOCS_ROUTE_PREFIX.length).replace(/^\//, '');
    // Route form only — see the header. A `/docs/...` href carrying a file
    // extension is a 404 on the site even when that file exists on disk.
    return routeCandidates(routePath ? path.join(docsRoot, routePath) : docsRoot).some(isFile);
  }

  // Site routes outside this docs collection — not resolvable from here.
  if (cleanHref.startsWith('/')) return true;

  const base = path.resolve(path.dirname(fromFile), cleanHref);
  // File form first (what fumadocs' `resolveHref` keys on), then the
  // extensionless-route spellings.
  return [base, ...routeCandidates(base)].some(isFile);
}

/** @returns {{ file: string, href: string, line: number }[]} */
export function collectBrokenLinks(docsRoot) {
  const broken = [];

  for (const file of walk(docsRoot)) {
    const source = stripCode(readFileSync(file, 'utf8'));
    MARKDOWN_LINK_RE.lastIndex = 0;
    let match;

    while ((match = MARKDOWN_LINK_RE.exec(source)) !== null) {
      const href = match[1].trim();
      if (EXTERNAL_HREF_RE.test(href)) continue;
      if (routeExists(href, { fromFile: file, docsRoot })) continue;

      broken.push({
        file,
        href,
        line: source.slice(0, match.index).split('\n').length,
      });
    }
  }

  return broken;
}

// Run only when invoked directly — the test suite imports the helpers above and
// must not trigger a repo scan (or a `process.exit`) on import. Same guard shape
// as scripts/check-control-bytes.mjs.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const docsRoot = path.resolve('content/docs');
  const broken = collectBrokenLinks(docsRoot);

  if (broken.length > 0) {
    const targets = new Set(broken.map((item) => `${path.dirname(item.file)}|${item.href.split('#')[0]}`));
    console.error(
      `Found ${broken.length} broken docs link${broken.length === 1 ? '' : 's'} (${targets.size} distinct target${targets.size === 1 ? '' : 's'}):`,
    );
    for (const item of broken) {
      console.error(`- ${path.relative(process.cwd(), item.file)}:${item.line} -> ${item.href}`);
    }
    console.error(
      '\nRelative links must name the target FILE including its real extension' +
        ' (`../plugins/plugin-charts.mdx`); absolute `/docs/...` links must be' +
        ' extensionless routes (`/docs/plugins/plugin-charts`). See the header of' +
        ' scripts/check-doc-links.mjs.',
    );
    process.exit(1);
  }

  console.log('Docs links are valid.');
}
