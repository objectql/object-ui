// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Catalog of Page-block types, mirrored from the framework's Page
 * schema (`regions[].components[].type` enum). Grouped + iconified
 * for the picker UI in PageBlockCanvas.
 *
 * Source of truth: keep the IDs in sync with
 * `@objectstack/spec`'s page protocol. New block types appear in the
 * `Other` category by default — add a META entry to give them an icon.
 */

import {
  PanelTop,
  PanelBottom,
  PanelLeft,
  Folders,
  ChevronsUpDown,
  Square,
  Layers,
  FileText,
  Tag,
  ListChecks,
  Activity,
  MessageSquare,
  Compass,
  AlertTriangle,
  Zap,
  BookOpen,
  History,
  Menu,
  Search,
  Bot,
  Sparkles,
  Type,
  Hash,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  List,
  Rows3,
  Box,
  Table,
  FormInput,
  Gauge,
  Columns3,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

export type BlockTypeId =
  // data — object-bound views & layout grid (the high-traffic app-page blocks)
  | 'grid' | 'object-grid' | 'object-form' | 'object-metric' | 'object-kanban'
  // page:*
  | 'page:header' | 'page:footer' | 'page:sidebar' | 'page:tabs'
  | 'page:accordion' | 'page:card' | 'page:section'
  // record:*
  | 'record:details' | 'record:highlights' | 'record:related_list'
  | 'record:activity' | 'record:discussion' | 'record:path' | 'record:alert'
  | 'record:quick_actions' | 'record:reference_rail' | 'record:history'
  // nav:* — page-content navigation (shell singletons like app:launcher /
  // global:notifications / user:profile are intentionally NOT page blocks)
  | 'nav:menu' | 'nav:breadcrumb'
  // global:*
  | 'global:search'
  // ai:*
  | 'ai:suggestion'
  // element:*
  | 'element:text' | 'element:number' | 'element:image' | 'element:divider'
  | 'element:button' | 'element:definition-list' | 'element:repeater';

export type BlockCategory = 'data' | 'layout' | 'record' | 'navigation' | 'element' | 'ai' | 'misc';

export interface BlockTypeMeta {
  id: BlockTypeId;
  label: string;
  category: BlockCategory;
  Icon: LucideIcon;
}

export const BLOCK_TYPE_META: Record<BlockTypeId, Omit<BlockTypeMeta, 'id'>> = {
  // Data — object-bound views & layout grid
  'grid':          { label: 'Grid',          category: 'data', Icon: LayoutGrid },
  'object-grid':   { label: 'Table',         category: 'data', Icon: Table },
  'object-form':   { label: 'Form',          category: 'data', Icon: FormInput },
  'object-metric': { label: 'Metric',        category: 'data', Icon: Gauge },
  'object-kanban': { label: 'Kanban',        category: 'data', Icon: Columns3 },

  // Page layout
  'page:header':    { label: 'Header',    category: 'layout', Icon: PanelTop },
  'page:footer':    { label: 'Footer',    category: 'layout', Icon: PanelBottom },
  'page:sidebar':   { label: 'Sidebar',   category: 'layout', Icon: PanelLeft },
  'page:tabs':      { label: 'Tabs',      category: 'layout', Icon: Folders },
  'page:accordion': { label: 'Accordion', category: 'layout', Icon: ChevronsUpDown },
  'page:card':      { label: 'Card',      category: 'layout', Icon: Square },
  'page:section':   { label: 'Section',   category: 'layout', Icon: Layers },

  // Record context
  'record:details':         { label: 'Record details',      category: 'record', Icon: FileText },
  'record:highlights':      { label: 'Highlights',          category: 'record', Icon: Tag },
  'record:related_list':    { label: 'Related list',        category: 'record', Icon: ListChecks },
  'record:activity':        { label: 'Activity timeline',   category: 'record', Icon: Activity },
  'record:discussion':      { label: 'Discussion',          category: 'record', Icon: MessageSquare },
  'record:path':            { label: 'Stage path',          category: 'record', Icon: Compass },
  'record:alert':           { label: 'Alert banner',        category: 'record', Icon: AlertTriangle },
  'record:quick_actions':   { label: 'Quick actions',       category: 'record', Icon: Zap },
  'record:reference_rail':  { label: 'Reference rail',      category: 'record', Icon: BookOpen },
  'record:history':         { label: 'History',             category: 'record', Icon: History },

  // Navigation (page-content only; shell singletons are not page blocks)
  'nav:menu':           { label: 'Nav menu',            category: 'navigation', Icon: Menu },
  'nav:breadcrumb':     { label: 'Breadcrumb',          category: 'navigation', Icon: Compass },
  'global:search':      { label: 'Global search',       category: 'navigation', Icon: Search },

  // AI
  // `ai:chat_window` is deliberately NOT in the palette: the floating chat
  // overlay (plugin-chatbot) is the canonical entry point and there is no
  // inline page-level renderer — `components/renderers/placeholders.tsx`
  // documents that exclusion. The palette used to offer it (with a config
  // panel), so an author dragged a block Studio advertised and got a red
  // "Unknown component type" box (#2943). See PALETTE_EXCLUSIONS.
  'ai:suggestion':      { label: 'AI suggestion',       category: 'ai', Icon: Sparkles },

  // Elements
  'element:text':           { label: 'Text',            category: 'element', Icon: Type },
  'element:number':         { label: 'Number',          category: 'element', Icon: Hash },
  'element:image':          { label: 'Image',           category: 'element', Icon: ImageIcon },
  'element:divider':        { label: 'Divider',         category: 'element', Icon: Minus },
  'element:button':         { label: 'Button',          category: 'element', Icon: MousePointerClick },
  'element:definition-list': { label: 'Definition list', category: 'element', Icon: List },
  'element:repeater':       { label: 'Repeater',        category: 'element', Icon: Rows3 },
};

/**
 * Every spec `PageComponentType` the page palette deliberately does NOT offer,
 * each with the reason it is unauthorable. This is the inverse of the old
 * guard (#2943): `block-config.test.ts` used to hand-assert a few exclusions,
 * which locks drift IN — a new spec block type could land and simply never
 * appear in the palette, unnoticed. The test now derives coverage from
 * `PageComponentType` and requires every value to be either in
 * {@link BLOCK_TYPE_META} or listed here, so a new one fails until someone
 * decides about it.
 *
 * A palette entry with no renderer is the failure this closes: `ai:chat_window`
 * was offered WITH a config panel while `placeholders.tsx` deliberately
 * excluded it to force a loud error — an author dragged a block Studio
 * advertised and got a red box.
 */
export const PALETTE_EXCLUSIONS: Record<string, string> = {
  // Shell singletons — chrome the app shell owns, not page content.
  'app:launcher': 'shell singleton — the app shell renders it, not a page',
  'global:notifications': 'shell singleton — lives in the app shell header',
  'user:profile': 'shell singleton — lives in the app shell header',
  // No renderer, by decision.
  'ai:chat_window': 'no inline renderer — the floating chat overlay (plugin-chatbot) is canonical',
  'element:form': 'no renderer — use the object-bound `object-form` block',
  'element:record_picker': 'no renderer — record picking is a field widget, not a page block',
  'element:text_input': 'no renderer — bare inputs belong to a form, not a page block',
  // Renders fine — excluded to keep ONE palette entry per renderer, not because
  // it is unauthorable. `record:chatter` and `record:discussion` are the same
  // renderer under two names: `plugin-detail/src/index.tsx` registers both
  // against `RecordChatterRenderer`, and the palette offers the CANONICAL one
  // above as 'Discussion'.
  //
  // ⛔ Excluded from the palette is NOT removed. `record:chatter` stays fully
  // renderable for schemas already in the wild — this entry changes what Studio
  // ADVERTISES, not what works. Deleting the registration is a different (and
  // breaking) change; `palette-discussion-alias.test.tsx` pins both halves so
  // "not offered" cannot quietly become "not rendered".
  //
  // Which of the two the palette advertises was a decision, not a pin-bump edit
  // (maintainer ruling 2026-08-22, objectui#5495 — Option A, the canonical name).
  // Everything else already pointed that way: `core/src/registry/public-blocks.ts`
  // records `record:chatter` as "`record:discussion` under a Salesforce-familiar
  // name, kept for schemas", objectui's own generator has emitted the canonical
  // spelling all along (`synth/buildDefaultPageSchema.ts`), and the console's AI
  // vocabulary leaves the alias uncurated for the same reason
  // (`apps/console/src/__tests__/public-contract.test.ts`, DELIBERATELY_UNCURATED).
  // The palette was the last surface still pointing at the alias — it offered it
  // only because the then-pinned `@objectstack/spec` did not declare the
  // canonical name yet (objectui#5328); the pinned spec now declares both.
  'record:chatter': 'compatibility alias — same renderer as the offered canonical `record:discussion`; still renders, just no longer advertised',
};

export const CATEGORY_LABEL_EN: Record<BlockCategory, string> = {
  data:       'Data',
  layout:     'Layout',
  record:     'Record context',
  navigation: 'Navigation',
  element:    'Elements',
  ai:         'AI',
  misc:       'Other',
};

export const TYPES_BY_CATEGORY: Array<{ category: BlockCategory; types: BlockTypeId[] }> = (() => {
  const out: Record<BlockCategory, BlockTypeId[]> = {
    data: [], layout: [], record: [], navigation: [], element: [], ai: [], misc: [],
  };
  for (const [id, meta] of Object.entries(BLOCK_TYPE_META)) {
    out[meta.category].push(id as BlockTypeId);
  }
  return (['data', 'layout', 'record', 'element', 'navigation', 'ai', 'misc'] as BlockCategory[])
    .map((c) => ({ category: c, types: out[c] }))
    .filter((g) => g.types.length > 0);
})();

/** Fallback icon for unknown block types. */
export const UnknownBlockIcon = Box;

/**
 * Per-category color tone — keeps block kinds scannable in the page
 * canvas and picker, mirroring the field-type / nav-kind / node-type
 * tinting used across the other Studio designers. Class strings are
 * written out in full so Tailwind's JIT emits them, with light + dark
 * variants (the app defaults to dark).
 */
export interface BlockCategoryTone {
  icon: string;
  badge: string;
}

export const BLOCK_CATEGORY_TONE: Record<BlockCategory, BlockCategoryTone> = {
  data: {
    icon: 'text-emerald-500 dark:text-emerald-400',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  layout: {
    icon: 'text-slate-500 dark:text-slate-400',
    badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  },
  record: {
    icon: 'text-blue-500 dark:text-blue-400',
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  },
  navigation: {
    icon: 'text-indigo-500 dark:text-indigo-400',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  element: {
    icon: 'text-teal-500 dark:text-teal-400',
    badge: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300',
  },
  ai: {
    icon: 'text-violet-500 dark:text-violet-400',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
  misc: {
    icon: 'text-zinc-500 dark:text-zinc-400',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400',
  },
};

/** Resolve a category tone for any block `type` string (handles unknowns). */
export function resolveBlockTone(type: string): BlockCategoryTone {
  const meta = BLOCK_TYPE_META[type as BlockTypeId];
  return BLOCK_CATEGORY_TONE[meta?.category ?? 'misc'];
}
