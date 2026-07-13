import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { type ObjectStackAdapter } from '@object-ui/data-objectstack';
import { resolveInlineMode } from '@object-ui/plugin-form';
import { MetadataCtx, useMetadata, type MetadataContextValue, type MetadataState } from '@object-ui/react';
import { usePreviewDrafts } from '../preview/PreviewModeContext';
import { createConsoleMetadataClient } from '../views/metadata-admin/metadataClientFactory';
import { subscribeCanvasInvalidate, subscribeMetadataRefresh } from '../assistant/assistantBus';

export type { MetadataState, MetadataContextValue };
export { useMetadataItem } from '@object-ui/react';
export { useMetadata };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetadataTypeStatus = 'idle' | 'loading' | 'ready' | 'error';

interface TypeCacheEntry {
  status: MetadataTypeStatus;
  items: any[];
  byName: Map<string, any>;
  error: Error | null;
  fetchedAt: number;
  promise: Promise<any[]> | null;
}

type ItemPromiseMap = Map<string, Promise<any | null>>;

interface MetadataProviderProps {
  children: ReactNode;
  adapter: ObjectStackAdapter;
  ttlMs?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const EAGER_TYPES = ['app', 'view'] as const;

const TYPE_BY_STATE_KEY: Record<keyof Omit<MetadataState, 'loading' | 'error'>, string> = {
  apps: 'app',
  objects: 'object',
  dashboards: 'dashboard',
  reports: 'report',
  pages: 'page',
};

const SESSION_STORAGE_PREFIX = 'objectui:metadata:';

function isDev(): boolean {
  try {
    const meta: any = (import.meta as any);
    if (meta && meta.env && typeof meta.env.MODE === 'string') {
      return meta.env.MODE !== 'production';
    }
  } catch {
    /* import.meta unavailable */
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env.NODE_ENV === 'string') {
    return process.env.NODE_ENV !== 'production';
  }
  return false;
}
const DEV = isDev();
function debug(...args: unknown[]) {
  if (DEV) {
    // eslint-disable-next-line no-console
    console.debug('[MetadataProvider]', ...args);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Exported for tests — both metadata sources must normalize identically. */
export function extractItems(res: unknown): any[] {
  // Both source shapes must parse: the adapter SDK returns the wrapped
  // `{ type, items: [...] }` envelope, while the ADR-0037 preview path's
  // MetadataClient.list() returns the already-unwrapped array. Dropping the
  // bare-array shape silently emptied the ENTIRE draft-preview world (every
  // type read 0 items), stranding the Live Canvas on "No Apps Configured".
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object' && 'items' in res && Array.isArray((res as { items: unknown[] }).items)) {
    return (res as { items: unknown[] }).items;
  }
  return [];
}

function extractItem(res: unknown): any | null {
  if (res == null) return null;
  if (typeof res === 'object' && 'item' in res) {
    return (res as { item: any }).item ?? null;
  }
  return res;
}

function isNamedItem(item: unknown): item is { name: string } {
  return (
    !!item &&
    typeof item === 'object' &&
    'name' in item &&
    typeof (item as { name: unknown }).name === 'string'
  );
}

/**
 * Merge `view` metadata into object definitions so that `objectDef.listViews`
 * is populated for the renderer (`@object-ui/plugin-view`) which expects it.
 *
 * Two view shapes coexist in the `view` metadata type (the backend returns
 * both for back-compat — see framework `objectql/engine.ts` registration):
 *
 *  1. Independent **ViewItem** (ADR-0017, "Object has-many View") — the
 *     canonical first-class shape, one entry per named view:
 *       { name: '<object>.<key>', object, viewKind: 'list' | 'form',
 *         label, isDefault?, config: { type, data, columns, … } }
 *     `viewKind` is the family discriminant and the view body lives under
 *     `config`. We route `viewKind: 'list'` items into `listViews` and
 *     `viewKind: 'form'` items into `formViews` — so FORM-family views never
 *     surface in the list-view switcher (which only reads `listViews`).
 *
 *  2. Legacy aggregated **container** `{ list?, form?, listViews?, formViews? }`
 *     keyed by the bare object name. Kept for adapters/fixtures that don't
 *     expand into ViewItems. When an object already has expanded ViewItems the
 *     container is skipped, since it restates the same views (and keying both
 *     would list every view twice — once under its short key, once under its
 *     canonical `<object>.<key>` name).
 *
 * Existing `obj.listViews` / `obj.list_views` win to preserve overrides.
 */
interface ViewBucket {
  primary?: any;
  form?: any;
  listViews: Record<string, any>;
  formViews: Record<string, any>;
}

/** A first-class ViewItem carries a `viewKind` discriminant + `object` binding. */
function isViewItem(view: any): boolean {
  return !!view && typeof view === 'object' && !!view.viewKind && !!view.object;
}

export function mergeViewsIntoObjects(objects: any[], views: any[]): any[] {
  if (!objects.length || !views.length) return objects;
  const byObject: Record<string, ViewBucket> = {};
  // Objects that received expanded ViewItems — their legacy aggregated
  // container (also present in the `view` list) is superseded and skipped.
  const hasViewItems = new Set<string>();
  for (const view of views) {
    if (isViewItem(view)) hasViewItems.add(view.object);
  }
  for (const view of views) {
    // ── New protocol: independent ViewItem ({ name, object, viewKind, config }) ──
    if (isViewItem(view)) {
      const bucket = (byObject[view.object] ||= { listViews: {}, formViews: {} });
      // Canonical `<object>.<key>` name doubles as the view id, so `/view/<name>`
      // URLs resolve directly against the switcher tab ids.
      const key = view.name || `${view.object}.${view.viewKind}`;
      const body = view.config && typeof view.config === 'object' ? view.config : {};
      // Flatten `config` to the legacy NamedListView/FormView shape the
      // renderer consumes (type/data/columns/sections at top level); carry the
      // item-level label/isDefault and stamp `name` so primary-view promotion
      // (which matches on `list.name`) finds this entry by its listViews key.
      const entry = { ...body, name: key, label: view.label ?? (body as any).label, isDefault: !!view.isDefault };
      if (view.viewKind === 'form') {
        bucket.formViews[key] = entry;
        if (view.isDefault || !bucket.form) bucket.form = entry;
      } else {
        bucket.listViews[key] = entry;
        if (view.isDefault) bucket.primary = entry;
      }
      continue;
    }
    // ── Legacy aggregated container ({ list, form, listViews, formViews }) ──
    const objName = view?.name || view?.list?.data?.object || view?.form?.data?.object;
    if (!objName) continue;
    // Expanded ViewItems supersede the bare container for this object.
    if (hasViewItems.has(objName)) continue;
    const bucket = (byObject[objName] ||= { listViews: {}, formViews: {} });
    if (view.list) {
      // Preserve the primary list view as `obj.list` per @objectstack/spec
      // ViewSchema. Also mirror it into `listViews` under its name so legacy
      // consumers (that only iterate `listViews`) still see it. Consumers
      // honoring `obj.list` (e.g. ObjectView) should dedup by id.
      bucket.primary = view.list;
      const k = view.list.name || 'list';
      bucket.listViews[k] = view.list;
    }
    if (view.form) {
      bucket.form = view.form;
    }
    if (view.listViews && typeof view.listViews === 'object') {
      for (const [k, v] of Object.entries(view.listViews as Record<string, any>)) {
        bucket.listViews[k] = v;
      }
    }
    if (view.formViews && typeof view.formViews === 'object') {
      for (const [k, v] of Object.entries(view.formViews as Record<string, any>)) {
        bucket.formViews[k] = v;
      }
    }
  }
  return objects.map(obj => {
    const extra = byObject[obj.name];
    if (!extra) return obj;
    const existingListViews = obj.listViews || obj.list_views || {};
    const existingFormViews = obj.formViews || obj.form_views || {};
    const merged: any = {
      ...obj,
      listViews: { ...extra.listViews, ...existingListViews },
    };
    if (Object.keys(extra.formViews).length || Object.keys(existingFormViews).length) {
      merged.formViews = { ...extra.formViews, ...existingFormViews };
    }
    if (extra.primary && !obj.list) {
      merged.list = extra.primary;
    }
    if (extra.form && !obj.form) {
      merged.form = extra.form;
    }
    return merged;
  });
}

/**
 * Relationship-driven master-detail: a child object's `master_detail`/`lookup`
 * field can carry `inlineEdit: true` to declare "edit me inline within my
 * parent's form". This pass scans every object for such fields and merges the
 * resulting child collections into each parent object's form view as
 * `subforms` — so the parent's standard create/edit form renders an atomic
 * master-detail form with NO view config and NO bespoke page. The intent lives
 * in the data model (where it's defined once, e.g. by an AI modelling the
 * schema); forms just follow. An explicit `form.subforms` entry for the same
 * child overrides the model-derived one.
 */
export function attachInlineSubforms(objects: any[]): any[] {
  if (!objects?.length) return objects;
  const inlineByParent: Record<string, any[]> = {};
  for (const child of objects) {
    const fields = child?.fields;
    if (!fields) continue;
    const entries: Array<[string, any]> = Array.isArray(fields)
      ? fields.map((f: any) => [f?.name, f])
      : Object.entries(fields);
    for (const [fname, fdef] of entries) {
      const d: any = fdef;
      if (!fname || !d?.inlineEdit) continue;
      if (d.type !== 'master_detail' && d.type !== 'lookup') continue;
      const parent = d.reference;
      if (!parent) continue;
      (inlineByParent[parent] ||= []).push({
        childObject: child.name,
        relationshipField: fname,
        // Resolve the inline-edit form factor (grid vs per-row form) from the
        // declared value, falling back to the smart default by child shape.
        inlineMode: resolveInlineMode(child, d.inlineEdit, { relationshipField: fname }),
        ...(d.inlineTitle ? { title: d.inlineTitle } : {}),
        ...(Array.isArray(d.inlineColumns) ? { columns: d.inlineColumns } : {}),
        ...(typeof d.inlineAmountField === 'string' ? { amountField: d.inlineAmountField } : {}),
      });
    }
  }
  if (!Object.keys(inlineByParent).length) return objects;
  return objects.map((obj) => {
    const derived = inlineByParent[obj.name];
    if (!derived?.length) return obj;
    const form: any = { ...(obj.form || { type: 'simple' }) };
    const explicit: any[] = Array.isArray(form.subforms) ? form.subforms : [];
    const explicitChildren = new Set(explicit.map((s: any) => s.childObject));
    // Model-derived first; an explicit view subform for the same child wins.
    form.subforms = [...derived.filter((d) => !explicitChildren.has(d.childObject)), ...explicit];
    const next: any = { ...obj, form };
    if (obj.formViews?.default) {
      next.formViews = { ...obj.formViews, default: { ...obj.formViews.default, subforms: form.subforms } };
    }
    return next;
  });
}

function emptyEntry(): TypeCacheEntry {
  return {
    status: 'idle',
    items: [],
    byName: new Map(),
    error: null,
    fetchedAt: 0,
    promise: null,
  };
}

function loadFromSession(type: string): any[] | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_PREFIX + type);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveToSession(type: string, items: any[]): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_PREFIX + type, JSON.stringify(items));
  } catch {
    /* quota or serialization failure */
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function MetadataProvider({ children, adapter, ttlMs = DEFAULT_TTL_MS }: MetadataProviderProps) {
  const cacheRef = useRef<Map<string, TypeCacheEntry>>(new Map());
  const itemPromisesRef = useRef<Map<string, ItemPromiseMap>>(new Map());
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  // ADR-0037 Live Canvas: when the tree is in draft-preview mode, metadata
  // reads come from the REST `?preview=draft` overlay (pending ADR-0033
  // drafts win over active) instead of the adapter SDK. The MetadataClient
  // is used because the SDK's meta API doesn't carry the preview flag; same
  // endpoints, same authenticated fetch (Bearer token) as every other console
  // client — see `createConsoleMetadataClient`. Reads only — every write path
  // is unchanged.
  const previewDrafts = usePreviewDrafts();
  const previewClient = useMemo(() => {
    if (!previewDrafts) return null;
    return createConsoleMetadataClient({ previewDrafts: true });
  }, [previewDrafts]);
  const previewClientRef = useRef(previewClient);
  previewClientRef.current = previewClient;

  const [version, setVersion] = useState(0);
  // Defer state bumps so they never occur synchronously during a consumer's
  // render phase. `ensureType` may be invoked from inside `useMemo` getters
  // (e.g. when a list-page renders and triggers a lazy fetch), and React
  // forbids cross-component setState during render. queueMicrotask schedules
  // the update after the current render has committed.
  const bump = useCallback(() => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => setVersion(v => v + 1));
    } else {
      Promise.resolve().then(() => setVersion(v => v + 1));
    }
  }, []);

  // Entering/leaving preview swaps the entire metadata source — the published
  // and draft-overlaid worlds must never mix in one cache. Drop everything and
  // let consumers refetch through the new source.
  useEffect(() => {
    cacheRef.current.clear();
    itemPromisesRef.current.clear();
    bump();
  }, [previewDrafts, bump]);

  const getEntry = useCallback((type: string): TypeCacheEntry => {
    let entry = cacheRef.current.get(type);
    if (!entry) {
      entry = emptyEntry();
      cacheRef.current.set(type, entry);
    }
    return entry;
  }, []);

  const ensureType = useCallback(
    (type: string): Promise<any[]> => {
      const entry = getEntry(type);

      if (entry.promise) return entry.promise;

      if (entry.status === 'ready' && Date.now() - entry.fetchedAt < ttlMs) {
        debug(`cache hit (fresh) type=${type} items=${entry.items.length}`);
        return Promise.resolve(entry.items);
      }

      const started = Date.now();
      entry.status = 'loading';
      entry.error = null;
      // Preview mode reads the draft-overlaid world (`?preview=draft`);
      // normal mode reads the adapter SDK as before.
      const preview = previewClientRef.current;
      const fetchItems: Promise<unknown> = preview
        ? preview.list(type)
        : adapterRef.current.getClient().meta.getItems(type);
      const promise = fetchItems
        .then((res: unknown) => {
          const items = extractItems(res);
          entry.items = items;
          entry.status = 'ready';
          entry.error = null;
          entry.fetchedAt = Date.now();
          entry.promise = null;
          entry.byName.clear();
          for (const it of items) {
            if (isNamedItem(it)) {
              entry.byName.set(it.name, it);
            }
          }
          // Never let the draft-overlaid world poison the published session
          // cache — preview is ephemeral by design.
          if (type === 'app' && !preview) saveToSession(type, items);
          debug(`fetched type=${type} items=${items.length} in ${Date.now() - started}ms`);
          bump();
          return items;
        })
        .catch((err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          entry.status = 'error';
          entry.error = error;
          entry.promise = null;
          debug(`fetch failed type=${type}`, error);
          bump();
          return [] as any[];
        });

      entry.promise = promise;
      // No synchronous bump here: the only externally-visible state change at
      // this point is `status: 'loading'`, which no consumer reads. Bumping
      // from inside a render-phase getter (see useMemo below) would trigger
      // React's "Cannot update a component while rendering" warning.
      return promise;
    },
    [bump, getEntry, ttlMs],
  );

  const getItem = useCallback(
    (type: string, name: string): Promise<any | null> => {
      const entry = getEntry(type);

      if (entry.byName.has(name)) {
        debug(`item cache hit type=${type} name=${name}`);
        return Promise.resolve(entry.byName.get(name) ?? null);
      }

      let pending = itemPromisesRef.current.get(type);
      if (!pending) {
        pending = new Map();
        itemPromisesRef.current.set(type, pending);
      }
      const existing = pending.get(name);
      if (existing) return existing;

      const started = Date.now();
      const preview = previewClientRef.current;
      const fetchItem: Promise<unknown> = preview
        ? preview.get(type, name)
        : adapterRef.current.getClient().meta.getItem(type, name);
      const promise = fetchItem
        .then((res: unknown) => {
          const item = extractItem(res);
          if (item) entry.byName.set(name, item);
          debug(`fetched item type=${type} name=${name} in ${Date.now() - started}ms`);
          pending!.delete(name);
          return item;
        })
        .catch((err: unknown) => {
          pending!.delete(name);
          debug(`fetch item failed type=${type} name=${name}`, err);
          return null;
        });

      pending.set(name, promise);
      return promise;
    },
    [getEntry],
  );

  const refresh = useCallback(
    async (type?: string): Promise<void> => {
      if (type) {
        const entry = getEntry(type);
        entry.fetchedAt = 0;
        entry.byName.clear();
        await ensureType(type);
        return;
      }
      const types = Array.from(cacheRef.current.keys()).filter(
        t => cacheRef.current.get(t)!.status !== 'idle',
      );
      await Promise.all(
        types.map(t => {
          const entry = cacheRef.current.get(t)!;
          entry.fetchedAt = 0;
          entry.byName.clear();
          return ensureType(t);
        }),
      );
    },
    [ensureType, getEntry],
  );

  const invalidate = useCallback(
    (type: string, name?: string): void => {
      const entry = cacheRef.current.get(type);
      if (!entry) return;
      if (name) {
        entry.byName.delete(name);
        entry.items = entry.items.filter((it: any) => it?.name !== name);
        debug(`invalidated type=${type} name=${name}`);
      } else {
        entry.status = 'idle';
        entry.items = [];
        entry.byName.clear();
        entry.error = null;
        entry.fetchedAt = 0;
        debug(`invalidated type=${type}`);
      }
      bump();
    },
    [bump],
  );

  // ADR-0037 P2.5 — same-document live refresh: while this tree renders the
  // draft overlay, chat hosts announce each drafted artifact on the assistant
  // bus; drop that type's cache entry so the next read refetches the updated
  // draft world. Published-mode trees ignore the events entirely.
  useEffect(() => {
    if (!previewDrafts) return;
    return subscribeCanvasInvalidate(({ type }) => {
      invalidate(type);
    });
  }, [previewDrafts, invalidate]);

  // Live-metadata-changed refresh: a publish (drafts → live) or a marketplace
  // install changed the registry out-of-band, so the schema this tree cached
  // is stale. Refetch every loaded type — open forms/views/nav then reflect
  // the new live world without a manual page reload (the chat-card "Publish"
  // and Browse-page install paths do not reload, unlike the DraftPreviewBar).
  // NOT gated to preview-drafts mode: the live world every tree reads changed.
  useEffect(() => {
    return subscribeMetadataRefresh(() => {
      // The adapter keeps its OWN object-schema cache (getObjectSchema) that the
      // context refresh below does not touch. A publish/install just changed the
      // live schema, so drop it too — otherwise create/edit forms (which read
      // the adapter's getObjectSchema, NOT this context) keep showing the
      // pre-publish field set until the adapter cache's 5-minute TTL lapses.
      try { adapterRef.current?.clearCache?.(); } catch { /* adapter mid-swap */ }
      void refresh();
    });
  }, [refresh]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Session-cached apps are PUBLISHED-world data — seeding them while in
    // draft preview would flash the wrong universe before the fetch lands.
    const cached = previewDrafts ? null : loadFromSession('app');
    if (cached) {
      const entry = getEntry('app');
      entry.items = cached;
      entry.status = 'ready';
      entry.fetchedAt = 0;
      for (const it of cached) {
        if (isNamedItem(it)) {
          entry.byName.set(it.name, it);
        }
      }
      bump();
      setInitialLoading(false);
    }

    (async () => {
      for (const type of EAGER_TYPES) {
        try {
          await ensureType(type);
          if (!cancelled) setInitialError(null);
        } catch (err) {
          if (!cancelled) {
            setInitialError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
      if (!cancelled) setInitialLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [adapter, ensureType, getEntry, bump, previewDrafts]);

  const value = useMemo<MetadataContextValue>(() => {
    void version;

    const readType = (type: string): any[] => {
      const entry = getEntry(type);
      if (entry.status === 'idle') {
        void ensureType(type);
      }
      return entry.items;
    };

    const getItemsByType = (type: string): any[] => readType(type);

    const base: MetadataContextValue = {
      apps: getEntry('app').items,
      get objects() {
        const objs = readType(TYPE_BY_STATE_KEY.objects);
        const views = readType('view');
        const merged = views.length ? mergeViewsIntoObjects(objs, views) : objs;
        return attachInlineSubforms(merged);
      },
      get dashboards() {
        return readType(TYPE_BY_STATE_KEY.dashboards);
      },
      get reports() {
        return readType(TYPE_BY_STATE_KEY.reports);
      },
      get pages() {
        return readType(TYPE_BY_STATE_KEY.pages);
      },
      loading: initialLoading,
      error: initialError ?? getEntry('app').error,
      refresh,
      invalidate,
      ensureType,
      getItem,
      getItemsByType,
      // Pure read — must NOT kick a fetch, so render-phase status checks
      // can't recurse into ensureType.
      getTypeStatus: (type: string) => getEntry(type).status,
    };

    return base;
  }, [version, initialLoading, initialError, ensureType, getItem, getEntry, refresh, invalidate]);

  return <MetadataCtx.Provider value={value}>{children}</MetadataCtx.Provider>;
}

export function useMetadataType(type: string): { items: any[]; loading: boolean; error: Error | null } {
  const ctx = useMetadata();
  const items = ctx.getItemsByType(type);
  return { items, loading: ctx.loading && type === 'app', error: ctx.error };
}
