/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * dataset-pivot — the lookup-key encoders every cross-tab over a semantic-layer
 * `queryDataset` result shares (ADR-0021).
 *
 * A pivot keys three lookups off dimension-value tuples: the DOWN bucket, the
 * ACROSS bucket, and the cell where the two meet. Every one of them used to be
 * spelled by concatenating values with a character the data was ASSUMED never
 * to contain — an empty string, a plain space, U+0001 — and each assumption
 * failed on ordinary data: `"x"` + `"yz"` and `"xy"` + `"z"` are one id under an
 * empty join, and `"New"` × `"York Q1"` and `"New York"` × `"Q1"` are one cell
 * key under a space join. The later row silently overwrote the earlier one, so
 * the cell showed a different row's measure, the overwritten row's value was
 * unreachable, and drill-through followed the same wrong index into the wrong
 * records — all without an error (objectstack#5473, objectstack#5665).
 *
 * `JSON.stringify` carries the boundary in its own quoting rather than in a
 * character the values must avoid, so these are unambiguous for ANY value a
 * dimension can hold. The ids are opaque lookup keys, never displayed — visible
 * text comes from the separately-formatted labels.
 *
 * Both encoders live here, in `@object-ui/core`, because the same pivot is
 * rendered by two packages (`plugin-dashboard`'s `DatasetWidget` and
 * `plugin-report`'s `DatasetReportRenderer`). Each having written its own is
 * exactly why both carried the defect and why fixing one left the other broken.
 * The same rule applies WITHIN a renderer: the cell index and the subtotal
 * lookups key the same buckets, so they must all call these — a second
 * hand-rolled encoding of the same id agrees with the first only for the
 * dimension counts someone happened to test, which is what kept the original
 * bug invisible.
 *
 * Pure (no React / i18n), like its `dataset-format` neighbour.
 *
 * Known residual, tracked separately in objectstack#5666: callers encode a
 * null/undefined dimension value as a placeholder string, so it still collides
 * with a value that literally equals that placeholder. That is a property of
 * the placeholder, not of the encoding below.
 */

/**
 * Encode a pivot BUCKET id from its dimension values.
 *
 * Axis-neutral on purpose: a DOWN bucket and an ACROSS bucket are the same kind
 * of thing (a dimension-value tuple), and a cross-tab with multiple across
 * dimensions collides on that axis just as readily as on the down axis.
 */
export const pivotBucketId = (dimensionValues: string[]): string => JSON.stringify(dimensionValues);

/**
 * Encode the cell key for a (down bucket, across bucket) pair — the key of the
 * map a renderer reads to place a measure and to resolve a drill-through.
 */
export const pivotCellKey = (rowId: string, colId: string): string => JSON.stringify([rowId, colId]);
