/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The board's schema vocabulary — declared in `@object-ui/types`, re-exported
 * here (objectui#7664, maintainer ruling (a), 2026-09-05).
 *
 * Until that ruling this file DECLARED `KanbanCard` / `KanbanColumn` /
 * `KanbanSchema` / `CardTemplate` / `ColumnWidthConfig` as the plugin's own
 * dialect, while `@object-ui/types` declared an unrelated board under the same
 * `'kanban'` key (the `DeclarativeKanban*` trio) and validated authored
 * documents against THAT — so a board could pass `objectui validate` and render
 * empty. The ruling made this dialect the authoritative one: the declaration
 * moved down to `@object-ui/types` (`complex.ts`, with a Zod mirror in
 * `zod/complex.zod.ts` that `safeValidateSchema` now applies to every
 * `type: 'kanban'` document), and this package imports it back. Member for
 * member the shape is what this file declared, so nothing this package renders
 * changed; the trio retired under ADR-0049.
 *
 * ⛔ Do not re-declare any of these names here. One declaration, one authority
 * (`scripts/__tests__/one-authority-per-exported-name-6273.test.ts` is the
 * recurrence guard) — a plain re-export is one declaration with two export
 * sites, which is what this file now is. `SchemaRegistry['kanban']` in
 * `@object-ui/types` names the same `KanbanSchema`, pinned in
 * `__tests__/kanban-plugin-dialect-authoritative-7664.test.ts`.
 *
 * `InlineFieldDefinition` stays local: it is the quick-add FORM's field
 * definition (`InlineQuickAdd.tsx`), not a member of the authored board.
 */
export type {
  KanbanCard,
  KanbanColumn,
  KanbanSchema,
  CardTemplate,
  ColumnWidthConfig,
} from '@object-ui/types';

/**
 * Field definition for inline quick-add forms.
 */
export interface InlineFieldDefinition {
  /** Field name (key in the resulting values object) */
  name: string;
  /** Display label */
  label?: string;
  /** Field type */
  type: 'text' | 'number' | 'select';
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: any;
  /** Options for select fields */
  options?: Array<{ label: string; value: string }>;
}
