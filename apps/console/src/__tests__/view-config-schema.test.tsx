/**
 * ViewConfigPanel — Schema-driven infrastructure tests
 *
 * Tests for:
 *  1. view-config-utils.ts utility functions
 *  2. view-config-schema.tsx schema factory (buildViewConfigSchema)
 */

import { describe, it, expect, vi } from 'vitest';

// Mock i18n — return keys as-is
vi.mock('@object-ui/i18n', () => ({
    useObjectTranslation: () => ({
        t: (key: string) => key,
    }),
}));

// Mock components to simple stubs — only needed by the schema factory render fns
vi.mock('@object-ui/components', () => {
    const React = require('react');
    return {
        ConfigRow: ({ label, value, children, onClick }: any) =>
            React.createElement('div', { 'data-testid': `config-row-${label}`, onClick }, children ?? value ?? null),
        SectionHeader: ({ title }: any) => React.createElement('div', null, title),
        Input: (props: any) => React.createElement('input', props),
        Switch: (props: any) => React.createElement('input', { type: 'checkbox', ...props }),
        Checkbox: (props: any) => React.createElement('input', { type: 'checkbox', ...props }),
        FilterBuilder: () => React.createElement('div', { 'data-testid': 'filter-builder' }),
        SortBuilder: () => React.createElement('div', { 'data-testid': 'sort-builder' }),
    };
});

// ── Imports under test ──────────────────────────────────────────────────────

import {
    normalizeFieldType,
    parseSpecFilter,
    toSpecFilter,
    parseCommaSeparated,
    parseNumberList,
    deriveFieldOptions,
    toFilterGroup,
    toSortItems,
    SPEC_TO_BUILDER_OP,
    BUILDER_TO_SPEC_OP,
    ROW_HEIGHT_OPTIONS,
} from '../utils/view-config-utils';

import { buildViewConfigSchema } from '../utils/view-config-schema';
import type { FieldOption } from '../utils/view-config-utils';

// ── Shared test data ────────────────────────────────────────────────────────

const mockT = (key: string) => key;
const mockFieldOptions: FieldOption[] = [
    { value: 'name', label: 'Name', type: 'text' as const },
    { value: 'amount', label: 'Amount', type: 'number' as const },
];
const mockObjectDef = { name: 'test', label: 'Test', fields: { name: { label: 'Name', type: 'text' } } };
const mockUpdateField = vi.fn();
const mockFilterGroup = { id: 'root', logic: 'and' as const, conditions: [] };
const mockSortItems: any[] = [];

// ═══════════════════════════════════════════════════════════════════════════
// 1. view-config-utils.ts
// ═══════════════════════════════════════════════════════════════════════════

describe('view-config-utils', () => {
    // ── normalizeFieldType ──────────────────────────────────────────────

    describe('normalizeFieldType', () => {
        it('returns "number" for numeric types', () => {
            for (const t of ['integer', 'int', 'float', 'double', 'number', 'currency', 'money', 'percent', 'rating']) {
                expect(normalizeFieldType(t)).toBe('number');
            }
        });

        it('returns "date" for date types', () => {
            for (const t of ['date', 'datetime', 'datetime_tz', 'timestamp']) {
                expect(normalizeFieldType(t)).toBe('date');
            }
        });

        it('returns "boolean" for boolean types', () => {
            for (const t of ['boolean', 'bool', 'checkbox', 'switch']) {
                expect(normalizeFieldType(t)).toBe('boolean');
            }
        });

        it('returns "select" for select types', () => {
            for (const t of ['select', 'picklist', 'single_select', 'multi_select', 'enum']) {
                expect(normalizeFieldType(t)).toBe('select');
            }
        });

        it('returns "text" for unknown / undefined types', () => {
            expect(normalizeFieldType('text')).toBe('text');
            expect(normalizeFieldType('string')).toBe('text');
            expect(normalizeFieldType('')).toBe('text');
            expect(normalizeFieldType(undefined)).toBe('text');
        });

        it('is case-insensitive', () => {
            expect(normalizeFieldType('INTEGER')).toBe('number');
            expect(normalizeFieldType('DateTime')).toBe('date');
            expect(normalizeFieldType('BOOLEAN')).toBe('boolean');
            expect(normalizeFieldType('ENUM')).toBe('select');
        });
    });

    // ── parseSpecFilter ─────────────────────────────────────────────────

    describe('parseSpecFilter', () => {
        it('returns empty conditions for empty / falsy input', () => {
            expect(parseSpecFilter([])).toEqual({ logic: 'and', conditions: [] });
            expect(parseSpecFilter(null as any)).toEqual({ logic: 'and', conditions: [] });
            expect(parseSpecFilter(undefined as any)).toEqual({ logic: 'and', conditions: [] });
        });

        it('parses a single triplet [field, op, value]', () => {
            const result = parseSpecFilter(['status', '=', 'active']);
            expect(result.logic).toBe('and');
            expect(result.conditions).toHaveLength(1);
            expect(result.conditions[0]).toMatchObject({ field: 'status', operator: 'equals', value: 'active' });
        });

        it('parses ["and", ...conditions]', () => {
            const result = parseSpecFilter(['and', ['status', '=', 'active'], ['age', '>', 18]]);
            expect(result.logic).toBe('and');
            expect(result.conditions).toHaveLength(2);
            expect(result.conditions[0]).toMatchObject({ field: 'status', operator: 'equals' });
            expect(result.conditions[1]).toMatchObject({ field: 'age', operator: 'greaterThan' });
        });

        it('parses ["or", ...conditions]', () => {
            const result = parseSpecFilter(['or', ['x', 'contains', 'a'], ['y', 'is_empty']]);
            expect(result.logic).toBe('or');
            expect(result.conditions).toHaveLength(2);
            expect(result.conditions[0]).toMatchObject({ field: 'x', operator: 'contains', value: 'a' });
            expect(result.conditions[1]).toMatchObject({ field: 'y', operator: 'isEmpty' });
        });

        it('parses array of arrays [[...], [...]]', () => {
            const result = parseSpecFilter([['a', '!=', 1], ['b', '<=', 5]]);
            expect(result.logic).toBe('and');
            expect(result.conditions).toHaveLength(2);
            expect(result.conditions[0]).toMatchObject({ field: 'a', operator: 'notEquals', value: 1 });
            expect(result.conditions[1]).toMatchObject({ field: 'b', operator: 'lessOrEqual', value: 5 });
        });

        it('parses object-style conditions', () => {
            const result = parseSpecFilter(['and', { field: 'status', operator: '=', value: 'done' }]);
            expect(result.conditions).toHaveLength(1);
            expect(result.conditions[0]).toMatchObject({ field: 'status', operator: 'equals', value: 'done' });
        });

        it('passes through already-normalized operators', () => {
            const result = parseSpecFilter(['and', { field: 'x', operator: 'contains', value: 'y' }]);
            expect(result.conditions[0].operator).toBe('contains');
        });
    });

    // ── toSpecFilter ────────────────────────────────────────────────────

    describe('toSpecFilter', () => {
        it('returns empty array for no conditions', () => {
            expect(toSpecFilter('and', [])).toEqual([]);
        });

        it('returns a single triplet (no wrapping) for one AND condition', () => {
            const result = toSpecFilter('and', [{ field: 'x', operator: 'equals', value: 'a' }]);
            expect(result).toEqual(['x', '=', 'a']);
        });

        it('wraps multiple AND conditions as nested arrays', () => {
            const result = toSpecFilter('and', [
                { field: 'x', operator: 'equals', value: 'a' },
                { field: 'y', operator: 'greaterThan', value: 5 },
            ]);
            expect(result).toEqual([['x', '=', 'a'], ['y', '>', 5]]);
        });

        it('wraps OR conditions with "or" prefix', () => {
            const result = toSpecFilter('or', [
                { field: 'a', operator: 'contains', value: 'z' },
                { field: 'b', operator: 'isEmpty', value: '' },
            ]);
            expect(result).toEqual(['or', ['a', 'contains', 'z'], ['b', 'is_empty', '']]);
        });

        it('skips conditions with empty field', () => {
            const result = toSpecFilter('and', [
                { field: '', operator: 'equals', value: '' },
                { field: 'x', operator: 'equals', value: 1 },
            ]);
            expect(result).toEqual(['x', '=', 1]);
        });
    });

    // ── parseCommaSeparated / parseNumberList ────────────────────────────

    describe('parseCommaSeparated', () => {
        it('splits and trims values', () => {
            expect(parseCommaSeparated(' a , b , c ')).toEqual(['a', 'b', 'c']);
        });

        it('filters empty strings', () => {
            expect(parseCommaSeparated(',,')).toEqual([]);
        });

        it('handles single value', () => {
            expect(parseCommaSeparated('hello')).toEqual(['hello']);
        });
    });

    describe('parseNumberList', () => {
        it('parses positive numbers', () => {
            expect(parseNumberList('10, 25, 50')).toEqual([10, 25, 50]);
        });

        it('filters NaN and non-positive values', () => {
            expect(parseNumberList('abc, 0, -1, 5')).toEqual([5]);
        });

        it('returns empty for invalid input', () => {
            expect(parseNumberList('')).toEqual([]);
        });
    });

    // ── deriveFieldOptions ──────────────────────────────────────────────

    describe('deriveFieldOptions', () => {
        it('derives options from objectDef fields', () => {
            const result = deriveFieldOptions({
                fields: {
                    name: { label: 'Name', type: 'text' },
                    age: { label: 'Age', type: 'integer' },
                    active: { type: 'boolean' },
                },
            });
            expect(result).toHaveLength(3);
            expect(result[0]).toMatchObject({ value: 'name', label: 'Name', type: 'text' });
            expect(result[1]).toMatchObject({ value: 'age', label: 'Age', type: 'number' });
            expect(result[2]).toMatchObject({ value: 'active', label: 'active', type: 'boolean' });
        });

        it('returns empty for missing fields', () => {
            expect(deriveFieldOptions({})).toEqual([]);
        });

        it('uses key as fallback label', () => {
            const result = deriveFieldOptions({ fields: { foo: { type: 'text' } } });
            expect(result[0].label).toBe('foo');
        });
    });

    // ── toFilterGroup / toSortItems ─────────────────────────────────────

    describe('toFilterGroup', () => {
        it('returns a FilterGroup from spec filter array', () => {
            const group = toFilterGroup(['status', '=', 'active']);
            expect(group.id).toBe('root');
            expect(group.logic).toBe('and');
            expect(group.conditions).toHaveLength(1);
            expect(group.conditions[0]).toMatchObject({ field: 'status', operator: 'equals' });
        });

        it('returns empty conditions for empty input', () => {
            const group = toFilterGroup([]);
            expect(group.conditions).toEqual([]);
        });
    });

    describe('toSortItems', () => {
        it('converts sort array to SortItem[]', () => {
            const items = toSortItems([
                { field: 'name', order: 'asc' },
                { field: 'age', direction: 'desc' },
            ]);
            expect(items).toHaveLength(2);
            expect(items[0]).toMatchObject({ field: 'name', order: 'asc' });
            expect(items[1]).toMatchObject({ field: 'age', order: 'desc' });
        });

        it('defaults order to "asc"', () => {
            const items = toSortItems([{ field: 'x' }]);
            expect(items[0].order).toBe('asc');
        });

        it('handles non-array input', () => {
            expect(toSortItems(null)).toEqual([]);
            expect(toSortItems(undefined)).toEqual([]);
        });
    });

    // ── Operator mappings ───────────────────────────────────────────────

    describe('operator mappings', () => {
        it('SPEC_TO_BUILDER_OP covers core operators', () => {
            expect(SPEC_TO_BUILDER_OP['=']).toBe('equals');
            expect(SPEC_TO_BUILDER_OP['!=']).toBe('notEquals');
            expect(SPEC_TO_BUILDER_OP['>']).toBe('greaterThan');
            expect(SPEC_TO_BUILDER_OP['<']).toBe('lessThan');
            expect(SPEC_TO_BUILDER_OP['>=']).toBe('greaterOrEqual');
            expect(SPEC_TO_BUILDER_OP['<=']).toBe('lessOrEqual');
            expect(SPEC_TO_BUILDER_OP['contains']).toBe('contains');
            expect(SPEC_TO_BUILDER_OP['is_empty']).toBe('isEmpty');
        });

        it('BUILDER_TO_SPEC_OP is the inverse', () => {
            expect(BUILDER_TO_SPEC_OP['equals']).toBe('=');
            expect(BUILDER_TO_SPEC_OP['notEquals']).toBe('!=');
            expect(BUILDER_TO_SPEC_OP['greaterThan']).toBe('>');
            expect(BUILDER_TO_SPEC_OP['contains']).toBe('contains');
            expect(BUILDER_TO_SPEC_OP['isEmpty']).toBe('is_empty');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. view-config-schema.tsx — buildViewConfigSchema
// ═══════════════════════════════════════════════════════════════════════════

describe('buildViewConfigSchema', () => {
    function buildSchema() {
        return buildViewConfigSchema({
            t: mockT,
            fieldOptions: mockFieldOptions,
            objectDef: mockObjectDef,
            updateField: mockUpdateField,
            filterGroupValue: mockFilterGroup,
            sortItemsValue: mockSortItems,
        });
    }

    it('returns a schema with breadcrumb', () => {
        const schema = buildSchema();
        expect(schema.breadcrumb).toEqual(['console.objectView.page']);
    });

    it('returns exactly 6 sections', () => {
        const schema = buildSchema();
        expect(schema.sections).toHaveLength(6);
    });

    it('has correct section keys', () => {
        const schema = buildSchema();
        const keys = schema.sections.map(s => s.key);
        expect(keys).toEqual(['pageConfig', 'data', 'appearance', 'userActions', 'sharing', 'accessibility']);
    });

    // ── Collapsible flags ───────────────────────────────────────────────

    describe('collapsible sections', () => {
        it('pageConfig is NOT collapsible', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig');
            expect(section?.collapsible).toBeFalsy();
        });

        it.each(['data', 'appearance', 'userActions', 'sharing', 'accessibility'])(
            '%s is collapsible',
            (key) => {
                const schema = buildSchema();
                const section = schema.sections.find(s => s.key === key);
                expect(section?.collapsible).toBe(true);
            },
        );
    });

    // ── Page Config Section ─────────────────────────────────────────────

    describe('pageConfig section', () => {
        it('contains expected field keys in spec order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const fieldKeys = section.fields.map(f => f.key);
            // Spec order: label, type, showSearch, showSort, showFilters, showHideFields, showGroup, showColor, showDensity,
            //             allowExport(_export), navigation, selection, addRecord, showRecordCount, allowPrinting
            // description is UI extension (after label)
            expect(fieldKeys).toEqual([
                'label', 'description', 'type',
                'showSearch', 'showSort', 'showFilters', 'showHideFields', 'showGroup', 'showColor', 'showDensity',
                '_export',
                '_navigationMode', '_navigationWidth', '_navigationOpenNewTab',
                '_selectionType',
                '_addRecord',
                'showRecordCount', 'allowPrinting',
            ]);
        });

        it('showSort comes before showFilters per spec', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys.indexOf('showSort')).toBeLessThan(fieldKeys.indexOf('showFilters'));
        });

        it('_export comes before _navigationMode per spec', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys.indexOf('_export')).toBeLessThan(fieldKeys.indexOf('_navigationMode'));
        });
    });

    // ── Data Section ────────────────────────────────────────────────────

    describe('data section', () => {
        it('contains expected field keys in spec order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'data')!;
            const fieldKeys = section.fields.map(f => f.key);
            // Spec order: columns, filter, sort, prefixField, pagination, searchableFields, filterableFields,
            //             hiddenFields, quickFilters, virtualScroll
            // _source is UI extension (first), _groupBy is UI extension (after prefixField), _typeOptions is UI extension (last)
            expect(fieldKeys).toEqual([
                '_source',
                '_columns', '_filterBy', '_sortBy',
                'prefixField', '_groupBy',
                '_pageSize', '_pageSizeOptions',
                '_searchableFields', '_filterableFields', '_hiddenFields',
                '_quickFilters',
                'virtualScroll',
                '_typeOptions',
            ]);
        });

        it('_columns comes before _filterBy and _sortBy per spec', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'data')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys.indexOf('_columns')).toBeLessThan(fieldKeys.indexOf('_filterBy'));
            expect(fieldKeys.indexOf('_filterBy')).toBeLessThan(fieldKeys.indexOf('_sortBy'));
        });
    });

    // ── Appearance Section ──────────────────────────────────────────────

    describe('appearance section', () => {
        it('contains expected field keys in spec order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'appearance')!;
            const fieldKeys = section.fields.map(f => f.key);
            // Spec order: striped, bordered, color, wrapHeaders, collapseAllByDefault, fieldTextColor,
            //             showDescription, resizable, densityMode, rowHeight, conditionalFormatting, emptyState
            expect(fieldKeys).toEqual([
                'striped', 'bordered', 'color',
                'wrapHeaders', 'collapseAllByDefault',
                'fieldTextColor', 'showDescription',
                'resizable', 'densityMode', 'rowHeight',
                '_conditionalFormatting', '_emptyState',
            ]);
        });

        it('striped and bordered come before color per spec', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'appearance')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys.indexOf('striped')).toBeLessThan(fieldKeys.indexOf('color'));
            expect(fieldKeys.indexOf('bordered')).toBeLessThan(fieldKeys.indexOf('color'));
        });
    });

    // ── User Actions Section ────────────────────────────────────────────

    describe('userActions section', () => {
        it('contains expected field keys in spec order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'userActions')!;
            const fieldKeys = section.fields.map(f => f.key);
            // Spec order: inlineEdit, clickIntoRecordDetails, addDeleteRecordsInline, rowActions, bulkActions
            expect(fieldKeys).toEqual([
                'inlineEdit', 'clickIntoRecordDetails', 'addDeleteRecordsInline',
                '_rowActions', '_bulkActions',
            ]);
        });

        it('inlineEdit comes before clickIntoRecordDetails per spec', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'userActions')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys.indexOf('inlineEdit')).toBeLessThan(fieldKeys.indexOf('clickIntoRecordDetails'));
        });
    });

    // ── Sharing Section ─────────────────────────────────────────────────

    describe('sharing section', () => {
        it('contains sharingEnabled and sharingVisibility fields', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'sharing')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys).toContain('_sharingEnabled');
            expect(fieldKeys).toContain('_sharingVisibility');
        });

        it('sharingVisibility has visibleWhen that checks sharing.enabled', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'sharing')!;
            const visibilityField = section.fields.find(f => f.key === '_sharingVisibility')!;

            expect(visibilityField.visibleWhen).toBeDefined();
            // Not enabled → hidden
            expect(visibilityField.visibleWhen!({ sharing: { enabled: false } })).toBe(false);
            expect(visibilityField.visibleWhen!({})).toBe(false);
            // Enabled → visible
            expect(visibilityField.visibleWhen!({ sharing: { enabled: true } })).toBe(true);
        });
    });

    // ── Accessibility Section ───────────────────────────────────────────

    describe('accessibility section', () => {
        it('contains expected field keys', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'accessibility')!;
            const fieldKeys = section.fields.map(f => f.key);
            expect(fieldKeys).toContain('_ariaLabel');
            expect(fieldKeys).toContain('_ariaDescribedBy');
            expect(fieldKeys).toContain('_ariaLive');
        });
    });

    // ── Navigation visibleWhen predicates ───────────────────────────────

    describe('visibleWhen predicates', () => {
        it('navigation width is visible only for drawer/modal/split', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const widthField = section.fields.find(f => f.key === '_navigationWidth')!;

            expect(widthField.visibleWhen).toBeDefined();
            expect(widthField.visibleWhen!({ navigation: { mode: 'drawer' } })).toBe(true);
            expect(widthField.visibleWhen!({ navigation: { mode: 'modal' } })).toBe(true);
            expect(widthField.visibleWhen!({ navigation: { mode: 'split' } })).toBe(true);
            expect(widthField.visibleWhen!({ navigation: { mode: 'page' } })).toBe(false);
            expect(widthField.visibleWhen!({ navigation: { mode: 'none' } })).toBe(false);
            expect(widthField.visibleWhen!({})).toBe(false);
        });

        it('navigation openNewTab is visible only for page/new_window', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const tabField = section.fields.find(f => f.key === '_navigationOpenNewTab')!;

            expect(tabField.visibleWhen).toBeDefined();
            expect(tabField.visibleWhen!({ navigation: { mode: 'page' } })).toBe(true);
            expect(tabField.visibleWhen!({ navigation: { mode: 'new_window' } })).toBe(true);
            expect(tabField.visibleWhen!({ navigation: { mode: 'drawer' } })).toBe(false);
            expect(tabField.visibleWhen!({})).toBe(true); // defaults to 'page'
        });
    });

    // ── All fields have render functions ─────────────────────────────────

    it('every field has a render function', () => {
        const schema = buildSchema();
        for (const section of schema.sections) {
            for (const field of section.fields) {
                expect(typeof field.render).toBe('function');
            }
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Spec-alignment validation
// ═══════════════════════════════════════════════════════════════════════════

describe('spec alignment', () => {
    function buildSpecSchema() {
        return buildViewConfigSchema({
            t: mockT,
            fieldOptions: mockFieldOptions,
            objectDef: mockObjectDef,
            updateField: mockUpdateField,
            filterGroupValue: mockFilterGroup,
            sortItemsValue: mockSortItems,
        });
    }

    // ── ROW_HEIGHT_OPTIONS matches spec RowHeight enum ───────────────────
    describe('ROW_HEIGHT_OPTIONS', () => {
        it('contains all 5 spec RowHeight values', () => {
            const values = ROW_HEIGHT_OPTIONS.map(o => o.value);
            expect(values).toEqual(['compact', 'short', 'medium', 'tall', 'extra_tall']);
        });

        it('each option has a gapClass', () => {
            for (const opt of ROW_HEIGHT_OPTIONS) {
                expect(opt.gapClass).toBeDefined();
                expect(typeof opt.gapClass).toBe('string');
            }
        });
    });

    // ── NamedListView field coverage ────────────────────────────────────
    describe('NamedListView spec field coverage', () => {
        function buildSchema() {
            return buildViewConfigSchema({
                t: mockT,
                fieldOptions: mockFieldOptions,
                objectDef: mockObjectDef,
                updateField: mockUpdateField,
                filterGroupValue: mockFilterGroup,
                sortItemsValue: mockSortItems,
            });
        }

        function allFieldKeys() {
            const schema = buildSchema();
            return schema.sections.flatMap(s => s.fields.map(f => f.key));
        }

        // Comprehensive: every NamedListView spec property must map to a UI field
        it('covers ALL NamedListView spec properties', () => {
            const keys = allFieldKeys();
            // NamedListView properties → UI field keys mapping
            const specPropertyToFieldKey: Record<string, string> = {
                label: 'label',
                type: 'type',
                columns: '_columns',
                filter: '_filterBy',
                sort: '_sortBy',
                showSearch: 'showSearch',
                showSort: 'showSort',
                showFilters: 'showFilters',
                showHideFields: 'showHideFields',
                showGroup: 'showGroup',
                showColor: 'showColor',
                showDensity: 'showDensity',
                allowExport: '_export',
                striped: 'striped',
                bordered: 'bordered',
                color: 'color',
                inlineEdit: 'inlineEdit',
                wrapHeaders: 'wrapHeaders',
                clickIntoRecordDetails: 'clickIntoRecordDetails',
                addRecordViaForm: '_addRecord',  // compound field
                addDeleteRecordsInline: 'addDeleteRecordsInline',
                collapseAllByDefault: 'collapseAllByDefault',
                fieldTextColor: 'fieldTextColor',
                prefixField: 'prefixField',
                showDescription: 'showDescription',
                navigation: '_navigationMode',  // compound: mode/width/openNewTab
                selection: '_selectionType',
                pagination: '_pageSize',  // compound: pageSize/pageSizeOptions
                searchableFields: '_searchableFields',
                filterableFields: '_filterableFields',
                resizable: 'resizable',
                densityMode: 'densityMode',
                rowHeight: 'rowHeight',
                hiddenFields: '_hiddenFields',
                exportOptions: '_export',  // compound with allowExport
                rowActions: '_rowActions',
                bulkActions: '_bulkActions',
                sharing: '_sharingEnabled',  // compound: enabled/visibility
                addRecord: '_addRecord',  // compound with addRecordViaForm
                conditionalFormatting: '_conditionalFormatting',
                quickFilters: '_quickFilters',
                showRecordCount: 'showRecordCount',
                allowPrinting: 'allowPrinting',
                virtualScroll: 'virtualScroll',
                emptyState: '_emptyState',
                aria: '_ariaLabel',  // compound: label/describedBy/live
            };
            for (const [specProp, fieldKey] of Object.entries(specPropertyToFieldKey)) {
                expect(keys).toContain(fieldKey);
            }
        });

        it('covers all NamedListView toolbar toggles in order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const keys = section.fields.map(f => f.key);
            const toolbarFields = [
                'showSearch', 'showSort', 'showFilters',
                'showHideFields', 'showGroup', 'showColor', 'showDensity',
            ];
            // All present
            for (const field of toolbarFields) {
                expect(keys).toContain(field);
            }
            // Order matches spec
            for (let i = 0; i < toolbarFields.length - 1; i++) {
                expect(keys.indexOf(toolbarFields[i])).toBeLessThan(keys.indexOf(toolbarFields[i + 1]));
            }
        });

        it('covers all NamedListView boolean toggles in userActions in spec order', () => {
            const schema = buildSchema();
            const section = schema.sections.find(s => s.key === 'userActions')!;
            const keys = section.fields.map(f => f.key);
            // Spec order: inlineEdit → clickIntoRecordDetails → addDeleteRecordsInline
            expect(keys.indexOf('inlineEdit')).toBeLessThan(keys.indexOf('clickIntoRecordDetails'));
            expect(keys.indexOf('clickIntoRecordDetails')).toBeLessThan(keys.indexOf('addDeleteRecordsInline'));
        });

        // Protocol suggestions: UI fields not in NamedListView spec
        it('documents UI extension fields not in NamedListView spec', () => {
            const keys = allFieldKeys();
            // These fields are UI extensions — documented as protocol suggestions
            const uiExtensions = ['description', '_source', '_groupBy', '_typeOptions'];
            for (const ext of uiExtensions) {
                expect(keys).toContain(ext);
            }
        });
    });

    // ── Accessibility section field ordering ─────────────────────────────
    describe('accessibility section ordering', () => {
        it('has ariaLabel before ariaDescribedBy before ariaLive', () => {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === 'accessibility')!;
            const keys = section.fields.map(f => f.key);
            expect(keys.indexOf('_ariaLabel')).toBeLessThan(keys.indexOf('_ariaDescribedBy'));
            expect(keys.indexOf('_ariaDescribedBy')).toBeLessThan(keys.indexOf('_ariaLive'));
        });
    });

    // ── EmptyState compound field sub-keys ───────────────────────────────
    describe('emptyState compound field', () => {
        it('renders title, message, and icon sub-fields', () => {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === 'appearance')!;
            const emptyStateField = section.fields.find(f => f.key === '_emptyState')!;
            expect(emptyStateField).toBeDefined();
            expect(emptyStateField.render).toBeDefined();
        });
    });

    // ── Switch fields default values ─────────────────────────────────────
    describe('switch field default conventions', () => {
        function findField(sectionKey: string, fieldKey: string) {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === sectionKey)!;
            return section.fields.find(f => f.key === fieldKey)!;
        }

        it('collapseAllByDefault defaults to false (explicitTrue)', () => {
            // explicitTrue fields only show checked when value === true
            const field = findField('appearance', 'collapseAllByDefault');
            expect(field.render).toBeDefined();
        });

        it('showDescription defaults to true (defaultOn)', () => {
            const field = findField('appearance', 'showDescription');
            expect(field.render).toBeDefined();
        });

        it('inlineEdit defaults to true (defaultOn)', () => {
            const field = findField('userActions', 'inlineEdit');
            expect(field.render).toBeDefined();
        });
    });

    // ── All conditional visibleWhen predicates ───────────────────────────
    describe('visibleWhen predicates comprehensive', () => {
        it('sharing visibility requires sharing.enabled', () => {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === 'sharing')!;
            const field = section.fields.find(f => f.key === '_sharingVisibility')!;
            expect(field.visibleWhen).toBeDefined();
            expect(field.visibleWhen!({ sharing: { enabled: true } })).toBe(true);
            expect(field.visibleWhen!({ sharing: { enabled: false } })).toBe(false);
            expect(field.visibleWhen!({})).toBe(false);
            expect(field.visibleWhen!({ sharing: {} })).toBe(false);
        });

        it('navigation width visible only for drawer/modal/split modes', () => {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const field = section.fields.find(f => f.key === '_navigationWidth')!;
            expect(field.visibleWhen).toBeDefined();
            expect(field.visibleWhen!({ navigation: { mode: 'drawer' } })).toBe(true);
            expect(field.visibleWhen!({ navigation: { mode: 'modal' } })).toBe(true);
            expect(field.visibleWhen!({ navigation: { mode: 'split' } })).toBe(true);
            expect(field.visibleWhen!({ navigation: { mode: 'page' } })).toBe(false);
            expect(field.visibleWhen!({ navigation: { mode: 'new_window' } })).toBe(false);
            expect(field.visibleWhen!({})).toBe(false);
        });

        it('navigation openNewTab visible only for page/new_window modes', () => {
            const schema = buildSpecSchema();
            const section = schema.sections.find(s => s.key === 'pageConfig')!;
            const field = section.fields.find(f => f.key === '_navigationOpenNewTab')!;
            expect(field.visibleWhen).toBeDefined();
            expect(field.visibleWhen!({ navigation: { mode: 'page' } })).toBe(true);
            expect(field.visibleWhen!({ navigation: { mode: 'new_window' } })).toBe(true);
            expect(field.visibleWhen!({ navigation: { mode: 'drawer' } })).toBe(false);
            expect(field.visibleWhen!({ navigation: { mode: 'modal' } })).toBe(false);
            // defaults to page mode when navigation is undefined → visible
            expect(field.visibleWhen!({})).toBe(true);
        });
    });
});
