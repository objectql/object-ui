/**
 * KeyboardShortcutsDialog
 *
 * A dialog listing all available keyboard shortcuts, triggered by pressing "?".
 * @module
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';

interface ShortcutEntry {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutEntry[];
}

export function KeyboardShortcutsDialog() {
  const { t } = useObjectTranslation();
  const [open, setOpen] = useState(false);

  const shortcutGroups: ShortcutGroup[] = useMemo(() => [
    {
      title: t('console.shortcuts.groups.general'),
      shortcuts: [
        { keys: ['⌘', 'K'], description: t('console.shortcuts.openCommandPalette') },
        { keys: ['?'], description: t('console.shortcuts.showShortcuts') },
        { keys: ['Esc'], description: t('console.shortcuts.closeDialog') },
      ],
    },
    {
      title: t('console.shortcuts.groups.navigation'),
      shortcuts: [
        { keys: ['B'], description: t('console.shortcuts.toggleSidebar') },
        { keys: ['⌘', '/'], description: t('console.shortcuts.focusSearch') },
      ],
    },
    {
      title: t('console.shortcuts.groups.dataViews'),
      shortcuts: [
        { keys: ['N'], description: t('console.shortcuts.createRecord') },
        { keys: ['R'], description: t('console.shortcuts.refreshData') },
        { keys: ['⌘', 'E'], description: t('console.shortcuts.editRecord') },
      ],
    },
    {
      title: t('console.shortcuts.groups.preferences'),
      shortcuts: [
        { keys: ['⌘', 'D'], description: t('console.shortcuts.toggleDarkMode') },
      ],
    },
  ], [t]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only trigger when not in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('console.shortcuts.title')}</DialogTitle>
          <DialogDescription>
            {t('console.shortcuts.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-2">
          {shortcutGroups.map(group => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, kidx) => (
                        <kbd
                          key={kidx}
                          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border bg-muted px-1.5 text-xs font-medium text-muted-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
