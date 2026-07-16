/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Action Engine
 * 
 * Declarative action dispatch engine. Manages action registration,
 * event-to-action mapping, location-based filtering, keyboard shortcuts,
 * and bulk operation support.
 * 
 * Replaces callback-based patterns with a schema-driven pipeline:
 *   ActionSchema[] → ActionEngine → ActionRunner → ActionResult
 */

import { ActionRunner, type ActionDef, type ActionContext, type ActionResult } from './ActionRunner';

/**
 * Action location types — re-exported from `@objectstack/spec/ui` so the
 * platform has one source of truth (`ACTION_LOCATIONS`). Do NOT redeclare
 * this enum locally; add new values in
 * `framework/packages/spec/src/ui/action.zod.ts` and they propagate here
 * automatically.
 */
export type { ActionLocation } from '@object-ui/types';
export { ACTION_LOCATIONS } from '@object-ui/types';
import type { ActionLocation } from '@object-ui/types';

/** Registered action with metadata */
export interface RegisteredAction {
  action: ActionDef;
  locations: ActionLocation[];
  /** Keyboard shortcut (e.g., 'ctrl+s', 'meta+k') */
  shortcut?: string;
  /** Whether this action supports bulk operations */
  bulkEnabled?: boolean;
  /** Priority for ordering (lower = first) */
  priority?: number;
}

/** Event-to-action mapping */
export interface ActionMapping {
  /** Event name (e.g., 'row:click', 'toolbar:save', 'keyboard:ctrl+s') */
  event: string;
  /** Action name to execute */
  actionName: string;
  /** Optional condition expression */
  condition?: string;
}

/** Keyboard shortcut handler */
export interface ShortcutBinding {
  /** Key combination (e.g., 'ctrl+s', 'meta+k', 'shift+n') */
  keys: string;
  /** Action name to trigger */
  actionName: string;
}

/** Normalize a shortcut string for comparison (lowercase, trimmed, sorted parts) */
function normalizeShortcut(keys: string): string {
  return keys.toLowerCase().split('+').map(k => k.trim()).sort().join('+');
}

/** De-dupe key set so a broken predicate warns once, not every re-render. */
const _warnedPredicates = new Set<string>();

/**
 * Surface an action whose `visible` predicate threw (and was therefore
 * fail-closed hidden). Almost always an authoring bug — typically a bare field
 * reference that should be `record.<field>`. Warned once per predicate.
 */
function warnHiddenPredicate(name: unknown, raw: unknown, err: unknown): void {
  const src = typeof raw === 'string'
    ? raw
    : (raw && typeof raw === 'object' && typeof (raw as any).source === 'string' ? (raw as any).source : String(raw));
  const key = `${String(name)}::${src}`;
  if (_warnedPredicates.has(key)) return;
  _warnedPredicates.add(key);
  const msg = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.warn(
    `[ActionEngine] action "${String(name)}" hidden: its \`visible\` predicate threw — ${msg}. ` +
    `Predicate: ${src}. Action predicates evaluate against { record, recordId, objectName, user, os.user, … }; ` +
    `use \`record.<field>\` (not a bare field).`,
  );
}

export class ActionEngine {
  private actions = new Map<string, RegisteredAction>();
  private mappings: ActionMapping[] = [];
  private shortcuts: ShortcutBinding[] = [];
  private normalizedShortcutMap = new Map<string, string>();
  private runner: ActionRunner;

  /**
   * @param contextOrRunner Either an initial `ActionContext` (constructs a
   *  new local `ActionRunner`) or an existing `ActionRunner` to share.
   *  Sharing is how nested consumers (e.g. `record:quick_actions` inside
   *  an `<ActionProvider>`) inherit the provider's confirm/param/modal/
   *  toast/navigate handlers without redeclaring them — without this,
   *  any action declaring `params: [...]` or `confirmText` would silently
   *  no-op in the nested engine.
   */
  constructor(contextOrRunner: ActionContext | ActionRunner = {}) {
    this.runner =
      contextOrRunner instanceof ActionRunner
        ? contextOrRunner
        : new ActionRunner(contextOrRunner);
  }

  /** Get the underlying ActionRunner for handler configuration */
  getRunner(): ActionRunner {
    return this.runner;
  }

  /** Register a single action */
  registerAction(action: ActionDef, options?: {
    locations?: ActionLocation[];
    shortcut?: string;
    bulkEnabled?: boolean;
    priority?: number;
  }): void {
    const name = action.name || action.type || '';
    if (!name) throw new Error('Action must have a name or type');
    
    this.actions.set(name, {
      action,
      locations: options?.locations || [],
      shortcut: options?.shortcut,
      bulkEnabled: options?.bulkEnabled ?? false,
      priority: options?.priority ?? 100,
    });

    // Auto-register keyboard shortcut
    if (options?.shortcut) {
      this.shortcuts.push({ keys: options.shortcut, actionName: name });
      this.normalizedShortcutMap.set(normalizeShortcut(options.shortcut), name);
    }
  }

  /** Register multiple actions from an ActionSchema array */
  registerActions(actions: ActionDef[]): void {
    for (const action of actions) {
      this.registerAction(action, {
        locations: (action as any).locations,
        shortcut: (action as any).shortcut,
        bulkEnabled: (action as any).bulkEnabled,
      });
    }
  }

  /** Unregister an action by name */
  unregisterAction(name: string): void {
    const registered = this.actions.get(name);
    if (registered?.shortcut) {
      this.normalizedShortcutMap.delete(normalizeShortcut(registered.shortcut));
    }
    this.actions.delete(name);
    this.shortcuts = this.shortcuts.filter(s => s.actionName !== name);
    this.mappings = this.mappings.filter(m => m.actionName !== name);
  }

  /** Add an event-to-action mapping */
  addMapping(mapping: ActionMapping): void {
    this.mappings.push(mapping);
  }

  /**
   * Get actions available at a specific location, sorted by priority.
   *
   * Filtering applied (in order):
   *   1. `locations.includes(location)` — location/region match
   *   2. `action.visible` — evaluated against the runner's current context
   *      ({ record, recordId, objectName, user, … }). Missing or `true`
   *      passes; any other value is coerced to boolean. Evaluator errors
   *      hide the action (fail-closed) rather than throwing — this matches
   *      the contract used by every individual action renderer
   *      (`action-button`, `action-menu`, `action-bar`, …) so the same
   *      action behaves identically whether surfaced via the engine or
   *      consumed standalone.
   *
   *   Predicate normalization matches `@object-ui/react`'s `toPredicateInput`:
   *   raw strings (`'record.foo == true'`) are wrapped as `${...}` so they
   *   evaluate as expressions, not as truthy string literals. Spec-style
   *   `{ dialect, source }` envelopes are unwrapped to their `source`.
   *   Without this, every per-action renderer (which already calls
   *   `toPredicateInput`) and the engine path would disagree on the same
   *   `visible:` predicate.
   */
  getActionsForLocation(location: ActionLocation): ActionDef[] {
    const evaluator = this.runner.getEvaluator();
    return Array.from(this.actions.values())
      .filter(ra => ra.locations.includes(location))
      .filter(ra => {
        // [ADR-0066 D4] Capability gate (UI half — the server enforces the
        // source of truth). Hide an action whose `requiredPermissions` are not
        // ALL held by the caller's `systemPermissions`. Fail-OPEN when
        // systemPermissions is unknown (undefined): the server still 403s, and
        // hiding on missing data is a worse regression than showing a button
        // that errors clearly. Mirrors the App/nav requiredPermissions gate.
        const required = (ra.action as any).requiredPermissions as string[] | undefined;
        if (!Array.isArray(required) || required.length === 0) return true;
        const held = (this.runner.getContext() as any)?.user?.systemPermissions as string[] | undefined;
        if (!Array.isArray(held)) return true;
        return required.every((p) => held.includes(p));
      })
      .filter(ra => {
        const raw = (ra.action as any).visible;
        if (raw == null || raw === '' || raw === true) return true;
        if (raw === false) return false;
        let expr: string | boolean;
        if (typeof raw === 'string') {
          expr = `\${${raw}}`;
        } else if (typeof raw === 'object' && typeof (raw as any).source === 'string') {
          const src = (raw as any).source as string;
          if (!src) return true;
          expr = `\${${src}}`;
        } else {
          expr = Boolean(raw);
        }
        try {
          // `throwOnError: true` is required for fail-closed semantics: the
          // evaluator's default behavior swallows expression errors and
          // returns the raw template string, which `Boolean(string)` then
          // coerces to `true` — silently leaking actions whose preconditions
          // failed (e.g. `ctx` undefined). Surface the error so our catch
          // below can hide the action.
          return evaluator.evaluateCondition(expr as any, { throwOnError: true } as any);
        } catch (err) {
          // Fail-closed: hide the action. But a *thrown* predicate is almost
          // always an authoring bug, not a real precondition — most often a
          // BARE field reference (`done` instead of `record.done`), which is
          // an undeclared variable in the `{ record, recordId, objectName,
          // user }` eval scope. Silently hiding it makes that bug invisible
          // (the #2183 hunt). Warn once per predicate so it is diagnosable
          // without spamming re-renders.
          warnHiddenPredicate((ra.action as any).name, raw, err);
          return false;
        }
      })
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
      .map(ra => ra.action);
  }

  /** Get actions that support bulk operations */
  getBulkActions(): ActionDef[] {
    return Array.from(this.actions.values())
      .filter(ra => ra.bulkEnabled)
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
      .map(ra => ra.action);
  }

  /** Get all registered keyboard shortcuts */
  getShortcuts(): ShortcutBinding[] {
    return [...this.shortcuts];
  }

  /** Get a registered action by name */
  getAction(name: string): ActionDef | undefined {
    return this.actions.get(name)?.action;
  }

  /** Execute an action by name */
  async executeAction(name: string, contextOverride?: Partial<ActionContext>): Promise<ActionResult> {
    const registered = this.actions.get(name);
    if (!registered) {
      return { success: false, error: `Action not found: ${name}` };
    }

    if (contextOverride) {
      this.runner.updateContext(contextOverride);
    }

    return this.runner.execute(registered.action);
  }

  /** Dispatch an event — finds mapped actions and executes them */
  async dispatch(event: string, contextOverride?: Partial<ActionContext>): Promise<ActionResult[]> {
    const matchingMappings = this.mappings.filter(m => m.event === event);
    
    if (matchingMappings.length === 0) {
      return [];
    }

    const results: ActionResult[] = [];
    for (const mapping of matchingMappings) {
      // Check condition if present
      if (mapping.condition) {
        const evaluator = this.runner.getEvaluator();
        const shouldRun = evaluator.evaluateCondition(mapping.condition);
        if (!shouldRun) continue;
      }

      const result = await this.executeAction(mapping.actionName, contextOverride);
      results.push(result);
    }

    return results;
  }

  /** Handle a keyboard shortcut event — returns true if handled */
  async handleShortcut(keys: string, contextOverride?: Partial<ActionContext>): Promise<ActionResult | null> {
    const actionName = this.normalizedShortcutMap.get(normalizeShortcut(keys));
    if (!actionName) return null;
    
    return this.executeAction(actionName, contextOverride);
  }

  /** Execute a bulk operation on multiple records */
  async executeBulk(
    actionName: string,
    records: Record<string, any>[],
    options?: { parallel?: boolean; continueOnError?: boolean }
  ): Promise<{ total: number; succeeded: number; failed: number; results: ActionResult[] }> {
    const registered = this.actions.get(actionName);
    if (!registered) {
      return { total: 0, succeeded: 0, failed: 0, results: [{ success: false, error: `Action not found: ${actionName}` }] };
    }
    if (!registered.bulkEnabled) {
      return { total: 0, succeeded: 0, failed: 0, results: [{ success: false, error: `Action ${actionName} does not support bulk operations` }] };
    }

    const results: ActionResult[] = [];
    let succeeded = 0;
    let failed = 0;

    if (options?.parallel) {
      const promises = records.map(record => {
        this.runner.updateContext({ record, selectedRecords: records });
        return this.runner.execute(registered.action);
      });
      const settled = await Promise.allSettled(promises);
      for (const r of settled) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
          if (r.value.success) succeeded++;
          else failed++;
        } else {
          results.push({ success: false, error: r.reason?.message || 'Unknown error' });
          failed++;
        }
      }
    } else {
      for (const record of records) {
        this.runner.updateContext({ record, selectedRecords: records });
        const result = await this.runner.execute(registered.action);
        results.push(result);
        if (result.success) succeeded++;
        else {
          failed++;
          if (!options?.continueOnError) break;
        }
      }
    }

    return { total: records.length, succeeded, failed, results };
  }

  /** Update the action context */
  updateContext(context: Partial<ActionContext>): void {
    this.runner.updateContext(context);
  }

  /** Clear all registered actions and mappings */
  clear(): void {
    this.actions.clear();
    this.mappings = [];
    this.shortcuts = [];
    this.normalizedShortcutMap.clear();
  }
}
