/**
 * HomePage
 *
 * Unified Home Dashboard (Workspace) that displays all available applications,
 * quick actions, recent items, and favorites. Inspired by Airtable/Notion home pages.
 *
 * Features:
 * - Display all active applications as cards
 * - Quick actions for creating apps, importing data, etc.
 * - Recent apps section (from useRecentItems)
 * - Starred/Favorite apps section (from useFavorites)
 * - Empty state guidance for new users
 * - Responsive grid layout
 * - i18n support
 *
 * @module
 */

import { useNavigate } from 'react-router-dom';
import { useMetadata } from '../../context/MetadataProvider';
import { useRecentItems } from '../../hooks/useRecentItems';
import { useFavorites } from '../../hooks/useFavorites';
import { useObjectTranslation } from '@object-ui/i18n';
import { QuickActions } from './QuickActions';
import { AppCard } from './AppCard';
import { RecentApps } from './RecentApps';
import { StarredApps } from './StarredApps';
import { Empty, EmptyTitle, EmptyDescription, Button } from '@object-ui/components';
import { Plus, Settings } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const { apps, loading } = useMetadata();
  const { recentItems } = useRecentItems();
  const { favorites } = useFavorites();

  // Filter active apps
  const activeApps = apps.filter((a: any) => a.active !== false);

  // Get recent apps (only apps, not objects/dashboards)
  const recentApps = recentItems
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page')
    .slice(0, 6);

  // Get starred apps
  const starredApps = favorites
    .filter(item => item.type === 'object' || item.type === 'dashboard' || item.type === 'page')
    .slice(0, 8);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  // Empty state - no apps configured
  if (activeApps.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Empty>
          <EmptyTitle>Welcome to ObjectUI</EmptyTitle>
          <EmptyDescription>
            Get started by creating your first application or configure your system settings.
          </EmptyDescription>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={() => navigate('/create-app')}
              data-testid="create-first-app-btn"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First App
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/system')}
              data-testid="go-to-settings-btn"
            >
              <Settings className="mr-2 h-4 w-4" />
              System Settings
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Page Title */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {t('home.title', { defaultValue: 'Home' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('home.subtitle', { defaultValue: 'Your workspace dashboard' })}
        </p>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 py-4 space-y-8">
        {/* Quick Actions */}
        <QuickActions />

        {/* Starred/Favorite Apps */}
        {starredApps.length > 0 && (
          <StarredApps items={starredApps} />
        )}

        {/* Recent Apps */}
        {recentApps.length > 0 && (
          <RecentApps items={recentApps} />
        )}

        {/* All Applications */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight mb-4">
            {t('home.allApps', { defaultValue: 'All Applications' })}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeApps.map((app: any) => (
              <AppCard
                key={app.name}
                app={app}
                onClick={() => navigate(`/apps/${app.name}`)}
                isFavorite={favorites.some(f => f.id === `app:${app.name}`)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
