---
'@object-ui/data-objectstack': minor
---

`createObjectStackAdapter` declares the adapter it returns, not the shared `DataSource`
interface (objectui#7323).

The factory returned `new ObjectStackAdapter(config)` while declaring `DataSource<T>`.
A wider value is assignable to a narrower annotation, so nothing ever failed to compile
— the loss was entirely on the reading side. Measured against the shipped
`dist/index.d.ts` with the doc-snippet gate's own compiler options, nine reads through
`ReturnType<typeof createObjectStackAdapter>` failed with TS2339: `getClient`,
`getCacheStats`, `invalidateCache`, `clearCache`, `getConnectionState`, `isConnected`,
`onConnectionStateChange`, `onBatchProgress` and `setSystemCapabilities`. Eight of those
nine reads are on this package's README API Reference list, and four whole README
sections are built on them; the ninth measured read is the one the factory's own JSDoc
links to (`[ADR-0066] See {@link ObjectStackAdapter.setSystemCapabilities}`). The README
list is itself **nine** adapter-only members, not eight — `connect()` is adapter-only
too and was documented all along; it simply was not one of the reads the card's
reproduction measured. So the file's own doc comment pointed the reader at a method its
declared return hid, and the two documented ways to obtain the same object — the factory
and `new ObjectStackAdapter(…)` — handed back different type surfaces.

**What the declared return now is: the whole class, not those nine reads.** The nine
above are what the reproduction measured, not the size of this change. The factory's
declared return is now `ObjectStackAdapter<T>` itself, so **every public member of the
class** is part of what the factory promises. Against `DataSource` that is **20**
members, not nine — `tsc`-computed as
`Exclude<keyof ObjectStackAdapter<unknown>, keyof DataSource<unknown>>`: `clearCache`,
`connect`, `getCacheStats`, `getCached`, `getClient`, `getConnectionState`,
`getDiscovery`, `getItems`, `invalidateCache`, `invalidateViewKeys`, `isConnected`,
`listImportMappings`, `onBatchProgress`, `onConnectionStateChange`, `onSaveAdvisory`,
`onWriteWarning`, `probeAppAccess`, `queryDataset`, `setSystemCapabilities`,
`updateDashboard`. The eleven past the documented nine were already in the shipped class
type — none is `@internal` or `@deprecated`, `stripInternal` is not set, and all were
already reachable through `new ObjectStackAdapter(…)` and through every
`ObjectStackAdapter`-typed seam in `@object-ui/react` and `app-shell` — so what widens
here is what the **factory declares**, not what the package ships. Two are escape-hatch
shaped and worth knowing before building on them: `getCached(key)` is a raw cache read,
and `getDiscovery()` reaches an internal property of the underlying `ObjectStackClient`.

**Branch taken: A (widen the factory's declared return), and why.** The card offered
three. B — moving caching, connection state and batch progress onto `DataSource` — was
rejected because those are this adapter's concerns, not every data source's; every other
`DataSource` implementation would then declare members it does not have. C — documenting
a cast — teaches a cast around a declaration that is merely narrower than the value,
which is the opposite of `declared = enforced`. A is one line and makes declared match
shipped for every documented member at once.

Two questions decided the shape and both were answered from the code before the diff.
`ObjectStackAdapter` was **already** exported from the package's only entry
(`src/index.ts`, tsup's single entry; the class is in the shipped `dist/index.d.ts`
export list, two pin tests assert the exported spelling, and `apps/console` re-exports it
by name) — so widening the return exports nothing by implication. And the narrow return
was **not** a deliberate swappability guarantee: no comment, ADR or test pinned it, and
the commit that added `autoReconnect` / `maxReconnectAttempts` / `reconnectDelay` to the
factory's own config bag left the members that observe those features off the factory's
declared return in the same change.

**One caller shape breaks: a structural stand-in for the factory's return.** A
hand-written object literal annotated `ReturnType<typeof createObjectStackAdapter>` no
longer satisfies that type, because it is now a class with private members (TS2740) —
annotate such a fake as `DataSource` instead, which is what it was standing in for.
Nothing else moves: a wider return is assignable to the narrower annotation, so
`const ds: DataSource = createObjectStackAdapter(…)` keeps compiling and keeps giving
the narrow surface to anyone who wants it.

The README's note saying the page could not yet teach the factory's shape is removed, and
the four sections built on the adapter-only members (Metadata Caching, Connection State
Monitoring, Batch Operation Progress, Troubleshooting → Cache Issues) now continue from
Basic Setup's `createObjectStackAdapter(…)` call instead of declaring the class by hand.
The docs-site page `content/docs/utilities/data-objectstack.mdx` is corrected the same
way: its prose, its factory signature fragment and its "hold the class type to reach
these" section described the old narrow return, and its Mutations and Troubleshooting
examples told the reader to construct the class by hand to reach members the factory now
declares. `src/adapterFactoryReturn.types.test.ts` pins the card's TS2339 reproduction
inverted,
with two controls: the adapter-only members stay absent from `DataSource` (fires on
option B), and the widened return stays assignable to `DataSource` (swappability kept).
