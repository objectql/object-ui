/**
 * QuickActions
 *
 * Quick action cards for common tasks like creating apps, importing data,
 * accessing system settings, etc.
 *
 * @module
 */

import { useNavigate } from 'react-router-dom';
import { useObjectTranslation } from '@object-ui/i18n';
import { Card, CardContent } from '@object-ui/components';
import { Plus, Settings, Database } from 'lucide-react';
import { cn } from '@object-ui/components';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

export function QuickActions() {
  const navigate = useNavigate();
  const { t } = useObjectTranslation();

  const actions: QuickAction[] = [
    {
      id: 'create-app',
      label: t('home.quickActions.createApp', { defaultValue: 'Create App' }),
      description: t('home.quickActions.createAppDesc', { defaultValue: 'Start with a new application' }),
      icon: Plus,
      href: '/create-app',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'manage-objects',
      label: t('home.quickActions.manageObjects', { defaultValue: 'Manage Objects' }),
      description: t('home.quickActions.manageObjectsDesc', { defaultValue: 'Configure data models' }),
      icon: Database,
      href: '/system/metadata/object',
      color: 'text-purple-600 dark:text-purple-400',
    },
    {
      id: 'system-settings',
      label: t('home.quickActions.systemSettings', { defaultValue: 'System Settings' }),
      description: t('home.quickActions.systemSettingsDesc', { defaultValue: 'Configure your workspace' }),
      icon: Settings,
      href: '/system',
      color: 'text-gray-600 dark:text-gray-400',
    },
  ];

  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight mb-4">
        {t('home.quickActions.title', { defaultValue: 'Quick Actions' })}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(action.href)}
              data-testid={`quick-action-${action.id}`}
              role="link"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(action.href);
                }
              }}
              aria-label={action.label}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn('p-3 rounded-lg bg-muted', action.color)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1">{action.label}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
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
