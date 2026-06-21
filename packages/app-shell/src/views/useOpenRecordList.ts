/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * `useOpenRecordList` — the console's implementation of the drill "escape
 * hatch" (`DrillNavigationContext.openRecordList`).
 *
 * Navigates to an object's full list page, scoped by a record filter, using the
 * console's `/apps/:appName/:object?filter[field]=value` route shape (the same
 * format `ReportView`'s drill navigation uses). Wire it into a
 * `DrillNavigationProvider` so the dashboard/report drill drawers can offer
 * "Open in list →" and honor `drillDown.target: 'navigate'`.
 */
export function useOpenRecordList(): (objectName: string, filter?: Record<string, unknown>) => void {
  const navigate = useNavigate();
  const { appName } = useParams<{ appName?: string }>();

  return useCallback(
    (objectName: string, filter?: Record<string, unknown>) => {
      const params = new URLSearchParams();
      if (filter) {
        for (const [field, value] of Object.entries(filter)) {
          if (value == null) continue;
          params.set(`filter[${field}]`, String(value));
        }
      }
      const qs = params.toString();
      const base = appName ? `/apps/${appName}` : '';
      navigate(`${base}/${objectName}${qs ? `?${qs}` : ''}`);
    },
    [navigate, appName],
  );
}
