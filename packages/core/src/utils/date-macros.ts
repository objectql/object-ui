/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Resolve well-known relative-date placeholders inside a filter object so
 * both server-side aggregation and client-side `find()` calls see a real
 * ISO date string instead of a literal `{current_quarter_start}`.
 *
 * Supported tokens (case-sensitive, both `{token}` and `${token}` forms):
 *   - today                      → start of today          (YYYY-MM-DD)
 *   - now                        → current timestamp       (full ISO)
 *   - current_week_start         → Monday 00:00 of this week
 *   - current_month_start        → 1st 00:00 of this month
 *   - current_quarter_start      → 1st 00:00 of this quarter
 *   - current_year_start         → Jan 1 00:00 of this year
 *   - last_week_start            → Monday 00:00 of previous week
 *   - last_month_start           → 1st 00:00 of previous month
 *   - last_quarter_start         → 1st 00:00 of previous quarter
 *   - last_year_start            → Jan 1 00:00 of previous year
 *
 * Walks any plain-object / array structure recursively. Non-string values
 * (and unknown tokens) are passed through untouched.
 */
export function resolveDateMacros<T = any>(filter: T, now: Date = new Date()): T {
  if (filter == null) return filter;

  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const isoDate = (d: Date) => {
    const x = startOfDay(d);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const startOfWeek = (d: Date) => {
    const x = startOfDay(d);
    const day = x.getDay(); // 0=Sun, 1=Mon, ...
    const diff = (day + 6) % 7; // distance back to Monday
    x.setDate(x.getDate() - diff);
    return x;
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const startOfQuarter = (d: Date) => {
    const q = Math.floor(d.getMonth() / 3);
    return new Date(d.getFullYear(), q * 3, 1);
  };
  const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
  const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

  const macros: Record<string, () => string> = {
    today: () => isoDate(now),
    now: () => now.toISOString(),
    current_week_start: () => isoDate(startOfWeek(now)),
    current_month_start: () => isoDate(startOfMonth(now)),
    current_quarter_start: () => isoDate(startOfQuarter(now)),
    current_year_start: () => isoDate(startOfYear(now)),
    last_week_start: () => {
      const w = startOfWeek(now);
      w.setDate(w.getDate() - 7);
      return isoDate(w);
    },
    last_month_start: () => isoDate(addMonths(startOfMonth(now), -1)),
    last_quarter_start: () => isoDate(addMonths(startOfQuarter(now), -3)),
    last_year_start: () => isoDate(new Date(now.getFullYear() - 1, 0, 1)),
  };

  const tokenRe = /\$?\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  const walk = (value: any): any => {
    if (value == null) return value;
    if (typeof value === 'string') {
      const wholeMatch = value.match(/^\$?\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/);
      if (wholeMatch && macros[wholeMatch[1]]) return macros[wholeMatch[1]]();
      let touched = false;
      const replaced = value.replace(tokenRe, (m, tok) => {
        if (macros[tok]) { touched = true; return macros[tok](); }
        return m;
      });
      return touched ? replaced : value;
    }
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(value)) out[k] = walk((value as any)[k]);
      return out;
    }
    return value;
  };

  return walk(filter) as T;
}
