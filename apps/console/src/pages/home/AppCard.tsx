/**
 * AppCard
 *
 * Display card for an application with icon, name, description, and favorite toggle.
 *
 * @module
 */

import { Star, StarOff } from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { resolveI18nLabel } from '../../utils';
import { useFavorites } from '../../hooks/useFavorites';
import { getIcon } from '../../utils/getIcon';
import { cn } from '@object-ui/components';

interface AppCardProps {
  app: any;
  onClick: () => void;
  isFavorite: boolean;
}

export function AppCard({ app, onClick, isFavorite }: AppCardProps) {
  const { t } = useObjectTranslation();
  const { toggleFavorite } = useFavorites();

  const Icon = getIcon(app.icon);
  const label = resolveI18nLabel(app.label, t) || app.name;
  const description = resolveI18nLabel(app.description, t);
  const primaryColor = app.branding?.primaryColor;

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({
      id: `app:${app.name}`,
      label,
      href: `/apps/${app.name}`,
      type: 'object',
    });
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all group relative"
      onClick={onClick}
      data-testid={`app-card-${app.name}`}
    >
      <CardContent className="p-6">
        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          onClick={handleToggleFavorite}
          aria-label={isFavorite ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
          aria-pressed={isFavorite}
          data-testid={`favorite-btn-${app.name}`}
        >
          {isFavorite ? (
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          ) : (
            <StarOff className="h-4 w-4" />
          )}
        </Button>

        {/* App Icon */}
        <div
          className={cn('inline-flex p-3 rounded-lg mb-4', primaryColor ? '' : 'bg-primary/10')}
          style={primaryColor ? { backgroundColor: `${primaryColor}20` } : {}}
        >
          <Icon
            className="h-8 w-8"
            style={primaryColor ? { color: primaryColor } : {}}
          />
        </div>

        {/* App Info */}
        <div>
          <h3 className="font-semibold text-lg mb-1">{label}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
          {!description && (
            <p className="text-sm text-muted-foreground">
              {t('home.appCard.noDescription', { defaultValue: 'No description' })}
            </p>
          )}
        </div>

        {/* App Badge (if default) */}
        {app.isDefault && (
          <div className="mt-3">
            <Badge variant="secondary">
              {t('home.appCard.default', { defaultValue: 'Default' })}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
