// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Registers the `datasource` metadata type as a custom-rendered resource in the
 * metadata-admin engine. datasource is a *side-effectful* type (secret +
 * connection pool + introspection), so it ships a bespoke ListPage that talks
 * to the framework `datasource-admin` REST — but it lives inside the engine
 * (engine route + registry slot + shell), reachable at the engine route
 * `…/metadata/datasource`, instead of a separate hand-written System page.
 *
 * The setup left-nav "Datasources" item still points at the older
 * `…/component/metadata/resource?type=datasource` spelling. That is a legacy
 * *alias*, not this engine route: it renders `LegacyMetadataRedirect`, which
 * 302s onto `…/metadata/datasource` (objectui#3639).
 */

import { registerMetadataResource } from '../registry';
import { DatasourceResourcePage } from './DatasourceResourcePage';

let registered = false;

export function registerDatasourceResource(): void {
  if (registered) return;
  registered = true;
  registerMetadataResource({
    type: 'datasource',
    label: 'Datasources',
    domain: 'data',
    ListPage: DatasourceResourcePage,
  });
}
