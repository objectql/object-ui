/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from './types';
import { bridgeListView } from './bridges/list-view';
import { bridgeFormView } from './bridges/form-view';
import { bridgePage } from './bridges/page';
import { bridgeDashboard } from './bridges/dashboard';

export class SpecBridge {
  private bridges = new Map<string, BridgeFn>();
  private context: BridgeContext;

  constructor(context: BridgeContext = {}) {
    this.context = context;
    this.register('list', bridgeListView);
    this.register('form', bridgeFormView);
    this.register('page', bridgePage);
    this.register('dashboard', bridgeDashboard);
  }

  register(specType: string, bridge: BridgeFn): void {
    this.bridges.set(specType, bridge);
  }

  /** Transform a spec schema into a SchemaNode tree */
  transform(specType: string, spec: any): SchemaNode {
    const bridge = this.bridges.get(specType);
    if (!bridge) {
      throw new Error(`No bridge registered for spec type: ${specType}`);
    }
    return bridge(spec, this.context);
  }

  /** Transform a ListView spec */
  transformListView(spec: any): SchemaNode {
    return this.transform('list', spec);
  }

  /** Transform a FormView spec */
  transformFormView(spec: any): SchemaNode {
    return this.transform('form', spec);
  }

  /** Transform a Page spec */
  transformPage(spec: any): SchemaNode {
    return this.transform('page', spec);
  }

  /** Transform a Dashboard spec */
  transformDashboard(spec: any): SchemaNode {
    return this.transform('dashboard', spec);
  }

  updateContext(ctx: Partial<BridgeContext>): void {
    this.context = { ...this.context, ...ctx };
  }
}
