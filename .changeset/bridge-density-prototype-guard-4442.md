---
'@object-ui/react': patch
---

The spec bridge abstains on prototype-member `rowHeight` spellings instead of leaking a
function into `density`.

`bridgeListView`'s `mapDensity` indexed a plain object literal with an unchecked key, so
the lookup reached `Object.prototype`. The parameter is typed `RowHeight`, but the
boundary a host's stored view definition actually crosses is `SpecBridge.transformListView`,
whose parameter is `any` — so `rowHeight: 'toString'` came back as `Object.prototype.toString`,
a **function**, out of a read whose return type is three strings or nothing. `bridgeListView`
then writes the key under `if (density)`, and a function is truthy, so the bad value was not
merely returned: it was stored on a `SchemaNode` whose renderer expects
`'compact' | 'comfortable' | 'spacious'`. Same for `constructor`, `valueOf`,
`hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and `toLocaleString`.

The lookup is now guarded with `Object.prototype.hasOwnProperty.call(...)` — the same guard
`@object-ui/core`'s `rowHeightToDensityMode` grew in objectui#4440, and the repo's existing
convention at eight other sites. Both `rowHeight` surfaces now abstain identically on every
off-spec **string** spelling, and objectui#4440's agreement pin covers the prototype-member
family instead of excluding it (objectui#4442).

Runtime-only: no public type moved, and no spec-valid `rowHeight` changes its answer.
