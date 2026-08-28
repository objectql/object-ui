// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppPreview — visual summary of an App metadata record's nav and
 * landing page, since rendering a full nested AppShell inside the
 * admin would be confusing (nav-within-nav).
 *
 * Shows:
 *   • App label/icon + the landing nav item (the first reachable entry)
 *   • Top-level navigation items as a clickable list — each link opens
 *     the runtime app in a new tab so authors can test the configured
 *     nav without leaving the editor.
 *
 * READING THE NAV (rewritten in objectui#3275). `AppSchema.navigation` is
 * a DISCRIMINATED UNION on `type` and every branch is `.strict()`. This
 * file used to ignore that: it inferred a "kind" from `it.object` /
 * `it.dashboard` and took a route from `it.path ?? it.href ?? it.route ??
 * it.url`. Not one of `path` / `href` / `route` / `object` / `dashboard`
 * is a key in any branch — the spec rejects them by name — while the keys
 * that ARE declared (`objectName`, `pageName`, `dashboardName`, `url`)
 * were never read. The result was exactly inverted: a spec-valid app
 * rendered every entry as an unlabelled generic item with no target,
 * and only an unsaveable one looked complete.
 *
 * An app does not route by hand-written path; it names the metadata
 * record to open and the SHELL derives the URL. So the route column now
 * comes from `resolveHref` — the shell's own nav → URL mapping, which
 * `NavigationRenderer` documents as the single source of truth and which
 * `useNavPins` / `SearchResultsPage` already share. A link shown here is
 * therefore the link the user will actually follow, `recordId` /
 * `filters` / `componentRef` semantics included.
 *
 * If the App schema doesn't follow the expected shape we degrade to
 * a "no preview" hint rather than throw.
 */

import * as React from 'react';
import {
  Compass,
  ExternalLink,
  Folder,
  LayoutDashboard,
  FileText,
  Database,
  BarChart3,
  Link as LinkIcon,
  Minus,
  MousePointerClick,
  Puzzle,
} from 'lucide-react';
import { resolveHref } from '@object-ui/layout';
import type { MetadataPreviewProps } from '../preview-registry.js';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell.js';
import { AppNavCanvas } from './AppNavCanvas.js';

/** The nine members of the spec's navigation union. */
type NavKind =
  | 'object'
  | 'dashboard'
  | 'page'
  | 'url'
  | 'report'
  | 'action'
  | 'component'
  | 'group'
  | 'separator';

const NAV_KINDS: readonly string[] = [
  'object', 'dashboard', 'page', 'url', 'report', 'action', 'component', 'group', 'separator',
];

interface NavItem {
  id?: string;
  label: string;
  /** The discriminator, verbatim — never inferred. */
  kind?: NavKind;
  /** The metadata record this entry names (`objectName`, `pageName`, …). */
  target?: string;
  /** Route the shell will navigate to, from `resolveHref`. */
  href?: string;
  external?: boolean;
  children?: NavItem[];
}

/**
 * The target a nav item names, read from the key its own branch declares.
 * Returns undefined for branches that name nothing (`group`, `separator`).
 */
function navTarget(it: Record<string, unknown>, kind?: NavKind): string | undefined {
  switch (kind) {
    case 'object':
      return typeof it.objectName === 'string' ? it.objectName : undefined;
    case 'dashboard':
      return typeof it.dashboardName === 'string' ? it.dashboardName : undefined;
    case 'page':
      return typeof it.pageName === 'string' ? it.pageName : undefined;
    case 'report':
      return typeof it.reportName === 'string' ? it.reportName : undefined;
    case 'url':
      return typeof it.url === 'string' ? it.url : undefined;
    case 'component':
      return typeof it.componentRef === 'string' ? it.componentRef : undefined;
    case 'action': {
      const def = it.actionDef as Record<string, unknown> | undefined;
      return def && typeof def.actionName === 'string' ? def.actionName : undefined;
    }
    default:
      return undefined;
  }
}

function normalizeNav(raw: unknown, appName: string): NavItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it: any): NavItem | null => {
      if (!it || typeof it !== 'object') return null;
      const kind: NavKind | undefined =
        typeof it.type === 'string' && NAV_KINDS.includes(it.type) ? (it.type as NavKind) : undefined;
      if (kind === 'separator') {
        return { id: typeof it.id === 'string' ? it.id : undefined, label: '', kind };
      }
      const label = typeof it.label === 'string' ? it.label.trim() : '';
      if (!label && !it.children) return null;
      const target = navTarget(it, kind);
      // Delegate to the shell's own mapping so the preview cannot invent a
      // route the runtime would not produce. Needs a `type`, so an item
      // missing the discriminator gets no link — which is the truth.
      let href: string | undefined;
      let external = false;
      if (kind && appName) {
        try {
          const r = resolveHref(it, `/apps/${encodeURIComponent(appName)}`);
          if (r.href && r.href !== '#') {
            href = r.href;
            external = r.external;
          }
        } catch {
          href = undefined;
        }
      }
      const children = Array.isArray(it.children) ? normalizeNav(it.children, appName) : undefined;
      return { id: typeof it.id === 'string' ? it.id : undefined, label: label || '(unnamed)', kind, target, href, external, children };
    })
    .filter((x): x is NavItem => x !== null);
}

function kindIcon(kind?: NavKind) {
  switch (kind) {
    case 'object':
      return Database;
    case 'page':
      return FileText;
    case 'dashboard':
      return LayoutDashboard;
    case 'report':
      return BarChart3;
    case 'url':
      return LinkIcon;
    case 'group':
      return Folder;
    case 'action':
      return MousePointerClick;
    case 'component':
      return Puzzle;
    case 'separator':
      return Minus;
    default:
      return Compass;
  }
}

/**
 * The entry the app opens on: depth-first, the first item that addresses
 * something inside the app. Mirrors `findFirstRoute` / `resolveLandingRoute`
 * in `console/AppContent.tsx` — `group` recurses, and `url` / `separator` /
 * `action` are skipped because none of them yields an in-app route.
 */
function findFirstLanding(items: NavItem[]): NavItem | undefined {
  for (const it of items) {
    if (it.kind === 'group') {
      const hit = it.children ? findFirstLanding(it.children) : undefined;
      if (hit) return hit;
      continue;
    }
    if (it.kind === 'url' || it.kind === 'separator' || it.kind === 'action') continue;
    if (it.href) return it;
  }
  return undefined;
}

export function AppPreview({ name, draft, editing, selection, onSelectionChange, onPatch }: MetadataPreviewProps) {
  const appName = String((draft as any).name ?? name ?? '');
  const label = (draft as any).label ?? appName;
  // The landing page is DERIVED, never authored: it is the first navigation
  // item that actually addresses something. The app used to be able to pin it
  // with `homePageId`, but spec 17.0.0 retired that key (objectstack#4667 /
  // #4709) — an ID cross-reference with no referential integrity, which fell
  // back to the first item silently when it dangled. Before that it was
  // `landing`, removed in objectstack#4001. Reading either one back here would
  // show the author a landing page the runtime will not honour.
  const { rootKey, navItems } = React.useMemo<{ rootKey: string | null; navItems: NavItem[] }>(() => {
    const candidates: Array<[string, unknown]> = [
      ['nav', (draft as any).nav],
      ['navigation', (draft as any).navigation],
      ['tabs', (draft as any).tabs],
      ['items', (draft as any).items],
      ['menu', (draft as any).menu],
    ];
    for (const [k, c] of candidates) {
      if (Array.isArray(c) && c.length) return { rootKey: k, navItems: normalizeNav(c, appName) };
    }
    return { rootKey: null, navItems: [] };
  }, [draft, appName]);

  // Resolve the landing entry the same way `resolveLandingRoute` does in the
  // console shell, so the author sees WHICH entry the app will open on:
  // depth-first, first item that yields a route (`group` recurses; `url`,
  // `separator` and `action` address nothing inside the app).
  const homeItem = React.useMemo(() => findFirstLanding(navItems), [navItems]);

  // For Add we need a root key even when empty — default to `navigation`,
  // the only root key the spec (AppSchema) actually accepts; `nav` /
  // `tabs` / `items` are read-back tolerances, not write targets (#2245).
  const addRootKey = rootKey ?? 'navigation';

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'nav' ? selection.id : null;
  const onSelect = designMode
    ? (path: string, item: NavItem) => onSelectionChange!({ kind: 'nav', id: path, label: item.label })
    : undefined;

  const baseRuntimeUrl = appName ? `/apps/${encodeURIComponent(appName)}/` : null;

  return (
    <PreviewShell
      hint="app"
      toolbar={
        baseRuntimeUrl && (
          <a
            href={baseRuntimeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            title="Open this app in a new tab"
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )
      }
    >
      <PreviewErrorBoundary>
        <div className="p-3 space-y-3">
          <div className="rounded border bg-muted/30 p-3">
            <div className="text-sm font-medium text-foreground">{String(label)}</div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">{appName}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {homeItem ? (
                <>
                  Home: opens the first navigation item
                  <span className="ml-1.5">→ {homeItem.label}</span>
                </>
              ) : (
                <>Home: no navigation item yields a route yet</>
              )}
            </div>
          </div>

          {designMode ? (
            // Design mode: form-canvas-style nav editor. Replaces the
            // legacy read-only list + Add button.
            <AppNavCanvas
              draft={draft}
              rootKey={addRootKey}
              onPatch={canEdit ? onPatch : undefined}
              selection={selection ?? null}
              onSelectionChange={onSelectionChange}
            />
          ) : navItems.length === 0 ? (
            <PreviewMessage>
              No top-level nav items. Add <code>navigation</code> entries in the Form tab to populate the app's navigation.
            </PreviewMessage>
          ) : (
            <div className="border rounded divide-y">
              {navItems.map((item, i) => (
                <NavRow
                  key={i}
                  item={item}
                  depth={0}
                  path={`${rootKey}[${i}]`}
                  onSelect={onSelect}
                  selectedId={selectedId}
                />
              ))}
            </div>
          )}
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function NavRow({
  item,
  depth,
  path,
  onSelect,
  selectedId,
}: {
  item: NavItem;
  depth: number;
  path: string;
  onSelect?: (path: string, item: NavItem) => void;
  selectedId: string | null;
}) {
  const Icon = kindIcon(item.kind);
  const url = item.href;
  const selected = selectedId === path;
  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/40 ${onSelect ? 'cursor-pointer' : ''} ${selected ? 'bg-primary/5 ring-1 ring-primary' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(path, item); } : undefined}
      >
        {/* eslint-disable-next-line react-hooks/static-components -- kindIcon returns a stable icon component from a static registry, not one created during render */}
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{item.label}</span>
        {item.kind ? (
          <span className="text-[10px] uppercase tracking-wider opacity-60">{item.kind}</span>
        ) : (
          <span
            className="text-[10px] uppercase tracking-wider text-amber-700"
            title="Every navigation item needs a `type` discriminator — this entry will be rejected on save."
          >
            no type
          </span>
        )}
        {item.target && (
          <span className="font-mono text-[10px] text-muted-foreground truncate">{item.target}</span>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto font-mono text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {url} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {item.children?.map((c, i) => (
        <NavRow
          key={i}
          item={c}
          depth={depth + 1}
          path={`${path}.children[${i}]`}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </>
  );
}

