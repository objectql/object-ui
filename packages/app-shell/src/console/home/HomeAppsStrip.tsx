/**
 * HomeAppsStrip
 *
 * Compact, scalable app launcher for Home. Business users live in a handful of
 * apps and switch via the top-bar AppSwitcher / ⌘K — so Home shows apps as
 * small icon+name tiles (favorites first), not a wall of marketing cards.
 *
 * Scales from a few apps to hundreds: a capped strip with a "Show all (N)"
 * toggle keeps the fold stable no matter how many apps exist.
 *
 * @module
 */
import { useMemo, useState } from 'react';
import { LayoutGrid, Store, Star } from 'lucide-react';
import { Button, cn } from '@object-ui/components';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { resolveI18nLabel } from '../../utils';
import { getIcon } from '../../utils/getIcon';
import type { FavoriteItem } from '../../hooks/useFavorites';

const COMPACT_LIMIT = 11;

// iOS-springboard-style icon tints: a vibrant gradient per app, assigned
// deterministically by name so an app keeps its colour across sessions.
// (Literal class strings so Tailwind's source scan emits them.)
const ICON_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-pink-500 to-rose-600',
  'from-amber-400 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-sky-500 to-cyan-600',
  'from-fuchsia-500 to-pink-600',
  'from-orange-500 to-red-600',
  'from-indigo-500 to-blue-600',
  'from-teal-500 to-green-600',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function HomeAppsStrip({
  apps,
  favorites,
  onOpen,
  onBrowseMarketplace,
  isAdmin,
}: {
  apps: any[];
  favorites: FavoriteItem[];
  onOpen: (app: any) => void;
  onBrowseMarketplace: () => void;
  isAdmin: boolean;
}) {
  const { t } = useObjectTranslation();
  const { appLabel } = useObjectLabel();
  const [showAll, setShowAll] = useState(false);

  const favNames = useMemo(
    () => new Set(favorites.filter((f) => f.id.startsWith('app:')).map((f) => f.id.slice(4))),
    [favorites],
  );
  // Favorites first, otherwise keep declared order — a stable, recognizable strip.
  const ordered = useMemo(
    () => [...apps].sort((a, b) => (favNames.has(b.name) ? 1 : 0) - (favNames.has(a.name) ? 1 : 0)),
    [apps, favNames],
  );

  const overflow = ordered.length - COMPACT_LIMIT;
  const visible = showAll ? ordered : ordered.slice(0, COMPACT_LIMIT);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <h2 className="text-base font-semibold tracking-tight">
          {t('home.yourApps', { defaultValue: 'Your apps' })}
        </h2>
        <span className="text-sm text-muted-foreground">{ordered.length}</span>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-8 text-muted-foreground"
            onClick={onBrowseMarketplace}
            data-testid="browse-marketplace-btn"
          >
            <Store className="mr-1.5 h-4 w-4" />
            {t('home.browseMarketplace', { defaultValue: 'Browse App Marketplace' })}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((app) => {
          const Icon = getIcon(app.icon);
          const label = appLabel({ name: app.name, label: resolveI18nLabel(app.label, t) });
          const fav = favNames.has(app.name);
          const grad = ICON_GRADIENTS[hashStr(app.name) % ICON_GRADIENTS.length];
          return (
            <button
              key={app.name}
              type="button"
              onClick={() => onOpen(app)}
              className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 text-left backdrop-blur-sm transition hover:border-foreground/20 hover:bg-muted/40 active:scale-[0.98]"
              data-testid={`app-tile-${app.name}`}
            >
              <span
                className={cn(
                  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]',
                  'bg-gradient-to-br text-white shadow-sm ring-1 ring-black/5',
                  'transition-transform group-hover:scale-105',
                  grad,
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
              {fav && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
            </button>
          );
        })}

        {!showAll && overflow > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border',
              'px-3 py-2.5 text-sm text-muted-foreground transition hover:border-foreground/30 hover:text-foreground active:scale-[0.98]',
            )}
            data-testid="apps-show-all"
          >
            {t('home.showAllApps', { defaultValue: '+{{count}} more', count: overflow })}
          </button>
        )}
      </div>

      {showAll && overflow > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-2.5 text-xs text-primary hover:underline"
        >
          {t('home.showLess', { defaultValue: 'Show less' })}
        </button>
      )}
    </section>
  );
}
