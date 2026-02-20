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

/** Action location types (from @objectstack/spec) */
export type ActionLocation =
  | 'list_toolbar'
  | 'list_item'
  | 'record_header'
  | 'record_more'
  | 'record_related'
  | 'global_nav';

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

export class ActionEngine {
  private actions = new Map<string, RegisteredAction>();
  private mappings: ActionMapping[] = [];
  private shortcuts: ShortcutBinding[] = [];
  private normalizedShortcutMap = new Map<string, string>();
  private runner: ActionRunner;

  constructor(context: ActionContext = {}) {
    this.runner = new ActionRunner(context);
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

  /** Get actions available at a specific location, sorted by priority */
  getActionsForLocation(location: ActionLocation): ActionDef[] {
    return Array.from(this.actions.values())
      .filter(ra => ra.locations.includes(location))
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
