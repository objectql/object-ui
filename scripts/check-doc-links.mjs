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
 * ## Why this file changed again (objectui#3490)
 *
 * The paragraph that used to sit here said non-`/docs` absolute hrefs
 * (`/spec/...`, `/api/...`, `/img/...`) were "waved through: they are routes
 * outside this collection and cannot be resolved from `content/docs` alone",
 * and that a relative href was checked purely as a path on disk. Both waivers
 * were load-bearing, and both were wrong in the same way: they made the gate's
 * question "does a file exist?" when the only question that matters to a reader
 * is "does the site serve this URL?". 18 live 404s had collected behind them —
 * 17 absolute (`/spec/*`, `/protocol/*`, `/api/core`, `/api/react`,
 * `/examples/*`) plus one relative link that resolved out of the collection
 * entirely. `lychee --offline` scores all 18 green for the same reason.
 *
 * **The trade-off this makes explicit.** Answering "does the site serve it?"
 * means the script can no longer read only `content/docs`: it now also reads
 * `apps/site` — the App-Router segment tree under `apps/site/app` and the static
 * files under `apps/site/public` — as its truth source for what URLs exist. That
 * widens the script's responsibility (and couples a `content/` gate to an
 * `apps/` layout), and it is a deliberate purchase, not an accident:
 *
 *   - Without it there is no gate at all on this class. #3479 is the evidence
 *     that "no gate" means "it accumulates": 33 dead references before anyone
 *     looked. The 18 here accumulated behind exactly the waiver being removed.
 *   - The coupling is to *structure*, not to content. `apps/site/app` is
 *     enumerated, never imported or executed, so a routing change is picked up
 *     automatically — the truth source cannot drift from the router the way a
 *     hand-maintained allowlist of prefixes would.
 *   - The cost is real and worth naming: adding a route to the site is now the
 *     thing that makes a docs link legal, so a docs PR can go red because
 *     `apps/site` moved under it. That failure is *correct* (the link really
 *     would 404), but it does mean the two trees are no longer independent.
 *
 * What is deliberately NOT bought here: `next.config.mjs` rewrites/redirects are
 * not modelled (the one rewrite, `/docs/:path*.mdx`, sits under the stricter
 * `/docs` branch above and never reaches this one), and the scan surface is
 * still only `content/docs` — `examples/**` and the root `README.md` remain
 * unscanned, tracked separately.
 *
 * **Relative hrefs may not leave the collection.** `../../../packages/foo/
 * README.md` resolves on disk, so the pre-#3490 check passed it, but
 * `source.resolveHref` can only look inside the docs page index; `packages/**`
 * is not in it, so the href reaches the browser verbatim and the browser
 * resolves it against the *page URL* — `/docs/guide/data-source` +
 * `../../../packages/...` lands on `/packages/...`, which is not a route. Such a
 * link is rejected with a pointer to the fix the repo already uses everywhere
 * else: an absolute `https://github.com/objectstack-ai/objectui/blob/main/...`
 * URL (the "Package README" form in `content/docs/plugins/*.mdx`).
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
/** Files that turn an App-Router directory into a servable URL. */
const ROUTE_ENTRY_RE = /^(?:page|route)\.(?:js|jsx|ts|tsx|md|mdx)$/;

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
 * Classifies one `apps/site/app` directory name as a URL segment.
 *
 * Next.js App Router, the four forms that matter here:
 *   `(group)`      — organisational only, contributes no URL segment
 *   `_private`     — never routable, subtree skipped
 *   `[[...slug]]`  — optional catch-all, matches 0+ segments
 *   `[...slug]`    — catch-all, matches 1+ segments
 *   `[slug]`       — dynamic, matches exactly 1 segment
 * anything else is a literal segment (`llms.txt` is a literal, dot included).
 */
function classifySegment(name) {
  if (name.startsWith('_') || name.startsWith('@')) return { kind: 'skip' };
  if (name.startsWith('(') && name.endsWith(')')) return { kind: 'group' };
  if (name.startsWith('[[...') && name.endsWith(']]')) return { kind: 'optionalCatchAll' };
  if (name.startsWith('[...') && name.endsWith(']')) return { kind: 'catchAll' };
  if (name.startsWith('[') && name.endsWith(']')) return { kind: 'dynamic' };
  return { kind: 'literal', value: name };
}

/**
 * Enumerates every URL the site can serve, as a truth source for absolute
 * hrefs: the App-Router segment tree under `<siteRoot>/app`, plus the static
 * files under `<siteRoot>/public` (Next serves those from `/`).
 *
 * Structure only — nothing here is imported or executed, so the table tracks
 * whatever the router currently is. See the header for why this script reads
 * outside `content/docs` at all.
 *
 * @returns {{ routes: object[][], assets: Set<string> }}
 */
export function collectSiteRoutes(siteRoot) {
  const routes = [];
  const assets = new Set();

  const walkApp = (dir, pattern) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((entry) => entry.isFile() && ROUTE_ENTRY_RE.test(entry.name))) {
      routes.push(pattern);
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const segment = classifySegment(entry.name);
      if (segment.kind === 'skip') continue;
      walkApp(path.join(dir, entry.name), segment.kind === 'group' ? pattern : [...pattern, segment]);
    }
  };

  const walkPublic = (dir, prefix) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walkPublic(path.join(dir, entry.name), child);
      else assets.add(child);
    }
  };

  walkApp(path.join(siteRoot, 'app'), []);
  walkPublic(path.join(siteRoot, 'public'), '');

  return { routes, assets };
}

/** Does `segments` match one route pattern? Catch-alls are terminal in Next. */
function matchesPattern(segments, pattern) {
  let index = 0;
  for (let cursor = 0; cursor < pattern.length; cursor += 1) {
    const part = pattern[cursor];
    if (part.kind === 'literal' || part.kind === 'dynamic') {
      if (index >= segments.length) return false;
      if (part.kind === 'literal' && segments[index] !== part.value) return false;
      index += 1;
      continue;
    }
    // catch-all / optional catch-all: swallows the rest, so it must be last.
    if (cursor !== pattern.length - 1) return false;
    return segments.length - index >= (part.kind === 'catchAll' ? 1 : 0);
  }
  return index === segments.length;
}

/** Is `pathname` (an absolute site path) served by a route or a static file? */
export function siteUrlExists(pathname, site) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (site.assets.has(normalized)) return true;
  const segments = normalized.split('/').filter(Boolean);
  return site.routes.some((pattern) => matchesPattern(segments, pattern));
}

/**
 * Resolves one href.
 *
 * @param {string} href       the raw href as authored
 * @param {{ fromFile: string, docsRoot: string, site?: { routes: object[][], assets: Set<string> } }} context
 */
export function routeExists(href, { fromFile, docsRoot, site }) {
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

  // Site routes outside this docs collection — checked against the enumerated
  // router + `public/` tree (objectui#3490). No table means the caller has not
  // supplied a truth source; failing loudly beats silently waving 404s through,
  // which is precisely how the 18 links in #3490 accumulated.
  if (cleanHref.startsWith('/')) {
    if (!site) {
      throw new Error(
        `routeExists() needs a site route table to judge the absolute href "${href}". ` +
          'Pass `site: collectSiteRoutes(<repo>/apps/site)`.',
      );
    }
    return siteUrlExists(cleanHref, site);
  }

  const base = path.resolve(path.dirname(fromFile), cleanHref);
  // A relative href must stay inside the collection: fumadocs' page index is
  // the only thing that can resolve one, and it holds nothing else. Resolving
  // on disk is not enough — `../../../packages/x/README.md` is a real file and
  // still a 404 on the site. See the header.
  if (base !== docsRoot && !base.startsWith(docsRoot + path.sep)) return false;

  // File form first (what fumadocs' `resolveHref` keys on), then the
  // extensionless-route spellings.
  return [base, ...routeCandidates(base)].some(isFile);
}

/** Which of the four checks rejected this href — drives the hint printed below. */
function classifyBroken(href, { fromFile, docsRoot }) {
  const cleanHref = href.split('#')[0].split('?')[0].trim();
  if (cleanHref === DOCS_ROUTE_PREFIX || cleanHref.startsWith(`${DOCS_ROUTE_PREFIX}/`)) return 'docs-route';
  if (cleanHref.startsWith('/')) return 'site-route';
  const base = path.resolve(path.dirname(fromFile), cleanHref);
  if (base !== docsRoot && !base.startsWith(docsRoot + path.sep)) return 'escapes-collection';
  return 'relative';
}

/**
 * @param {string} docsRoot  the `content/docs` tree to scan
 * @param {string} siteRoot  `apps/site` — truth source for absolute hrefs
 * @returns {{ file: string, href: string, line: number, reason: string }[]}
 */
export function collectBrokenLinks(docsRoot, siteRoot) {
  const broken = [];
  const site = collectSiteRoutes(siteRoot);

  for (const file of walk(docsRoot)) {
    const source = stripCode(readFileSync(file, 'utf8'));
    MARKDOWN_LINK_RE.lastIndex = 0;
    let match;

    while ((match = MARKDOWN_LINK_RE.exec(source)) !== null) {
      const href = match[1].trim();
      if (EXTERNAL_HREF_RE.test(href)) continue;
      if (routeExists(href, { fromFile: file, docsRoot, site })) continue;

      broken.push({
        file,
        href,
        line: source.slice(0, match.index).split('\n').length,
        reason: classifyBroken(href, { fromFile: file, docsRoot }),
      });
    }
  }

  return broken;
}

// Run only when invoked directly — the test suite imports the helpers above and
// must not trigger a repo scan (or a `process.exit`) on import. Same guard shape
// as scripts/check-control-bytes.mjs.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const HINTS = {
  relative:
    'Relative links must name the target FILE including its real extension' +
    ' (`../plugins/plugin-charts.mdx`) — that is the key fumadocs indexes pages by.',
  'docs-route':
    'Absolute `/docs/...` links must be extensionless ROUTES' +
    ' (`/docs/plugins/plugin-charts`); a `.md`/`.mdx` suffix 404s whatever is on disk.',
  'site-route':
    'Absolute non-`/docs` links must resolve to a real site URL — a route under' +
    ' `apps/site/app` or a file under `apps/site/public`. There is no `/spec`,' +
    ' `/protocol`, `/api/<pkg>` or `/examples` route: link the equivalent' +
    ' `/docs/...` page, or an absolute `https://github.com/...` URL.',
  'escapes-collection':
    'A relative link may not leave `content/docs` — fumadocs can only resolve' +
    ' hrefs inside the docs page index, so it reaches the browser verbatim and' +
    ' 404s even though the file exists. Use an absolute' +
    ' `https://github.com/objectstack-ai/objectui/blob/main/...` URL instead' +
    ' (the "Package README" form used throughout content/docs/plugins/).',
};

if (invokedDirectly) {
  const docsRoot = path.resolve('content/docs');
  const siteRoot = path.resolve('apps/site');
  const broken = collectBrokenLinks(docsRoot, siteRoot);

  if (broken.length > 0) {
    const targets = new Set(broken.map((item) => `${path.dirname(item.file)}|${item.href.split('#')[0]}`));
    console.error(
      `Found ${broken.length} broken docs link${broken.length === 1 ? '' : 's'} (${targets.size} distinct target${targets.size === 1 ? '' : 's'}):`,
    );
    for (const item of broken) {
      console.error(`- [${item.reason}] ${path.relative(process.cwd(), item.file)}:${item.line} -> ${item.href}`);
    }
    for (const reason of Object.keys(HINTS)) {
      if (broken.some((item) => item.reason === reason)) console.error(`\n${reason}: ${HINTS[reason]}`);
    }
    console.error('\nSee the header of scripts/check-doc-links.mjs.');
    process.exit(1);
  }

  console.log('Docs links are valid.');
}
