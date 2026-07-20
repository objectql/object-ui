/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Spec-aligned renderers for the `element:*` component namespace defined
 * by `@objectstack/spec` (`framework/packages/spec/src/ui/component.zod.ts`).
 *
 * Maps:
 *   - ElementTextProps    -> element:text
 *   - ElementNumberProps  -> element:number     (object aggregate)
 *   - ElementImageProps   -> element:image
 *   - element:divider                            (no-props separator)
 *   - ElementButtonProps  -> element:button
 *
 * Heavier interactive elements (element:filter, element:form) live in their
 * owning plugins and are left to those packages. element:record_picker — which
 * writes its selection into a page variable — ships alongside in `./record-picker`.
 *
 * All props are read off `schema.properties` per the spec's
 * `UIComponent.properties` convention; `schema.props` is also accepted
 * as a fallback so authors transitioning between conventions keep working.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { useAdapter, useAction } from '@object-ui/react';
import { useObjectTranslation, pickLocalized, useLocalization } from '@object-ui/i18n';
import { cn } from '../../lib/utils';
import { LazyIcon } from '../../lib/lazy-icon';
import { Button, Separator } from '../../ui';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readProps<T extends Record<string, any>>(schema: any): T {
  // Per spec, element components carry their config in `schema.properties`.
  // Tolerate `schema.props` (legacy alias) so JSON written either way works.
  const fromProperties = (schema?.properties ?? {}) as T;
  const fromProps = (schema?.props ?? {}) as T;
  return { ...fromProps, ...fromProperties };
}

function ariaAttrs(aria?: Record<string, any>): Record<string, string> {
  if (!aria || typeof aria !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(aria)) {
    if (v == null) continue;
    out[k.startsWith('aria-') || k === 'role' ? k : `aria-${k}`] = String(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// element:text
// ---------------------------------------------------------------------------

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const VARIANT_CLASS: Record<string, string> = {
  heading: 'text-2xl font-semibold tracking-tight',
  subheading: 'text-lg font-medium text-foreground',
  body: 'text-sm text-foreground',
  caption: 'text-xs text-muted-foreground',
};

function ElementTextRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    content?: unknown;
    variant?: 'heading' | 'subheading' | 'body' | 'caption';
    align?: 'left' | 'center' | 'right';
    aria?: Record<string, any>;
  }>(schema);
  const { language } = useObjectTranslation();
  const variant = props.variant ?? 'body';
  const align = props.align ?? 'left';
  const Tag = variant === 'heading' ? 'h2' : variant === 'subheading' ? 'h3' : 'p';
  return (
    <Tag
      className={cn(VARIANT_CLASS[variant] ?? VARIANT_CLASS.body, ALIGN_CLASS[align], schema?.className)}
      {...ariaAttrs(props.aria)}
    >
      {pickLocalized(props.content, language)}
    </Tag>
  );
}

ComponentRegistry.register('element:text', ElementTextRenderer, {
  namespace: 'element',
  label: 'Text',
  category: 'content',
});

// ---------------------------------------------------------------------------
// element:divider
// ---------------------------------------------------------------------------

function ElementDividerRenderer({ schema }: { schema: any }) {
  return <Separator className={cn('my-4', schema?.className)} />;
}

ComponentRegistry.register('element:divider', ElementDividerRenderer, {
  namespace: 'element',
  label: 'Divider',
  category: 'content',
});

// ---------------------------------------------------------------------------
// element:image
// ---------------------------------------------------------------------------

const FIT_CLASS: Record<string, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
};

function ElementImageRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    src?: string;
    alt?: string;
    fit?: 'cover' | 'contain' | 'fill';
    height?: number;
    aria?: Record<string, any>;
  }>(schema);
  const fit = props.fit ?? 'cover';
  if (!props.src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground',
          schema?.className,
        )}
        style={{ height: props.height ?? 120 }}
      >
        no image source
      </div>
    );
  }
  return (
    <img
      src={props.src}
      alt={props.alt ?? ''}
      className={cn('w-full rounded-md', FIT_CLASS[fit] ?? FIT_CLASS.cover, schema?.className)}
      style={props.height ? { height: props.height } : undefined}
      {...ariaAttrs(props.aria)}
    />
  );
}

ComponentRegistry.register('element:image', ElementImageRenderer, {
  namespace: 'element',
  label: 'Image',
  category: 'content',
});

// ---------------------------------------------------------------------------
// element:button
// ---------------------------------------------------------------------------

const SHADCN_BUTTON_VARIANT: Record<string, string> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
  link: 'link',
};

const SHADCN_BUTTON_SIZE: Record<string, string> = {
  small: 'sm',
  medium: 'default',
  large: 'lg',
};


function ElementButtonRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    label?: unknown;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
    size?: 'small' | 'medium' | 'large';
    icon?: string;
    iconPosition?: 'left' | 'right';
    disabled?: boolean;
    aria?: Record<string, any>;
    /**
     * Optional action executed on click. Any ActionDef the ActionRunner
     * understands — `url`/`navigation` (link to another page), `api`/`script`
     * (POST a cloud route, with optional param collection + redirect), `modal`,
     * `flow`. This is what makes a standalone-page button interactive: without
     * it the button renders inert (back-compat). Executed via `useAction`,
     * which falls back to a local runner when no ActionProvider is mounted, so
     * adding the hook never throws in non-page contexts.
     */
    action?: Record<string, any>;
  }>(schema);
  const variant = (SHADCN_BUTTON_VARIANT[props.variant ?? 'primary'] ?? 'default') as any;
  const size = (SHADCN_BUTTON_SIZE[props.size ?? 'medium'] ?? 'default') as any;
  const { language } = useObjectTranslation();
  const label = pickLocalized(props.label, language);
  const iconPosition = props.iconPosition ?? 'left';
  const icon = props.icon ? <LazyIcon name={props.icon} className="h-4 w-4" /> : null;

  const { execute } = useAction();
  const [running, setRunning] = React.useState(false);
  const action = props.action;

  const handleClick = React.useCallback(async () => {
    if (!action || running) return;
    setRunning(true);
    try {
      // Mirror action:button's param routing: an array of {name,type,…} defs is
      // forwarded for in-dialog collection; a plain object is passed as values.
      const paramsPayload = Array.isArray(action.params)
        ? { actionParams: action.params }
        : { params: action.params };
      await execute({
        type: action.actionType || action.type,
        name: action.name,
        label: action.label,
        description: action.description,
        target: action.target,
        openIn: (action as any).openIn,
        endpoint: action.endpoint,
        method: action.method,
        navigate: action.navigate,
        to: action.to,
        opensInNewTab: action.opensInNewTab,
        confirmText: action.confirmText,
        successMessage: action.successMessage,
        errorMessage: action.errorMessage,
        refreshAfter: action.refreshAfter,
        ...paramsPayload,
      } as any);
    } finally {
      setRunning(false);
    }
  }, [action, execute, running]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={props.disabled || running}
      className={cn(schema?.className)}
      onClick={action ? handleClick : undefined}
      {...ariaAttrs(props.aria)}
    >
      {iconPosition === 'left' && icon}
      {label}
      {iconPosition === 'right' && icon}
    </Button>
  );
}

ComponentRegistry.register('element:button', ElementButtonRenderer, {
  namespace: 'element',
  label: 'Button',
  category: 'action',
});

// ---------------------------------------------------------------------------
// element:number — aggregate metric pulled from an object via the adapter.
// ---------------------------------------------------------------------------

const FORMAT_OPTS: Record<string, Intl.NumberFormatOptions> = {
  number: {},
  currency: { style: 'currency', currency: 'USD' },
  percent: { style: 'percent', maximumFractionDigits: 1 },
};

function formatValue(
  value: number | null | undefined,
  format?: string,
  prefix?: string,
  suffix?: string,
  currency?: string,
  locale?: string,
): string {
  if (value == null || Number.isNaN(value)) return '—';
  let opts = FORMAT_OPTS[format ?? 'number'] ?? FORMAT_OPTS.number;
  // A `currency`-format metric resolves its ISO code from the field/tenant
  // default (localization.currency, ADR-0053). When no currency is known,
  // render a plain number rather than guessing USD — a baked-in `$` silently
  // mis-displays non-USD orgs (e.g. RMB amounts shown as US$).
  if (format === 'currency') {
    opts = currency ? { ...FORMAT_OPTS.currency, currency } : FORMAT_OPTS.number;
  }
  const body = new Intl.NumberFormat(locale, opts).format(value);
  return `${prefix ?? ''}${body}${suffix ?? ''}`;
}

function ElementNumberRenderer({ schema }: { schema: any }) {
  const props = readProps<{
    object?: string;
    field?: string;
    aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max';
    filter?: unknown;
    format?: 'number' | 'currency' | 'percent';
    prefix?: string;
    suffix?: string;
    aria?: Record<string, any>;
  }>(schema);
  const adapter = useAdapter() as any;
  // Tenant default currency + locale (ADR-0053) for a `currency`-format metric.
  const { currency: tenantCurrency, locale } = useLocalization();
  const [value, setValue] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const filterKey = React.useMemo(() => (props.filter ? JSON.stringify(props.filter) : ''), [props.filter]);

  React.useEffect(() => {
    let cancelled = false;
    if (!adapter || !props.object || !props.aggregate) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (typeof adapter.aggregate === 'function') {
          const rows = await adapter.aggregate(props.object, {
            field: props.field,
            function: props.aggregate,
            groupBy: '_all',
            filter: props.filter,
          });
          const row = Array.isArray(rows) ? rows[0] : rows;
          const measureKey = props.aggregate === 'count' ? 'count' : `${props.field ?? ''}_${props.aggregate}`;
          const v =
            row?.[measureKey] ??
            row?.[props.field ?? ''] ??
            row?.value ??
            (typeof row === 'number' ? row : null);
          if (!cancelled) setValue(typeof v === 'number' ? v : v != null ? Number(v) : null);
        } else if (typeof adapter.find === 'function') {
          // Last-resort: pull all rows and aggregate client-side. Costly
          // but matches the chart renderer fallback path.
          const res = await adapter.find(props.object, props.filter ? { $filter: props.filter } : undefined);
          const records: any[] = res?.data ?? res?.records ?? (Array.isArray(res) ? res : []);
          let v: number | null = null;
          if (props.aggregate === 'count') v = records.length;
          else if (props.field) {
            const nums = records.map((r) => Number(r?.[props.field as string])).filter((n) => !Number.isNaN(n));
            if (nums.length) {
              if (props.aggregate === 'sum') v = nums.reduce((a, b) => a + b, 0);
              else if (props.aggregate === 'avg') v = nums.reduce((a, b) => a + b, 0) / nums.length;
              else if (props.aggregate === 'min') v = Math.min(...nums);
              else if (props.aggregate === 'max') v = Math.max(...nums);
            }
          }
          if (!cancelled) setValue(v);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'aggregate failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, props.object, props.field, props.aggregate, filterKey]);

  return (
    <div className={cn('flex flex-col gap-1', schema?.className)} {...ariaAttrs(props.aria)}>
      <div className="text-3xl font-semibold tracking-tight tabular-nums">
        {loading ? '…' : formatValue(value, props.format, props.prefix, props.suffix, tenantCurrency, locale)}
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

ComponentRegistry.register('element:number', ElementNumberRenderer, {
  namespace: 'element',
  label: 'Number',
  category: 'content',
});
