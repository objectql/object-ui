---
'@object-ui/react': patch
---

`useSchemaPersistence` no longer writes its adapter ref during render
(objectui#6745).

The hook keeps the live adapter in a ref so `save`/`load`/`list`/`remove` can be
created once and still reach the newest adapter at call time. That ref was
written in the render body:

```
const defaultAdapter = useRef(createLocalStorageAdapter());
const adapterRef = useRef(adapter ?? defaultAdapter.current);
adapterRef.current = adapter ?? defaultAdapter.current;   // during render
```

which `react-hooks/refs` flags on three counts. A render React discards or
replays — StrictMode, a Suspense retry, a concurrent interruption — still
performed that write, so a save could be routed through an adapter belonging to
a render that never committed.

The write now happens in `useInsertionEffect`, and the default adapter comes
from `useMemo` instead of a ref read during render.

**Timing is preserved for every legal call site.** Insertion effects run in the
mutation phase — before every layout effect in the tree, before paint, and
before any event handler can fire — so a changed `adapter` prop is in place
before anything that may legally invoke these methods can observe it. This is
deliberately *not* `useEffect` (which lands after paint) or `useLayoutEffect`
(a child's layout effects run before its parent's); either would route a call
made earlier in the same commit to the previous adapter. The only window that
changed is a read during the render phase itself, which no legal consumer has:
`save`/`load`/`list`/`remove` are side effects and are never callable during
render.

Also fixed in passing, on the same lines: `useRef(createLocalStorageAdapter())`
invoked the factory on **every** render and discarded all but the first result.
The `useMemo` runs it once. The adapter is a stateless facade over
`localStorage` and its identity is never exposed, so this is unobservable
beyond the saved work.

No API, signature or observable behaviour change for any supported call site.
