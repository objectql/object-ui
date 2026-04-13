/**
 * RecentApps
 *
 * Display section for recently accessed items (objects, dashboards, pages).
 *
 * @module
 */

import { useNavigate } from 'react-router-dom';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card, CardContent } from '@object-ui/components';
import { Clock } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import { capitalizeFirst } from '../../utils';
import type { RecentItem } from '../../hooks/useRecentItems';

interface RecentAppsProps {
  items: RecentItem[];
}

export function RecentApps({ items }: RecentAppsProps) {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();

  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('home.recentApps.title', { defaultValue: 'Recently Accessed' })}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = getIcon(item.type);
          return (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(item.href)}
              data-testid={`recent-item-${item.id}`}
              role="link"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(item.href);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.label}</h3>
                    <p className="text-xs text-muted-foreground">{capitalizeFirst(item.type)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
