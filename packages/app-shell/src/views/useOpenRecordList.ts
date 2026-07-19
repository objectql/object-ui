/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { serializeDrillFilterParams } from './drillUrlFilters';

/**
 * `useOpenRecordList` — the console's implementation of the drill "escape
 * hatch" (`DrillNavigationContext.openRecordList`).
 *
 * Navigates to the object's ADR-0055 bare data surface, scoped by a record
 * filter, using the console's `/apps/:appName/:object/data?filter[...]` route
 * shape. Equality dims serialize to `filter[field]=value`; a date-bucket drill's
 * range serializes to `filter[field][gte]=…&filter[field][lt]=…` (#1752). Wire it
 * into a `DrillNavigationProvider` so the dashboard/report drill drawers can offer
 * "Open in list →" and honor `drillDown.target: 'navigate'`.
 */
export function useOpenRecordList(): (objectName: string, filter?: Record<string, unknown>) => void {
  const navigate = useNavigate();
  const { appName } = useParams<{ appName?: string }>();

  return useCallback(
    (objectName: string, filter?: Record<string, unknown>) => {
      // A date-bucket drill carries an ObjectQL range operator object
      // (`{ $gte, $lt }`); the shared serializer emits it as `filter[field][gte|lt]`
      // (never "[object Object]"). Equality dims stay `filter[field]=value` (#1752).
      const qs = serializeDrillFilterParams(filter).toString();
      const base = appName ? `/apps/${appName}` : '';
      // ADR-0055 bare data surface (`/:object/data`): "the URL is the view" — no
      // saved-view filter is baked in, so the drill scope is exactly these
      // conditions. (The object route stacks URL filters ON TOP of the default
      // view's own filter, which can silently over-narrow a drill.)
      navigate(`${base}/${objectName}/data${qs ? `?${qs}` : ''}`);
    },
    [navigate, appName],
  );
}
