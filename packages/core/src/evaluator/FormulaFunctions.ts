/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Formula Functions
 * 
 * Built-in formula functions available in expressions.
 * Provides common aggregation, date, string, math, and logic functions
 * that can be used inside ${...} template expressions.
 * 
 * @example
 * ```ts
 * // In expressions:
 * "${SUM(data.items, 'price')}"          // Sum a field across an array
 * "${IF(data.age >= 18, 'Adult', 'Minor')}" // Conditional
 * "${TODAY()}"                           // Current date
 * "${UPPER(data.name)}"                 // String transform
 * ```
 * 
 * @module evaluator
 * @packageDocumentation
 */

// ─── Aggregation Functions ───────────────────────────────────────────────────

/**
 * Sum numeric values in an array, optionally by field path
 */
export function SUM(arr: any[], field?: string): number {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, item) => {
    const val = field ? getNestedValue(item, field) : item;
    return acc + (typeof val === 'number' ? val : parseFloat(val) || 0);
  }, 0);
}

/**
 * Calculate the average of numeric values in an array
 */
export function AVG(arr: any[], field?: string): number {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return SUM(arr, field) / arr.length;
}

/**
 * Find the minimum value in an array
 */
export function MIN(arr: any[], field?: string): number {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const values = arr.map(item => {
    const val = field ? getNestedValue(item, field) : item;
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  });
  return Math.min(...values);
}

/**
 * Find the maximum value in an array
 */
export function MAX(arr: any[], field?: string): number {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const values = arr.map(item => {
    const val = field ? getNestedValue(item, field) : item;
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  });
  return Math.max(...values);
}

/**
 * Count items in an array, optionally filtering by a field being truthy
 */
export function COUNT(arr: any[], field?: string): number {
  if (!Array.isArray(arr)) return 0;
  if (!field) return arr.length;
  return arr.filter(item => {
    const val = getNestedValue(item, field);
    return val !== null && val !== undefined && val !== '' && val !== false;
  }).length;
}

// ─── Date Functions ──────────────────────────────────────────────────────────

/**
 * Returns today's date as an ISO date string (YYYY-MM-DD)
 */
export function TODAY(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns the current date and time as an ISO string
 */
export function NOW(): string {
  return new Date().toISOString();
}

/**
 * Extract the year from a date string or Date object
 */
export function YEAR(dateStr: string | Date): number {
  return new Date(dateStr).getFullYear();
}

/**
 * Extract the month (1-12) from a date string or Date object
 */
export function MONTH(dateStr: string | Date): number {
  return new Date(dateStr).getMonth() + 1;
}

/**
 * Extract the day of month from a date string or Date object
 */
export function DAY(dateStr: string | Date): number {
  return new Date(dateStr).getDate();
}

/**
 * Calculate the difference in days between two dates
 */
export function DATEDIFF(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diff = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date and return ISO date string
 */
export function DATEADD(dateStr: string | Date, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// ─── Logic Functions ─────────────────────────────────────────────────────────

/**
 * Conditional expression: IF(condition, trueValue, falseValue)
 */
export function IF<T, U>(condition: boolean, trueValue: T, falseValue: U): T | U {
  return condition ? trueValue : falseValue;
}

/**
 * Return the first non-null/undefined value
 */
export function COALESCE(...args: any[]): any {
  for (const arg of args) {
    if (arg !== null && arg !== undefined) {
      return arg;
    }
  }
  return null;
}

/**
 * Logical AND — returns true if all arguments are truthy
 */
export function AND(...args: any[]): boolean {
  return args.every(Boolean);
}

/**
 * Logical OR — returns true if any argument is truthy
 */
export function OR(...args: any[]): boolean {
  return args.some(Boolean);
}

/**
 * Logical NOT
 */
export function NOT(value: any): boolean {
  return !value;
}

/**
 * Switch/case-like function: SWITCH(expr, case1, value1, case2, value2, ..., defaultValue?)
 */
export function SWITCH(expr: any, ...cases: any[]): any {
  for (let i = 0; i < cases.length - 1; i += 2) {
    if (expr === cases[i]) {
      return cases[i + 1];
    }
  }
  // If odd number of case args, last one is the default
  if (cases.length % 2 !== 0) {
    return cases[cases.length - 1];
  }
  return undefined;
}

// ─── String Functions ────────────────────────────────────────────────────────

/**
 * Convert string to uppercase
 */
export function UPPER(str: string): string {
  return String(str ?? '').toUpperCase();
}

/**
 * Convert string to lowercase
 */
export function LOWER(str: string): string {
  return String(str ?? '').toLowerCase();
}

/**
 * Trim whitespace from both ends
 */
export function TRIM(str: string): string {
  return String(str ?? '').trim();
}

/**
 * Concatenate strings
 */
export function CONCAT(...args: any[]): string {
  return args.map(a => String(a ?? '')).join('');
}

/**
 * Get the length of a string or array
 */
export function LEN(value: string | any[]): number {
  if (Array.isArray(value)) return value.length;
  return String(value ?? '').length;
}

/**
 * Extract a substring
 */
export function SUBSTRING(str: string, start: number, length?: number): string {
  const s = String(str ?? '');
  if (length !== undefined) {
    return s.substring(start, start + length);
  }
  return s.substring(start);
}

/**
 * Check if a string contains a substring (case-insensitive)
 */
export function CONTAINS(str: string, search: string): boolean {
  return String(str ?? '').toLowerCase().includes(String(search ?? '').toLowerCase());
}

// ─── Math Functions ──────────────────────────────────────────────────────────

/**
 * Round a number to specified decimal places
 */
export function ROUND(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value ?? 0) * factor) / factor;
}

/**
 * Round down to specified decimal places
 */
export function FLOOR(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor((value ?? 0) * factor) / factor;
}

/**
 * Round up to specified decimal places
 */
export function CEIL(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil((value ?? 0) * factor) / factor;
}

/**
 * Get absolute value
 */
export function ABS(value: number): number {
  return Math.abs(value ?? 0);
}

/**
 * Calculate power
 */
export function POWER(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

// ─── Format Functions ────────────────────────────────────────────────────────

/**
 * Format a number with a fixed number of decimal places
 */
export function FIXED(value: number, decimals = 2): string {
  return (value ?? 0).toFixed(decimals);
}

/**
 * Format a number as a percentage string
 */
export function PERCENT(value: number, decimals = 0): string {
  return `${ROUND((value ?? 0) * 100, decimals)}%`;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Get a nested value from an object by dot-separated path
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    return current && typeof current === 'object' ? current[key] : undefined;
  }, obj);
}

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * All built-in formula functions as a record.
 * This is injected into the expression evaluation context.
 */
export const FORMULA_FUNCTIONS: Record<string, (...args: any[]) => any> = {
  // Aggregation
  SUM,
  AVG,
  MIN,
  MAX,
  COUNT,
  // Date
  TODAY,
  NOW,
  YEAR,
  MONTH,
  DAY,
  DATEDIFF,
  DATEADD,
  // Logic
  IF,
  COALESCE,
  AND,
  OR,
  NOT,
  SWITCH,
  // String
  UPPER,
  LOWER,
  TRIM,
  CONCAT,
  LEN,
  SUBSTRING,
  CONTAINS,
  // Math
  ROUND,
  FLOOR,
  CEIL,
  ABS,
  POWER,
  // Format
  FIXED,
  PERCENT,
};
