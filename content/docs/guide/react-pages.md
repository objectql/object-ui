---
title: React Pages
description: Author a page body as real React (kind:'react') or as constrained JSX that is parsed and never executed (kind:'html') — and how to choose between them.
---

# React Pages

Most pages in ObjectUI are a **schema tree** — `regions[].components[]` of JSON
nodes. Two page kinds let you write the body as **source** instead, for layouts
that are awkward to express as nested JSON:

| `kind` | Source is | Executed? | Author trust |
|---|---|---|---|
| `"html"` | Constrained JSX/HTML + Tailwind | **No** — parsed into a schema tree | Untrusted OK |
| `"react"` | Real React (hooks, handlers, arbitrary JS) | **Yes** — in the main React tree | Trusted only |

Both set `source` and leave `regions` unused. `"jsx"` is a deprecated alias for
`"html"` and is still accepted.

> Page `kind` also carries the record-page override values `"full"` (default)
> and `"slotted"` — a different axis, covered in [Slotted Pages](./slotted-pages.md).

## Choosing between them

Reach for **`kind:'html'`** by default. It is parsed, whitelisted against the
public block manifest, and never executed, so it is safe for AI-generated and
customer-authored pages. It covers layout, blocks, and Tailwind styling.

Reach for **`kind:'react'`** only when you need real behaviour the schema tree
cannot express — local state, computed lists, event handlers wiring one block to
another, custom data fetching. It runs **without a sandbox**.

## `kind:'react'`

```json
{
  "type": "home",
  "name": "project_console",
  "kind": "react",
  "source": "function Page() {\n  const [selected, setSelected] = React.useState(null);\n  return (\n    <div className=\"grid grid-cols-2 gap-4\">\n      <ListView objectName=\"showcase_project\" fields={['name', 'status']} onRowClick={(r) => setSelected(r._id)} />\n      {selected && <ObjectForm objectName=\"showcase_project\" mode=\"edit\" recordId={selected} />}\n    </div>\n  );\n}"
}
```

Written out, that `source` is:

```jsx
function Page() {
  const [selected, setSelected] = React.useState(null);
  return (
    <div className="grid grid-cols-2 gap-4">
      <ListView
        objectName="showcase_project"
        fields={['name', 'status']}
        onRowClick={(r) => setSelected(r._id)}
      />
      {selected && <ObjectForm objectName="showcase_project" mode="edit" recordId={selected} />}
    </div>
  );
}
```

### The security gate

A react page's source is transpiled and evaluated directly in the application —
no isolation, full access to the page's React tree. The platform assumes page
authors are reviewed and draft-gated, so the host capability `react-pages`
defaults **ON**.

A deployment that does not trust its authors turns it off server-side with
`OS_PAGE_REACT=off` (or `disableCapability('react-pages')` in the host). Pages
then render an explanatory notice instead of executing. Existing `kind:'html'`
pages are unaffected.

### What is in scope

Nothing is imported. These identifiers are injected as closure variables:

| In scope | What it is |
|---|---|
| `React` | The host's React — call hooks with it (`React.useState`). |
| The public data blocks | `<ObjectGrid>`, `<ListView>`, `<ObjectForm>`, `<ObjectKanban>`, `<ObjectChart>`, `<ObjectMetric>`, `<Markdown>`, … |
| `Block` | Escape hatch for anything not injected. |
| `useAdapter` | The live data source — query/create/update. |
| `data`, `variables`, `page` | The page's own data, local variables, and schema. |

The block tags come from the curated **public contract**
(`PUBLIC_BLOCKS`), converted from kebab-case to PascalCase: `object-grid` →
`<ObjectGrid>`, `record:details` → `<RecordDetails>`. Blocks registered lazily
are in scope too — you never wait on a plugin chunk to reference one.

**Layout containers are deliberately not injected.** In react mode you compose
layout with real HTML and Tailwind, which React is better at than a schema-children
renderer. `<flex>`, `<grid>`, `<card>` and friends have no injected wrapper — use
`<div className="flex gap-4">`.

### Blocks take flat props

An injected block folds its JSX props into the block's schema, so you write
flat props rather than a nested `schema` object:

```jsx
<ObjectGrid objectName="showcase_project" fields={['name', 'status']} pageSize={25} />
```

Function props (`onRowClick`, `onSelect`) are passed through as real callbacks —
that is how you wire one block to another.

One collision to know about: `type` is both the schema's component
discriminator and a legitimate prop name on some blocks (a chart's family, for
instance). The discriminator wins the `type` slot, and your value is preserved
next to it as `specType` for the block to read.

### `Block` — the escape hatch

Any registered component, including ones outside the public contract:

```jsx
<Block type="object-tree" objectName="showcase_category" />
```

### Live data

```jsx
function Page() {
  const adapter = useAdapter();
  const [rows, setRows] = React.useState([]);

  React.useEffect(() => {
    adapter.find('showcase_project', { filters: [['status', '=', 'open']] }).then(setRows);
  }, [adapter]);

  return <ul>{rows.map((r) => <li key={r._id}>{r.name}</li>)}</ul>;
}
```

### Source shapes

The page renders the source's **default export**. An implicit `export default`
is added when the source *starts with* JSX, a `function` declaration, `()`, or
`class`:

```jsx
function Page() { return <p/>; }     // ✅
<p>hi</p>                            // ✅
() => <p>hi</p>                      // ✅

const Page = () => <p/>;             // ❌ exports nothing
const Page = () => <p/>;
export default Page;                 // ✅
```

The `const Page = …` form does **not** get the implicit export — export it
explicitly. Getting this wrong reports an error in the page error panel; it does
not silently render blank.

### When something throws

Transpile errors, evaluation errors, and errors thrown while rendering all
surface in a **React page error** panel with the message. The error is held
until the page source or its data changes, so it does not flicker or escape to
the generic renderer error.

Referencing an identifier that is not in scope is the common case, and reads as
`ReferenceError: <Name> is not defined` — usually a layout container (not
injected — use HTML) or a block outside the public contract (use `Block`).

### Page state

A react page keeps its own `useState` across re-renders and across lazy plugin
loads. Three things reset it, all intentional: a change to `source`, a change to
the page's data/variables, and a **new data source** — the page is genuinely a
different page then.

That last one is a requirement on the **host**, not the author. The page is
recompiled when the adapter's *identity* changes, because recompiling is the
only way the new adapter reaches the blocks inside the page. So a host that
constructs a new adapter on every render resets every react page on every
render. Provide it from state or a module constant:

<!-- doc-snippet: fragment — a bad/good contrast of two bare JSX opening tags: neither half is a closed element, and showing them closed would hide the difference the section is about -->
```tsx
// ❌ new adapter object every render — every react page below loses its state
<AdapterCtx.Provider value={new ObjectStackAdapter(config)}>

// ✅
const [adapter, setAdapter] = useState<ObjectStackAdapter | null>(null);
<AdapterCtx.Provider value={adapter}>
```

`@object-ui/app-shell`'s `AdapterProvider` already does this correctly; the rule
matters for custom hosts and preview surfaces.

## `kind:'html'`

The constrained tier. Same JSX-looking syntax, but the source is **parsed**
into a schema tree and rendered through the normal renderer — never executed.
Only tags in the public block manifest are allowed, props are validated against
each block's declared inputs, and unknown tags are a hard error at save time.

Use it for anything author- or AI-generated. Expressions are limited to what the
schema supports (`${data.x}`), and there is no local state or event handling
beyond the action system.

## Related

- [Slotted Pages](./slotted-pages.md) — `kind:'full'` / `kind:'slotted'` record pages.
- [Schema Rendering](./schema-rendering.md) — the schema tree the other kinds compile to.
- [Component Registry](./component-registry.md) — how blocks are registered and what makes one public.
