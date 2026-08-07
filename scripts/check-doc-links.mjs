#!/usr/bin/env node
/**
 * Rejects internal documentation links that point nowhere, across the scan
 * surfaces listed in `SCAN_ROOTS` below.
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
 * (The paragraph that stood here listed two things #3490 deliberately did not
 * buy: the scan surface staying at `content/docs`, and `examples/**` + the root
 * `README.md` remaining unscanned. objectui#3536 bought both — see the next
 * section. What is still not modelled is `next.config.mjs`
 * rewrites/redirects; the one rewrite, `/docs/:path*.mdx`, sits under the
 * stricter `/docs` branch above and never reaches the site-route branch.)
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
 * ## Why this file changed again (objectui#3536)
 *
 * Two extensions, in the two directions the paragraph above had left open.
 *
 * ### 1. The scan surface: `examples/**` and the root `README.md`
 *
 * Both had been caught carrying dead links twice, by eye and never by a gate:
 * `examples/hello-world/README.md` pointed at `../crm/` and `../todo/` after
 * those examples were deleted (#3486 / PR #3495), and the root `README.md`
 * listed four dead example entries (PR #3485). `examples/console-starter`'s 14
 * relative links (PR #3524) were checked by a throwaway script its author wrote
 * by hand, because nothing in CI would.
 *
 * **These files do not have docs semantics, and forcing them onto it would be
 * wrong.** They are read on GitHub, whose renderer resolves a relative href
 * against the file's own directory *in the repository* — so the href names a
 * path on DISK, not a fumadocs route. Three consequences, all encoded in the
 * `disk` rule below:
 *
 *   - **Existence is the whole question.** A directory is a fine target
 *     (`./packages/core` renders as a directory listing), and so is a file with
 *     no extension at all (`./LICENSE`) or one that is not markdown
 *     (`./src/App.tsx`, `./vite.config.ts`). The docs rule's
 *     `routeCandidates()` spellings are meaningless here and are not tried.
 *   - **There is no collection to escape.** `examples/console-starter/README.md`
 *     links `../../packages/app-shell/src/console/ConsoleShell.tsx` and
 *     `../../content/docs/fields/lookup.mdx`; both render correctly on GitHub.
 *     The `escapes-collection` rule that is right for `content/docs` would
 *     reject them, so it is not applied. The only containment rule is the repo
 *     boundary: a path resolving above `<repoRoot>` cannot be rendered at all.
 *   - **An extensionless spelling of a markdown file is a dead link, not a
 *     fragile one.** `../plugins/plugin-charts` is accepted under the docs rule
 *     (a browser may resolve it); on GitHub it is a 404, because there is no
 *     file by that name. The disk rule therefore does not accept it.
 *
 * **Absolute `/...` hrefs in these files: rejected** (`example-absolute`).
 * There are none today — the decision is preventive, and it is the one the
 * renderer forces. GitHub does not rewrite a leading `/`; it resolves it
 * against `github.com` itself, so `[core](/packages/core)` in the root README
 * links to `https://github.com/packages/core`, not to this repo's directory.
 * The hint names both repairs, because the rare deliberate case (a real
 * github.com path) is real: write the repo path relative, or write the
 * github.com URL in full. Waving the shape through instead would be the same
 * silent waiver #3490 spent 18 live 404s removing.
 *
 * ### 2. A decidable href shape: this repo's own GitHub blob/tree URLs
 *
 * `https://github.com/objectstack-ai/objectui/(blob|tree)/main/<path>` is an
 * in-repo reference wearing an external URL's clothes, and it fell between the
 * two gates (#3507): this script skipped it by scheme, and lychee — the only
 * thing that would resolve it — is a weekly cron with `continue-on-error`, so
 * it gates nothing. Two such links stayed dead for about three months. The
 * backlog was cleared to zero by PR #3509 (25 distinct targets swept, exactly
 * the 2 dead), and PR #3506 then introduced 8 more of the shape with nothing
 * checking them. This closes that: `<path>` must exist in the working tree.
 *
 * It applies to **every** surface, `content/docs` included — the shape is
 * decidable wherever it is written, and the `escapes-collection` hint above
 * actively recommends it, so leaving it unchecked would recommend an unchecked
 * form as the fix for a checked one.
 *
 * Deliberately narrow, because the rest is not decidable offline:
 *
 *   - **Only `main`.** `blob/v1.2.0/...` or `blob/<sha>/...` names a different
 *     ref; the working tree cannot answer for it.
 *   - **Only this repo.** Other repos' GitHub URLs stay external (lychee's job).
 *   - **Only the path.** `#fragment` (`#L42`, `#readme`) is out of scope, and
 *     stripped before the check — resolving an anchor means parsing the target,
 *     which is a different gate.
 *   - **Only `blob|tree`.** `https://github.com/objectstack-ai/objectui/issues`
 *     and the `workflows/<name>/badge.svg` badge URLs in the root README are
 *     github.com web routes, not paths in this tree, and stay skipped.
 *
 * ## Why this file changed again (objectui#3572)
 *
 * The section that stood here, "Still not bought", named the next surface and
 * its entry price: `CONTRIBUTING.md`, `ROADMAP.md` and the internal `docs/`
 * tree were unscanned, and adding them was "one `SCAN_ROOTS` row each — plus
 * fixing what that turns red". Both halves came due, in that order.
 *
 * The red was paid first and separately (#3545 / PR #3571): three dead links,
 * two in `CONTRIBUTING.md` and one in `ROADMAP.md`. So this change is the three
 * rows and nothing else — measured at 70 links across the three surfaces, of
 * which 52 are decidable here, and **zero** dead the day it landed. That is the
 * shape an extension should have; contrast #3479 (16 dead targets) and #3490
 * (18), where the gate and its own backlog arrived together.
 *
 * `docs/**` is the one of the three nothing had ever measured. Lychee's scope
 * does list it, but that workflow is `schedule` + `workflow_dispatch` only —
 * `push` and `pull_request` are commented out on purpose (#3213 ruling B: an
 * external link check goes over the network and would redden PRs their authors
 * cannot fix), so it blocks nobody. 47 of its 49 links had therefore never been
 * resolved by anything that could fail a build.
 *
 * All three take the `disk` rule, and correctly: they are read on GitHub, like
 * `examples/**` and the root `README.md`. No new rule class, no new reason
 * string, no new hint.
 *
 * ### The boundary this does NOT cover: links inside code fences
 *
 * Stated because the alternative is implying total coverage. `stripCode()`
 * blanks fenced blocks and inline spans before the scan (see the section below
 * — it is what makes the relative-link check safe at all), so **a link written
 * inside a fence is invisible to this gate, dead or not**.
 *
 * That is not hypothetical on the very surface being added. `CONTRIBUTING.md`
 * carries 25 markdown links; 10 sit inside fences, and this gate judges exactly
 * **one** of the remaining 15 (the other 14 are `#anchors` and external URLs).
 * Those 10 are objectui#3570's instance class — a fenced block illustrating
 * docs-link conventions whose "correct example" routes (`/guide/quick-start`,
 * `/api/core`, `/spec/component`, …) are themselves dead. A reader copies them;
 * this script never sees them. Fixing that text is #3570's job; noticing that
 * no gate can reach it is this comment's.
 *
 * Widening `stripCode()` is not the repair, and the two false positives it was
 * built for are why: fenced code legitimately contains `[…](…)` that is not a
 * link. A gate for prose *about* links inside fences would need to tell an
 * illustrative route from an executable one, which is a different gate.
 *
 * (A "Still not bought" list closed this section, naming `QUICK_REFERENCE.md`,
 * `AGENTS.md`, `CLAUDE.md` and `CHANGELOG.md`. It has moved to the end of the
 * objectui#3622 section below, which is the current one; those four are still
 * on it.)
 *
 * ## Why this file changed again (objectui#3603)
 *
 * A second scheme-bearing shape that is decidable here, and the exact mirror of
 * the self-repo blob URLs above: **this site's own absolute URLs**.
 *
 * `judgeHref()` skipped every href carrying a scheme (`EXTERNAL_HREF_RE`), with
 * `SELF_REPO_BLOB_RE` as the single exception. So
 * `https://www.objectui.org/docs/guide/plugins` — a route on the very site this
 * repo publishes, whose whole route table is already enumerated above to serve
 * the `/docs/...` and `/...` branches — was never resolved, while the identical
 * route written `/docs/guide/plugins` was checked strictly. The origin is the
 * only difference between the two, and it is the one part of a URL this script
 * can be certain about.
 *
 * **Not a package-README special case, and deliberately not written as one.**
 * The blind spot lives in `judgeHref()`, so it was never confined to any
 * surface: `content/docs` carries 6 site-absolute URLs of its own and the root
 * `README.md` 5, and all 11 were unchecked until now. Stripping the origin and
 * handing the rest to `routeExists()` fixes the class everywhere at once, which
 * is also why it needs no new rule and no new scan root.
 *
 * Both host spellings are live in this tree (`www.objectui.org` and bare
 * `objectui.org`), so both are accepted; every other origin stays external and
 * remains lychee's problem. Because what survives the strip is an ordinary
 * absolute site path, it inherits BOTH branches of `routeExists()` unchanged —
 * `/docs` strictness included. `https://www.objectui.org/docs/guide/plugins.md`
 * is rejected for precisely the reason `/docs/guide/plugins.md` is.
 *
 * Measured before landing: 11 site-absolute URLs across today's surfaces, zero
 * dead. The #3572 shape again — the check arrives green, its backlog already
 * paid.
 *
 * ## Why this file changed again (objectui#3622): the package READMEs, bought
 *
 * The section that stood here was headed "Measured and NOT bought". It recorded
 * the price of objectui#3603's other half — growing the scan surface by the 38
 * package READMEs, which is where the 9 dead links that prompted that card lived
 * — and refused to add the row until that price was paid, per this file's rule
 * from #3572. It is paid, so the row is in the table above.
 *
 * (Note kept for whoever edits that row: a glob naming each package README
 * cannot be spelled inside this block comment, because the star-slash in it
 * closes the comment. It is described in prose here and written out only in the
 * table below, which is code.)
 *
 * The price was **11 more** dead links, none of them among #3603's 9. They sit
 * in seven packages: five that card never opened, plus two where it had already
 * fixed a different line. `/api/core`, `/api/react` and `/api/components` (no
 * such routes — the class #3490 swept); `/docs/core`, `/docs/fields` and
 * `/docs/layout`, twice (real directories with no index page, so no route);
 * `/docs/types` and `/examples` (neither exists); and two disk paths that were
 * simply absent (a `docs/SHADCN_SYNC.md` that has never existed, and a
 * per-package `LICENSE` that `packages/vscode-extension` does not have).
 *
 * All eleven were repointed at a page or path that does exist, in the same PR as
 * this row — none had to be dropped, unlike #3603's 9, where 6 assumed a whole
 * `/docs/packages/...` namespace that was never written. So the row arrives on a
 * green tree, the #3572 shape.
 *
 * Three of those deserve naming, because objectui#3603's own verification
 * script scored them GREEN: it accepted a bare DIRECTORY as a fumadocs
 * candidate. This gate does not, and is right not to — `routeCandidates()` has
 * no such spelling, and the pinned test "rejects a relative link to a directory
 * that has no index page" is that decision. `content/docs/core/` really has no
 * index page, so `/docs/core` really does 404. The class was 20 links, not 9.
 *
 * **The rule is `disk`, and that is not a coin toss.** A package README is read
 * on npm and on GitHub, never served by the site, so its relative hrefs are
 * paths on disk exactly like `examples/`, the root `README.md`,
 * `CONTRIBUTING.md`, `ROADMAP.md` and `docs/`: `./CHANGELOG.md` is a file next
 * to it, not a route. The same reading forbids the origin-less `/docs/...`
 * spelling this file prefers inside `content/docs` — GitHub and npm resolve a
 * leading `/` against their own host — which is why the site links repaired
 * above all keep the `https://[www.]objectui.org/...` origin, and are still
 * checked as strictly as the origin-less form (see the section above).
 *
 * The one thing the row does need is a wildcard segment in the scan-root path,
 * since the surface is one file per package directory rather than a tree.
 * `expandWildcard()` is that, and no more than that.
 *
 * ### Still not bought
 *
 * `QUICK_REFERENCE.md`, `AGENTS.md`, `CLAUDE.md` and `CHANGELOG.md` remain
 * unscanned, along with the non-README markdown inside packages (`CHANGELOG.md`,
 * `TESTING.md`, `MIGRATION.md`, per-package `docs/` trees). Same one-row price,
 * same caveat — measure the surface first, pay its backlog separately, then add
 * the row.
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
/**
 * This repo's own GitHub URLs, in the one shape that is decidable offline: a
 * `main` blob/tree path (objectui#3536). Case-insensitive because github.com
 * treats owner and repo that way; the captured path is used as written.
 */
const SELF_REPO_BLOB_RE = /^https:\/\/github\.com\/objectstack-ai\/objectui\/(?:blob|tree)\/main\/(.+)$/i;
/**
 * This site's own origin — the second decidable scheme-bearing shape
 * (objectui#3603). Both host spellings are in use in this tree, and the site
 * serves the same routes under each. Anchored at both ends so a lookalike host
 * (`objectui.org.example.com`) cannot match; the captured group is the absolute
 * site path, which `routeExists()` then judges exactly as if it had been
 * written without the origin.
 */
const SITE_ORIGIN_RE = /^https?:\/\/(?:www\.)?objectui\.org(\/[^\s]*)?$/i;
/** Never markdown sources of ours, and huge — walking them wastes the scan. */
const UNSCANNED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', '.git']);

/**
 * The scan surfaces, and the link semantics each one actually has.
 *
 * `docs` — the fumadocs collection: an href names a site ROUTE, resolved
 *          through the page index and the `apps/site` router.
 * `disk` — files read on GitHub: an href names a PATH in this repository.
 *
 * The split is the point (objectui#3536). See the header for why applying the
 * docs rules to the second group would reject links that render perfectly well:
 * over today's `disk` surface it would reject 186 links that all render — 111
 * of them before objectui#3622 widened that surface, 75 in the package READMEs
 * it added.
 *
 * Adding a surface is one row. Adding one that is read on GitHub needs no new
 * rule class at all — which is why objectui#3572 could take the last three for
 * the price of the table entry, and objectui#3622 the package READMEs.
 *
 * A row's `path` is a directory to walk, a single markdown file, or a pattern
 * whose one wildcard SEGMENT stands for every directory at that level — see
 * `expandWildcard()` below, which is all the glob syntax this table has.
 */
export const SCAN_ROOTS = [
  { path: 'content/docs', rule: 'docs' },
  { path: 'examples', rule: 'disk' },
  { path: 'README.md', rule: 'disk' },
  { path: 'CONTRIBUTING.md', rule: 'disk' },
  { path: 'ROADMAP.md', rule: 'disk' },
  { path: 'docs', rule: 'disk' },
  { path: 'packages/*/README.md', rule: 'disk' },
];

const blank = (text) => text.replace(/[^\n]/g, ' ');

export function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files; // a scan root that does not exist here contributes nothing
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!UNSCANNED_DIRS.has(entry.name)) walk(fullPath, files);
      continue;
    }
    if (/\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Expands the leftmost wildcard segment of a scan root into one path per
 * directory at that level, sorted so the scan order — and therefore the report
 * order — does not depend on the filesystem's (objectui#3622). `collectFiles`
 * recurses, so a later wildcard segment expands on the next pass.
 *
 * Deliberately not a glob library: a whole segment that is exactly `*`, and
 * nothing else. Anything richer THROWS rather than quietly matching nothing,
 * because a scan root that expands to zero paths is a surface silently dropped
 * — the one failure mode this gate must not have (same stance as the missing
 * route table in `routeExists()`).
 */
function expandWildcard(pattern) {
  const segments = pattern.split(path.sep);
  const index = segments.findIndex((segment) => segment.includes('*'));
  if (segments[index] !== '*') {
    throw new Error(
      `A SCAN_ROOTS path may only use a wildcard as a whole path segment, and got "${pattern}". ` +
        'Widen the row to the directory above, or add the paths one row each.',
    );
  }

  const parent = segments.slice(0, index).join(path.sep);
  const rest = segments.slice(index + 1);
  let entries;
  try {
    entries = readdirSync(parent, { withFileTypes: true });
  } catch {
    return []; // the parent is not here — same contract as a missing scan root
  }

  return entries
    .filter((entry) => entry.isDirectory() && !UNSCANNED_DIRS.has(entry.name))
    .map((entry) => [parent, entry.name, ...rest].join(path.sep))
    .sort();
}

/**
 * One scan root, which may be a directory to walk, a single markdown file, or a
 * wildcard pattern standing for one path per directory at that level.
 */
export function collectFiles(root) {
  if (root.includes('*')) return expandWildcard(root).flatMap((expanded) => collectFiles(expanded));
  try {
    if (statSync(root).isFile()) return /\.(md|mdx)$/.test(root) ? [root] : [];
  } catch {
    return [];
  }
  return walk(root);
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

/**
 * Existence, the `disk` rule's whole question — a directory counts, and so does
 * a file with no extension. GitHub renders links to both.
 */
function pathExists(candidate) {
  try {
    statSync(candidate);
    return true;
  } catch {
    return false;
  }
}

/** Is `candidate` `root` itself, or inside it? */
function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/** Strips the fragment and query, and decodes escapes — shared by every rule. */
function hrefPath(href) {
  const cleanHref = href.split('#')[0].split('?')[0].trim();
  try {
    return decodeURI(cleanHref);
  } catch {
    return cleanHref; // a malformed escape is checked as written
  }
}

/**
 * The in-repo path a self-referential GitHub URL names, or `null` if this href
 * is not one (objectui#3536). Fragments are stripped: anchors are out of scope.
 */
export function selfRepoPath(href) {
  const match = SELF_REPO_BLOB_RE.exec(hrefPath(href));
  return match ? match[1].replace(/\/+$/, '') : null;
}

/**
 * The absolute site path a site-absolute URL names, or `null` if this href is
 * not one (objectui#3603). The fragment and query are stripped — anchors are
 * out of scope here for the same reason they are for `selfRepoPath` — but the
 * path is NOT decoded: `routeExists()` does that itself, and decoding twice
 * would corrupt a legitimately escaped `%25`.
 *
 * `https://www.objectui.org` with no path at all names the site root, so it
 * resolves to `/` rather than to the empty string (which `routeExists()` reads
 * as a pure in-page anchor and waves through).
 */
export function siteAbsoluteRoute(href) {
  const match = SITE_ORIGIN_RE.exec(href.split('#')[0].split('?')[0].trim());
  if (!match) return null;
  return match[1] || '/';
}

/**
 * Does one `disk`-rule href resolve to something in this repository?
 *
 * @param {string} href
 * @param {{ fromFile: string, repoRoot: string }} context
 */
export function diskPathExists(href, { fromFile, repoRoot }) {
  const cleanHref = hrefPath(href);
  if (!cleanHref) return true; // pure in-page anchor or query

  // GitHub resolves a leading `/` against github.com, never against the repo,
  // so this shape cannot name a path here at all. See the header.
  if (cleanHref.startsWith('/')) return false;

  const target = path.resolve(path.dirname(fromFile), cleanHref);
  return isInside(repoRoot, target) && pathExists(target);
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

/** Which `disk`-rule check rejected this href — drives the hint printed below. */
function classifyBrokenDisk(href) {
  return hrefPath(href).startsWith('/') ? 'example-absolute' : 'example-relative';
}

/**
 * Judges one href under one scan root's rule.
 *
 * @returns {string | null} the failing check's name, or `null` when it resolves
 */
function judgeHref(href, context) {
  // The two external-LOOKING shapes this script can actually decide run FIRST,
  // and in every rule: both must be reached before the by-scheme skip below
  // waves them through (objectui#3536, objectui#3603).
  const selfPath = selfRepoPath(href);
  if (selfPath !== null) {
    const target = path.resolve(context.repoRoot, selfPath);
    return isInside(context.repoRoot, target) && pathExists(target) ? null : 'self-repo-url';
  }
  // A URL on this site is an internal route wearing an origin. Strip the origin
  // and judge what is left with the same `routeExists()` every absolute href
  // goes through — so `/docs` strictness and the `apps/site` route table apply
  // here too, on every surface, `content/docs` included.
  // A URL on this site is an internal route wearing an origin. Strip the origin
  // and judge what is left with the same `routeExists()` every absolute href
  // goes through — so `/docs` strictness and the `apps/site` route table apply
  // here too, on every surface, `content/docs` included.
  const siteRoute = siteAbsoluteRoute(href);
  if (siteRoute !== null) {
    return routeExists(siteRoute, context) ? null : 'site-absolute-url';
  }
  if (EXTERNAL_HREF_RE.test(href)) return null;

  if (context.rule === 'disk') {
    return diskPathExists(href, context) ? null : classifyBrokenDisk(href);
  }
  return routeExists(href, context) ? null : classifyBroken(href, context);
}

/**
 * Scans every surface in `SCAN_ROOTS`, each under its own rule.
 *
 * Takes the repo root — not a docs root — so a caller cannot configure away a
 * scan surface or the `apps/site` truth source and get a green that only means
 * "nothing was looked at". `SCAN_ROOTS` is the single list of what is checked.
 *
 * @param {string} repoRoot  the repository to scan
 * @returns {{ file: string, href: string, line: number, reason: string }[]}
 */
export function collectBrokenLinks(repoRoot) {
  const broken = [];
  const docsRoot = path.join(repoRoot, 'content', 'docs');
  const site = collectSiteRoutes(path.join(repoRoot, 'apps', 'site'));

  for (const scanRoot of SCAN_ROOTS) {
    for (const file of collectFiles(path.join(repoRoot, scanRoot.path))) {
      const source = stripCode(readFileSync(file, 'utf8'));
      MARKDOWN_LINK_RE.lastIndex = 0;
      let match;

      while ((match = MARKDOWN_LINK_RE.exec(source)) !== null) {
        const href = match[1].trim();
        const reason = judgeHref(href, { fromFile: file, docsRoot, repoRoot, site, rule: scanRoot.rule });
        if (reason === null) continue;

        broken.push({ file, href, line: source.slice(0, match.index).split('\n').length, reason });
      }
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
  'example-relative':
    'Outside content/docs (examples/**, README.md, CONTRIBUTING.md, ROADMAP.md,' +
    ' docs/** and each package README) a relative link is a' +
    ' PATH IN THIS REPO, resolved by GitHub against the linking file — so it' +
    ' must name something that exists and lives inside the repository. A' +
    ' directory or a non-markdown file is fine; an extensionless spelling of a' +
    ' `.md` file is not, since GitHub serves files, not routes.',
  'example-absolute':
    'Outside content/docs a leading `/` is NOT the root of this repository —' +
    ' GitHub resolves it against github.com, so `/packages/core` links to' +
    ' https://github.com/packages/core. Write the repo path relative to the' +
    ' file (`./packages/core`), or, if a github.com URL really was meant,' +
    ' write it in full with the scheme.',
  'site-absolute-url':
    'A `https://www.objectui.org/...` URL is a route on this project OWN site,' +
    ' so the origin is stripped and the rest is checked exactly like the' +
    ' equivalent absolute href — this one does not resolve. Fix the route, or' +
    ' drop the link if no such page exists. Inside content/docs prefer the' +
    ' origin-less form (`/docs/guide/plugins`): it survives a domain change,' +
    ' and both spellings are checked identically.',
  'self-repo-url':
    'A `https://github.com/objectstack-ai/objectui/(blob|tree)/main/...` URL' +
    ' points into this repository, so its path is checked against the working' +
    ' tree — this one is not there. Fix the path, or link the equivalent' +
    ' `/docs/...` page. (Only `main` and only this repo are checked; other' +
    ' refs and other repos cannot be resolved offline.)',
};

if (invokedDirectly) {
  // Derived from this file's own location, not the cwd: a cwd-relative root
  // would make running the script from a subdirectory scan nothing and report
  // success — a false green is the one failure mode this gate must not have.
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const broken = collectBrokenLinks(repoRoot);

  if (broken.length > 0) {
    const targets = new Set(broken.map((item) => `${path.dirname(item.file)}|${item.href.split('#')[0]}`));
    console.error(
      `Found ${broken.length} broken link${broken.length === 1 ? '' : 's'} (${targets.size} distinct target${targets.size === 1 ? '' : 's'}):`,
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

  console.log(`Links are valid across ${SCAN_ROOTS.length} scan roots.`);
}
