/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Action Runner
 * 
 * Executes actions defined in ActionSchema and EventHandler.
 */

import { ExpressionEvaluator } from '../evaluator/ExpressionEvaluator';

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  reload?: boolean;
  close?: boolean;
  redirect?: string;
}

export interface ActionContext {
  data?: Record<string, any>;
  record?: any;
  user?: any;
  [key: string]: any;
}

export type ActionHandler = (
  action: any,
  context: ActionContext
) => Promise<ActionResult> | ActionResult;

export class ActionRunner {
  private handlers = new Map<string, ActionHandler>();
  private evaluator: ExpressionEvaluator;
  private context: ActionContext;

  constructor(context: ActionContext = {}) {
    this.context = context;
    this.evaluator = new ExpressionEvaluator(context);
  }

  registerHandler(actionName: string, handler: ActionHandler): void {
    this.handlers.set(actionName, handler);
  }

  async execute(action: any): Promise<ActionResult> {
    try {
      if (action.condition) {
        const shouldExecute = this.evaluator.evaluateCondition(action.condition);
        if (!shouldExecute) {
          return { success: false, error: 'Action condition not met' };
        }
      }

      if (action.disabled) {
        const isDisabled = typeof action.disabled === 'string'
          ? this.evaluator.evaluateCondition(action.disabled)
          : action.disabled;
        
        if (isDisabled) {
          return { success: false, error: 'Action is disabled' };
        }
      }

      if (action.type === 'action' || action.actionType) {
        return await this.executeActionSchema(action);
      } else if (action.type === 'navigation' || action.navigate) {
        return await this.executeNavigation(action);
      } else if (action.type === 'api' || action.api) {
        return await this.executeAPI(action);
      } else if (action.onClick) {
        await action.onClick();
        return { success: true };
      }

      return { success: false, error: 'Unknown action type' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private async executeActionSchema(action: any): Promise<ActionResult> {
    const result: ActionResult = { success: true };

    if (action.confirmText) {
      const confirmed = await this.showConfirmation(action.confirmText);
      if (!confirmed) {
        return { success: false, error: 'Action cancelled by user' };
      }
    }

    if (action.api) {
      const apiResult = await this.executeAPI(action);
      if (!apiResult.success) return apiResult;
      result.data = apiResult.data;
    }

    if (action.onClick) {
      await action.onClick();
    }

    result.reload = action.reload !== false;
    result.close = action.close !== false;

    if (action.redirect) {
      result.redirect = this.evaluator.evaluate(action.redirect) as string;
    }

    return result;
  }

  /**
   * Execute navigation action
   */
  private async executeNavigation(action: any): Promise<ActionResult> {
    const nav = action.navigate || action;
    const to = this.evaluator.evaluate(nav.to) as string;

    if (nav.external) {
      window.open(to, '_blank', 'noopener,noreferrer');
    } else {
      return { success: true, redirect: to };
    }

    return { success: true };
  }

  private async executeAPI(action: any): Promise<ActionResult> {
    const apiConfig = action.api;
    
    if (typeof apiConfig === 'string') {
      try {
        const response = await fetch(apiConfig, {
          method: action.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.context.data || {})
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }

    return { success: false, error: 'Complex API configuration not yet implemented' };
  }

  private async showConfirmation(message: string): Promise<boolean> {
    const evaluatedMessage = this.evaluator.evaluate(message) as string;
    return window.confirm(evaluatedMessage);
  }

  updateContext(newContext: Partial<ActionContext>): void {
    this.context = { ...this.context, ...newContext };
    this.evaluator.updateContext(newContext);
  }

  getContext(): ActionContext {
    return this.context;
  }
}

export async function executeAction(
  action: any,
  context: ActionContext = {}
): Promise<ActionResult> {
  const runner = new ActionRunner(context);
  return await runner.execute(action);
}
