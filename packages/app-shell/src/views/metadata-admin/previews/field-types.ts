// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonical field-type catalog for the object form designer.
 *
 * Mirrors `@objectstack/spec`'s `FieldType` discriminated union (46
 * entries as of spec 7.1) but grouped into the 9 user-facing
 * categories used by the type picker and inspector.
 *
 * Adding a new type here is enough — the canvas and inspector both
 * key off `FIELD_TYPE_META` for icon / label / category lookup, and
 * the picker auto-includes any new entry.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Type, AlignLeft, AtSign, Globe, Phone, Lock, FileText, Code, Sparkles,
  Hash, DollarSign, Percent,
  Calendar, Clock,
  ToggleLeft,
  ListOrdered, ListChecks, CircleDot, CheckSquare,
  Link2, Workflow, Network,
  Image, Paperclip, UserCircle, Video, Music,
  Calculator, Sigma,
  Boxes, Repeat2,
  MapPin, Map,
  FileJson, Palette, Star, SlidersHorizontal, PenLine, QrCode, BarChart3, Tags, Atom,
} from 'lucide-react';

export type FieldTypeId =
  | 'text' | 'textarea' | 'email' | 'url' | 'phone' | 'password' | 'markdown' | 'html' | 'richtext'
  | 'number' | 'currency' | 'percent'
  | 'date' | 'datetime' | 'time'
  | 'boolean' | 'toggle'
  | 'select' | 'multiselect' | 'radio' | 'checkboxes'
  | 'lookup' | 'master_detail' | 'tree'
  | 'image' | 'file' | 'avatar' | 'video' | 'audio'
  | 'formula' | 'summary' | 'autonumber'
  | 'composite' | 'repeater'
  | 'location' | 'address'
  | 'code' | 'json' | 'color' | 'rating' | 'slider' | 'signature' | 'qrcode' | 'progress' | 'tags' | 'vector';

export type FieldTypeCategory =
  | 'text' | 'number' | 'date' | 'logic' | 'selection'
  | 'relation' | 'media' | 'calculated' | 'advanced';

export interface FieldTypeMeta {
  id: FieldTypeId;
  /**
   * English display label. The localized name lives in the Studio catalog as
   * `engine.fieldType.<id>` — this column used to carry a `labelZh` sibling,
   * which capped the picker at two languages (objectui#2871).
   */
  label: string;
  category: FieldTypeCategory;
  Icon: LucideIcon;
}

const M = (id: FieldTypeId, label: string, category: FieldTypeCategory, Icon: LucideIcon): FieldTypeMeta =>
  ({ id, label, category, Icon });

export const FIELD_TYPE_META: Record<FieldTypeId, FieldTypeMeta> = {
  text:        M('text',        'Text',   'text',       Type),
  textarea:    M('textarea',    'Text Area',   'text',       AlignLeft),
  email:       M('email',       'Email',       'text',       AtSign),
  url:         M('url',         'URL',       'text',       Globe),
  phone:       M('phone',       'Phone',       'text',       Phone),
  password:    M('password',    'Password',       'text',       Lock),
  markdown:    M('markdown',    'Markdown',   'text',       FileText),
  html:        M('html',        'HTML',       'text',       Code),
  richtext:    M('richtext',    'Rich Text',     'text',       Sparkles),

  number:      M('number',      'Number',       'number',     Hash),
  currency:    M('currency',    'Currency',       'number',     DollarSign),
  percent:     M('percent',     'Percent',     'number',     Percent),

  date:        M('date',        'Date',       'date',       Calendar),
  datetime:    M('datetime',    'Date/Time',   'date',       Calendar),
  time:        M('time',        'Time',       'date',       Clock),

  boolean:     M('boolean',     'Checkbox',     'logic',      CheckSquare),
  toggle:      M('toggle',      'Toggle',       'logic',      ToggleLeft),

  select:      M('select',      'Picklist',   'selection',  ListOrdered),
  multiselect: M('multiselect', 'Multi-Select',       'selection',  ListChecks),
  radio:       M('radio',       'Radio',       'selection',  CircleDot),
  checkboxes:  M('checkboxes',  'Checkboxes',     'selection',  ListChecks),

  lookup:        M('lookup',        'Lookup', 'relation', Link2),
  master_detail: M('master_detail', 'Master-Detail', 'relation', Workflow),
  tree:          M('tree',          'Tree', 'relation', Network),

  image:       M('image',       'Image',       'media',      Image),
  file:        M('file',        'File',       'media',      Paperclip),
  avatar:      M('avatar',      'Avatar',       'media',      UserCircle),
  video:       M('video',       'Video',       'media',      Video),
  audio:       M('audio',       'Audio',       'media',      Music),

  formula:     M('formula',     'Formula',       'calculated', Calculator),
  summary:     M('summary',     'Rollup',       'calculated', Sigma),
  autonumber:  M('autonumber',  'Auto Number',   'calculated', Hash),

  composite:   M('composite',   'Composite',   'advanced',   Boxes),
  repeater:    M('repeater',    'Repeater',   'advanced',   Repeat2),
  location:    M('location',    'Location',   'advanced',   MapPin),
  address:     M('address',     'Address',       'advanced',   Map),
  code:        M('code',        'Code',       'advanced',   Code),
  json:        M('json',        'JSON',       'advanced',   FileJson),
  color:       M('color',       'Color',       'advanced',   Palette),
  rating:      M('rating',      'Rating',       'advanced',   Star),
  slider:      M('slider',      'Slider',       'advanced',   SlidersHorizontal),
  signature:   M('signature',   'Signature',       'advanced',   PenLine),
  qrcode:      M('qrcode',      'QR Code',     'advanced',   QrCode),
  progress:    M('progress',    'Progress',     'advanced',   BarChart3),
  tags:        M('tags',        'Tags',       'advanced',   Tags),
  vector:      M('vector',      'Vector',       'advanced',   Atom),
};

export const CATEGORY_ORDER: FieldTypeCategory[] = [
  'text', 'number', 'date', 'logic', 'selection', 'relation', 'media', 'calculated', 'advanced',
];

export const CATEGORY_LABEL_EN: Record<FieldTypeCategory, string> = {
  text: 'Text', number: 'Number', date: 'Date & Time', logic: 'Logic',
  selection: 'Selection', relation: 'Relation', media: 'Media',
  calculated: 'Calculated', advanced: 'Advanced',
};

/**
 * Per-category color tone. Lets the canvas, type badges, and type
 * picker tint a field by its category so the form is scannable at a
 * glance (text vs number vs relation vs media …) instead of a wall of
 * neutral-grey rows. Colour is used purely as a category *signal* —
 * subtle tints, never loud fills — consistent with the console's
 * content-first visual language.
 *
 * Class strings are written out in full (not composed) so Tailwind's
 * JIT can see and emit every variant.
 */
export interface CategoryTone {
  /** Icon stroke colour. */
  icon: string;
  /** Tinted type-badge classes (border + bg + text), light & dark. */
  badge: string;
}

export const CATEGORY_TONE: Record<FieldTypeCategory, CategoryTone> = {
  text:       { icon: 'text-slate-500 dark:text-slate-400',     badge: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-300' },
  number:     { icon: 'text-blue-600 dark:text-blue-400',       badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-950/40 dark:text-blue-300' },
  date:       { icon: 'text-violet-600 dark:text-violet-400',   badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-300' },
  logic:      { icon: 'text-amber-600 dark:text-amber-400',     badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300' },
  selection:  { icon: 'text-teal-600 dark:text-teal-400',       badge: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-300' },
  relation:   { icon: 'text-indigo-600 dark:text-indigo-400',   badge: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-300' },
  media:      { icon: 'text-pink-600 dark:text-pink-400',       badge: 'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-800/50 dark:bg-pink-950/40 dark:text-pink-300' },
  calculated: { icon: 'text-emerald-600 dark:text-emerald-400', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300' },
  advanced:   { icon: 'text-zinc-500 dark:text-zinc-400',       badge: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800/40 dark:text-zinc-300' },
};

/** Resolve the colour tone for any field-type string (unknown → advanced). */
export function resolveCategoryTone(type: unknown): CategoryTone {
  return CATEGORY_TONE[resolveFieldTypeMeta(type).category];
}

/** All type ids grouped by category, in category order. */
export const TYPES_BY_CATEGORY: Array<{ category: FieldTypeCategory; types: FieldTypeId[] }> =
  CATEGORY_ORDER.map((category) => ({
    category,
    types: (Object.keys(FIELD_TYPE_META) as FieldTypeId[]).filter(
      (id) => FIELD_TYPE_META[id].category === category,
    ),
  }));

/** Resolve metadata for any type string, including unknown values. */
export function resolveFieldTypeMeta(type: unknown): FieldTypeMeta {
  if (typeof type === 'string' && type in FIELD_TYPE_META) {
    return FIELD_TYPE_META[type as FieldTypeId];
  }
  return {
    id: 'text',
    label: typeof type === 'string' ? type : 'unknown',
    category: 'advanced',
    Icon: Type,
  };
}
