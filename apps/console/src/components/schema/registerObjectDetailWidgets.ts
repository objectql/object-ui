/**
 * Register Object Detail Widgets
 *
 * Side-effect module that registers all object-detail SchemaNode widget types
 * in the ComponentRegistry. Import this module once at app startup (main.tsx)
 * so that SchemaRenderer can resolve these types when rendering PageSchema.
 *
 * Widget types registered:
 *   - `object-detail-tabs`     — Tabbed layout for object detail page
 *   - `object-properties`      — Object property card
 *   - `object-relationships`   — Relationships card
 *   - `object-keys`            — Keys card
 *   - `object-data-experience` — Data experience placeholders
 *   - `object-data-preview`    — Data preview placeholder
 *   - `object-field-designer`  — Interactive FieldDesigner with CRUD
 *
 * @module components/schema/registerObjectDetailWidgets
 */

import { ComponentRegistry } from '@object-ui/core';
import {
  ObjectPropertiesWidget,
  ObjectRelationshipsWidget,
  ObjectKeysWidget,
  ObjectDataExperienceWidget,
  ObjectDataPreviewWidget,
} from './objectDetailWidgets';
import { ObjectFieldDesignerWidget } from './ObjectFieldDesignerWidget';
import { ObjectDetailTabsWidget } from './ObjectDetailTabsWidget';

const widgetMeta = {
  namespace: 'console',
  category: 'system',
};

ComponentRegistry.register('object-detail-tabs', ObjectDetailTabsWidget, {
  ...widgetMeta,
  label: 'Object Detail Tabs',
  icon: 'LayoutDashboard',
});

ComponentRegistry.register('object-properties', ObjectPropertiesWidget, {
  ...widgetMeta,
  label: 'Object Properties',
  icon: 'Settings2',
});

ComponentRegistry.register('object-relationships', ObjectRelationshipsWidget, {
  ...widgetMeta,
  label: 'Object Relationships',
  icon: 'Link2',
});

ComponentRegistry.register('object-keys', ObjectKeysWidget, {
  ...widgetMeta,
  label: 'Object Keys',
  icon: 'KeyRound',
});

ComponentRegistry.register('object-data-experience', ObjectDataExperienceWidget, {
  ...widgetMeta,
  label: 'Data Experience',
  icon: 'LayoutList',
});

ComponentRegistry.register('object-data-preview', ObjectDataPreviewWidget, {
  ...widgetMeta,
  label: 'Data Preview',
  icon: 'Table',
});

ComponentRegistry.register('object-field-designer', ObjectFieldDesignerWidget, {
  ...widgetMeta,
  label: 'Field Designer',
  icon: 'Columns',
});
