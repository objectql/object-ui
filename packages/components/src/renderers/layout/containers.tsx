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
 *   - PageContainerProps -> page:footer / page:sidebar / page:section
 *                           (the thin wrappers; one shared `children` slot)
 */

import React from 'react';
import { ComponentRegistry, ExpressionEvaluator, evalRowPredicate, getRecordDisplayName, toPredicateRecord } from '@object-ui/core';
import type { ComponentInput } from '@object-ui/core';
import { actionRendersAt } from '@object-ui/types';
import { useRecordContext, useAction, useCapabilityGate, usePredicateScope, usePageVariables, useInlineEdit, useActionTextLocalizer } from '@object-ui/react';
import { renderChildren, cn } from '../../lib/utils';
import { LazyIcon } from '../../lib/lazy-icon';
import { RelatedCountStore, useRelatedCountVersion } from '../../hooks/related-count-store';
import { useIsMobile } from '../../hooks/use-mobile';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui';
import { RecordTitleChip } from '../../custom/RecordTitleChip';
import { useObjectLabel, useSafeFieldLabel, useObjectTranslation, useSafeTranslate, createSafeTranslation, pickLocalized } from '@object-ui/i18n';
import { MoreHorizontal, RefreshCw } from 'lucide-react';

/**
 * The one authorable key the three thin containers publish — `page:section`,
 * `page:footer`, `page:sidebar` (objectui#4027).
 *
 * `@objectstack/spec` declares all three through one shared `PageContainerProps`
 * whose single key is `children` (objectstack#5775, PR objectstack#6281, merged
 * 2026-08-07). They had been declared `EmptyProps` upstream — "this component
 * takes zero props" — while their renderers have always rendered a child list;
 * this side carried the mirror-image gap, registering all three with no `inputs`
 * at all, so the designer had nothing to authorize and the generated
 * `sdui.manifest.json` published them as propless.
 *
 * Declaring it as a `slot` is what makes this an AUTHORING-surface change and
 * nothing else — no validation verdict moves in either direction:
 *   - `sdui-parser/src/codegen.ts:emitInterface` filters `slot` inputs out of
 *     `sdui-intrinsics.d.ts`, where `SduiBaseProps.children` already types it;
 *   - `sdui-parser/src/validate.ts` lists `children` in `BASE_PROPS`, so it was
 *     never an `unknown-prop` and does not become one;
 *   - `isContainer: true` (already set on all three) is what authorizes children
 *     to the parser's `not-a-container` check.
 * What does move is the designer: an authorable slot on the components whose
 * entire purpose is to render one.
 *
 * Shared rather than copied three times, mirroring the spec's own single
 * `PageContainerProps` — three identical literals are three places to drift.
 */
const PAGE_CONTAINER_INPUTS: ComponentInput[] = [
  {
    name: 'children',
    type: 'slot',
    label: 'Content',
    description: 'Child components rendered inside this container, in order',
  },
];

/**
 * How long the header's manual-refresh icon keeps spinning after a click
 * (objectui#3460).
 *
 * The refresh itself is fire-and-forget — it publishes on the #2269
 * invalidation bus and every mounted reader refetches in place, so there is no
 * completion signal to spin until. Against a warm backend the whole round trip
 * can finish inside one frame, which would render the click as "nothing
 * happened". This floor makes the click visibly land.
 */
const MANUAL_REFRESH_SPIN_MS = 650;

/**
 * Copy for the `page:tabs` count badge (objectstack#5506).
 *
 * The badge renders digits only, so its `aria-label` IS the badge as far as a
 * screen reader is concerned — and it used to be built by a template literal
 * that hardcoded both the English word and English pluralization.
 *
 * Two keys, NOT an i18next `_one`/`_other` pair: zh/ja/ko have no separate
 * singular form, so those packs would legitimately omit the `_one` half and
 * `all-locales-key-parity` would read that as a missing key. Same convention as
 * `detail.reactionCount`/`reactionCountOne` and `detail.relatedRecords`/
 * `relatedRecordOne`.
 *
 * `createSafeTranslation` rather than the per-call `useSafeTranslate` used
 * elsewhere in this file because these keys interpolate `{{count}}` and
 * `useSafeTranslate` carries no options bag.
 */
const TABS_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'common.itemCount': '{{count}} items',
  'common.itemCountOne': '{{count}} item',
};
const useTabsTranslation = createSafeTranslation(TABS_DEFAULT_TRANSLATIONS, 'common.itemCount');

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

/**
 * `locale` is passed in rather than re-detected. Both call sites already
 * resolve it from `useObjectTranslation().language`; this function used to
 * call `detectLocale()` and read `document.documentElement.lang` on its own,
 * so the tab label and the chrome around it could render from two different
 * language sources — they desync the moment the user switches language
 * in-app, because the DOM attribute and the i18n instance update
 * independently (objectui#2871).
 */
const translateLabel = (text: string, locale: string): string => {
  if (!text) return text;
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
  /**
   * Stable, semantic tab identity (e.g. `details`, `related:<childObject>`) —
   * used as the Radix value and as the URL token for `?tab=` sync
   * (objectui#2257). Falls back to an index-derived value when absent, which
   * is NOT stable across item-list changes; synthesized pages always set it.
   */
  value?: string;
  icon?: string;
  /**
   * Optional badge value rendered after the label (e.g. related-list count).
   * Numbers >= 1000 are shortened to `1.2k`-style.
   */
  count?: number | string;
  /**
   * Conditional tab (framework#2606): CEL predicate — when it evaluates FALSE
   * the whole tab (header + panel) is omitted from the strip. Canonical
   * ADR-0089 key only; the deprecated `visibility`/`visibleOn` aliases are
   * not read on this surface. Accepts a bare CEL string or the normalized
   * `{ dialect, source }` Expression envelope the spec emits at parse.
   */
  visibleWhen?: string | boolean | { dialect?: string; source?: string };
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

/**
 * Walk a tab's children (depth-first) and return true when a
 * `record:attachments` node is present. The Attachments tab
 * (objectstack#4358) derives its badge from a `sys_attachment` count scoped
 * by `(parent_object, parent_id)` — a two-key filter the related-list probe
 * shape can't express, so it gets its own detection + probe path below.
 */
const containsAttachmentsNode = (nodes: any): boolean => {
  if (!nodes) return false;
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const n of list) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'record:attachments') return true;
    const candidates = [n.children, n.properties?.children, n.properties?.items, n.body, n.items];
    for (const c of candidates) {
      if (c && containsAttachmentsNode(c)) return true;
    }
  }
  return false;
};

const PageTabsRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  // `useTabsTranslation` surfaces `language` itself (it wraps
  // `useObjectTranslation`), so the count-badge copy and the tab-label
  // localization below read the same session locale from one hook.
  const { t: tTabs, language } = useTabsTranslation();
  const rawItems: PageTabsItem[] = schema?.items || [];
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

  // Conditional tabs (framework#2606): an item-level `visibleWhen` CEL
  // predicate removes the ENTIRE tab (header + panel) when FALSE — unlike a
  // child component's own `visibleWhen`, which hides only the panel content
  // and leaves an empty tab header behind. Same binding environment as
  // page-component `visibleWhen`: record fields (bare and via `record.` /
  // `data.`), `user`/`current_user`, and page state as `page.<var>` — so tabs
  // appear/disappear live as page variables change. Canonical key only
  // (ADR-0089): the deprecated `visibility`/`visibleOn` aliases are not read
  // on this new surface.
  const predicateScope = usePredicateScope();
  const { variables: pageVariables } = usePageVariables();
  const recordData: any = ctx?.data;
  const isItemVisible = (it: PageTabsItem): boolean => {
    if (it?.visibleWhen === undefined || it?.visibleWhen === null) return true;
    const evaluator = new ExpressionEvaluator({
      ...(recordData && typeof recordData === 'object' ? recordData : {}),
      ...predicateScope,
      current_user: (predicateScope as any)?.user,
      record: recordData,
      data: recordData,
      page: pageVariables,
    });
    // evaluateCondition is fail-open (unparseable predicate → visible) — the
    // same semantics SchemaRenderer applies to component-level `visibleWhen`.
    return evaluator.evaluateCondition(it.visibleWhen);
  };
  const visibleFlags = rawItems.map(isItemVisible);
  // Keep the filtered array's identity stable while visibility is unchanged
  // (usePageVariables returns a fresh object per render outside a Page), so
  // the count-probe memo/effect below don't re-walk on unrelated renders.
  const visibleKey = visibleFlags.join(',');
  const items = React.useMemo(
    () => rawItems.filter((_, i) => visibleFlags[i]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawItems, visibleKey],
  );
  // Subscribe to the store version so badges re-render on invalidation /
  // remote count updates, and RE-PROBE freshly-invalidated keys (#2269): the
  // version is a dep of the probe effect below, so an invalidation (deleted
  // cache entries) triggers a refetch instead of leaving the badge stale.
  const countsVersion = useRelatedCountVersion();

  // Snapshot which tabs (index → derived (objectName, relationshipField))
  // need a count probe. Cached per items reference so we don't re-walk on
  // every render.
  const recordObject: string | undefined = ctx?.objectName;
  const probeTargets = React.useMemo(() => {
    const out = new Map<number, Array<{ objectName: string; relationshipField?: string; attachments?: boolean }>>();
    items.forEach((it, idx) => {
      if (it.count !== undefined && it.count !== null && it.count !== '') return;
      const lists = collectRelatedLists((it as any).children);
      const probes: Array<{ objectName: string; relationshipField?: string; attachments?: boolean }> = [];
      for (const rl of lists) {
        const objectName: string | undefined = rl?.properties?.objectName || rl?.objectName;
        if (!objectName) continue;
        const relationshipField: string | undefined =
          rl?.properties?.relationshipField || rl?.relationshipField;
        probes.push({ objectName, relationshipField });
      }
      // Attachments tab (objectstack#4358): count sys_attachment rows scoped
      // to this record. The synthetic `relationshipField` below is only a
      // cache-key discriminator — the actual filter is injected by the probe
      // wrapper in the effect, since the store's single-key filter shape
      // can't express `(parent_object, parent_id)`.
      if (recordObject && containsAttachmentsNode((it as any).children)) {
        probes.push({ objectName: 'sys_attachment', relationshipField: `attachments:${recordObject}`, attachments: true });
      }
      if (probes.length > 0) out.set(idx, probes);
    });
    return out;
  }, [items, recordObject]);

  React.useEffect(() => {
    if (!ds || typeof ds.find !== 'function') return;
    if (probeTargets.size === 0) return;
    let cancelled = false;
    for (const probes of probeTargets.values()) {
      for (const probe of probes) {
        // RelatedCountStore.fetch is internally deduplicated, so concurrent
        // mounts of multiple tab strips don't generate redundant requests.
        // The attachments probe overrides the store-built single-key filter
        // with the two-key `(parent_object, parent_id)` scope; the synthetic
        // relationshipField keeps the cache key unique, and the store's
        // `sys_attachment` invalidation (data-change bus) still hits it.
        const finder = probe.attachments
          ? (object: string, query: any) =>
              ds.find(object, {
                ...query,
                $filter: { parent_object: recordObject, parent_id: parentId },
              })
          : (object: string, query: any) => ds.find(object, query);
        void RelatedCountStore.fetch(
          finder,
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
  }, [ds, probeTargets, parentId, countsVersion]);

  // Compute the displayed count by reading the store for every probe target.
  // useRelatedCountVersion above subscribed us to changes, so any store update —
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

  // Prefer an item's own STABLE `value` (semantic keys like `details` /
  // `related:<child>`, emitted by buildDefaultTabs — objectui#2257); fall back
  // to the index-derived value for authored schemas that don't declare one.
  // Stable values are what make the active tab URL-addressable: an index
  // value would silently point at a different tab when the item list changes.
  const itemsWithValue = items.map((it, idx) => ({
    ...it,
    value: typeof (it as any).value === 'string' && (it as any).value !== '' ? (it as any).value : `tab-${idx}`,
    // pickLocalized first (honours `{ en, zh }` / `{ default }`); translateLabel
    // then maps any plain-English well-known token (Details/Related/…) to the locale.
    labelStr: translateLabel(pickLocalized(it.label, language), language),
    // Explicit spec count wins; otherwise fall back to the derived probe.
    count: it.count !== undefined && it.count !== null && it.count !== ''
      ? it.count
      : computeCount(idx),
  }));

  // Host-provided initial tab (e.g. app-shell restoring `?tab=` — the active
  // tab is state that must SURVIVE this component remounting, so it cannot
  // live only in Radix's internal uncontrolled state). Honored only when it
  // names an actual tab; otherwise the first tab wins as before.
  const requestedDefault: string | undefined = (schema as any)?.defaultTab;
  const defaultValue =
    (requestedDefault && itemsWithValue.some((it) => it.value === requestedDefault)
      ? requestedDefault
      : undefined) ?? itemsWithValue[0]?.value;
  // Host callback on tab switch (app-shell writes `?tab=` with replace).
  const onTabChange: ((value: string) => void) | undefined = (schema as any)?.onTabChange;

  // Controlled active tab so a CONDITIONAL tab can vanish under the user
  // (framework#2606): when the active tab's `visibleWhen` flips FALSE (a page
  // variable or record change), fall back to the first visible tab instead of
  // leaving Radix pointing at a value with no trigger/panel — a blank content
  // area. The user's own selection is kept whenever it is still visible, and
  // restored semantics for `?tab=` (`defaultTab`) are unchanged.
  const [selectedValue, setSelectedValue] = React.useState<string | undefined>(defaultValue);
  const activeValue =
    (selectedValue && itemsWithValue.some((it) => it.value === selectedValue)
      ? selectedValue
      : undefined) ?? itemsWithValue[0]?.value ?? '';

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
      value={activeValue}
      onValueChange={(v) => {
        setSelectedValue(v);
        onTabChange?.(v);
      }}
      orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cn(className, isVertical && 'flex gap-4 w-full')}
      {...designer}
    >
      {/* Hide the tab strip entirely when there's only one tab — a single
          pill labelled "Details" is visual clutter rather than an
          affordance. Authors who want the strip even at length 1 pass
          `alwaysShowStrip: true`.

          BOTH spellings are read, canonical FIRST, and the top-level arm is
          why: `alwaysShowStrip` is a PUBLISHED input since objectui#4668, and
          `inputs` publishes top-level keys — `gen-manifest.ts`,
          `sdui-intrinsics.d.ts` and `sdui-parser`'s prop walk all judge the
          flat `{ type: 'page:tabs', alwaysShowStrip: true }`. This read was
          `properties.*`-only, so that flat form passed every one of those
          layers and was then dropped here. Measured on a one-tab schema before
          the arm was added: the wrapped form showed the strip, the flat form
          did not — publishing the key without this arm would have advertised a
          write the renderer throws away, which is the exact defect the parity
          gate exists to prevent, one layer further in.

          `SchemaRenderer` hoists `properties.*` onto the schema (it keeps the
          bag intact for the collision-prone `type` / `id`), so the canonical
          arm already covers the wrapped form; the `properties` arm stays for
          any path that reaches this renderer without that hoist. The same dual
          read `maxVisible` / `mobileMaxVisible` carry below, for the same
          reason. */}
      {(itemsWithValue.length > 1 ||
        schema?.alwaysShowStrip === true ||
        schema?.properties?.alwaysShowStrip === true) && (
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
                  // Interpolate the FORMATTED count so the accessible name and
                  // the visible digits never disagree (`1.2k`, not `1200`);
                  // plurality is chosen from the raw numeric value. Passing a
                  // STRING as `count` is deliberate: i18next only runs its own
                  // plural resolution when `count` is not a string, so the
                  // repo's two-key scheme stays in charge of the choice.
                  aria-label={tTabs(
                    Number(item.count) === 1 ? 'common.itemCountOne' : 'common.itemCount',
                    { count: formatTabCount(item.count) },
                  )}
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

ComponentRegistry.register('tabs', PageTabsRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Tabs',
  category: 'layout',
  isContainer: true,
  // `alwaysShowStrip` is DECLARED, not merely honoured (objectui#4668).
  // @objectstack/spec 17.0.0 GA declares it on `PageTabsProps` and this
  // renderer has read it since the one-tab strip was first suppressed, while
  // `inputs` omitted it — so the manifest, the generated `.d.ts` and the
  // designer panel all said the key did not exist, `sdui-parser` reported
  // `unknown-prop` on an author who wrote it anyway, and the renderer honoured
  // it regardless. Same defect as `record:details.hideFields` in objectui#3808.
  inputs: [
    { name: 'items', type: 'array', label: 'Tabs', required: true, description: 'Tab definitions [{ label, value?, icon?, count?, visibleWhen?, children }] — value is the stable ?tab= URL token, count auto-derives from record:related_list descendants when omitted' },
    { name: 'tabStyle', type: 'enum', label: 'Style', enum: ['line', 'card', 'pill'], defaultValue: 'line' },
    { name: 'position', type: 'enum', label: 'Position', enum: ['top', 'left'], defaultValue: 'top' },
    { name: 'alwaysShowStrip', type: 'boolean', label: 'Always Show Tab Strip', defaultValue: false, description: 'Keep the tab strip visible when only one tab survives. Default false: a lone pill is clutter rather than an affordance, so a one-tab strip is hidden and its panel renders bare. Count the tabs AFTER each item visibleWhen predicate has been evaluated — a page authored with four tabs of which three are conditional reaches this rule whenever the other three are false.' },
  ],
});

// ---------------------------------------------------------------------------
// page:card
// ---------------------------------------------------------------------------

const PageCardRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const { language } = useObjectTranslation();
  // Resolve the title via pickLocalized so inline-i18n shapes (`{ en, zh }`)
  // render in the active locale. `labelText` only understands `{ default, value }`
  // and would silently blank an `{ en, zh }` title — e.g. the Cloud Pricing
  // page's per-plan name + price headings vanished in both locales.
  const title = pickLocalized(schema?.title, language);
  const bordered = schema?.bordered !== false;
  // `children` is the authorable spelling; `body` is a READ-ONLY back-compat
  // fallback for documents already stored with it (objectui#4027).
  //
  // `body` was retired from the contract by objectstack#5775 (PR #6281, ADR-0087
  // D2): it was a second spelling of the slot every other container — grid, flex,
  // section, tabs items — calls `children`, and the spec now declares `children`
  // on `PageCardProps` and rejects `body` by name. The registration below stopped
  // publishing `body` in the same change, so nothing teaches it any more.
  //
  // The READ deliberately stays, and stays FIRST: a stored document written
  // against the old contract still renders until the ADR-0087 D2 conversion
  // rewrites `body` → `children` at load time. Order matters only for a document
  // carrying both, which the conversion is what resolves; deleting the read
  // before the conversion is live would blank an existing card's content
  // silently — the `page-header-subtitle-alias` sequencing precedent, verbatim.
  const body = schema?.body ?? schema?.children;
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

ComponentRegistry.register('card', PageCardRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Card',
  category: 'layout',
  isContainer: true,
  inputs: [
    // Two arms, because the contract has two (objectui#3832): the spec's
    // `PageCardProps.title` accepts a plain string OR an inline translation map,
    // and the renderer resolves both (`pickLocalized` at the read site above).
    // While this said `type: 'string'` the manifest gate reported
    // `type-mismatch` on the map form — the shape this input's own description
    // teaches — so the block contradicted itself on a write it recommended.
    { name: 'title', type: ['string', 'object'], label: 'Title', description: 'Accepts an inline translation map ({ en, "zh-CN", … })' },
    { name: 'bordered', type: 'boolean', label: 'Bordered', defaultValue: true },
    // The card's content slot, respelled from `body` to `children`
    // (objectui#4027). One slot, one spelling: objectstack#5775 (PR #6281)
    // retired `PageCardProps.body` and declared `children` in its place, so a
    // designer that kept offering `body` was teaching a key the contract now
    // rejects by name. The renderer still READS `body` for stored documents —
    // see the comment at its read site above — but a back-compat read is not a
    // second authorable spelling, and `inputs` is the authoring surface.
    { name: 'children', type: 'slot', label: 'Content', description: 'Card content components, in order (the card body slot)' },
    { name: 'footer', type: 'slot', label: 'Footer' },
  ],
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
  const { language } = useObjectTranslation();
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
    labelStr: translateLabel(pickLocalized(it.label, language), language),
  }));

  const defaultOpen = itemsWithValue
    .filter((it) => it.collapsed === false)
    .map((it) => it.value);

  // Radix Accordion has separate single/multiple variants; render the right
  // one without trying to share a generic prop bag.
  const commonChildren = itemsWithValue.map((item) => (
    <AccordionItem key={item.value} value={item.value} className={itemClass}>
      <AccordionTrigger className="text-sm font-semibold tracking-tight hover:no-underline">
        {/* One wrapping element, not two siblings — AccordionTrigger's
            underlying primitive (`ui/accordion.tsx`, no-touch zone) lays its
            children out with `justify-between` against the auto-appended
            ChevronDown, so an icon + label passed as separate flex children
            would be spread apart instead of grouped (same pattern as the
            `page:tabs` trigger below, minus this wrapper — that trigger's
            own class list uses `justify-center`, not `justify-between`). */}
        <span className="flex items-center gap-1.5">
          {item.icon && (
            <LazyIcon
              name={item.icon}
              className="h-3.5 w-3.5 shrink-0 opacity-70"
              aria-hidden
            />
          )}
          <span>{item.labelStr}</span>
        </span>
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

ComponentRegistry.register('accordion', PageAccordionRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Accordion',
  category: 'layout',
  isContainer: true,
  inputs: [
    { name: 'items', type: 'array', label: 'Panels', required: true, description: 'Panel definitions [{ label, icon?, collapsed?, children }] — collapsed: false opens a panel by default' },
    { name: 'allowMultiple', type: 'boolean', label: 'Allow Multiple Open', defaultValue: false },
    { name: 'variant', type: 'enum', label: 'Variant', enum: ['flush', 'card'], defaultValue: 'flush' },
  ],
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

ComponentRegistry.register('section', PageSectionRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Section',
  category: 'layout',
  isContainer: true,
  inputs: PAGE_CONTAINER_INPUTS,
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

/**
 * One-time diagnostics for header-action `visible` / `hidden` predicates
 * (#2358). Warn-once per (action, predicate) pair so re-renders don't spam the
 * console, mirroring ActionEngine's `warnHiddenPredicate` (#2183).
 *
 * The *fault* half of these diagnostics is no longer written here: since
 * objectui#3521 the predicates run through `evalRowPredicate`, whose own
 * warn-once machinery reports a faulting predicate under the label this file
 * passes (`page:header action "…" visible`) — one report per broken predicate,
 * identical in wording to the row kebab and the selection bar. What stays local
 * is the missing-field diagnostic below, which explains a *cause* the engine
 * cannot see (fields stripped from the payload server-side).
 */
const _warnedHeaderPredicates = new Set<string>();

/**
 * Warn when a predicate references `record.<field>` keys that are absent from
 * the loaded record payload (#2358 trap 3): the server strips `hidden: true`
 * fields from detail payloads, so such a predicate silently resolves to
 * `undefined` and fail-closed hides the action with no error to catch. A key
 * that is present-but-null does NOT trigger this (legitimately empty field).
 * Skipped while the record is empty/loading to avoid false positives.
 */
function warnMissingRecordFields(name: unknown, source: string, record: unknown): void {
  if (!record || typeof record !== 'object' || Object.keys(record as object).length === 0) return;
  const re = /\brecord\.([A-Za-z_][A-Za-z0-9_]*)/g;
  const missing: string[] = [];
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (!(m[1] in (record as Record<string, unknown>)) && !missing.includes(m[1])) missing.push(m[1]);
  }
  if (missing.length === 0) return;
  const key = `missing::${String(name)}::${source}`;
  if (_warnedHeaderPredicates.has(key)) return;
  _warnedHeaderPredicates.add(key);
  console.warn(
    `[page:header] action "${String(name)}" predicate references record field(s) ` +
    `not present in the record payload: ${missing.join(', ')}. Predicate: ${source}. ` +
    `Hidden (hidden: true) fields are stripped from detail payloads server-side, ` +
    `so a predicate gating on one may evaluate to a hide-by-default verdict.`,
  );
}

const PageHeaderRenderer: React.FC<any> = ({ schema, className, ...props }) => {
  const { designer } = splitDesignerProps(props);
  const ctx = useRecordContext();
  // Record-level inline-edit session (objectui#2572 item 4): while a shared
  // inline draft is active, header actions flagged `disableDuringInlineEdit`
  // (the host's Edit CTA) grey out so the classic form-edit surface can't be
  // stacked on top of the live draft — two competing edit sessions with no
  // reconciliation. `useInlineEdit` is null outside an InlineEditProvider
  // (non-record pages), which leaves everything enabled.
  const inlineEditing = !!useInlineEdit()?.editing;
  // Ambient host scope (signed-in user / app / features), fed by app-shell's
  // ExpressionProvider. Needed so header-action `visible` CEL predicates can
  // gate on `ctx.user.*` (e.g. sys_environment "Change Plan (admin)" →
  // `ctx.user.isPlatformAdmin == true`). Without it the action-visibility
  // evalCtx below only had record fields, so every `ctx.user`-gated header
  // action was silently filtered out.
  const predicateScope = usePredicateScope();
  const { execute } = useAction();
  // [ADR-0066 D4 / framework#3923] Shared capability gate — see filterAction.
  const mayInvoke = useCapabilityGate();
  const isMobile = useIsMobile();
  const { objectLabel: tObjectLabel } = useObjectLabel();
  // The ONE resolver for a declared action's authored strings (objectui#4265).
  // This header used to localize `label` only — via `useObjectLabel().actionLabel`
  // inline below — and dispatch the action's `confirmText` / `successMessage`
  // untouched, so on an authored record page one bundle entry met two fates: the
  // button rendered the translation and the confirm dialog rendered the English
  // literal from the metadata.
  const localizeActionTexts = useActionTextLocalizer();
  const { fieldOptionLabel } = useSafeFieldLabel();
  const { language } = useObjectTranslation();
  // Console-supplied chrome copy (objectstack#5407). `detail.moreActions` is
  // the SAME key `action:menu`'s overflow trigger already reads, so the two
  // `⋯` buttons a record page can show cannot read differently per locale.
  const tt = useSafeTranslate();
  // ── Manual refresh (objectui#3460) ────────────────────────────────────────
  // Rendered as page CHROME at the far end of the header row, NOT as a header
  // action: business/system actions come and go per object and record state,
  // while refresh has to sit in the same place on every record page. Keeping it
  // out of the action pipeline also keeps it out of that pipeline's capability
  // gating and `maxVisible` overflow budget — reading a record you are already
  // looking at is not a permissioned operation, and the button must never be
  // the one that gets collapsed into `⋯`.
  //
  // The host opts in by providing `RecordContext.refresh`; hosts that don't
  // (previews, embedded drawers, non-record pages) render exactly as before.
  const hostRefresh = ctx?.refresh;
  const [manualRefreshing, setManualRefreshing] = React.useState(false);
  const refreshSpinTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(refreshSpinTimer.current), []);
  const handleManualRefresh = React.useCallback(() => {
    if (!hostRefresh) return;
    void hostRefresh();
    setManualRefreshing(true);
    clearTimeout(refreshSpinTimer.current);
    refreshSpinTimer.current = setTimeout(
      () => setManualRefreshing(false),
      MANUAL_REFRESH_SPIN_MS,
    );
  }, [hostRefresh]);
  // Spec bridge may either inline `properties.*` onto the node or preserve
  // the raw bag (see record:quick_actions for the same pattern). Read from
  // both so a `{ properties: { title } }` schema is rendered correctly.
  const titleSrc = schema?.title ?? schema?.properties?.title;
  const subtitleSrc = schema?.subtitle ?? schema?.properties?.subtitle;
  const headerObjectSchema: any = (ctx as any)?.objectSchema;
  const headerObjectName: string | undefined = ctx?.objectName || headerObjectSchema?.name;
  const explicitTitle = interpolate(
    pickLocalized(titleSrc, language),
    ctx?.data,
    headerObjectSchema,
    fieldOptionLabel,
    headerObjectName,
  );
  const subtitle = interpolate(
    pickLocalized(subtitleSrc, language),
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

  // ── Action predicates: ONE dialect, ONE entry (objectui#3521) ──────────────
  //
  // `visible` / `hidden` / `disabled` on a header action are evaluated by
  // `evalRowPredicate` — the SAME entry the row kebab (`RowActionMenu`), the
  // selection bar (`partitionBulkRows`) and conditional formatting have used
  // since objectui#1584 / ADR-0058. A bare string is therefore CEL, which is
  // what `@objectstack/spec` types `ActionSchema.visible` as and what the
  // server enforces with, so the CEL-only constructs an author writes once
  // (`record.tags.size() > 0`, `'"red" in record.f_multiselect'`,
  // `record.f_date < today()`) now reach a verdict here instead of throwing in
  // a JS parser and fail-closed hiding the button. Before this, the header was
  // the last surface still handing EVERY predicate to the legacy JS evaluator,
  // so one piece of metadata meant two different things depending on whether
  // the reader was a list row or a record page.
  //
  // A legacy-dialect string (`${…}`, `===`/`!==`, `?.`, `??`, JS-only methods
  // like `.includes()`) still routes to the legacy evaluator inside
  // `evalRowPredicate` via `isLegacyDialectSource`, with its one-time
  // deprecation warning — existing authored pages do not regress.
  //
  // Fail-closed and warn-once come from that same entry (`fallback: false`,
  // `warnOnError: true`), so a broken predicate hides its button here exactly
  // as it does on the other surfaces, and says so once.
  const headerPredicateFields = headerObjectSchema?.fields;
  const headerPredicateScope = React.useMemo(() => {
    const scopeUser = (predicateScope as any)?.user;
    // Relation fields bind as the FOREIGN KEY the server stores, not as the
    // record `$expand` substituted for them (objectui#3501): the detail fetch
    // expands every relation it can, so `record.owner == os.user.id` — the
    // spelling that works server-side and in a bare list — could only ever be
    // false here, while `record.owner.id` faults on an empty lookup. The
    // top-level `record` / bare-field / `data.*` bindings get this same
    // normalization from `evalRowPredicate`'s `fields` option below; this copy
    // is for the `ctx.*` namespace, which the engine does not build. Display
    // (`interpolate` above) still reads the raw `ctx.data`, which is what
    // renders the related record's NAME.
    const predicateRecord = toPredicateRecord(ctx?.data, headerPredicateFields);
    return {
      // The ambient host scope (`features` / `app` / `current_user` / …) binds
      // top-level, the way it does for a row predicate — the header used to
      // expose it only under `ctx.*`.
      ...(predicateScope && typeof predicateScope === 'object' ? predicateScope : {}),
      user: scopeUser,
      // Server-CEL-parity identity alias (#2358 trap 1): the spec's canonical
      // CEL identity scope is `os.user.*`, so a predicate authored against the
      // server dialect resolves here too instead of faulting (fail-closed).
      os: (predicateScope as any)?.os ?? { user: scopeUser },
      ctx: {
        user: scopeUser,
        record: predicateRecord,
        data: predicateRecord,
        app: (predicateScope as any)?.app,
        features: (predicateScope as any)?.features,
      },
    };
  }, [predicateScope, ctx?.data, headerPredicateFields]);

  /**
   * Evaluate one header-action predicate. `label` is the locator carried into
   * the fault warning, so a hidden button names itself in the console.
   *
   * `fallback: false` is what preserves both historical fail directions: a
   * faulting `visible`/`disabled` hides/enables nothing new (fail-closed), and
   * a faulting `hidden` leaves the action rendered exactly as the old
   * `catch → undefined` did.
   */
  const evalHeaderPredicate = React.useCallback(
    (pred: unknown, label: string): boolean =>
      evalRowPredicate(pred as never, ctx?.data ?? {}, {
        fallback: false,
        scope: headerPredicateScope,
        fields: headerPredicateFields,
        warnOnError: true,
        label,
      }),
    [ctx?.data, headerPredicateScope, headerPredicateFields],
  );

  const headerActionsRaw = React.useMemo<any[]>(() => {
    const recordData: any = ctx?.data;
    // The record binds three ways inside `evalRowPredicate` — `record.status`
    // (spec/canonical), bare `status` (the row-action shorthand) and
    // `data.status` (legacy) — so no authoring convention silently falls
    // through to the JS global scope the way a bare identifier used to
    // (`window.status`, an empty string, filtering the action out). The host
    // scope and the `ctx.*` / `os.user` namespaces come from
    // `headerPredicateScope` above. See `evalHeaderPredicate`.
    const filterAction = (a: any): boolean => {
      // [ADR-0066 D4 / framework#3923] Capability gate — the UI half of the
      // dual-surface `requiredPermissions` contract.
      //
      // `page:header` filters its own actions rather than going through
      // `ActionEngine.getActionsForLocation`, so the engine's gate never ran on
      // the ONE surface `record_header` / `record_more` actions live on: a
      // button declaring a capability nobody holds rendered, and only the
      // server's 403 stopped it — and only for platform action routes, never
      // for a `type: 'api'` action pointed at a custom endpoint. Same rule as
      // the engine, so the two surfaces can't disagree: hide unless the caller
      // holds ALL declared capabilities.
      //
      // Fail-OPEN when the caller's capabilities are unknown (no
      // ActionProvider user, no host predicate scope) — unknown is not denied,
      // and hiding on missing data is the worse regression.
      if (!mayInvoke(a?.requiredPermissions)) return false;
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
            warnMissingRecordFields(a?.name, src, recordData);
            // The predicate is handed over WHOLE, not as its `source`: a
            // `{ dialect: 'cel' }` envelope is authoritative CEL and must not
            // be flattened onto a dialect guess — the same rule the row kebab
            // applies by passing `def.visible` through untouched.
            // On a fault (`fallback: false`) the action hides rather than risk
            // surfacing a destructive button in the wrong state.
            if (!evalHeaderPredicate(v, `page:header action "${String(a?.name)}" visible`)) {
              return false;
            }
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
            warnMissingRecordFields(a?.name, src, recordData);
            // `fallback: false` keeps `hidden`'s historical fail direction: a
            // predicate that cannot be evaluated does NOT hide the action (the
            // old `catch → undefined` read as "not hidden").
            if (evalHeaderPredicate(h, `page:header action "${String(a?.name)}" hidden`)) {
              return false;
            }
          }
        }
      }
      return true;
    };
    // Placement, for AUTHORED actions only (objectui#3142). The header serves
    // TWO locations — `record_header` (inline) and `record_more` (the ⋯
    // overflow menu; see renderHeaderActions, #2358 trap 2) — so declaring
    // either one places the action here. A missing or empty `locations` used
    // to mean "show here", which made this header the one surface where an
    // action nobody placed still appeared; `RecordDetailView` pre-filters the
    // same actions strictly, and the synthesizer's own contract already says
    // "must include `locations: ['record_header']` to render"
    // (buildDefaultPageSchema.ts), so the leniency contradicted both.
    const placedOnHeader = (a: any): boolean =>
      actionRendersAt(a, 'record_header') || actionRendersAt(a, 'record_more');
    const authored = Array.isArray(rawHeaderActions)
      ? rawHeaderActions.filter(a => placedOnHeader(a) && filterAction(a))
      : [];
    // Host-injected chrome (Edit / Share / Delete / Open-in-new-tab) is placed
    // by the HOST, not authored — so it is not location-filtered, matching
    // `action:bar`'s `systemActions` carve-out. Before #3142 this slot WAS
    // location-filtered here and not there, so the same `sys_delete` obeyed
    // two different rules depending on which renderer drew the header.
    // Capability and visibility gates still apply.
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
    // Order the merged list before the inline/overflow split — the same rule
    // action:bar applies (objectui#2339):
    //   1. `order` ascending (unset = 0; lower = more prominent)
    //   2. `variant === 'primary'` as a tie-break within equal order
    //   3. original registration order (stable) for the remaining ties
    // This is what lets metadata declare which actions claim the inline
    // button slots vs. the `⋯` overflow menu (objectui#2361).
    const needsOrdering = out.some(
      (a) => a?.order !== undefined || a?.variant === 'primary',
    );
    if (!needsOrdering) return out;
    return [...out].sort((a, b) => {
      const byOrder = (a?.order ?? 0) - (b?.order ?? 0);
      if (byOrder !== 0) return byOrder;
      const ap = a?.variant === 'primary' ? 0 : 1;
      const bp = b?.variant === 'primary' ? 0 : 1;
      return ap - bp; // equal → stable sort preserves registration order
    });
    // `evalHeaderPredicate` closes over `predicateScope` (via
    // `headerPredicateScope`) and the object's fields, so it replaces the raw
    // scope in this list rather than adding to it.
  }, [rawHeaderActions, hostSystemActions, ctx?.data, evalHeaderPredicate]);

  /**
   * Localize the surviving actions ONCE, here, so the button text and the
   * dispatched def cannot disagree (objectui#4265).
   *
   * Both the display path (`resolveLabel` below) and the execution path
   * (`dispatchHeaderAction` → ActionRunner, which reads `confirmText` for the
   * confirm dialog body and `successMessage` for the toast) read this same
   * list, so one localization covers both. Localizing after the filter/order
   * memo keeps translation out of the predicate gates — a `visible` CEL is
   * evaluated against the record, never against display text.
   *
   * Idempotent by construction: a host that already localized these actions
   * (RecordDetailView's `recordHeaderActions`, which feeds the SYNTHESIZED page
   * schema) passes the translated string back in as the bundle fallback, and
   * the same key resolves to the same value. Only the authored-page path —
   * where `schema.actions` reaches this renderer straight from page metadata —
   * changes behaviour.
   */
  const headerActions = React.useMemo<any[]>(
    () => headerActionsRaw.map((a: any, idx: number) =>
      localizeActionTexts(ctx?.objectName, a, {
        // Last-resort display text only; `ActionDef.name` is the translation
        // key and the spec makes it required.
        fallbackLabel: (typeof a?.id === 'string' && a.id) || `Action ${idx + 1}`,
      }),
    ),
    [headerActionsRaw, localizeActionTexts, ctx?.objectName],
  );

  // Dispatch shape for record-page header actions (objectui#3391) — the same
  // shape ObjectGrid row actions, RelatedRecordActionsBridge, and
  // DeclaredActionsBar use: stash the current record under `params._rowRecord`
  // (the api handler's `{field}` URL-interpolation + record-id source) and
  // surface a spec-shaped `params` ARRAY as `actionParams` (the runner's
  // param-dialog input), reserving `params` for the stash. Without this, a
  // `record_header` `type:'api'` action targeting `/api/v1/data/:object/{id}`
  // was sent with the literal `{id}` (`%7Bid%7D` on the wire) while the SAME
  // declaration interpolated fine from `list_item`. Dispatching a fresh object
  // also keeps ActionRunner's collected-params merge (which writes
  // `action.params` in place) from mutating the authored schema node between
  // invocations. Non-record hosts (no RecordContext data) dispatch unchanged.
  const record = ctx?.data;
  const dispatchHeaderAction = React.useCallback((action: any) => {
    if (!record || typeof record !== 'object') {
      void execute(action);
      return;
    }
    const { params: rawParams, ...rest } = (action ?? {}) as Record<string, any>;
    const dispatch: any = { ...rest };
    if (Array.isArray(rawParams)) {
      if (!dispatch.actionParams && rawParams.length > 0) dispatch.actionParams = rawParams;
      dispatch.params = { _rowRecord: record };
    } else {
      dispatch.params = { ...(rawParams || {}), _rowRecord: record };
    }
    void execute(dispatch);
  }, [record, execute]);

  const renderHeaderActions = () => {
    if (headerActions.length === 0) return null;
    // The label is already resolved — the `headerActions` memo above ran every
    // action through the shared localizer (`{ns}.objects.{objectName}
    // ._actions.{name}.label`, authored literal as fallback), together with the
    // `confirmText` / `successMessage` that ride the same dispatch. Reading it
    // back off the def is what keeps the button and the confirm dialog on one
    // bundle entry (objectui#4265).
    const resolveLabel = (action: any) => action?.label ?? '';
    // Inline/overflow split (objectui#2361) — up to `maxVisible` actions
    // render side-by-side as buttons; the rest collapse into a `⋯` overflow
    // menu. Which actions stay inline is metadata-driven:
    //   1. actions declaring ONLY `record_more` (not `record_header`) are the
    //      spec's "overflow menu under the ⋯ button" location — they are
    //      always routed into the overflow menu and never occupy an inline
    //      slot, regardless of how few actions the header has (#2358 trap 2);
    //   2. `component: 'action:menu'` forces an action into the `⋯` menu
    //      regardless of the count (chrome actions like Share/Delete);
    //   3. the remainder is pre-sorted by `order` / `variant: 'primary'`
    //      (see the headerActions memo above), so the first `maxVisible`
    //      claim the inline slots.
    // `maxVisible` / `mobileMaxVisible` are overridable on the page:header
    // schema and default to 3 / 1. This still keeps the header from drowning
    // in 4–5 buttons on every record page, while letting multi-action objects
    // surface several primary buttons at once.
    //
    // `readMax` enforces the SPEC's value domain rather than a laxer renderer
    // tolerance (objectui#5006). Measured on `ComponentPropsMap['page:header']`
    // at @objectstack/spec 17.0.0, both keys are a POSITIVE SAFE INTEGER
    // (`{format:'safeint'}` + `{check:'greater_than',value:0,inclusive:false}`),
    // so `0`, `-1`, `1.5` and anything past `Number.MAX_SAFE_INTEGER` are all
    // rejected by the contract. This reader used to be the loosest of the three
    // authorities — it accepted `0` and floored fractions — so a value that
    // `os validate` / `os build` rejects outright still changed what rendered
    // here, and the loosest layer decided behaviour. A contract-rejected value
    // now falls back to the default instead of taking effect.
    //
    // `Number.isSafeInteger` is the exact translation of `safeint`, not an
    // approximation: plain `Number.isInteger` would admit `2**53 + 2` and
    // `1e21`, both of which spec rejects (`Too big: expected int to be
    // <= 9007199254740991`). It also subsumes the old `Number.isFinite` guard,
    // since Infinity and NaN are not safe integers.
    //
    // ⛔ Do NOT re-lax this into a tolerant read. objectui's authoring-time
    // gates stay coarse by ruling (maintainer, 2026-08-17): `ComponentInput`
    // keeps its single `number` arm and `checkType` is not bound to spec, so
    // SPEC IS THE SOLE JUDGE OF VALUES — which makes agreeing with it this
    // renderer's job. Rejections are pinned in `page-header-actions.test.tsx`.
    const readMax = (v: any): number | undefined =>
      typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : undefined;
    const maxVisible = isMobile
      ? (readMax(schema?.mobileMaxVisible ?? schema?.properties?.mobileMaxVisible) ?? 1)
      : (readMax(schema?.maxVisible ?? schema?.properties?.maxVisible) ?? 3);
    const isMoreOnly = (a: any): boolean =>
      Array.isArray(a?.locations) &&
      a.locations.length > 0 &&
      a.locations.includes('record_more') &&
      !a.locations.includes('record_header');
    const moreOnlyActions = headerActions.filter(isMoreOnly);
    const menuOnly = headerActions.filter(
      (a: any) => !isMoreOnly(a) && a?.component === 'action:menu',
    );
    const buttonable = headerActions.filter(
      (a: any) => !isMoreOnly(a) && a?.component !== 'action:menu',
    );
    const inlineActions = buttonable.slice(0, maxVisible);
    const overflowActions = [
      ...buttonable.slice(maxVisible),
      ...menuOnly,
      ...moreOnlyActions,
    ];
    const useOverflow = overflowActions.length > 0;
    // Resolve a `disabled` predicate against the record — a boolean OR an
    // expression (`'record.status == …'` or the `{ dialect, source }`
    // envelope). Without this a CEL `disabled` silently did nothing (only
    // boolean was honoured).
    //
    // Same entry, same bindings and same fail direction as `visible` above:
    // ONE evaluator for this surface, so a `disabled` predicate cannot speak a
    // different dialect from the `visible` predicate sitting next to it in the
    // same action (objectui#3521). A faulting predicate still leaves the button
    // enabled (`fallback: false`), it just says so once now.
    const resolveDisabled = (d: any, actionName: unknown): boolean => {
      if (d === undefined || d === null) return false;
      if (typeof d === 'boolean') return d;
      const src = typeof d === 'string'
        ? d
        : (d && typeof d === 'object' && typeof (d as any).source === 'string' ? (d as any).source : undefined);
      if (!src) return false;
      return evalHeaderPredicate(d, `page:header action "${String(actionName)}" disabled`);
    };
    // A live inline-edit session disables actions the host flagged with
    // `disableDuringInlineEdit` (objectui#2572 item 4) — see `inlineEditing`
    // at the top of the renderer.
    const isActionDisabled = (action: any): boolean =>
      (inlineEditing && action?.disableDuringInlineEdit === true) ||
      resolveDisabled(action?.disabled, action?.name ?? action?.id);
    const renderButton = (action: any, idx: number) => {
      const label = resolveLabel(action);
      // `variant: 'primary'` is valid ActionSchema but not a Shadcn Button
      // variant — map it to `default` (same as action-button.tsx).
      const variant = action.variant === 'primary' ? 'default' : (action.variant || 'default');
      const size = action.size || 'sm';
      const disabled = isActionDisabled(action);
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
            dispatchHeaderAction(action);
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
        aria-label={tt('detail.pageHeaderActions', 'Page header actions')}
      >
        {inlineActions.map(renderButton)}
        {useOverflow && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 px-2"
                aria-label={tt('detail.moreActions', 'More actions')}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {overflowActions.map((action, idx) => {
                const label = resolveLabel(action);
                const disabled = isActionDisabled(action);
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
                      dispatchHeaderAction(action);
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

  /**
   * The ⟳ button (objectui#3460), or `null` when the host provides no
   * `refresh`.
   *
   * Styled as the `⋯` overflow trigger's twin — same `outline` variant, same
   * `size="sm"`, same padding — so the whole row reads as ONE button family
   * (`[Start][Expedite][Edit][⋯][⟳]`). A bare ghost icon next to a row of
   * bordered pills read as detached from it.
   */
  const renderRefreshButton = (): React.ReactNode => {
    if (!hostRefresh) return null;
    const refreshLabel = tt('common.refresh', 'Refresh');
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 px-2"
              onClick={handleManualRefresh}
              aria-label={refreshLabel}
              data-page-refresh
            >
              <RefreshCw className={cn('h-4 w-4', manualRefreshing && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{refreshLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /**
   * The header's trailing slot: the action row (or the empty layout slot that
   * stands in for it) followed by the refresh chrome.
   *
   * Both header layouts below funnel through this so the ⟳ keeps the same
   * position whether or not the record chip is rendered — including the first
   * paint of a record page, before `ctx.data` lands. When no host provides
   * `refresh` the slot is returned untouched, byte for byte what it was.
   */
  const renderHeaderTail = (emptySlot: React.ReactNode): React.ReactNode => {
    const actions = renderHeaderActions() ?? emptySlot;
    const refreshButton = renderRefreshButton();
    if (!refreshButton) return actions;
    return (
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {refreshButton}
      </div>
    );
  };

  // Decide whether to render the record chip. Conditions:
  //   1. There's a live RecordContext with data + an object schema.
  //   2. Author hasn't opted out via `recordChrome: false`.
  // When both pass, we resolve the chip title from (in order):
  //   - explicit `schema.title` (interpolated against data),
  //   - `objectSchema.primaryField` / `titleFormat` (author overrides),
  //   - the unified ADR-0079 resolver (`nameField` → `displayNameField` →
  //     type-aware derivation) — same precedence as DetailView's own header,
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
    // Unified resolver (ADR-0079): honours the object's declared
    // `nameField`/`displayNameField` and falls back to type-aware field
    // derivation. `deriveFromRecordKeys: false` keeps bare record-key
    // guesses from outranking the legacy probes below; the resolver's
    // `Record #<id>` floor is detected and skipped so the richer
    // `${objectLabel} ${id}` fallback still wins for truly unnamed records.
    const recordId = data?.id ?? data?._id;
    const unifiedTitle = (() => {
      const resolved = getRecordDisplayName(objSchema, data, { deriveFromRecordKeys: false });
      const isFloor =
        resolved === 'Untitled' ||
        (recordId !== null && recordId !== undefined && resolved === `Record #${recordId}`);
      return isFloor ? '' : resolved;
    })();
    const resolvedTitle =
      explicitTitle ||
      (primaryField && data?.[primaryField]) ||
      (interpolatedTitleFormat && !interpolatedTitleFormat.includes('{') ? interpolatedTitleFormat : '') ||
      unifiedTitle ||
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
        {renderHeaderTail(<div data-page-actions-slot className="shrink-0" />)}
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
        {renderHeaderTail(<div data-page-actions-slot />)}
      </div>
    </header>
  );
};

ComponentRegistry.register('header', PageHeaderRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Header',
  category: 'layout',
  // The renderer reads all of these off the schema (or off `properties.*` —
  // the spec bridge may inline or preserve the bag), so an author configures
  // the header through them. `className` is left out as a styling
  // pass-through, and the host-injected `RecordContext.headerSystemActions`
  // is not authored here at all.
  inputs: [
    // Both carry two arms (objectui#3832). The spec accepts a plain string or an
    // inline translation map on each — measured against
    // `ComponentPropsMap['page:header']` at rc.6, where the union is
    // string-or-record — and the renderer resolves the map form through
    // `pickLocalized` before interpolating. The single `'string'` arm they used
    // to declare is what made the manifest gate warn `type-mismatch` on the very
    // map form this description tells the author to write.
    { name: 'title', type: ['string', 'object'], label: 'Title', description: 'Supports {field} interpolation and inline translation maps; falls back to the record title' },
    { name: 'subtitle', type: ['string', 'object'], label: 'Subtitle', description: 'Same interpolation as Title' },
    { name: 'actions', type: 'array', label: 'Actions', description: 'Action buttons rendered in the header, before any host-injected system actions' },
    { name: 'breadcrumb', type: 'boolean', label: 'Breadcrumb', defaultValue: true },
    { name: 'recordChrome', type: 'boolean', label: 'Record Chrome', defaultValue: true, description: 'Set false for the bare h1 header on non-record pages' },
    { name: 'showStar', type: 'boolean', label: 'Show Follow Star', defaultValue: true },
    { name: 'showCopyId', type: 'boolean', label: 'Show Copy-ID', defaultValue: true },
    // The inline/overflow budget, DECLARED rather than merely honoured
    // (objectui#4668). Both are @objectstack/spec 17.0.0 GA keys this renderer
    // has read since objectui#2361 (`readMax(...)` at the split above, in both
    // spellings — `page-header-actions.test.tsx` pins the schema-level and the
    // `properties.*` variant), while `inputs` omitted them: the manifest and
    // `sdui-intrinsics.d.ts` left them out and `sdui-parser` warned
    // `unknown-prop` on the very key that then took effect.
    //
    // ONE arm each, not a union: measured against
    // `ComponentPropsMap['page:header']` on the installed GA pin, both are
    // `z.number()` constrained to a POSITIVE SAFE INTEGER — `0`, `-1` and `2.5`
    // are all rejected by value, which is why the descriptions say so instead
    // of leaving an author to discover it from a parse error. (`readMax` at the
    // inline/overflow split above now enforces exactly that domain — objectui#5006
    // closed the gap where this renderer accepted `0` and floored fractions while
    // the contract rejected both. The coarse `number` arm here still cannot
    // express the domain: `ComponentInput.type` has no integer/min/max slot, so
    // `description` stays the only authoring-time expression of it, and spec
    // stays the sole judge of values.)
    { name: 'maxVisible', type: 'number', label: 'Max Inline Actions', defaultValue: 3, description: 'How many header actions render as inline buttons on desktop before the rest fold into the overflow menu. A positive integer — the contract rejects 0 and fractional values. Two kinds of action are routed to the overflow menu regardless of this budget and never occupy an inline slot: an action whose locations declare record_more without record_header, and any action with component action:menu.' },
    { name: 'mobileMaxVisible', type: 'number', label: 'Max Inline Actions (Mobile)', defaultValue: 1, description: 'The same inline-button budget on mobile viewports, where horizontal room is scarce. A positive integer, defaulting to 1; the desktop half is Max Inline Actions, and the overflow routing rules stated there apply unchanged.' },
  ],
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

ComponentRegistry.register('footer', PageFooterRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Footer',
  category: 'layout',
  isContainer: true,
  inputs: PAGE_CONTAINER_INPUTS,
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

ComponentRegistry.register('sidebar', PageSidebarRenderer, {
  namespace: 'page',
  skipFallback: true,
  label: 'Page Sidebar',
  category: 'layout',
  isContainer: true,
  inputs: PAGE_CONTAINER_INPUTS,
});
