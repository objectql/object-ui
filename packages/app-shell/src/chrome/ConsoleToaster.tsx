/**
 * ConsoleToaster
 *
 * Sonner Toaster configured for the console app. Uses the local ThemeProvider
 * instead of next-themes to resolve the current color scheme.
 * @module
 */

import { Toaster as Sonner } from 'sonner';
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react';
import { useTheme } from './ThemeProvider.js';
import { useObjectTranslation } from '@object-ui/i18n';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function ConsoleToaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  const { t } = useObjectTranslation();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      // UX defaults chosen for an enterprise console — match the Linear /
      // Notion pattern users expect. Callers can still override any of
      // these via the spread `{...props}` below.
      position="top-right"
      closeButton
      richColors
      expand
      visibleToasts={4}
      containerAriaLabel={t('notifications.regionLabel', { defaultValue: 'Notifications' })}
      icons={{
        success: <CircleCheck className="h-4 w-4" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        // 4s default keeps actionable toasts visible long enough to
        // click an Undo button without feeling sticky.
        duration: 4000,
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
