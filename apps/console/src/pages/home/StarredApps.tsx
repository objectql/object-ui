/**
 * StarredApps
 *
 * Display section for starred/favorite items (objects, dashboards, pages).
 *
 * @module
 */

import { useNavigate } from 'react-router-dom';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card, CardContent } from '@object-ui/components';
import { Star } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import type { FavoriteItem } from '../../hooks/useFavorites';

interface StarredAppsProps {
  items: FavoriteItem[];
}

export function StarredApps({ items }: StarredAppsProps) {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();

  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('home.starredApps.title', { defaultValue: 'Starred' })}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = getIcon(item.type);
          return (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(item.href)}
              data-testid={`starred-item-${item.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.label}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
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
