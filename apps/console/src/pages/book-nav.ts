/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Book-driven documentation navigation (ADR-0046 §6).
 *
 * A `book` is the *spine* of a table of contents: an ordered set of groups
 * (sections) plus identity and access. It deliberately does NOT store its
 * members — membership is **derived** at render time from a rule on each
 * group (`include` glob/tag) plus an optional per-doc `order`/`group`.
 *
 * The portal resolves that spine against the docs that exist *now*. This is
 * a faithful local port of the framework's `resolveBookTree` (book.zod.ts)
 * so the portal works the moment the backend serves `book` + `doc` through
 * the ordinary metadata API — without depending on a particular published
 * `@objectstack/spec` version or the `/meta/book/:name/tree` endpoint.
 */

// ── Authored spine (a subset of the framework `Book` shape) ────────────────

export type BookInclude = string | { tag: string };

export type BookNode =
  | string // a doc name, or the literals '---' (separator) / '...' (rest)
  | { doc?: string; href?: string; label?: string; badge?: string; icon?: string };

export interface BookGroup {
  key: string;
  label: string;
  order?: number;
  include?: BookInclude;
  /** Scope the rule to a package id (default: the book's package). */
  package?: string;
  /** Explicit override — a hand-pinned curated order; wins over `include`. */
  pages?: BookNode[];
}

export type BookAudience = 'org' | 'public' | { profile: string };

export interface Book {
  name: string;
  label?: string;
  description?: string;
  slug?: string;
  icon?: string;
  order?: number;
  audience?: BookAudience;
  groups?: BookGroup[];
  /** Owning package id (`_packageId`), stamped by the metadata API. */
  packageId?: string;
  /** True for a synthetic implicit per-package book (ADR-0046 §6.4). */
  implicit?: boolean;
}

/** Minimal doc header the resolver needs. */
export interface ResolverDoc {
  name: string;
  label?: string;
  description?: string;
  order?: number;
  /** Explicit placement: the `key` of the group this doc belongs to. */
  group?: string;
  /** Tags for `include: { tag }` matching. */
  tags?: string[];
  /** Owning package id (`_packageId`); used to scope `include`. */
  packageId?: string;
}

// ── Resolved tree (what the UI renders) ────────────────────────────────────

export interface ResolvedEntry {
  /** Doc name, or undefined for an external link / separator. */
  doc?: string;
  href?: string;
  label?: string;
  description?: string;
  badge?: string;
  icon?: string;
  /** True for a `---` separator node. */
  separator?: boolean;
}

export interface ResolvedGroup {
  key: string;
  label: string;
  entries: ResolvedEntry[];
  /**
   * True for the synthetic "Uncategorized" catch-all. It appears in EVERY
   * book's resolution (it absorbs whatever the book's own groups didn't
   * claim), so it must be excluded from authored-membership questions like
   * "how many docs does this book organize?" or "which book owns this doc?".
   */
  synthetic?: boolean;
}

export interface ResolvedBook {
  name: string;
  label?: string;
  description?: string;
  groups: ResolvedGroup[];
}

const UNCATEGORIZED_KEY = 'uncategorized';

/** The namespace prefix of a metadata name (everything before the first `_`). */
export function namePrefix(name: string): string {
  const i = name.indexOf('_');
  return i > 0 ? name.slice(0, i) : name;
}

/**
 * The package a doc belongs to. Prefer the server-stamped `_packageId`; fall
 * back to the name's namespace prefix (ADR-0046 names are prefix-scoped by
 * build convention), so package scoping still works before the backend stamps
 * provenance.
 */
export function pkgOf(doc: ResolverDoc): string {
  return doc.packageId ?? namePrefix(doc.name);
}

/** The package a book belongs to — same precedence as {@link pkgOf}. */
export function pkgOfBook(book: Book): string {
  return book.packageId ?? namePrefix(book.name);
}

/** The portal URL segment for a book (ADR-0046 §6: `slug`, default the name). */
export function bookSlug(book: Book): string {
  return book.slug ?? book.name;
}

/** Compile a `*`-glob over doc names to a RegExp anchored on the whole name. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function matchesInclude(doc: ResolverDoc, include: BookInclude, scopePackage?: string): boolean {
  if (scopePackage && pkgOf(doc) !== scopePackage) return false;
  if (typeof include === 'string') return globToRegExp(include).test(doc.name);
  return Array.isArray(doc.tags) && doc.tags.includes(include.tag);
}

function byOrderThenLabel(a: ResolverDoc, b: ResolverDoc): number {
  return (a.order ?? 0) - (b.order ?? 0) || (a.label ?? a.name).localeCompare(b.label ?? b.name);
}

function entryFromDoc(doc: ResolverDoc): ResolvedEntry {
  return { doc: doc.name, label: doc.label, description: doc.description };
}

/**
 * Resolve a book spine against the current doc set into a rendered tree.
 * Faithful port of ADR-0046 §6.2.1 — see book-nav.ts header.
 */
export function resolveBookTree(book: Book, docs: ResolverDoc[], bookPackage?: string): ResolvedBook {
  const scopeDefault = bookPackage ?? book.packageId;
  const groupsSorted = [...(book.groups ?? [])]
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.order ?? 0) - (b.g.order ?? 0) || a.i - b.i)
    .map((x) => x.g);

  const claimed = new Set<string>();
  const byName = new Map(docs.map((d) => [d.name, d] as const));

  // First pass: rule/explicit membership for groups WITHOUT an explicit
  // `pages` override, so a `...` in an override group can later draw from rest.
  const derivedMembers = new Map<string, ResolverDoc[]>();
  for (const group of groupsSorted) {
    if (group.pages) continue;
    const scope = group.package ?? scopeDefault;
    const members = docs.filter((d) => {
      if (claimed.has(d.name)) return false;
      return (
        (group.include != null && matchesInclude(d, group.include, scope)) ||
        (d.group != null && d.group === group.key)
      );
    });
    members.sort(byOrderThenLabel);
    members.forEach((d) => claimed.add(d.name));
    derivedMembers.set(group.key, members);
  }

  const resolvedGroups: ResolvedGroup[] = [];
  for (const group of groupsSorted) {
    let entries: ResolvedEntry[];
    if (group.pages) {
      const scope = group.package ?? scopeDefault;
      entries = [];
      const pinned = new Set(
        group.pages.filter((n): n is string => typeof n === 'string' && n !== '...' && n !== '---'),
      );
      for (const node of group.pages) {
        if (node === '---') {
          entries.push({ separator: true });
        } else if (node === '...') {
          const rest = docs.filter(
            (d) =>
              !claimed.has(d.name) &&
              !pinned.has(d.name) &&
              ((group.include != null && matchesInclude(d, group.include, scope)) ||
                (d.group != null && d.group === group.key)),
          );
          rest.sort(byOrderThenLabel);
          rest.forEach((d) => {
            claimed.add(d.name);
            entries.push(entryFromDoc(d));
          });
        } else if (typeof node === 'string') {
          const d = byName.get(node);
          claimed.add(node);
          entries.push(d ? entryFromDoc(d) : { doc: node }); // missing doc → renderer shows "not found"
        } else if (node.doc) {
          const d = byName.get(node.doc);
          claimed.add(node.doc);
          entries.push({
            ...(d ? entryFromDoc(d) : { doc: node.doc }),
            label: node.label ?? d?.label,
            badge: node.badge,
            icon: node.icon,
          });
        } else if (node.href) {
          entries.push({ href: node.href, label: node.label, badge: node.badge, icon: node.icon });
        }
      }
    } else {
      entries = (derivedMembers.get(group.key) ?? []).map(entryFromDoc);
    }
    resolvedGroups.push({ key: group.key, label: group.label, entries });
  }

  // Orphans: docs claimed by no group fall into a synthetic Uncategorized
  // group appended last — nothing is ever dropped.
  const orphans = docs.filter((d) => !claimed.has(d.name)).sort(byOrderThenLabel);
  if (orphans.length) {
    resolvedGroups.push({
      key: UNCATEGORIZED_KEY,
      label: 'Uncategorized',
      entries: orphans.map(entryFromDoc),
      synthetic: true,
    });
  }

  return { name: book.name, label: book.label, description: book.description, groups: resolvedGroups };
}

/**
 * Synthesize the implicit per-package book (ADR-0046 §6.4): no authored book ⇒
 * one book keyed by the package id, a single group including every doc.
 */
export function deriveImplicitPackageBook(packageId: string, label?: string): Book {
  return {
    name: packageId,
    label: label ?? packageId,
    audience: 'org',
    groups: [{ key: 'all', label: label ?? 'Documentation', include: '*', package: packageId }],
  };
}

// ── Portal helpers (multi-book) ────────────────────────────────────────────

export interface BookCard {
  name: string;
  /** Portal URL segment (`/docs/<slug>`). */
  slug: string;
  label: string;
  description?: string;
  /** Context line for cards without a description — the owning package id. */
  subtitle?: string;
  icon?: string;
  packageId?: string;
  /** Number of docs the book currently resolves to (excludes separators/links). */
  docCount: number;
}

/** The set of packages a book draws from: its own plus any group overrides. */
function bookPackages(book: Book): Set<string> {
  const pkgs = new Set<string>();
  if (book.packageId) pkgs.add(book.packageId);
  for (const g of book.groups ?? []) if (g.package) pkgs.add(g.package);
  return pkgs;
}

/**
 * Narrow the doc set to the packages a book draws from before resolving, so the
 * synthetic Uncategorized group stays scoped to the book instead of vacuuming
 * up every other package's docs. When a book declares no package (its own or a
 * group override) we can't scope safely, so all docs are kept and membership
 * falls to each group's `include` glob.
 */
export function scopeDocsToBook(book: Book, docs: ResolverDoc[]): ResolverDoc[] {
  const pkgs = bookPackages(book);
  if (pkgs.size === 0) return docs;
  return docs.filter((d) => pkgs.has(pkgOf(d)));
}

/** Sort books for the index: by `order`, then label, then name (stable). */
export function sortBooks(books: Book[]): Book[] {
  return [...books]
    .map((b, i) => ({ b, i }))
    .sort(
      (a, b) =>
        (a.b.order ?? 0) - (b.b.order ?? 0) ||
        (a.b.label ?? a.b.name).localeCompare(b.b.label ?? b.b.name) ||
        a.i - b.i,
    )
    .map((x) => x.b);
}

/**
 * Count the docs a book *organizes* — i.e. those landing in an authored group,
 * excluding the synthetic Uncategorized catch-all (see {@link ResolvedGroup}).
 */
export function countBookDocs(book: Book, docs: ResolverDoc[]): number {
  const resolved = resolveBookTree(book, scopeDocsToBook(book, docs));
  const seen = new Set<string>();
  for (const g of resolved.groups) {
    if (g.synthetic) continue;
    for (const e of g.entries) {
      if (e.doc && !e.separator) seen.add(e.doc);
    }
  }
  return seen.size;
}

/**
 * Build the index cards for the portal landing. Input order is preserved —
 * callers pass {@link buildPortalBooks} output, which already orders authored
 * books (by `order`) ahead of the synthetic per-package ones; re-sorting here
 * would undo that.
 */
export function buildBookCards(books: Book[], docs: ResolverDoc[]): BookCard[] {
  return books.map((b) => ({
    name: b.name,
    slug: bookSlug(b),
    label: b.label ?? b.name,
    description: b.description,
    // Implicit per-package books have no authored description; surface the
    // package id so the card still says where the docs come from.
    subtitle: b.implicit && !b.description ? b.packageId : undefined,
    icon: b.icon,
    packageId: b.packageId,
    docCount: countBookDocs(b, docs),
  }));
}

/**
 * The portal's full book set (ADR-0046 §6.4): every authored book, plus a
 * synthetic implicit book for any package that has docs but no authored book
 * of its own. There is no "flat vs book" fork — a package without an authored
 * book is still browsed as its implicit per-package book (keyed by packageId,
 * one group including every doc). Returned in display order.
 */
export function buildPortalBooks(authored: Book[], docs: ResolverDoc[]): Book[] {
  const ownPkgs = new Set(authored.map(pkgOfBook));
  const docPkgs = new Set(docs.map(pkgOf));
  const implicit: Book[] = [...docPkgs]
    .filter((p) => !ownPkgs.has(p))
    // Humanize the package id for the visible label (the slug/name stays the
    // full id so it remains unique and reversible); keep the group as the
    // generic "Documentation".
    .map((p) => ({ ...deriveImplicitPackageBook(p), label: humanizePackageId(p), packageId: p, implicit: true }));
  // Authored books lead (curated, primary) in their own order; the synthetic
  // per-package books follow, alphabetically — so an authored book with an
  // explicit `order` is never pushed below a fallback.
  return [...sortBooks(authored), ...sortBooks(implicit)];
}

/** "com.objectstack.setup" → "Setup" — a readable label for an implicit book. */
function humanizePackageId(pkg: string): string {
  const seg = pkg.split('.').pop() || pkg;
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

/**
 * The canonical ("home") book for a doc — the authored or implicit book of the
 * doc's own package. Used for the legacy `/docs/:name` permalink redirect and
 * as the default reading context. A doc curated into a cross-package authored
 * book is still reachable there, but its canonical URL is its home book.
 */
export function homeBook(docName: string, portalBooks: Book[], docs: ResolverDoc[]): Book | null {
  const doc = docs.find((d) => d.name === docName);
  const pkg = doc ? pkgOf(doc) : namePrefix(docName);
  return sortBooks(portalBooks).find((b) => pkgOfBook(b) === pkg) ?? null;
}

/**
 * Find the first book (in display order) whose resolved tree contains `docName`
 * — used by the single-doc reader to show the surrounding book's nav. Returns
 * the resolved book and the matching book record, or null when the doc belongs
 * to no authored book.
 */
export function findBookContainingDoc(
  books: Book[],
  docs: ResolverDoc[],
  docName: string,
): { book: Book; resolved: ResolvedBook } | null {
  for (const book of sortBooks(books)) {
    const resolved = resolveBookTree(book, scopeDocsToBook(book, docs));
    // Authored membership only — a doc that merely lands in this book's
    // synthetic Uncategorized group is not "owned" by it (every book has one).
    const has = resolved.groups.some(
      (g) => !g.synthetic && g.entries.some((e) => e.doc === docName && !e.separator),
    );
    if (has) return { book, resolved };
  }
  return null;
}

/**
 * The doc a book opens to — its overview. Prefers an `*_index` doc, else the
 * first doc in reading order. Returns undefined for a book with no readable
 * docs (only external links / separators).
 */
export function firstDoc(resolved: ResolvedBook): string | undefined {
  const names: string[] = [];
  for (const g of resolved.groups) {
    for (const e of g.entries) if (e.doc && !e.separator) names.push(e.doc);
  }
  return names.find((n) => /(^|_)index$/.test(n)) ?? names[0];
}

/** Total docs an entry list covers — handy for "N articles" labels. */
export function countEntries(groups: ResolvedGroup[]): number {
  let n = 0;
  for (const g of groups) for (const e of g.entries) if ((e.doc || e.href) && !e.separator) n += 1;
  return n;
}
