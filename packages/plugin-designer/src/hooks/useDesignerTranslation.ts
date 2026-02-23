/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Safe wrapper for useObjectTranslation that falls back to English defaults
 * when I18nProvider is not available (e.g., standalone usage outside console).
 */

import { useObjectTranslation } from '@object-ui/i18n';

const DESIGNER_DEFAULT_TRANSLATIONS: Record<string, string> = {
  // Step labels & descriptions
  'appDesigner.basicInfo': 'Basic Info',
  'appDesigner.objects': 'Objects',
  'appDesigner.navigation': 'Navigation',
  'appDesigner.branding': 'Branding',
  'appDesigner.stepBasicDesc': 'Name, title, and layout',
  'appDesigner.stepObjectsDesc': 'Select business objects',
  'appDesigner.stepNavigationDesc': 'Build navigation tree',
  'appDesigner.stepBrandingDesc': 'Logo, colors, and favicon',
  // Step 1
  'appDesigner.appName': 'App Name',
  'appDesigner.appTitle': 'Title',
  'appDesigner.appDescription': 'Description',
  'appDesigner.appIcon': 'Icon',
  'appDesigner.template': 'Template',
  'appDesigner.layout': 'Layout',
  'appDesigner.layoutSidebar': 'Sidebar',
  'appDesigner.layoutHeader': 'Header',
  'appDesigner.layoutEmpty': 'Empty',
  'appDesigner.snakeCaseHint': 'Must be snake_case (e.g. my_app)',
  // Step 2
  'appDesigner.searchObjects': 'Search objects…',
  'appDesigner.selectAll': 'Select All',
  'appDesigner.deselectAll': 'Deselect All',
  'appDesigner.noObjectsFound': 'No objects found.',
  // Step 3
  'appDesigner.addGroup': 'Add Group',
  'appDesigner.addUrl': 'Add URL',
  'appDesigner.addSeparator': 'Add Separator',
  'appDesigner.noNavItemsHint': 'No navigation items yet. Select objects in the previous step or add items manually.',
  'appDesigner.separatorLabel': '— Separator —',
  'appDesigner.newGroup': 'New Group',
  'appDesigner.newLink': 'New Link',
  // Step 4
  'appDesigner.logoUrl': 'Logo URL',
  'appDesigner.primaryColor': 'Primary Color',
  'appDesigner.faviconUrl': 'Favicon URL',
  'appDesigner.preview': 'Preview',
  // Buttons
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.close': 'Close',
  'appDesigner.complete': 'Complete',
  'appDesigner.saveDraft': 'Save Draft',
  // Cancel confirmation
  'appDesigner.cancelConfirmTitle': 'Discard changes?',
  'appDesigner.cancelConfirmMessage': 'You have unsaved changes. Are you sure you want to cancel?',
  'appDesigner.confirmDiscard': 'Discard',
  'appDesigner.keepEditing': 'Keep Editing',
  // Navigation Designer
  'appDesigner.navNoItems': 'No navigation items. Click buttons above to add items.',
  'appDesigner.navNoPreviewItems': 'No items',
  'appDesigner.navLivePreview': 'Live Preview',
  'appDesigner.navCollapseGroup': 'Collapse group',
  'appDesigner.navExpandGroup': 'Expand group',
  'appDesigner.navAddChild': 'Add child',
  'appDesigner.navMoveUp': 'Move up',
  'appDesigner.navMoveDown': 'Move down',
  'appDesigner.navRemove': 'Remove',
  'appDesigner.navObjectPage': 'Object Page',
  'appDesigner.navDashboard': 'Dashboard',
  'appDesigner.navPage': 'Page',
  'appDesigner.navReport': 'Report',
  'appDesigner.navGroup': 'Group',
  'appDesigner.navUrl': 'URL',
  'appDesigner.navSeparator': 'Separator',
  'appDesigner.navTypeObject': 'Object',
  'appDesigner.navTypeDashboard': 'Dashboard',
  'appDesigner.navTypePage': 'Page',
  'appDesigner.navTypeReport': 'Report',
  'appDesigner.navTypeUrl': 'URL',
  'appDesigner.navTypeGroup': 'Group',
  'appDesigner.navTypeSeparator': 'Separator',
  'appDesigner.navTypeAction': 'Action',
  'appDesigner.navEditIcon': 'Edit icon',
  'appDesigner.navToggleVisible': 'Toggle visibility',
  'appDesigner.navHidden': 'Hidden',
  'appDesigner.navExportSchema': 'Export JSON',
  'appDesigner.navImportSchema': 'Import JSON',
  'appDesigner.navExportSuccess': 'Navigation schema exported',
  'appDesigner.navImportSuccess': 'Navigation schema imported',
  'appDesigner.navImportError': 'Invalid navigation JSON',
  'appDesigner.navIconPlaceholder': 'Icon name (e.g. Users)',
};

function createFallbackTranslator(defaults: Record<string, string>) {
  return (key: string, options?: Record<string, unknown>): string => {
    let value = defaults[key] || key;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        value = value.replace(`{{${k}}}`, String(v));
      }
    }
    return value;
  };
}

export function useDesignerTranslation() {
  try {
    const result = useObjectTranslation();
    const testValue = result.t('appDesigner.basicInfo');
    if (testValue === 'appDesigner.basicInfo') {
      // i18n returned the key itself — not initialized
      return { t: createFallbackTranslator(DESIGNER_DEFAULT_TRANSLATIONS) };
    }
    return { t: result.t };
  } catch {
    return { t: createFallbackTranslator(DESIGNER_DEFAULT_TRANSLATIONS) };
  }
}
