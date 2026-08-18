import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { expandViewContainer } from '@objectstack/spec/ui';
import { ActiveOrganizationStorage, useAuth } from '@object-ui/auth';
import { type ObjectStackAdapter } from '@object-ui/data-objectstack';
import { normalizeSchemaReferenceKeys } from '@object-ui/core';
import { resolveInlineMode } from '@object-ui/plugin-form';
import { MetadataCtx, useMetadata, type MetadataContextValue, type MetadataCacheState } from '@object-ui/react';
import { usePreviewDrafts } from '../preview/PreviewModeContext';
import { createConsoleMetadataClient } from '../views/metadata-admin/metadataClientFactory';
import { subscribeCanvasInvalidate, subscribeMetadataRefresh } from '../assistant/assistantBus';

export type { MetadataCacheState, MetadataContextValue };
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

/**
 * How long a FAILED type stays un-retried (objectui#4042).
 *
 * `entry.promise` already collapses callers that arrive while a request is in
 * flight — but callers that arrive just AFTER a failure found `status: 'error'`
 * with `promise: null` and each started a fresh attempt. That is a real
 * sequence, not a hypothetical: the mount effect walks EAGER_TYPES serially, so
 * by the time it reaches `view` the render-phase read of `view` has already
 * failed, and it re-requested it. Signed out, that was a second doomed 401 per
 * type; signed in, a second doomed request on any transient failure.
 *
 * Deliberately ~1s and NOT `ttlMs`: this exists to collapse the burst of
 * callers that start together during one mount, not to cache failures. A later
 * caller (route change, remount) still retries on its own, and `refresh()` /
 * `invalidate()` — which zero `fetchedAt` / reset the status — retry
 * immediately and unconditionally, so no explicit recovery path is affected.
 */
const ERROR_RETRY_COOLDOWN_MS = 1000;

const TYPE_BY_STATE_KEY: Record<keyof Omit<MetadataCacheState, 'loading' | 'error'>, string> = {
  apps: 'app',
  objects: 'object',
  dashboards: 'dashboard',
  reports: 'report',
  pages: 'page',
};

const SESSION_STORAGE_PREFIX = 'objectui:metadata:';

/**
 * Storage scope for a deployment with no active organization — a single-tenant
 * install, or a brand-new user before provisioning. A real org id can never
 * collide with it (`@` is not produced by the id generator), and the moment an
 * org DOES become active the scope changes, so a list cached with no org is
 * never served to one.
 */
const NO_ORG_SCOPE = '@none';

/**
 * The active organization id, read the SAME way the request that filled this
 * cache reads it (objectui#4486).
 *
 * `createAuthenticatedFetch` stamps `X-Tenant-ID` from
 * `ActiveOrganizationStorage` on every `/api/v1/meta/*` call, so deriving the
 * cache scope from that same storage makes the key equal to the tenant the
 * items were fetched under — the cache cannot describe itself as belonging to
 * an org other than the one the server filtered for.
 *
 * Deliberately NOT `useAuth().activeOrganization?.id`: that resolves
 * ASYNCHRONOUSLY (AuthProvider fetches the membership list after mount), so at
 * seed time — the whole point of this cache — it is still `null` and every boot
 * would miss its own entry. The storage value is already correct at mount
 * because the previous session wrote it.
 */
function activeOrgScope(): string {
  try {
    return ActiveOrganizationStorage.get() || NO_ORG_SCOPE;
  } catch {
    return NO_ORG_SCOPE;
  }
}

/** `objectui:metadata:<type>:<orgId>` — see {@link activeOrgScope}. */
function sessionKeyFor(type: string): string {
  return `${SESSION_STORAGE_PREFIX}${type}:${activeOrgScope()}`;
}

/**
 * Drop the pre-#4486 unscoped entry (`objectui:metadata:<type>`).
 *
 * Re-keying alone only fixes tabs going FORWARD: a tab that was already open
 * across the upgrade still holds an org-blind blob under the old key. Nothing
 * reads that key any more, so it is inert — but it is another organization's
 * app list sitting in storage, and the cheapest correct answer to "does already
 * cached data need invalidating on upgrade" is to delete it the first time the
 * new code looks.
 */
function dropLegacyUnscopedEntry(type: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_PREFIX + type);
  } catch {
    /* storage unavailable */
  }
}

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
 * Two view shapes coexist in the `view` metadata type — **both deliberate, and
 * neither one a leftover** (objectstack#4959 settled this end-to-end; see
 * framework `objectql/engine.ts` registration). Each belongs to a different
 * authoring gate, so this merge has to read both:
 *
 *  1. Independent **ViewItem** — the RECORD gate (ADR-0017, "Object has-many
 *     View"): one first-class metadata record per named view, as authored by
 *     `defineViewItem` or written through the runtime `/meta` seam.
 *       { name: '<object>.<key>', object, viewKind: 'list' | 'form',
 *         label, isDefault?, config: { type, data, columns, … } }
 *     `viewKind` is the family discriminant and the view body lives under
 *     `config`. We route `viewKind: 'list'` items into `listViews` and
 *     `viewKind: 'form'` items into `formViews` — so FORM-family views never
 *     surface in the list-view switcher (which only reads `listViews`).
 *
 *  2. Aggregated **container** `{ list?, form?, listViews?, formViews? }` keyed
 *     by the bare object name — the STACK gate's packaging shape: what
 *     `defineView` emits and what a stack carries in
 *     `defineStack({ views: [...] })`. The spec treats it as first class
 *     (`isAggregatedViewContainer` / `expandViewContainer` in
 *     `@objectstack/spec/ui`), so it is NOT legacy and this branch is NOT dead
 *     code — delete it and stack-packaged views stop reaching the renderer.
 *     A container is served UNEXPANDED on purpose (the platform's write
 *     chokepoint states it: "container bodies are left untouched —
 *     `expandViewContainer` derives identity itself"), so this branch asks the
 *     composer for each view's identity rather than deriving one of its own
 *     (objectui#3770). Both gates therefore produce the same canonical
 *     `<object>.<key>` ids — including the default `list`'s implicit
 *     `<object>.default` — and the container inherits the composer's folding and
 *     collision-renaming rules for free.
 *     When an object already has expanded ViewItems the container is skipped for
 *     THAT object: it restates the same identities, and the ViewItem rows are
 *     the authoritative ones (the runtime heals personalization overlays onto
 *     them).
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

/**
 * Route ONE view identity into its object's bucket — shared by both gates: the
 * record gate's stored ViewItems and the views `expandViewContainer` materialises
 * out of a stack-packaged container. Both shapes are
 * `{ name, object, viewKind, label?, isDefault?, config }`, so both are keyed by
 * the canonical `<object>.<key>` name the composer owns.
 *
 * The `config` body is flattened to the legacy NamedListView/FormView shape the
 * renderer consumes (type/data/columns/sections at top level); the item-level
 * label/isDefault ride along and `name` is stamped with the id so primary-view
 * promotion (which matches on `list.name`) finds this entry by its listViews key.
 * FORM-family views land in `formViews` only, never in the list-view switcher.
 */
function applyViewItem(bucket: ViewBucket, view: any): void {
  const key = view.name || `${view.object}.${view.viewKind}`;
  const body = view.config && typeof view.config === 'object' ? view.config : {};
  const entry = {
    ...body,
    name: key,
    label: view.label ?? (body as any).label,
    isDefault: !!view.isDefault,
  };
  if (view.viewKind === 'form') {
    bucket.formViews[key] = entry;
    if (view.isDefault || !bucket.form) bucket.form = entry;
  } else {
    bucket.listViews[key] = entry;
    if (view.isDefault) bucket.primary = entry;
  }
}

export function mergeViewsIntoObjects(objects: any[], views: any[]): any[] {
  if (!objects.length || !views.length) return objects;
  const byObject: Record<string, ViewBucket> = {};
  // Objects that received expanded ViewItems — the aggregated container for
  // those objects (also present in the `view` list) restates the same views, so
  // it is skipped per-object. Other objects still depend on it.
  const hasViewItems = new Set<string>();
  for (const view of views) {
    if (isViewItem(view)) hasViewItems.add(view.object);
  }
  for (const view of views) {
    // ── Record gate: independent ViewItem ({ name, object, viewKind, config }) ──
    if (isViewItem(view)) {
      // The canonical `<object>.<key>` name doubles as the view id, so
      // `/view/<name>` URLs resolve directly against the switcher tab ids.
      applyViewItem((byObject[view.object] ||= { listViews: {}, formViews: {} }), view);
      continue;
    }
    // ── Stack gate: aggregated container ({ list, form, listViews, formViews }) ──
    const objName = view?.name || view?.list?.data?.object || view?.form?.data?.object;
    if (!objName) continue;
    // Expanded ViewItems supersede the bare container for this object.
    if (hasViewItems.has(objName)) continue;
    const bucket = (byObject[objName] ||= { listViews: {}, formViews: {} });
    // Ask the composer which views this container declares and what each one's
    // runtime identity is (objectui#3770) — the default `list` implicitly claims
    // `<object>.default`, and a `listViews` entry that merely restates it folds
    // into that entry's own name. The primary list keeps arriving on `obj.list`
    // per @objectstack/spec ViewSchema (below) AND is mirrored into `listViews`
    // under that identity, so consumers that only iterate `listViews` still see
    // it and consumers honoring `obj.list` dedup by the same id.
    for (const item of expandViewContainer(objName, view)) {
      applyViewItem(bucket, item);
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
      // Served schemas use `reference`; ObjectUI-authored defs use `reference_to`.
      const parent = d.reference ?? d.reference_to;
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
    const raw = sessionStorage.getItem(sessionKeyFor(type));
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
    sessionStorage.setItem(sessionKeyFor(type), JSON.stringify(items));
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
  //
  // ⚠️ Deliberately skipped on MOUNT (objectui#4042). Consumers read metadata
  // during the FIRST render — `useActionModal` reads `objects`, which kicks
  // `ensureType('object')` and `ensureType('view')` from a render-phase getter,
  // before any effect has run. Clearing unconditionally in this mount effect
  // threw those two entries away while their requests were still in flight, so
  // the very next render found them `idle` again and refetched BOTH. That is
  // the "same round, `meta/object` / `meta/view` each fired twice" the card
  // reported — and it is not an unauthenticated-only artefact: it doubled the
  // two requests on every mount, signed in as well. There is nothing to drop on
  // mount anyway (the cache is per-provider-instance and starts empty), so the
  // clear only ever had meaning on a LATER `previewDrafts` change.
  const previewModeMounted = useRef(false);
  useEffect(() => {
    if (!previewModeMounted.current) {
      previewModeMounted.current = true;
      return;
    }
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

      // Just failed — see ERROR_RETRY_COOLDOWN_MS. `refresh()`/`invalidate()`
      // zero `fetchedAt` / reset the status, so explicit retries fall straight
      // through this.
      if (entry.status === 'error' && Date.now() - entry.fetchedAt < ERROR_RETRY_COOLDOWN_MS) {
        debug(`cache hit (recent failure) type=${type}`);
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
          // Canonicalize `reference` ↔ `reference_to` on object field defs at
          // ingestion (the store-side choke point, mirroring the adapter's
          // getObjectSchema pass) so `useMetadata().objects` consumers can
          // read either key (#2407 / PR #2587). Idempotent, in place.
          if (type === 'object') {
            for (const it of items) normalizeSchemaReferenceKeys(it);
          }
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
          // Stamped on failure too, so ERROR_RETRY_COOLDOWN_MS has a clock to
          // measure from. `refresh()` zeroes it, which is what makes an
          // explicit retry immediate.
          entry.fetchedAt = Date.now();
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

  // ── An org change drops the whole cache (objectui#4486) ───────────────────
  //
  // Scoping the sessionStorage seed by org covers the RELOADING switch paths
  // (`WorkspaceSwitcher` and `OrganizationsPage` both full-page-navigate to the
  // console root after `switchOrganization` resolves). It does NOT cover the
  // switch path that stays inside the SPA:
  // `console/organizations/manage/OrganizationLayout` calls `switchOrganization`
  // from an effect whenever the `/organizations/:slug` segment names a
  // different org, with no reload at all. On that path the IN-MEMORY cache
  // below is what answers `useMetadata().apps`, and it would keep serving the
  // previous org's items until the 5-minute TTL lapsed.
  //
  // The card's invariant is about the data, not the storage key, so it is
  // enforced where the data actually lives: one organization's metadata never
  // survives into another organization's reads. Same shape as the preview-mode
  // clear above — swapping the active org swaps the world every `/meta/*`
  // request resolves in.
  const { activeOrganization } = useAuth();
  const activeOrgId = activeOrganization?.id ?? null;
  const lastOrgId = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastOrgId.current;
    lastOrgId.current = activeOrgId;
    // The FIRST resolution (unknown → known) is NOT a switch. AuthProvider
    // resolves the active organization asynchronously after mount, so this
    // effect sees `null → <id>` on every normal boot; clearing there would
    // throw away the eager `app`/`object`/`view` fetches while they are still
    // in flight and make the next render refetch all three — precisely the
    // doubled-request regression objectui#4042 pinned.
    if (previous === null || previous === activeOrgId) return;

    let cancelled = false;
    cacheRef.current.clear();
    itemPromisesRef.current.clear();
    // `apps` is the one collection read straight off the entry
    // (`getEntry('app').items`) instead of through `readType`, so unlike every
    // lazy type it is NOT re-armed by a consumer reading it. Without this kick
    // the clear above would leave the nav permanently empty on the no-reload
    // path. And `initialLoading` goes back up for the same reason the cached-
    // empty case is a miss: while the new org's list is in flight, "no apps" is
    // not yet an answer.
    setInitialLoading(true);
    void ensureType('app').finally(() => {
      if (!cancelled) setInitialLoading(false);
    });
    bump();
    return () => {
      cancelled = true;
    };
  }, [activeOrgId, bump, ensureType]);

  useEffect(() => {
    let cancelled = false;

    // Session-cached apps are PUBLISHED-world data — seeding them while in
    // draft preview would flash the wrong universe before the fetch lands.
    const cached = previewDrafts ? null : loadFromSession('app');
    dropLegacyUnscopedEntry('app');
    // A cached EMPTY list is a MISS, not a hit (objectui#4486).
    //
    // `[]` is truthy, so an empty cached list used to take this branch and
    // clear `initialLoading` — which made "no apps (cached, possibly stale)"
    // indistinguishable from "no apps (fresh)" for every consumer that gates on
    // `loading`. There is also nothing to gain: seeding zero items saves no
    // render, while the `status: 'ready'` it stamped made `getTypeStatus('app')`
    // claim a settled answer the provider did not have. Falling through leaves
    // the entry `idle` and `initialLoading` true until the fetch below lands.
    if (cached && cached.length > 0) {
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
