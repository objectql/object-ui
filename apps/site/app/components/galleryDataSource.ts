/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

/**
 * The docs gallery's stand-in data source (objectui#4600).
 *
 * The catalog is a **presentation corpus**: it ships JSON, not a backend, and
 * the gallery renders it with no application behind it. Most entries need
 * nothing — their data is inline. Dataset-bound dashboard widgets are the
 * exception: `DatasetWidget` routes through `dataSource.queryDataset`, and with
 * no such function it renders "This data source does not support dataset
 * queries." — which is what `plugin-dashboard/filtered-dashboard-dataset-
 * widgets` showed in the gallery until this file existed.
 *
 * So this is the smallest thing that lets a dataset-bound widget draw: canned
 * rows shaped from the query's own `dimensions` / `measures`, so any widget
 * gets a two-bucket series (or a single value when it selects no dimension)
 * regardless of which dataset it names. It is a DEMO fixture — it does not
 * filter, aggregate or honour `runtimeFilter`, and it must never be mistaken
 * for a data-source implementation. Real ones live in `@object-ui/data-*`.
 *
 * It is gallery-only on purpose: `apps/site` is `private`, so nothing here is
 * a published package surface.
 */

/** The subset of a dataset query this fixture reads. */
interface GalleryDatasetQuery {
  dimensions?: string[];
  measures?: string[];
}

/** One canned row: dimension values plus measure values. */
type GalleryRow = Record<string, unknown>;

export const galleryDataSource = {
  async queryDataset(dataset: string, query: GalleryDatasetQuery) {
    const dimensions = query?.dimensions ?? [];
    const measures = query?.measures ?? [];
    const measure = measures[0] ?? 'value';
    const rows: GalleryRow[] = dimensions.length
      ? [
          { [dimensions[0]]: 'Alpha', [measure]: 42 },
          { [dimensions[0]]: 'Beta', [measure]: 27 },
        ]
      : [{ [measure]: 69 }];
    // `object` is what makes a chart drillable; a demo fixture has nothing to
    // drill INTO, so it is deliberately omitted along with `dimensionFields`.
    return { rows, fields: [] };
  },
};
