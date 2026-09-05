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
      //
      // objectui#7482 — `top-right` is load-bearing, not cosmetic. The
      // bottom-right corner belongs to the ChatDock's composer and the FAB
      // that launches it (ADR-0057 P3a/P3b), and a toaster anchored there does
      // more than overlap them: sonner pauses a toast's dismiss timer while
      // the pointer is inside the toaster region (`expanded || interacting ||
      // isDocumentHidden` in its Toast effect), so a pointer resting on the
      // composer underneath keeps the toast on screen until the user clicks ×.
      // Override the position only onto a corner nothing interactive occupies.
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
        // click an Undo button without feeling sticky. objectui#7482 asked for
        // 3–5s on success toasts and this already sits in that band; it is
        // pinned in `__tests__/ConsoleToaster.autoDismiss-7482` because
        // nothing checked it, and a success toast that outlives its own
        // information is what that card was reported as.
        //
        // NOT split per intent ("errors may persist"): sonner has no per-type
        // duration on `Toaster`, so the only way to say it is a `duration` at
        // each of the ~100 `toast.error(...)` call sites. `closeButton` below
        // already gives every toast a manual exit.
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
