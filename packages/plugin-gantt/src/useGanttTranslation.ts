/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useObjectTranslation } from '@object-ui/react';

/**
 * Default English translations for ObjectGantt. Mirrors the
 * createSafeTranslationHook pattern used by plugin-detail / plugin-timeline so
 * the Gantt keeps working when rendered standalone (unit tests, embed)
 * without an I18nProvider on the React tree.
 */
export const GANTT_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'gantt.column.taskName': 'Task Name',
  'gantt.column.start': 'Start',
  'gantt.column.end': 'End',
  'gantt.toolbar.prevPeriod': 'Previous period',
  'gantt.toolbar.nextPeriod': 'Next period',
  'gantt.toolbar.zoomIn': 'Zoom in',
  'gantt.toolbar.zoomOut': 'Zoom out',
  'gantt.toolbar.jumpToToday': 'Jump to today',
  'gantt.toolbar.today': 'Today',
  'gantt.toolbar.thisWeek': 'This week',
  'gantt.toolbar.thisMonth': 'This month',
  'gantt.toolbar.exportPdf': 'Export PDF',
  'gantt.toolbar.saveLayout': 'Save layout',
  'gantt.toolbar.showTaskList': 'Show task list',
  'gantt.toolbar.hideTaskList': 'Hide task list',
  'gantt.toolbar.viewMode': 'Timeline granularity',
  'gantt.toolbar.enterFullscreen': 'Enter fullscreen',
  'gantt.toolbar.exitFullscreen': 'Exit fullscreen',
  'gantt.toolbar.criticalPath': 'Highlight critical path',
  'gantt.toolbar.autoSchedule': 'Auto-schedule dependencies',
  'gantt.toolbar.exportPng': 'Export as PNG',
  'gantt.toolbar.refresh': 'Refresh',
  'gantt.toolbar.undo': 'Undo',
  'gantt.toolbar.redo': 'Redo',
  'gantt.viewMode.day': 'Day',
  'gantt.viewMode.week': 'Week',
  'gantt.viewMode.month': 'Month',
  'gantt.viewMode.quarter': 'Quarter',
  'gantt.viewMode.year': 'Year',
  'gantt.row.expand': 'Expand',
  'gantt.row.collapse': 'Collapse',
  'gantt.row.open': 'Open details',
  'gantt.aria.taskList': 'Task list',
  'gantt.tooltip.days': 'd',
  'gantt.menu.view': 'View details',
  'gantt.menu.qrcode': 'Mobile QR code',
  'gantt.qr.title': 'Open on mobile',
  'gantt.qr.hint': 'Scan with a phone to open the details',
  'gantt.qr.copy': 'Copy link',
  'gantt.qr.copied': 'Copied',
  'gantt.qr.close': 'Close',
  'gantt.menu.edit': 'Edit inline',
  'gantt.menu.delete': 'Delete',
  'gantt.menu.addPredecessor': 'Add predecessor…',
  'gantt.menu.addSuccessor': 'Add successor…',
  'gantt.menu.removeDependency': 'Remove dependency',
  'gantt.menu.noCandidates': 'No available tasks',
  'gantt.menu.searchTasks': 'Search tasks…',
  'gantt.delete.title': 'Delete this task?',
  'gantt.delete.body': '"{{title}}" will be permanently removed. This action cannot be undone.',
  'gantt.delete.cancel': 'Cancel',
  'gantt.delete.confirm': 'Delete',
  'gantt.delete.deleting': 'Deleting…',
  'gantt.drawer.fallbackTitle': 'Task Details',
  'gantt.linkType.fs': 'Finish → Start',
  'gantt.linkType.ss': 'Start → Start',
  'gantt.linkType.ff': 'Finish → Finish',
  'gantt.linkType.sf': 'Start → Finish',
  'gantt.linkEnd.start': 'start',
  'gantt.linkEnd.end': 'end',
  'gantt.conflict.title': 'Schedule conflict',
  'gantt.conflict.body': 'This move conflicts with dependency constraints. Auto-reschedule {count} affected task(s)?',
  'gantt.conflict.confirm': 'Auto-reschedule',
  'gantt.conflict.cancel': 'Keep as is',
  'gantt.resource.header': 'Resource',
  'gantt.resource.peak': 'Peak',
  'gantt.resource.over': 'overloaded',
  'gantt.resource.empty': 'No tasks to allocate.',
  'gantt.readOnly': 'Read-only',
  'gantt.readOnlyHint': 'Editing is disabled for this view.',
  'gantt.lockedHint': 'No edit permission',
  'gantt.writeFailed': 'Save failed — the change was rolled back',
};

function fallback(key: string, options?: Record<string, unknown>): string {
  let v = GANTT_DEFAULT_TRANSLATIONS[key] || key;
  if (options) {
    for (const [k, val] of Object.entries(options)) {
      v = v.replace(`{{${k}}}`, String(val));
    }
  }
  return v;
}

export function useGanttTranslation() {
  try {
    const result = useObjectTranslation();
    // `language` is a BCP-47 tag (e.g. 'zh', 'en'). We thread it into the
    // date formatters so the calendar headers/tooltips localize to the SAME
    // language as the chrome, instead of silently following the browser
    // locale (which can diverge — English UI but Chinese dates).
    const language = result.language as string | undefined;
    // Per-key fallback. A consuming app's i18n dictionary commonly translates
    // the *common* gantt keys (column headers, toolbar) but lags behind on
    // newer ones (link types, dependency context-menu). i18next returns the
    // raw key string for a miss, which would surface untranslated keys like
    // `gantt.linkType.fs` in the UI. So for every key we let the host resolve
    // it first and fall back to our bundled English default ONLY when the host
    // returns the key unchanged (a miss). An all-or-nothing probe on a single
    // key can't catch a partially-translated host dictionary.
    const t = (key: string, options?: Record<string, unknown>): string => {
      const hostValue = result.t(key, options as never) as unknown;
      if (typeof hostValue === 'string' && hostValue !== key) return hostValue;
      return fallback(key, options);
    };
    return { t, language };
  } catch {
    // No I18nProvider on the tree (standalone embed / unit tests): keep the
    // English fallback and let dates follow the browser locale (language
    // undefined → toLocaleDateString uses the runtime default).
    return { t: fallback, language: undefined as string | undefined };
  }
}
