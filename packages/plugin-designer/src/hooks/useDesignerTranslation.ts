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
  // Dashboard Editor
  'appDesigner.dashboardEditor': 'Dashboard Editor',
  'appDesigner.noWidgets': 'No widgets. Click a button above to add one.',
  'appDesigner.widgetLayoutSize': 'Layout Size',
  'appDesigner.widgetWidth': 'Width',
  'appDesigner.widgetHeight': 'Height',
  'appDesigner.dashboardPreview': 'Dashboard Preview',
  'appDesigner.noWidgetsPreview': 'No widgets to preview',
  // Page Canvas Editor
  'appDesigner.pageCanvasEditor': 'Page Canvas Editor',
  'appDesigner.emptyPage': 'Empty page. Click a button above to add a component.',
  'appDesigner.pagePreview': 'Page Preview',
  'appDesigner.noComponentsPreview': 'No components to preview',
  'appDesigner.modePage': 'Page',
  'appDesigner.modeDashboard': 'Dashboard',
  // Shared editor actions
  'appDesigner.undo': 'Undo',
  'appDesigner.redo': 'Redo',
  // Branding Editor
  'appDesigner.brandingEditor': 'Branding Editor',
  'appDesigner.brandingExport': 'Export JSON',
  'appDesigner.brandingImport': 'Import JSON',
  'appDesigner.brandingPreview': 'Preview',
  'appDesigner.brandingSampleButton': 'Sample Button',
  'appDesigner.brandingSampleText': 'This is how your brand theme will look.',
  'appDesigner.colorPalette': 'Color Palette',
  'appDesigner.fontFamily': 'Font Family',
  'appDesigner.fontDefault': 'Default (System)',
  'appDesigner.modeLight': 'Light',
  'appDesigner.modeDark': 'Dark',
  'appDesigner.mobilePreview': 'Mobile Preview',
  // Object Manager
  'appDesigner.objectManager.title': 'Object Manager',
  'appDesigner.objectManager.addObject': 'New Object',
  'appDesigner.objectManager.searchPlaceholder': 'Search objects…',
  'appDesigner.objectManager.noObjects': 'No objects found.',
  'appDesigner.objectManager.objectName': 'API Name',
  'appDesigner.objectManager.objectLabel': 'Label',
  'appDesigner.objectManager.pluralLabel': 'Plural Label',
  'appDesigner.objectManager.icon': 'Icon',
  'appDesigner.objectManager.selectIcon': 'Select icon…',
  'appDesigner.objectManager.group': 'Group',
  'appDesigner.objectManager.noGroup': 'No Group',
  'appDesigner.objectManager.sortOrder': 'Sort Order',
  'appDesigner.objectManager.enabled': 'Enabled',
  'appDesigner.objectManager.relationships': 'Relationships',
  'appDesigner.objectManager.systemBadge': 'System',
  'appDesigner.objectManager.fieldCount': '{{count}} fields',
  'appDesigner.objectManager.ungrouped': 'Ungrouped',
  'appDesigner.objectManager.deleteConfirmTitle': 'Delete Object?',
  'appDesigner.objectManager.deleteConfirmMessage': 'This will permanently delete the object and all its fields. This action cannot be undone.',
  // Field Designer
  'appDesigner.fieldDesigner.title': 'Field Designer',
  'appDesigner.fieldDesigner.addField': 'New Field',
  'appDesigner.fieldDesigner.searchPlaceholder': 'Search fields…',
  'appDesigner.fieldDesigner.allTypes': 'All Types',
  'appDesigner.fieldDesigner.noFields': 'No fields found.',
  'appDesigner.fieldDesigner.fieldName': 'API Name',
  'appDesigner.fieldDesigner.fieldLabel': 'Label',
  'appDesigner.fieldDesigner.fieldType': 'Type',
  'appDesigner.fieldDesigner.fieldGroup': 'Group',
  'appDesigner.fieldDesigner.description': 'Description',
  'appDesigner.fieldDesigner.required': 'Required',
  'appDesigner.fieldDesigner.unique': 'Unique',
  'appDesigner.fieldDesigner.readOnly': 'Read Only',
  'appDesigner.fieldDesigner.hidden': 'Hidden',
  'appDesigner.fieldDesigner.indexed': 'Indexed',
  'appDesigner.fieldDesigner.externalId': 'External ID',
  'appDesigner.fieldDesigner.trackHistory': 'Track History',
  'appDesigner.fieldDesigner.defaultValue': 'Default Value',
  'appDesigner.fieldDesigner.placeholder': 'Placeholder',
  'appDesigner.fieldDesigner.referenceTo': 'Reference To',
  'appDesigner.fieldDesigner.formula': 'Formula',
  'appDesigner.fieldDesigner.options': 'Options',
  'appDesigner.fieldDesigner.addOption': 'Add Option',
  'appDesigner.fieldDesigner.validationRules': 'Validation Rules',
  'appDesigner.fieldDesigner.addRule': 'Add Rule',
  'appDesigner.fieldDesigner.systemBadge': 'System',
  'appDesigner.fieldDesigner.ungrouped': 'General',
  'appDesigner.fieldDesigner.deleteConfirmTitle': 'Delete Field?',
  'appDesigner.fieldDesigner.deleteConfirmMessage': 'This will permanently delete the field. Existing data in this field will be lost.',
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
