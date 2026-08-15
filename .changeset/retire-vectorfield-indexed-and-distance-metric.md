---
'@object-ui/types': minor
---

Remove `VectorFieldMetadata.indexed` and `VectorFieldMetadata.distance_metric`
— both declared keys the ObjectStack spec rejects

Two separate dead keys on `VectorFieldMetadata`
(`packages/types/src/field-types.ts`), found alongside PR #4686's sibling
`BaseFieldMetadata.indexed` deletion:

- `indexed` was never a `FieldSchema` key — same class as `BaseFieldMetadata`
  above: the field-level flag built no index (objectstack#2377 removed it),
  and `FieldSchema.safeParse` rejects it by name (objectstack#4001).
- `distance_metric` was measured first rather than assumed removable: the
  installed `@objectstack/spec` 17.0.0-rc.6's vector field shape declares no
  metric-spelling key under any candidate spelling probed (`metric`,
  `distanceMetric`, `similarity`, `similarityMetric`, `metricType`,
  `vectorMetric`) — `dimensions` is the only vector-specific key
  `FieldSchema` recognizes, and its `FIELD_KEY_GUIDANCE` alias/retirement
  table carries no entry for `distance_metric` at all. With no equivalent to
  align to, and zero measured readers/writers, removal takes no capability
  away.

Both are rejected by `FieldSchema.safeParse` as `unrecognized_keys`; `dimensions`
is accepted (control). Repo-wide sweep (excluding tests) found zero readers or
writers of either key on the vector path — `VectorField.tsx` (the renderer)
reads only `field.dimensions`. Declare the index on the object instead:
`indexes: [{ name, fields, unique }]`.
