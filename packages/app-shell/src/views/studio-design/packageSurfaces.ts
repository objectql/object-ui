// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Load the rail entries for one metadata type inside a Studio package pillar:
 * the PUBLISHED items unioned with the pending DRAFT items, deduped by name.
 *
 * Why the union: `client.list(type, { packageId })` only returns
 * published/active metadata. A freshly-authored item that hasn't been published
 * yet (or a whole fresh writable-base package whose items are all still drafts)
 * would therefore render an empty rail even though the author just created it —
 * and the "N pending changes" counter would show the draft exists while the rail
 * itself hid it. Merging `client.listDrafts({ packageId, type })` keeps the item
 * designable between authoring and its first publish.
 *
 * This is the canonical form of the merge the Data / Interfaces / Access pillars
 * already do inline; extracting it (a) fixes the Automations pillar, which was
 * the sole rail that listed only published items and hid draft-only flows, and
 * (b) makes the behaviour unit-testable without rendering a heavy pillar tree.
 *
 * Draft headers carry no label (they are light rows — no body), so a draft-only
 * item shows its machine name until the draft body loads on selection, matching
 * the sibling pillars.
 */

/** Minimal structural view of the metadata client this helper needs. */
export interface PackageSurfaceClient {
  list(type: string, options?: { packageId?: string }): Promise<unknown>;
  listDrafts(
    options?: { packageId?: string; type?: string },
  ): Promise<Array<{ name?: string | null }>>;
}

/** One rail entry — mirrors the `Surface` shape used by the pillars. */
export interface PackageSurface {
  type: string;
  name: string;
  label: string;
}

/**
 * Fetch published + pending-draft items of `type` for `packageId` and merge them
 * into rail entries. Published rows win on name collision (their real label is
 * kept); draft-only names are appended with the machine name as the label.
 *
 * `listDrafts` failures are tolerated (an older server without the drafts
 * endpoint, or a transient error) — the rail still renders the published set
 * rather than erroring out, matching the sibling pillars' `.catch(() => [])`.
 */
export async function loadPackageSurfaces(
  client: PackageSurfaceClient,
  type: string,
  packageId: string,
): Promise<PackageSurface[]> {
  const [published, draftHeaders] = await Promise.all([
    client.list(type, { packageId }) as Promise<Array<Record<string, unknown>> | null | undefined>,
    client
      .listDrafts({ packageId, type })
      .catch(() => [] as Array<{ name?: string | null }>),
  ]);

  const items: PackageSurface[] = (published || [])
    .map((o) => ({
      type,
      name: String(o.name ?? ''),
      label: String(o.label ?? o.name ?? ''),
    }))
    .filter((o) => o.name);

  const known = new Set(items.map((o) => o.name));
  for (const d of draftHeaders || []) {
    const name = String(d?.name ?? '');
    if (name && !known.has(name)) {
      items.push({ type, name, label: name });
      known.add(name);
    }
  }

  return items;
}
