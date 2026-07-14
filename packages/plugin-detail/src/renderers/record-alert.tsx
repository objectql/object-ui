/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:alert` — banner-style notice rendered between the page header and
 * the body of a record page. Use to draw the user's attention to a state
 * that needs action (unverified email, expired trial, locked account, …)
 * without forcing them to hunt for the relevant control.
 *
 * Schema
 * ------
 *   {
 *     type: 'record:alert',
 *     properties: {
 *       severity: 'info' | 'warning' | 'error' | 'success',  // default 'info'
 *       title?: string,
 *       body?: string,
 *       visible?: string | { dialect, source } | boolean,    // CEL/template predicate
 *       icon?: string,                                       // lucide name
 *       action?: {                                           // optional CTA
 *         actionName: string,                                // resolved from object metadata
 *         label?: string,                                    // overrides action.label
 *       },
 *       dismissible?: boolean,                               // X to dismiss
 *       dismissKey?: string,                                 // localStorage key suffix
 *     }
 *   }
 *
 * Visibility model
 * ----------------
 *   Reuses `useCondition` + `toPredicateInput` (same pipeline as every
 *   `<ActionButton>` / `<ActionBar>`), so the predicate evaluates against
 *   the same scope: `record`, `user`, `objectName`, `features`, plus
 *   `ctx.*` namespace mirror. Missing predicate → always visible.
 *   Empty `record` (loading) → hidden (no flash of stale alert).
 *
 * CTA wiring
 * ----------
 *   The optional `action.actionName` is resolved from the object's
 *   metadata `actions[]` and executed via the shared `<ActionProvider>`
 *   runner — so confirm dialogs, param dialogs, toast, and reload
 *   handlers all work exactly as they do in `record:quick_actions`.
 */

import * as React from 'react';
import {
  useRecordContext,
  useMetadataItem,
  useCondition,
  toPredicateInput,
  useActionEngine,
} from '@object-ui/react';
import { Alert, AlertTitle, AlertDescription, Button, cn, LazyIcon } from '@object-ui/components';
import { useObjectTranslation, pickLocalized } from '@object-ui/i18n';
import type { ActionDef } from '@object-ui/core';

type Severity = 'info' | 'warning' | 'error' | 'success';

interface RecordAlertProps {
  schema?: {
    properties?: {
      severity?: Severity;
      title?: string;
      body?: string;
      visible?: any;
      icon?: string;
      action?: { actionName: string; label?: string; variant?: string };
      dismissible?: boolean;
      dismissKey?: string;
    };
    // Legacy: support flat properties too (mirrors element:text convention).
    severity?: Severity;
    title?: string;
    body?: string;
    visible?: any;
    icon?: string;
    action?: { actionName: string; label?: string; variant?: string };
    dismissible?: boolean;
    dismissKey?: string;
    className?: string;
  };
  className?: string;
  [k: string]: any;
}

// Severity → Tailwind classes + default icon. The shadcn Alert primitive
// only ships `default`/`destructive` variants, so the other severities get
// applied via composed utility classes — keeps the primitive untouched.
const SEVERITY_STYLES: Record<Severity, { wrap: string; icon: string }> = {
  info: {
    wrap: 'border-blue-300/60 bg-blue-50 text-blue-900 dark:border-blue-700/40 dark:bg-blue-950/30 dark:text-blue-100 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-300',
    icon: 'Info',
  },
  warning: {
    wrap: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-300',
    icon: 'AlertTriangle',
  },
  error: {
    wrap: 'border-destructive/60 bg-destructive/10 text-destructive dark:bg-destructive/20 [&>svg]:text-destructive',
    icon: 'AlertCircle',
  },
  success: {
    wrap: 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-100 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-300',
    icon: 'CheckCircle2',
  },
};

function readProps(schema: any) {
  const fromNested = (schema?.properties ?? {}) as any;
  return { ...schema, ...fromNested };
}

export const RecordAlertRenderer: React.FC<RecordAlertProps> = ({ schema = {}, className }) => {
  const props = readProps(schema);
  const recordCtx = useRecordContext();
  const record = recordCtx?.data;
  const objectName = recordCtx?.objectName || '';
  const recordId = (recordCtx?.recordId as any) ?? record?.id;
  const { language } = useObjectTranslation();

  // Authored copy may carry inline translations (`{ en, 'zh-CN', … }`) —
  // resolve to the current language before rendering / keying.
  const title = pickLocalized(props.title, language);
  const body = pickLocalized(props.body, language);
  const ctaLabel = pickLocalized(props.action?.label, language);

  const severity: Severity = (['info', 'warning', 'error', 'success'] as const).includes(props.severity)
    ? (props.severity as Severity)
    : 'info';
  const styles = SEVERITY_STYLES[severity];
  const iconName = props.icon || styles.icon;

  // Always-call hooks (Rules of Hooks). Evaluate the visibility predicate
  // against the record / user / ctx scope using the same canonical helper
  // every action button uses, so this banner can't disagree with the
  // Salesforce Lightning-style buttons it commonly pairs with.
  const predicateInput = toPredicateInput(props.visible);
  const passesPredicate = useCondition(predicateInput, { record });

  // Dismissed-state persistence. Keyed by `<objectName>:<recordId>:<key>`
  // so an admin viewing a different record sees the alert fresh, and so
  // dismissing on one record does not silence the same alert on another.
  const storageKey = React.useMemo(() => {
    if (!props.dismissible) return null;
    // Key by the language-independent resolution ('en'/default) so dismissing
    // the alert in one locale keeps it dismissed after a language switch.
    const k = props.dismissKey || pickLocalized(props.title, 'en') || severity;
    return `os.record-alert:${objectName}:${recordId ?? '_'}:${k}`;
  }, [props.dismissible, props.dismissKey, props.title, severity, objectName, recordId]);

  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    if (!storageKey || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  // Resolve the optional CTA from object metadata (DRY — same `actions[]`
  // that backs `record:quick_actions`). Skip the lookup when no CTA is
  // requested to avoid an extra metadata fetch per record page.
  const ctaName = props.action?.actionName as string | undefined;
  const needsMeta = !!ctaName && !!objectName;
  const { item: objectMeta } = useMetadataItem('object', needsMeta ? objectName : null);
  const ctaAction: ActionDef | undefined = React.useMemo(() => {
    if (!ctaName || !objectMeta?.actions) return undefined;
    return (objectMeta.actions as ActionDef[]).find((a) => a.name === ctaName);
  }, [ctaName, objectMeta]);

  // Route execution through the shared ActionEngine so confirm /
  // param-dialog / result-dialog / toast handlers from the surrounding
  // ActionProvider all fire — same pipeline that record:quick_actions
  // uses for its Salesforce-Lightning-style toolbar.
  const engineActions = React.useMemo(() => (ctaAction ? [ctaAction] : []), [ctaAction]);
  const { executeAction } = useActionEngine({
    actions: engineActions,
    context: {
      record,
      recordId,
      objectName,
    } as any,
  });

  // Hide if dismissed, if record hasn't loaded yet (avoids false alerts
  // during the empty initial-render frame), or if the visibility predicate
  // returns false.
  if (dismissed) return null;
  if (!record || Object.keys(record).length === 0) return null;
  if (predicateInput !== undefined && !passesPredicate) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, '1');
      } catch {
        /* storage disabled — dismiss for session only */
      }
    }
  };

  const handleCta = () => {
    if (!ctaAction?.name) return;
    void executeAction(ctaAction.name);
  };

  return (
    <Alert
      className={cn('relative pr-12', styles.wrap, className)}
      role={severity === 'error' ? 'alert' : 'status'}
      aria-live={severity === 'error' ? 'assertive' : 'polite'}
    >
      <LazyIcon name={iconName} className="h-4 w-4" aria-hidden="true" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {body || ctaAction ? (
        <AlertDescription>
          {body ? <p className="mb-2 last:mb-0">{body}</p> : null}
          {ctaAction ? (
            <Button
              size="sm"
              variant={(props.action?.variant as any) || (severity === 'error' ? 'destructive' : 'default')}
              onClick={handleCta}
            >
              {ctaLabel || ctaAction.label || ctaAction.name}
            </Button>
          ) : null}
        </AlertDescription>
      ) : null}
      {props.dismissible ? (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/80 hover:bg-foreground/5 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <LazyIcon name="X" className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </Alert>
  );
};

export default RecordAlertRenderer;
