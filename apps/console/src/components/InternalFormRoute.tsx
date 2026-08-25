// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * InternalFormRoute — the element for `/forms/:name`, the AUTHED form surface
 * a `type: 'form'` action navigates to (`ActionRunner.executeForm`).
 *
 * ## Why this wrapper exists (objectui#4109)
 *
 * Maintainer ruling, 2026-08-10, quoted verbatim from objectstack#7245:
 *
 * > **the `type: 'form'` contract means in-shell, and an internal submit lands
 * > on the record.**
 * >
 * > 1. `/forms/:name` in `mode="internal"` nests inside the console shell (keep
 * >    the route — deep-linking survives; the missing chrome is the defect, not
 * >    the navigation).
 *
 * `/forms/:name` was a TOP-LEVEL route, a sibling of the app-shell routes, so
 * clicking an in-app button dropped the user onto a bare form with no header,
 * no navigation and no way back — while the URL still said they were in the
 * console. The route itself was never the problem (deep links to it are
 * legitimate and still work), so it stays exactly where it was; only the chrome
 * around it changes.
 *
 * ## Why `HomeLayout` and not `ConsoleLayout`
 *
 * `/forms/:name` names no app, and this is the console's established chrome for
 * app-INDEPENDENT authed pages: `/home` and `/organizations` both render this
 * same `AppHeader`-over-`main` layout (in `home` and `orgs` variants). It gives
 * the page the product header — brand, workspace switcher, search, inbox,
 * assistant, user menu — i.e. the "navigation" half of the measured defect.
 *
 * `ConsoleLayout` (the one with `UnifiedSidebar` and the breadcrumb) is NOT
 * used here, and the reason is not squeamishness about the extra chrome: it is
 * app-SCOPED by construction. It takes an `activeAppName`/`activeApp` and
 * publishes them as the shell's current app, so mounting it here would have to
 * invent an app for a page that belongs to none — and on a cold deep-link,
 * where nothing has published a current app yet, that invention resolves to
 * whichever app happens to be first. Announcing an arbitrary app's sidebar and
 * breadcrumb around someone's form is a worse answer than no sidebar, and it
 * writes that guess into shared navigation state on the way past. The sidebar
 * half of the defect is therefore left open on #4109 rather than faked; see
 * that card's report for the follow-up.
 */

import { useMemo } from 'react';
import {
  buildExpressionUser,
  DefaultHomeLayout,
  ExpressionProvider,
  useMetadata,
  useNavigationContext,
} from '@object-ui/app-shell';
import { useAuth } from '@object-ui/auth';
import { FormPage } from './FormPage';
import { buildCreatedRecordPath, type HostAppLike } from './createdRecordPath';

export function InternalFormRoute() {
  const { apps } = useMetadata();
  // The app the user is in, or last had open — published by `ConsoleLayout`
  // and kept in `NavigationProvider`, which sits ABOVE the route tree in
  // `ConsoleShell`. So a `type: 'form'` action fired from inside an app still
  // knows which app that was after the client-side hop to this route; a cold
  // deep-link legitimately has nothing here, and the resolver falls through.
  const { currentAppName } = useNavigationContext();
  const { user } = useAuth();

  const recordPath = useMemo(
    () => (objectName: string, recordId: string) =>
      buildCreatedRecordPath(apps as HostAppLike[] | undefined, currentAppName, objectName, recordId),
    [apps, currentAppName],
  );

  // The session principal, in the shape `ExpressionProvider` publishes it. The
  // SAME normaliser `AppContent` uses, imported rather than re-derived: it is
  // what supplies `positions: []` and `role`, and an absent key makes a
  // predicate FAULT (fail-open) instead of resolving false — see #6110.
  const expressionUser = useMemo(() => buildExpressionUser(user), [user]);

  return (
    <ExpressionProvider user={expressionUser}>
      <DefaultHomeLayout userId={user?.id}>
        <FormPage mode="internal" recordPath={recordPath} />
      </DefaultHomeLayout>
    </ExpressionProvider>
  );
}

export default InternalFormRoute;
