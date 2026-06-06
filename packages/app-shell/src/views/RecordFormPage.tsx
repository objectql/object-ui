/**
 * RecordFormPage Component
 *
 * Renders a full-screen create or edit page for a record. This is the
 * page-mode counterpart to the global `ModalForm` mounted by `AppContent`
 * for objects whose metadata declares `editMode: 'page'`.
 *
 * Routes (mounted by `AppContent`):
 *   - `/apps/:appName/:objectName/new`              — create mode
 *   - `/apps/:appName/:objectName/record/:recordId/edit` — edit mode
 *
 * Behavior:
 *   - Resolves the object definition via `useMetadata()`. While metadata is
 *     still loading the page renders a `SkeletonDetail` to avoid a flash of
 *     "Object Not Found".
 *   - Delegates form rendering and data fetching to `<ObjectForm>` from
 *     `@object-ui/plugin-form` with `formType: 'simple'`. ObjectForm itself
 *     fetches the existing record (in edit mode) via `dataSource.findOne`,
 *     so this page does not need to manage its own loading state for
 *     record data.
 *   - On success / cancel, navigates back if the user has history, otherwise
 *     falls back to a sensible parent route (record detail in edit mode,
 *     object list in create mode). Cancel always navigates back without a
 *     toast.
 *   - Wraps the form in a sticky page header (back button + title) for a
 *     consistent full-screen chrome.
 *
 * @module views/RecordFormPage
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ObjectForm } from '@object-ui/plugin-form';
import { Button, Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { ArrowLeft, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';
import { useAdapter } from '../providers/AdapterProvider';
import { ExpressionProvider, evaluateVisibility } from '../providers/ExpressionProvider';
import { SkeletonDetail } from '../skeletons';
import { ManagedByBadge } from '../components/ManagedByBadge';
import { useAuth } from '@object-ui/auth';
import { ExpressionEvaluator } from '@object-ui/core';

export interface RecordFormPageProps {
  /** Form mode — `'create'` for the `/new` route, `'edit'` for the `/edit` route. */
  mode: 'create' | 'edit';
}

/**
 * Full-screen record create/edit page.
 *
 * Reads `:objectName` (and `:recordId` when editing) from the URL and
 * resolves the object definition. Renders an `<ObjectForm>` configured with
 * `formType: 'simple'` (i.e. a flat in-page form), wrapped in a page header
 * that mirrors the look of `RecordDetailView`.
 */
export function RecordFormPage({ mode }: RecordFormPageProps) {
  const { appName, objectName, recordId } = useParams<{
    appName: string;
    objectName: string;
    recordId: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dataSource = useAdapter();
  const { objects, loading: metadataLoading } = useMetadata();
  const { t } = useObjectTranslation();
  const { objectLabel } = useObjectLabel();
  const { user, getAuthConfig } = useAuth();

  // Pull deployment-level feature flags so action visibility predicates
  // (e.g. `features.multiOrgEnabled != false` on sys_organization's create
  // action) can see them inside the nested ExpressionProvider below.
  const [features, setFeatures] = useState<Record<string, any>>({});
  useEffect(() => {
    let cancelled = false;
    getAuthConfig()
      .then(cfg => { if (!cancelled) setFeatures(cfg?.features ?? {}); })
      .catch(() => { /* leave empty — predicates default to visible */ });
    return () => { cancelled = true; };
  }, [getAuthConfig]);

  /**
   * Query-string prefills for create mode. Used by related-list "+ New"
   * buttons that pass the parent record id as a `<referenceField>=<id>`
   * pair so the new child record is auto-linked back to the parent.
   * Stable identity: only changes when the actual search string changes.
   */
  const prefillValues = useMemo<Record<string, string> | undefined>(() => {
    if (mode !== 'create') return undefined;
    const entries: Array<[string, string]> = [];
    for (const [k, v] of searchParams.entries()) {
      if (k && v) entries.push([k, v]);
    }
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, searchParams.toString()]);

  const objectDef = useMemo(
    () => objects.find((o: any) => o.name === objectName),
    [objects, objectName],
  );

  const baseUrl = `/apps/${appName}`;
  const objectListUrl = `${baseUrl}/${objectName}`;
  const recordDetailUrl =
    mode === 'edit' && recordId
      ? `${baseUrl}/${objectName}/record/${encodeURIComponent(recordId)}`
      : objectListUrl;

  /**
   * Navigate back to the most relevant location.
   * Prefer `history.back()` so users return to the exact list/view they came
   * from (preserving filters, scroll position, etc.). Fall back to the
   * record detail (edit mode) or list (create mode) when there is no
   * history entry — happens on direct/refreshed loads of the URL.
   */
  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(recordDetailUrl, { replace: true });
    }
  }, [navigate, recordDetailUrl]);

  const label = objectDef ? objectLabel(objectDef as any) : objectName ?? '';
  const pageTitle =
    mode === 'create'
      ? t('form.createTitle', { object: label, defaultValue: `New ${label}` })
      : t('form.editTitle', { object: label, defaultValue: `Edit ${label}` });

  const handleSuccess = useCallback(() => {
    toast.success(
      mode === 'create'
        ? t('form.createSuccess', {
            object: label,
            defaultValue: `${label} created successfully`,
          })
        : t('form.updateSuccess', {
            object: label,
            defaultValue: `${label} updated successfully`,
          }),
    );
    goBack();
  }, [mode, t, label, goBack]);

  const handleCancel = useCallback(() => {
    goBack();
  }, [goBack]);

  // Authenticated-user descriptor — shared by the ExpressionEvaluator (used
  // for field-visibility expression evaluation) and the ExpressionProvider
  // wrapping the form (which exposes the same descriptor to descendant
  // expression consumers). Memoised on the underlying user identity so a
  // re-render that doesn't change the user does not invalidate downstream
  // memoisations.
  const expressionUser = useMemo(
    () =>
      user
        ? { name: user.name, email: user.email, role: user.role ?? 'user' }
        : { name: 'Anonymous', email: '', role: 'guest' },
    [user],
  );

  // Build expression evaluator for field-visibility expressions, mirroring
  // the global ModalForm setup in AppContent.
  const expressionEvaluator = useMemo(
    () =>
      new ExpressionEvaluator({
        // expressionUser already handles the anonymous fallback, so we can
        // pass it through unconditionally.
        user: expressionUser,
        app: { name: appName },
        data: {},
      }),
    [expressionUser, appName],
  );

  // Resolve the field list using the same visibility-aware logic as the
  // ModalForm in AppContent so page-mode and modal-mode show the same
  // fields for a given user.
  const fields = useMemo(() => {
    if (!objectDef?.fields) return [];
    if (Array.isArray(objectDef.fields)) {
      return (objectDef.fields as any[])
        .filter((f: any) => {
          if (typeof f === 'string') return true;
          return evaluateVisibility(f.visible, expressionEvaluator);
        })
        .map((f: any) => (typeof f === 'string' ? f : f.name));
    }
    return Object.entries(objectDef.fields as Record<string, any>)
      .filter(([, f]) => evaluateVisibility(f.visible, expressionEvaluator))
      .map(([key]) => key);
  }, [objectDef, expressionEvaluator]);

  // Show skeleton while metadata is still loading rather than the
  // "Object Not Found" empty state — otherwise direct/refreshed loads of
  // the URL flash an error before the metadata resolves.
  if (metadataLoading) {
    return <SkeletonDetail />;
  }

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.objectNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('empty.objectNotFoundDescription', { name: objectName })}
          </EmptyDescription>
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate(baseUrl)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('empty.back')}
            </Button>
          </div>
        </Empty>
      </div>
    );
  }

  return (
    <ExpressionProvider user={expressionUser} app={{ name: appName }} data={{}} features={features}>
      <div
        className="flex flex-col h-full overflow-hidden bg-background"
        data-testid="record-form-page"
        data-mode={mode}
      >
        {/* Sticky header with back button + breadcrumb + title */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            data-testid="record-form-page-back"
            aria-label={t('common.back', { defaultValue: 'Back' })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              to={objectListUrl}
              className="hover:text-foreground transition-colors"
            >
              {label}
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground font-medium" data-testid="record-form-page-title">
              {pageTitle}
            </span>
            {/* Lifecycle bucket badge — see ManagedByBadge.
                Forms additionally disable inputs for non-`platform`
                buckets via ObjectForm's own readOnly resolution. */}
            <ManagedByBadge
              managedBy={(objectDef as any)?.managedBy}
              className="ml-1"
            />
          </nav>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">
            <ObjectForm
              key={`${mode}:${objectName}:${recordId ?? 'new'}`}
              schema={{
                type: 'object-form',
                formType: 'simple',
                objectName: objectDef.name,
                mode,
                recordId: mode === 'edit' ? recordId : undefined,
                ...(prefillValues && { initialValues: prefillValues }),
                title: pageTitle,
                description:
                  mode === 'create'
                    ? t('form.createDescription', {
                        object: label,
                        defaultValue: `Create a new ${label}.`,
                      })
                    : t('form.editDescription', {
                        object: label,
                        defaultValue: `Edit this ${label}.`,
                      }),
                layout: 'vertical',
                fields,
                // Master-detail by config: if the object's form view declares
                // inline child collections, ObjectForm renders them as an atomic
                // master-detail form on this page — no bespoke page needed.
                subforms: (objectDef as any).form?.subforms
                  ?? (objectDef as any).formViews?.default?.subforms,
                onSuccess: handleSuccess,
                onCancel: handleCancel,
                showSubmit: true,
                showCancel: true,
                submitText: t('form.saveRecord', { defaultValue: 'Save' }),
                cancelText: t('common.cancel', { defaultValue: 'Cancel' }),
              }}
              dataSource={dataSource ?? undefined}
            />
          </div>
        </div>
      </div>
    </ExpressionProvider>
  );
}
