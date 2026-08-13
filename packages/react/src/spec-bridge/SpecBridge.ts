/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema } from '@object-ui/types';
import type { BridgeContext, BridgeFn } from './types';
import { bridgeListView } from './bridges/list-view';
import { bridgeFormView } from './bridges/form-view';

export class SpecBridge {
  private bridges = new Map<string, BridgeFn>();
  private context: BridgeContext;

  constructor(context: BridgeContext = {}) {
    this.context = context;
    this.register('list', bridgeListView);
    this.register('form', bridgeFormView);
  }

  register(specType: string, bridge: BridgeFn): void {
    this.bridges.set(specType, bridge);
  }

  /**
   * Transform a spec schema into a schema node tree.
   *
   * Returns `BaseSchema` rather than `SchemaNode` — see {@link BridgeFn} for
   * the ruling (objectui#4580 Q4-B) and the measurement behind it. A registered
   * bridge always produces an object; the union only made callers narrow.
   */
  transform(specType: string, spec: any): BaseSchema {
    const bridge = this.bridges.get(specType);
    if (!bridge) {
      throw new Error(`No bridge registered for spec type: ${specType}`);
    }
    return bridge(spec, this.context);
  }

  /** Transform a ListView spec */
  transformListView(spec: any): BaseSchema {
    return this.transform('list', spec);
  }

  /** Transform a FormView spec */
  transformFormView(spec: any): BaseSchema {
    return this.transform('form', spec);
  }

  updateContext(ctx: Partial<BridgeContext>): void {
    this.context = { ...this.context, ...ctx };
  }
}
