/**
 * Guardrail for #2561 — decision (a): the zod validators (`…Schema`) of
 * `@objectstack/spec/ui` are NOT part of @object-ui/types' public surface.
 *
 * Background: index.ts re-exports the spec UI surface inside
 * `export type { … }` blocks. A zod schema listed in such a block is
 * value-erased — a consumer importing it as a value silently got `undefined`
 * at runtime. Decision (a) drops those names instead of converting them to
 * value re-exports; consumers needing the runtime validators import
 * `@objectstack/spec/ui` directly.
 *
 * Note: dual type+value names (`Dashboard`, `DensityMode`, `ThemeMode`, …)
 * are intentionally re-exported type-only — only `…Schema`-suffixed zod
 * values are governed by this contract.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as SpecUI from '@objectstack/spec/ui';
import * as Types from '../index';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The public names dropped in #2561 (previously value-erased `export type`
 * re-exports of spec/ui zod schemas, listed under their exported alias).
 */
const DROPPED_SCHEMA_EXPORTS = [
  // Drag and Drop
  'DndConfigSchema',
  'DragItemSchema',
  'DropZoneSchema',
  'DragConstraintSchema',
  'DragHandleSchema',
  'DropEffectSchema',
  // Focus & Keyboard Navigation
  'FocusManagementSchema',
  'FocusTrapConfigSchema',
  'KeyboardNavigationConfigSchema',
  'KeyboardShortcutSchema',
  // Animation & Motion
  'ComponentAnimationSchema',
  'AnimationTriggerSchema',
  'MotionConfigSchema',
  'TransitionConfigSchema',
  'TransitionPresetSchema',
  'EasingFunctionSchema',
  // Notifications
  'NotificationSchema',
  'NotificationConfigSchema',
  'NotificationActionSchema',
  'NotificationPositionSchema',
  'NotificationSeveritySchema',
  'NotificationTypeSchema',
  // Gestures & Touch
  'SpecGestureConfigSchema',
  'SpecGestureTypeSchema',
  'SwipeGestureConfigSchema',
  'SwipeDirectionSchema',
  'PinchGestureConfigSchema',
  'LongPressGestureConfigSchema',
  'TouchInteractionSchema',
  'TouchTargetConfigSchema',
  // Offline & Sync
  'SpecOfflineConfigSchema',
  'OfflineCacheConfigSchema',
  'OfflineStrategySchema',
  'SyncConfigSchema',
  'ConflictResolutionSchema',
  'PersistStorageSchema',
  'EvictionPolicySchema',
  // View Enhancements
  'ColumnSummarySchema',
  'GalleryConfigSchema',
  'GroupingConfigSchema',
  'RowColorConfigSchema',
  'RowHeightSchema',
  'DensityModeSchema',
  'TimelineConfigSchema',
  'NavigationConfigSchema',
  'ViewSharingSchema',
  // Dashboard
  'SpecDashboardSchema',
  'SpecDashboardWidgetSchema',
  'SpecDashboardHeaderSchema',
  'SpecDashboardHeaderActionSchema',
  'SpecGlobalFilterSchema',
  'GlobalFilterOptionsFromSchema',
  'WidgetColorVariantSchema',
  // Sharing & Embedding
  'SharingConfigSchema',
  'EmbedConfigSchema',
  // View Configuration
  'AddRecordConfigSchema',
  'AppearanceConfigSchema',
  'UserActionsConfigSchema',
  'ViewTabSchema',
  // View Filter Rules
  'ViewFilterRuleSchema',
  // Form View
  'SpecFormViewSchema',
  'SpecFormSectionSchema',
  'SpecFormFieldSchema',
  // ListView
  'SpecListViewSchema',
  'SpecListColumnSchema',
  // Page
  'SpecPageSchema',
  'SpecPageComponentSchema',
  'SpecPageRegionSchema',
  'SpecPageTypeSchema',
  'SpecPageVariableSchema',
  // Performance & Page Transitions
  'PerformanceConfigSchema',
  'PageTransitionSchema',
  // Accessibility
  'AriaPropsSchema',
  'WcagContrastLevelSchema',
  // I18n
  'I18nLabelSchema',
  'I18nObjectSchema',
  'LocaleConfigSchema',
  'PluralRuleSchema',
  'DateFormatSchema',
  'NumberFormatSchema',
  // Responsive Design
  'SpecResponsiveConfigSchema',
  'BreakpointColumnMapSchema',
  'BreakpointOrderMapSchema',
  // theme.ts
  'ThemeModeSchema',
];

describe('spec/ui …Schema re-exports (#2561, decision (a))', () => {
  it('does not runtime-export the dropped …Schema names', () => {
    for (const name of DROPPED_SCHEMA_EXPORTS) {
      expect(
        name in Types,
        `'${name}' must not be exported from @object-ui/types — #2561 dropped ` +
          `the spec/ui zod-schema re-exports; import it from '@objectstack/spec/ui'`,
      ).toBe(false);
    }
  });

  it('keeps the genuine value re-exports intact', () => {
    expect(typeof Types.defineStack).toBe('function');
    expect(Types.ObjectStackSchema).toBeDefined();
    expect(Types.SpecReportSchema).toBeDefined();
    expect(Types.SpecReportColumnSchema).toBeDefined();
    expect(Types.SpecReportTypeEnum).toBeDefined();
    expect(Types.ACTION_LOCATIONS).toBeDefined();
    expect(Types.ActionLocationSchema).toBeDefined();
  });

  it('source: no spec/ui zod value hides inside an `export type` block', () => {
    for (const file of ['index.ts', 'theme.ts']) {
      const src = readFileSync(join(SRC_DIR, file), 'utf8');
      const blocks = src.matchAll(
        /export type \{([^}]*)\} from '@objectstack\/spec\/ui'/g,
      );
      for (const [, body] of blocks) {
        const sourceNames = body
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => entry.split(/\s+as\s+/)[0].trim());
        for (const name of sourceNames) {
          const isValueErasedSchema =
            name.endsWith('Schema') &&
            (SpecUI as Record<string, unknown>)[name] !== undefined;
          expect(
            isValueErasedSchema,
            `${file}: '${name}' is a zod value in @objectstack/spec/ui but sits ` +
              `in an 'export type' block, so it would be value-erased (#2561) — ` +
              `drop it or re-export it as a value deliberately`,
          ).toBe(false);
        }
      }
    }
  });
});
