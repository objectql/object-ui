/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Spec-aligned container renderers for the `page:*` component namespace.
 * Backs the Page-as-root record detail page model (Salesforce Lightning
 * Record Page parity).
 *
 * Maps `packages/spec/src/ui/component.zod.ts` props:
 *   - PageTabsProps      -> page:tabs
 *   - PageCardProps      -> page:card
 *   - PageAccordionProps -> page:accordion
 *   - PageHeaderProps    -> page:header
 *   - page:footer / page:sidebar / page:section thin wrappers
 */

import React from 'react';
import { ComponentRegistry, ExpressionEvaluator } from '@object-ui/core';
import { useRecordContext, useAction } from '@object-ui/react';
import { renderChildren, cn } from '../../lib/utils';
import { LazyIcon } from '../../lib/lazy-icon';
import { RelatedCountStore, useRelatedCount } from '../../hooks/related-count-store';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Separator,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../ui';
import { RecordTitleChip } from '../../custom/RecordTitleChip';
import { useObjectLabel, useSafeFieldLabel } from '@object-ui/i18n';
import { MoreHorizontal } from 'lucide-react';

/**
 * Pull the standard designer-passthrough props off a renderer's `props`.
 * Every page:* renderer must forward these so the Studio designer overlay
 * can still target the rendered element.
 */
const splitDesignerProps = (props: Record<string, any>) => {
  const {
    'data-obj-id': dataObjId,
    'data-obj-type': dataObjType,
    style,
    ...rest
  } = props || {};
  return {
    designer: { 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style },
    rest,
  };
};

/** Pick a value for I18nLabelSchema (string or { default, ... } shape). */
const labelText = (label: any): string => {
  if (label == null) return '';
  if (typeof label === 'string') return label;
  if (typeof label === 'object') return label.default || label.value || '';
  return String(label);
};

/**
 * Lightweight built-in translation for well-known English tab/accordion
 * labels used by Lightning-style record pages (Details / Related /
 * Activity / History / Notes / Files / Tasks / Events / Attachments /
 * Chatter / Discussion). Keeps `@object-ui/components` free of an i18n
 * dependency while closing the gap between custom Page schemas (often
 * authored in English) and the localised default detail view.
 *
 * Authors can always override by passing a localised `label` (string or
 * `{ default, zh-CN, ... }` shape) directly in their schema; the map is
 * only consulted when the input matches a known English token.
 */
const KNOWN_LABEL_DICT: Record<string, Record<string, string>> = {
  'zh-CN': {
    Details: '详情',
    Related: '相关',
    Activity: '活动',
    History: '历史',
    Notes: '备注',
    Files: '文件',
    Tasks: '任务',
    'Open Tasks': '待办任务',
    'Closed Tasks': '已完成任务',
    Events: '日程',
    Attachments: '附件',
    Chatter: '讨论',
    Discussion: '讨论',
    Comments: '评论',
    Overview: '概览',
    Summary: '摘要',
    Quotes: '报价单',
    Products: '产品',
    Contacts: '联系人',
    Accounts: '客户',
    Leads: '线索',
    Opportunities: '商机',
    Cases: '服务案例',
    Campaigns: '营销活动',
    Approvals: '审批',
    Documents: '文档',
    Emails: '邮件',
    Calls: '通话',
    Meetings: '会议',
  },
  'zh-TW': {
    Details: '詳情',
    Related: '相關',
    Activity: '活動',
    History: '歷史',
    Notes: '備註',
    Files: '檔案',
    Tasks: '任務',
    'Open Tasks': '待辦任務',
    'Closed Tasks': '已完成任務',
    Events: '行程',
    Attachments: '附件',
    Chatter: '討論',
    Discussion: '討論',
    Comments: '評論',
    Overview: '概覽',
    Summary: '摘要',
    Quotes: '報價單',
    Products: '產品',
    Contacts: '聯絡人',
    Accounts: '客戶',
    Leads: '線索',
    Opportunities: '商機',
    Cases: '服務案例',
    Campaigns: '行銷活動',
    Approvals: '審批',
    Documents: '文件',
    Emails: '郵件',
    Calls: '通話',
    Meetings: '會議',
  },
};

const detectLocale = (): string => {
  if (typeof document !== 'undefined') {
    const docLang = document.documentElement?.lang;
    if (docLang) return docLang;
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en';
};

const translateLabel = (text: string): string => {
  if (!text) return text;
  const locale = detectLocale();
  // Match `zh-CN`, `zh-TW`, then base `zh` → `zh-CN`.
  const exact = KNOWN_LABEL_DICT[locale];
  const base = locale.split('-')[0];
  const fallback = base === 'zh' ? KNOWN_LABEL_DICT['zh-CN'] : undefined;
  const dict = exact || fallback;
  if (!dict) return text;
  // Direct hit on the full string.
  if (dict[text] !== undefined) return dict[text];
  // Try splitting on " & " / " 和 " / " and " separators so labels like
  // "Notes & Attachments" translate piece-wise to "备注 & 附件" without
  // requiring every concrete combination to be enumerated in the dict.
  const sepRe = /\s*(?:&|and|和)\s*/i;
  if (sepRe.test(text)) {
    const parts = text.split(sepRe);
    const allKnown = parts.every((p) => dict[p.trim()] !== undefined);
    if (allKnown) {
      const sep = locale.startsWith('zh') ? '与' : ' & ';
      return parts.map((p) => dict[p.trim()]).join(sep);
    }
  }
  return text;
};

/**
 * Replace `{field.path}` tokens in a template against the given data object.
 * Missing fields collapse to an empty string. The result is trimmed and
 * whitespace-collapsed so partial misses don't leave gaping holes.
 *
 * When `objectSchema` and `fieldOptionLabel` are supplied, a token that
 * resolves to a select-field value gets routed through the i18n option
 * label dictionary — so `subtitle: "{industry} · {type}"` renders as
 * "科技 · 客户" rather than the raw enum values "technology · customer".
 */
const interpolate = (
  template: string,
  data: any,
  objectSchema?: any,
  fieldOptionLabel?: (objectName: string, fieldName: string, value: string, fallback: string) => string,
  objectName?: string,
): string => {
  if (!template || typeof template !== 'string') return template || '';
  if (!template.includes('{')) return template;
  const out = template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, path: string) => {
    const v = path.split('.').reduce<any>((acc, seg) => (acc == null ? acc : acc[seg]), data);
    if (v == null) return '';
    // Skip object/array values rather than letting `String(v)` produce a
    // useless "[object Object]" — this happens when a token resolves to a
    // related record (e.g. `{account}` on an opportunity). Authors who want
    // a field of the related record should use a deeper path
    // (e.g. `{account.name}`).
    if (typeof v === 'object') return '';
    const raw = String(v);
    // Route enum values through i18n so subtitle templates render
    // translated option labels instead of raw machine-readable values.
    // Only the first path segment is treated as a field name (deeper
    // paths reach into related records and have their own translation
    // surfaces).
    if (objectSchema?.fields && fieldOptionLabel && objectName && !path.includes('.')) {
      const fieldDef: any = Array.isArray(objectSchema.fields)
        ? objectSchema.fields.find((f: any) => f?.name === path)
        : objectSchema.fields[path];
      const options: any[] | undefined = fieldDef?.options;
      if (Array.isArray(options)) {
        const match = options.find((opt: any) => String(opt?.value ?? opt) === raw);
        const fallback = match?.label ? String(match.label) : raw;
        return fieldOptionLabel(objectName, path, raw, fallback);
      }
    }
    return raw;
  });
  return out.replace(/\s+/g, ' ').trim();
};

// ---------------------------------------------------------------------------
// page:tabs
// ---------------------------------------------------------------------------

interface PageTabsItem {
  label: any;
  icon?: string;
  /**
   * Optional badge value rendered after the label (e.g. related-list count).
   * Numbers >= 1000 are shortened to `1.2k`-style.
   */
  count?: number | string;
  children: any[];
}

const formatTabCount = (v: number | string): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
};

/**
 * Walk a tab's children (depth-first) and return the first
 * `record:related_list` schema node found. Used to auto-derive a count
 * for the tab badge when the spec author didn't supply one explicitly.
 */
/**
 * Walk a tab's children (depth-first) and collect every `record:related_list`
 * schema node. Used to auto-derive a count for the tab badge when the spec
 * author didn't supply one explicitly. Multiple lists are summed (Salesforce
 * "Related" tab convention).
 */
const collectRelatedLists = (nodes: any, acc: any[] = []): any[] => {
  if (!nodes) return acc;
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const n of list) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'record:related_list' || n.type === 'record_related_list') {
      acc.push(n);
      continue; // Don't descend into a related_list's own subtree.
    }
    const candidates = [
      n.children,
      n.properties?.children,
      n.properties?.items,
      n.body,
      n.items,
    ];
    for (const c of candidates) {
      if (c) collectRelatedLists(c, acc);
    }
  }
  return acc;
};

const PageTabsRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const items: PageTabsItem[] = schema?.items || [];
  // Tab visual style lives at `properties.type` ('line'|'card'|'pill') — the
  // outer `schema.type` is always 'page:tabs' (the component dispatch key).
  const type: 'line' | 'card' | 'pill' = schema?.properties?.type || schema?.tabStyle || 'line';
  const position: 'top' | 'left' = schema?.position || 'top';
  const isVertical = position === 'left';

  // Auto-derive tab counts from any `record:related_list` descendant of
  // each tab. The fetch is a `limit:1` find so we only consume the `total`
  // — cheap relative to the eventual list render the user gets when they
  // open the tab. Spec authors that pass `count` explicitly win.
  //
  // Counts are kept in a module-scoped store (`RelatedCountStore`) so:
  //   - sibling tab strips on the same record don't re-probe identical keys
  //   - bulk mutations elsewhere in the app (delete, create, save) can
  //     `RelatedCountStore.invalidate(objectName, parentId)` and every
  //     subscriber updates with no parent re-render.
  const ctx = useRecordContext();
  const parentId = ctx?.data?.id;
  const ds: any = ctx?.dataSource;
  // Subscribe to store changes so badges re-render on invalidation /
  // remote count updates. The actual count lookup is per-tab below.
  useRelatedCount(undefined, undefined, parentId);

  // Snapshot which tabs (index → derived (objectName, relationshipField))
  // need a count probe. Cached per items reference so we don't re-walk on
  // every render.
  const probeTargets = React.useMemo(() => {
    const out = new Map<number, Array<{ objectName: string; relationshipField?: string }>>();
    items.forEach((it, idx) => {
      if (it.count !== undefined && it.count !== null && it.count !== '') return;
      const lists = collectRelatedLists((it as any).children);
      const probes: Array<{ objectName: string; relationshipField?: string }> = [];
      for (const rl of lists) {
        const objectName: string | undefined = rl?.properties?.objectName || rl?.objectName;
        if (!objectName) continue;
        const relationshipField: string | undefined =
          rl?.properties?.relationshipField || rl?.relationshipField;
        probes.push({ objectName, relationshipField });
      }
      if (probes.length > 0) out.set(idx, probes);
    });
    return out;
  }, [items]);

  React.useEffect(() => {
    if (!ds || typeof ds.find !== 'function') return;
    if (probeTargets.size === 0) return;
    let cancelled = false;
    for (const probes of probeTargets.values()) {
      for (const probe of probes) {
        // RelatedCountStore.fetch is internally deduplicated, so concurrent
        // mounts of multiple tab strips don't generate redundant requests.
        void RelatedCountStore.fetch(
          (object, query) => ds.find(object, query),
          probe.objectName,
          probe.relationshipField,
          parentId,
        ).catch(() => 0);
        if (cancelled) return;
      }
    }
    return () => {
      cancelled = true;
    };
  }, [ds, probeTargets, parentId]);

  // Compute the displayed count by reading the store for every probe target.
  // useRelatedCount above subscribed us to changes, so any store update —
  // whether from this effect or from an external invalidate — re-renders.
  const computeCount = (idx: number): number | undefined => {
    const probes = probeTargets.get(idx);
    if (!probes || probes.length === 0) return undefined;
    let sum = 0;
    let seenAny = false;
    for (const p of probes) {
      const v = RelatedCountStore.get(p.objectName, p.relationshipField, parentId);
      if (v !== undefined) {
        sum += v;
        seenAny = true;
      }
    }
    return seenAny ? sum : undefined;
  };

  // PageTabsProps doesn't carry a value, synthesize one from the index so
  // Radix Tabs (which requires stable values) is happy.
  const itemsWithValue = items.map((it, idx) => ({
    ...it,
    value: `tab-${idx}`,
    labelStr: translateLabel(labelText(it.label)),
    // Explicit spec count wins; otherwise fall back to the derived probe.
    count: it.count !== undefined && it.count !== null && it.count !== ''
      ? it.count
      : computeCount(idx),
  }));

  const defaultValue = itemsWithValue[0]?.value;

  const listClass = cn(
    isVertical && 'flex-col h-auto items-stretch p-1',
    type === 'card' && 'bg-transparent gap-1',
    type === 'pill' && 'bg-muted rounded-full p-1 gap-1',
    // 'line' is the default: an anchored, underline-style strip. The Shadcn
    // primitive defaults to a pill-card look (bg-muted, rounded-md) that
    // floats unmoored on long record pages — override it so the strip reads
    // as a section anchor with a bottom border + per-trigger underline.
    type === 'line' && !isVertical && 'h-auto rounded-none bg-transparent p-0 gap-4 border-b border-border w-full justify-start',
    // Pin the horizontal tab strip to the top of the scroll container so
    // users keep their bearings on long record pages. Skipped for vertical
    // layouts where the strip is a sidebar, not a header.
    !isVertical && 'sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  );

  const triggerClass = () => cn(
    isVertical && 'justify-start',
    type === 'card' && 'data-[state=active]:bg-background data-[state=active]:border data-[state=active]:shadow-sm rounded-md',
    type === 'pill' && 'rounded-full data-[state=active]:bg-background',
    type === 'line' && !isVertical && 'rounded-none border-b-2 border-transparent bg-transparent px-1 pb-2.5 -mb-px shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground',
  );

  return (
    <Tabs
      defaultValue={defaultValue}
      orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cn(className, isVertical && 'flex gap-4 w-full')}
      {...designer}
    >
      {/* Hide the tab strip entirely when there's only one tab — a single
          pill labelled "Details" is visual clutter rather than an
          affordance. Authors who want the strip even at length 1 can pass
          `properties.alwaysShowStrip: true`. */}
      {(itemsWithValue.length > 1 || schema?.properties?.alwaysShowStrip === true) && (
        <TabsList className={listClass}>
          {itemsWithValue.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className={triggerClass()}>
              {item.icon && (
                <LazyIcon
                  name={item.icon}
                  className="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70"
                  aria-hidden
                />
              )}
              <span>{item.labelStr}</span>
              {item.count !== undefined && item.count !== null && item.count !== '' && Number(item.count) > 0 && (
                <span
                  className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium leading-none text-muted-foreground"
                  aria-label={`${formatTabCount(item.count)} items`}
                >
                  {formatTabCount(item.count)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {itemsWithValue.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          className={cn(
            itemsWithValue.length > 1 ? 'mt-3' : 'mt-0',
            isVertical && 'mt-0 flex-1',
          )}
        >
          {renderChildren(item.children)}
        </TabsContent>
      ))}
    </Tabs>
  );
};

ComponentRegistry.register('page:tabs', PageTabsRenderer, {
  namespace: 'page',
  label: 'Page Tabs',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:card
// ---------------------------------------------------------------------------

const PageCardRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const title = labelText(schema?.title);
  const bordered = schema?.bordered !== false;
  const body = schema?.body;
  const footer = schema?.footer;

  return (
    <Card
      className={cn(className, !bordered && 'border-0 shadow-none bg-transparent')}
      {...designer}
    >
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      {body && <CardContent>{renderChildren(body)}</CardContent>}
      {footer && <CardFooter className="flex justify-between">{renderChildren(footer)}</CardFooter>}
    </Card>
  );
};

ComponentRegistry.register('page:card', PageCardRenderer, {
  namespace: 'page',
  label: 'Page Card',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:accordion
// ---------------------------------------------------------------------------

interface PageAccordionItem {
  label: any;
  icon?: string;
  collapsed?: boolean;
  children: any[];
}

const PageAccordionRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const items: PageAccordionItem[] = schema?.items || [];
  const allowMultiple = !!schema?.allowMultiple;
  // Variants:
  //   - `flush` (default): no per-item border. Lets the inner content (e.g.
  //     a `record:related_list` Card) provide its own containment so the
  //     accordion doesn't fight with nested visuals.
  //   - `card`: legacy bordered look. Authors opt in by setting
  //     `variant: 'card'` (or `properties.variant: 'card'`) on the schema.
  const variant: 'flush' | 'card' =
    schema?.variant ?? schema?.properties?.variant ?? 'flush';
  const itemClass = variant === 'flush' ? 'border-b last:border-b-0' : undefined;

  const itemsWithValue = items.map((it, idx) => ({
    ...it,
    value: `panel-${idx}`,
    labelStr: translateLabel(labelText(it.label)),
  }));

  const defaultOpen = itemsWithValue
    .filter((it) => it.collapsed === false)
    .map((it) => it.value);

  // Radix Accordion has separate single/multiple variants; render the right
  // one without trying to share a generic prop bag.
  const commonChildren = itemsWithValue.map((item) => (
    <AccordionItem key={item.value} value={item.value} className={itemClass}>
      <AccordionTrigger className="text-sm font-semibold tracking-tight hover:no-underline">
        {item.labelStr}
      </AccordionTrigger>
      <AccordionContent>{renderChildren(item.children)}</AccordionContent>
    </AccordionItem>
  ));

  if (allowMultiple) {
    return (
      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className={className}
        {...designer}
      >
        {commonChildren}
      </Accordion>
    );
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen[0]}
      className={className}
      {...designer}
    >
      {commonChildren}
    </Accordion>
  );
};

ComponentRegistry.register('page:accordion', PageAccordionRenderer, {
  namespace: 'page',
  label: 'Page Accordion',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:section — thin wrapper used inside regions for grouping children.
// ---------------------------------------------------------------------------

const PageSectionRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <section
      className={cn('space-y-4', className)}
      {...designer}
    >
      {renderChildren(schema?.children || schema?.body)}
    </section>
  );
};

ComponentRegistry.register('page:section', PageSectionRenderer, {
  namespace: 'page',
  label: 'Page Section',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:header — title row + optional subtitle + breadcrumb/action slots.
// Action ids are intentionally not resolved here; that will land alongside
// the upcoming `record:quick_actions` renderer.
// ---------------------------------------------------------------------------

/**
 * Strip dangling connectors that survive when a `titleFormat` interpolates
 * with one side empty — e.g. `{number} - {name}` becomes `CTR-0001 -` when
 * `name` is blank. Removes a trailing/leading hyphen / middle-dot / colon /
 * slash / pipe (optionally surrounded by whitespace) and collapses
 * adjacent whitespace into a single space. Idempotent.
 *
 * Exported for unit tests.
 */
export function cleanupTitleSeparators(s: string): string {
  if (!s) return s;
  let out = s;
  // Repeatedly trim trailing connectors. Loop so chains like " - · " all peel.
  for (let i = 0; i < 4; i += 1) {
    const next = out.replace(/[\s\u00A0]*[-·:|/–—][\s\u00A0]*$/u, '').trimEnd();
    if (next === out) break;
    out = next;
  }
  for (let i = 0; i < 4; i += 1) {
    const next = out.replace(/^[\s\u00A0]*[-·:|/–—][\s\u00A0]*/u, '').trimStart();
    if (next === out) break;
    out = next;
  }
  // Collapse double-separators in the middle (rare, but happens when the
  // middle field of a 3-part format is empty: "A -  - B" -> "A - B").
  out = out.replace(/([-·:|/–—])[\s\u00A0]*\1/gu, '$1');
  // Collapse runs of whitespace.
  out = out.replace(/[\s\u00A0]+/g, ' ').trim();
  return out;
}

const PageHeaderRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const ctx = useRecordContext();
  const { execute } = useAction();
  const { objectLabel: tObjectLabel, actionLabel: tActionLabel } = useObjectLabel();
  const { fieldOptionLabel } = useSafeFieldLabel();
  // Spec bridge may either inline `properties.*` onto the node or preserve
  // the raw bag (see record:quick_actions for the same pattern). Read from
  // both so a `{ properties: { title } }` schema is rendered correctly.
  const titleSrc = schema?.title ?? schema?.properties?.title;
  const subtitleSrc = schema?.subtitle ?? schema?.properties?.subtitle;
  const headerObjectSchema: any = (ctx as any)?.objectSchema;
  const headerObjectName: string | undefined = ctx?.objectName || headerObjectSchema?.name;
  const explicitTitle = interpolate(
    labelText(titleSrc),
    ctx?.data,
    headerObjectSchema,
    fieldOptionLabel,
    headerObjectName,
  );
  const subtitle = interpolate(
    labelText(subtitleSrc),
    ctx?.data,
    headerObjectSchema,
    fieldOptionLabel,
    headerObjectName,
  );
  const breadcrumb = (schema?.breadcrumb ?? schema?.properties?.breadcrumb) !== false;

  // Schema-level opt-outs let authors keep the historic "bare h1" header
  // when they don't want a record chip (e.g. a non-record landing page).
  const disableRecordChrome =
    schema?.recordChrome === false || schema?.properties?.recordChrome === false;
  const showStar = schema?.showStar !== false && schema?.properties?.showStar !== false;
  const showCopyId = schema?.showCopyId !== false && schema?.properties?.showCopyId !== false;

  // Inline header actions — authored pages embed action buttons directly on
  // `page:header.actions` (or `.properties.actions`). Custom CRM record
  // detail pages (lead → Convert Lead, opportunity → Mark Won/Lost, …)
  // rely on this slot. Without this rendering they would silently disappear.
  const rawHeaderActions = schema?.actions ?? schema?.properties?.actions;
  // System actions (Edit / Share / Delete) injected by the host via
  // `RecordContext.headerSystemActions`. Appended AFTER authored actions
  // and deduplicated by `name` so the host can always supply them
  // regardless of whether the page schema is authored (full Lightning) or
  // synthesised. Authored pages may opt out by omitting them at the host
  // or by adding a name-clashing action of their own.
  const hostSystemActions = (ctx as any)?.headerSystemActions as any[] | undefined;
  const headerActions = React.useMemo<any[]>(() => {
    const recordData: any = ctx?.data;
    // Spread record fields as top-level bindings so author-friendly CEL like
    // `status == "active"` or `is_default != true` resolves directly. Without
    // this, bare identifiers fall through to the JS global scope and silently
    // resolve to e.g. `window.status` (empty string), causing every action
    // with a `visible` expression to be filtered out.
    const evalCtx = {
      ...(recordData && typeof recordData === 'object' ? recordData : {}),
      record: recordData,
      data: recordData,
    };
    const evaluator = new ExpressionEvaluator(evalCtx);
    const evalExpr = (src: string): any => {
      try {
        return evaluator.evaluateExpression(src);
      } catch {
        return undefined;
      }
    };
    const filterAction = (a: any): boolean => {
      // Location filter — when `locations` is declared, require record_header.
      // Missing/empty `locations` defaults to "show here" since the action
      // is inlined on the header itself.
      if (Array.isArray(a?.locations) && a.locations.length > 0) {
        if (!a.locations.includes('record_header')) return false;
      }
      // Boolean / expression visibility — supports both `visible: false`,
      // `visible: 'record.status == "open"'` and the structured shape
      // `visible: { dialect: 'cel', source: '…' }` used by spec authors.
      const v = a?.visible;
      if (v !== undefined && v !== null) {
        if (typeof v === 'boolean') {
          if (!v) return false;
        } else {
          const src =
            typeof v === 'string'
              ? v
              : (v && typeof v === 'object' && typeof (v as any).source === 'string')
                ? (v as any).source
                : null;
          if (src) {
            const result = evalExpr(src);
            // On evaluation error (undefined), hide the action rather than
            // risk surfacing a destructive button in the wrong state.
            if (!result) return false;
          }
        }
      }
      // `hidden` is the mirror image — when truthy, skip.
      const h = a?.hidden;
      if (h !== undefined && h !== null) {
        if (typeof h === 'boolean') {
          if (h) return false;
        } else {
          const src =
            typeof h === 'string'
              ? h
              : (h && typeof h === 'object' && typeof (h as any).source === 'string')
                ? (h as any).source
                : null;
          if (src) {
            const result = evalExpr(src);
            if (result) return false;
          }
        }
      }
      return true;
    };
    const authored = Array.isArray(rawHeaderActions)
      ? rawHeaderActions.filter(filterAction)
      : [];
    const system = Array.isArray(hostSystemActions)
      ? hostSystemActions.filter(filterAction)
      : [];
    // Dedupe by `name` — authored wins.
    const seen = new Set<string>();
    const out: any[] = [];
    for (const a of [...authored, ...system]) {
      const key = (a?.name || a?.id || '') as string;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(a);
    }
    return out;
  }, [rawHeaderActions, hostSystemActions, ctx?.data]);

  const renderHeaderActions = () => {
    if (headerActions.length === 0) return null;
    // Resolve a translated label for an action via the
    // `{ns}.objects.{objectName}._actions.{name}.label` convention. Falls
    // back to authored `action.label`, then `action.name`.
    const resolveLabel = (action: any, idx: number) => {
      const key = (action?.name || action?.id) as string | undefined;
      const fallback = action?.label || key || `Action ${idx + 1}`;
      if (!key) return fallback;
      return tActionLabel(ctx?.objectName, key, fallback);
    };
    // Collapse secondary actions into a `⋯` overflow menu when more than 2
    // actions are present. The first 1 action (typically the primary
    // business action, e.g. "克隆商机") stays inline; everything else
    // becomes a dropdown item. This keeps the header from drowning in 4–5
    // buttons (Clone + Edit + Share + Delete + …) on every record page.
    const INLINE_MAX = 1;
    const useOverflow = headerActions.length > INLINE_MAX + 1;
    const inlineActions = useOverflow ? headerActions.slice(0, INLINE_MAX) : headerActions;
    const overflowActions = useOverflow ? headerActions.slice(INLINE_MAX) : [];
    // Resolve a `disabled` predicate against the record. Mirrors the `visible`
    // evaluation above — a boolean OR a CEL expression (`'record.status == …'`
    // or the `{ dialect, source }` envelope). Without this a CEL `disabled`
    // silently did nothing (only boolean was honoured).
    const dRecord: any = ctx?.data;
    const dEvaluator = new ExpressionEvaluator({
      ...(dRecord && typeof dRecord === 'object' ? dRecord : {}),
      record: dRecord,
      data: dRecord,
    });
    const resolveDisabled = (d: any): boolean => {
      if (d === undefined || d === null) return false;
      if (typeof d === 'boolean') return d;
      const src = typeof d === 'string'
        ? d
        : (d && typeof d === 'object' && typeof (d as any).source === 'string' ? (d as any).source : undefined);
      if (!src) return false;
      try { return !!dEvaluator.evaluateExpression(src); } catch { return false; }
    };
    const renderButton = (action: any, idx: number) => {
      const label = resolveLabel(action, idx);
      const variant = action.variant || 'default';
      const size = action.size || 'sm';
      const disabled = resolveDisabled(action.disabled);
      const icon = typeof action.icon === 'string' ? action.icon : null;
      return (
        <Button
          key={action.name || action.id || `header-action-${idx}`}
          variant={variant}
          size={size}
          disabled={disabled}
          className="gap-2"
          onClick={() => {
            if (typeof action.onClick === 'function') {
              void action.onClick();
              return;
            }
            void execute(action);
          }}
        >
          {icon && <LazyIcon name={icon} className="h-4 w-4" />}
          <span>{label}</span>
        </Button>
      );
    };
    return (
      <div
        className="flex flex-wrap items-center gap-2 shrink-0"
        role="toolbar"
        aria-label="Page header actions"
      >
        {inlineActions.map(renderButton)}
        {useOverflow && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 px-2"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {overflowActions.map((action, idx) => {
                const label = resolveLabel(action, idx + INLINE_MAX);
                const disabled = resolveDisabled(action.disabled);
                const icon = typeof action.icon === 'string' ? action.icon : null;
                const isDestructive =
                  action.variant === 'destructive' || action.name === 'sys_delete';
                return (
                  <DropdownMenuItem
                    key={action.name || action.id || `overflow-action-${idx}`}
                    disabled={disabled}
                    onSelect={(e) => {
                      e.preventDefault();
                      if (typeof action.onClick === 'function') {
                        void action.onClick();
                        return;
                      }
                      void execute(action);
                    }}
                    className={cn(
                      'gap-2',
                      isDestructive && 'text-destructive focus:text-destructive focus:bg-destructive/10'
                    )}
                  >
                    {icon && <LazyIcon name={icon} className="h-4 w-4" />}
                    <span>{label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  // Decide whether to render the record chip. Conditions:
  //   1. There's a live RecordContext with data + an object schema.
  //   2. Author hasn't opted out via `recordChrome: false`.
  // When both pass, we resolve the chip title from (in order):
  //   - explicit `schema.title` (interpolated against data),
  //   - common display fields on the record (`name`, `title`, `display_name`),
  //   - `${objectLabel} ${id}` as a last-resort.
  const hasRecord = !!(ctx?.data && (ctx as any)?.objectSchema);
  if (hasRecord && !disableRecordChrome) {
    const data: any = ctx!.data;
    const objSchema: any = (ctx as any).objectSchema;
    const rawObjectName: string | undefined = ctx!.objectName || objSchema?.name;
    const fallbackLabel = labelText(objSchema?.label) || objSchema?.name || ctx!.objectName || '';
    const objectLabel: string | undefined = rawObjectName
      ? tObjectLabel({ name: rawObjectName, label: fallbackLabel })
      : fallbackLabel || undefined;
    const primaryField: string | undefined = objSchema?.primaryField;
    // Honor objectSchema.titleFormat (e.g. `{first_name} {last_name}`).
    // Mirrors DetailView.resolveDisplayTitle's behaviour so default and
    // synthesized record pages produce the same title.
    const rawTitleFormat: any = objSchema?.titleFormat;
    const titleFormatStr: string | undefined =
      typeof rawTitleFormat === 'string'
        ? rawTitleFormat
        : (rawTitleFormat && typeof rawTitleFormat === 'object' && typeof rawTitleFormat.source === 'string')
          ? rawTitleFormat.source
          : undefined;
    const interpolatedTitleFormat = titleFormatStr
      ? cleanupTitleSeparators(interpolate(titleFormatStr, data, objSchema, fieldOptionLabel, rawObjectName).trim())
      : '';
    const resolvedTitle =
      explicitTitle ||
      (primaryField && data?.[primaryField]) ||
      (interpolatedTitleFormat && !interpolatedTitleFormat.includes('{') ? interpolatedTitleFormat : '') ||
      data?.name ||
      data?.full_name ||
      data?.title ||
      data?.subject ||
      data?.display_name ||
      data?.label ||
      (objectLabel && data?.id ? `${objectLabel} ${String(data.id).slice(0, 8)}` : '') ||
      objectLabel ||
      '';
    return (
      <header
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b',
          className,
        )}
        {...designer}
      >
        <div className="flex flex-col min-w-0 flex-1">
          {breadcrumb && (
            <div
              className="text-xs text-muted-foreground mb-1"
              data-page-breadcrumb-slot
            />
          )}
          <RecordTitleChip
            title={resolvedTitle}
            objectLabel={objectLabel}
            resourceId={data?.id ? String(data.id) : undefined}
            showStar={showStar}
            showCopyId={showCopyId}
            isFavorite={(ctx as any)?.isFavorite}
            onToggleFavorite={
              (ctx as any)?.onToggleFavorite
                ? () => (ctx as any).onToggleFavorite()
                : undefined
            }
          />
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {renderHeaderActions() ?? <div data-page-actions-slot className="shrink-0" />}
      </header>
    );
  }

  // Non-record fallback: keep the original bare-title layout so non-record
  // pages (dashboards, settings) stay unaffected.
  return (
    <header
      className={cn('flex flex-col gap-2 pb-4 border-b', className)}
      {...designer}
    >
      {breadcrumb && (
        <div className="text-xs text-muted-foreground" data-page-breadcrumb-slot />
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          {explicitTitle && (
            <h1 className="text-2xl font-semibold tracking-tight">{explicitTitle}</h1>
          )}
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {renderHeaderActions() ?? <div data-page-actions-slot />}
      </div>
    </header>
  );
};

ComponentRegistry.register('page:header', PageHeaderRenderer, {
  namespace: 'page',
  label: 'Page Header',
  category: 'layout',
});

// ---------------------------------------------------------------------------
// page:footer — thin <footer> wrapper.
// ---------------------------------------------------------------------------

const PageFooterRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <>
      <Separator className="my-4" />
      <footer
        className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}
        {...designer}
      >
        {renderChildren(schema?.children || schema?.body)}
      </footer>
    </>
  );
};

ComponentRegistry.register('page:footer', PageFooterRenderer, {
  namespace: 'page',
  label: 'Page Footer',
  category: 'layout',
  isContainer: true,
});

// ---------------------------------------------------------------------------
// page:sidebar — thin <aside> wrapper for region children.
// ---------------------------------------------------------------------------

const PageSidebarRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  return (
    <aside
      className={cn('flex flex-col gap-4 w-full md:w-80 shrink-0', className)}
      {...designer}
    >
      {renderChildren(schema?.children || schema?.body)}
    </aside>
  );
};

ComponentRegistry.register('page:sidebar', PageSidebarRenderer, {
  namespace: 'page',
  label: 'Page Sidebar',
  category: 'layout',
  isContainer: true,
});
