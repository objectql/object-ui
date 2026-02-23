/**
 * ViewConfigPanel — Shared Utilities
 *
 * Extracted from ViewConfigPanel to enable reuse across the
 * schema-driven config panel framework.
 */

import type { FilterGroup, SortItem } from '@object-ui/components';

// ---------------------------------------------------------------------------
// Operator mapping: @objectstack/spec ↔ FilterBuilder
// ---------------------------------------------------------------------------

export const SPEC_TO_BUILDER_OP: Record<string, string> = {
    '=': 'equals',
    '==': 'equals',
    '!=': 'notEquals',
    '<>': 'notEquals',
    '>': 'greaterThan',
    '<': 'lessThan',
    '>=': 'greaterOrEqual',
    '<=': 'lessOrEqual',
    'contains': 'contains',
    'not_contains': 'notContains',
    'is_empty': 'isEmpty',
    'is_not_empty': 'isNotEmpty',
    'in': 'in',
    'not_in': 'notIn',
    'not in': 'notIn',
    'before': 'before',
    'after': 'after',
    'between': 'between',
    // Pass-through for already-normalized IDs
    'equals': 'equals',
    'notEquals': 'notEquals',
    'greaterThan': 'greaterThan',
    'lessThan': 'lessThan',
    'greaterOrEqual': 'greaterOrEqual',
    'lessOrEqual': 'lessOrEqual',
    'notContains': 'notContains',
    'isEmpty': 'isEmpty',
    'isNotEmpty': 'isNotEmpty',
    'notIn': 'notIn',
};

export const BUILDER_TO_SPEC_OP: Record<string, string> = {
    'equals': '=',
    'notEquals': '!=',
    'greaterThan': '>',
    'lessThan': '<',
    'greaterOrEqual': '>=',
    'lessOrEqual': '<=',
    'contains': 'contains',
    'notContains': 'not_contains',
    'isEmpty': 'is_empty',
    'isNotEmpty': 'is_not_empty',
    'in': 'in',
    'notIn': 'not in',
    'before': 'before',
    'after': 'after',
    'between': 'between',
};

// ---------------------------------------------------------------------------
// Field type normalization: ObjectUI → FilterBuilder
// ---------------------------------------------------------------------------

export function normalizeFieldType(rawType?: string): 'text' | 'number' | 'boolean' | 'date' | 'select' {
    const t = (rawType || '').toLowerCase();
    if (['integer', 'int', 'float', 'double', 'number', 'currency', 'money', 'percent', 'rating'].includes(t)) return 'number';
    if (['date', 'datetime', 'datetime_tz', 'timestamp'].includes(t)) return 'date';
    if (['boolean', 'bool', 'checkbox', 'switch'].includes(t)) return 'boolean';
    if (['select', 'picklist', 'single_select', 'multi_select', 'enum'].includes(t)) return 'select';
    return 'text';
}

// ---------------------------------------------------------------------------
// Spec-style filter bridge
// ---------------------------------------------------------------------------

function parseTriplet(arr: any[]): { id: string; field: string; operator: string; value: any } | null {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    const [field, op, value] = arr;
    if (typeof field !== 'string' || typeof op !== 'string') return null;
    return {
        id: crypto.randomUUID(),
        field,
        operator: SPEC_TO_BUILDER_OP[op] || op,
        value: value ?? '',
    };
}

function parseSingleOrNested(item: any): Array<{ id: string; field: string; operator: string; value: any }> {
    if (Array.isArray(item)) {
        const triplet = parseTriplet(item);
        return triplet ? [triplet] : [];
    }
    if (typeof item === 'object' && item !== null && item.field) {
        return [{
            id: item.id || crypto.randomUUID(),
            field: item.field,
            operator: SPEC_TO_BUILDER_OP[item.operator] || item.operator || 'equals',
            value: item.value ?? '',
        }];
    }
    return [];
}

export function parseSpecFilter(raw: any): { logic: 'and' | 'or'; conditions: Array<{ id: string; field: string; operator: string; value: any }> } {
    if (!Array.isArray(raw) || raw.length === 0) {
        return { logic: 'and', conditions: [] };
    }

    // Detect ['and', ...conditions] or ['or', ...conditions]
    if (typeof raw[0] === 'string' && (raw[0] === 'and' || raw[0] === 'or')) {
        const logic = raw[0] as 'and' | 'or';
        const rest = raw.slice(1);
        const conditions = rest.flatMap((item: any) => parseSingleOrNested(item));
        return { logic, conditions };
    }

    // Detect single triplet: ['field', '=', value] (all primitives at top level)
    if (raw.length >= 2 && raw.length <= 3 && typeof raw[0] === 'string' && typeof raw[1] === 'string' && !Array.isArray(raw[0])) {
        // Check it's not an array of arrays
        if (!Array.isArray(raw[2])) {
            const cond = parseTriplet(raw);
            return { logic: 'and', conditions: cond ? [cond] : [] };
        }
    }

    // Detect array of conditions: [[...], [...]] or [{...}, {...}]
    if (Array.isArray(raw[0]) || (typeof raw[0] === 'object' && raw[0] !== null && !Array.isArray(raw[0]))) {
        const conditions = raw.flatMap((item: any) => parseSingleOrNested(item));
        return { logic: 'and', conditions };
    }

    // Fallback: try as single triplet
    const cond = parseTriplet(raw);
    return { logic: 'and', conditions: cond ? [cond] : [] };
}

/**
 * Convert FilterGroup conditions back to spec-style filter array.
 */
export function toSpecFilter(logic: 'and' | 'or', conditions: Array<{ field: string; operator: string; value: any }>): any[] {
    const triplets = conditions
        .filter(c => c.field) // skip empty
        .map(c => [c.field, BUILDER_TO_SPEC_OP[c.operator] || c.operator, c.value]);

    if (triplets.length === 0) return [];
    if (triplets.length === 1 && logic === 'and') return triplets[0];
    if (logic === 'or') return ['or', ...triplets];
    return triplets;
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/** Parse comma-separated string to trimmed non-empty string array */
export function parseCommaSeparated(input: string): string[] {
    return input.split(',').map(s => s.trim()).filter(Boolean);
}

/** Parse comma-separated string to positive number array */
export function parseNumberList(input: string): number[] {
    return input.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** View type labels for display */
export const VIEW_TYPE_LABELS: Record<string, string> = {
    grid: 'Grid',
    kanban: 'Kanban',
    calendar: 'Calendar',
    gallery: 'Gallery',
    timeline: 'Timeline',
    gantt: 'Gantt',
    map: 'Map',
    chart: 'Chart',
};

/** All available view type keys */
export const VIEW_TYPE_OPTIONS = Object.keys(VIEW_TYPE_LABELS);

/** Row height options with Tailwind gap classes for visual icons */
export const ROW_HEIGHT_OPTIONS: Array<{ value: string; gapClass: string }> = [
    { value: 'compact', gapClass: 'gap-0' },
    { value: 'medium', gapClass: 'gap-0.5' },
    { value: 'tall', gapClass: 'gap-1' },
];

// ---------------------------------------------------------------------------
// Field options derivation
// ---------------------------------------------------------------------------

export interface FieldOption {
    value: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'select';
    options?: any[];
}

/** Derive field options from an objectDef for FilterBuilder/SortBuilder/Selects */
export function deriveFieldOptions(objectDef: { fields?: Record<string, any> }): FieldOption[] {
    if (!objectDef.fields) return [];
    return Object.entries(objectDef.fields).map(([key, field]: [string, any]) => ({
        value: key,
        label: field.label || key,
        type: normalizeFieldType(field.type),
        options: field.options,
    }));
}

/** Convert draft filter → FilterGroup for FilterBuilder */
export function toFilterGroup(draftFilter: any): FilterGroup {
    const parsed = parseSpecFilter(draftFilter);
    return { id: 'root', logic: parsed.logic, conditions: parsed.conditions };
}

/** Convert draft sort → SortItem[] for SortBuilder */
export function toSortItems(draftSort: any): SortItem[] {
    return (Array.isArray(draftSort) ? draftSort : []).map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        field: s.field || '',
        order: (s.order || s.direction || 'asc') as 'asc' | 'desc',
    }));
}
