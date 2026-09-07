---
'@object-ui/types': minor
---

`SchemaRegistry` names all three `plugin-chatbot` registrations, so the published
`ComponentType` union does too (objectui#7704).

`packages/plugin-chatbot/src/renderer.tsx` registers three components — `chatbot`,
`chatbot-enhanced` and `chatbot-floating` — and `SchemaRegistry` mapped one of them.
Since `ComponentType = keyof SchemaRegistry` is the published union, a consumer
discriminating on it was told two registered keys do not exist: an author narrowing a
node by `ComponentType`, or writing a `Record<ComponentType, …>` table, had no arm for
either. The asymmetry that showed which half was wrong is that
`packages/cli/src/utils/known-schema-types.ts` keeps its own parallel list containing
both keys, precisely because this map did not.

**Additive.** Two keys join the map under its `// Complex` group; no existing entry
changes, `'chatbot'` still maps to `ChatbotSchema`, and nothing is removed. The union
widens, which cannot break a consumer that produces `ComponentType` values and can only
help one that consumes them — except an exhaustive `Record<ComponentType, …>` or
`switch`, which now needs the two new arms. Nothing in this repo has one: the only
consumer of `ComponentType` outside its own declaration is a pin test.

**Why the entries can be honest now.** This map's value has to be the type the
registered renderer honours, and until objectui#7655 there was none to point at —
`ChatbotSchema` pins `type` to `'chatbot'`, and each registration's real key set lived
in an anonymous `ChatbotSchema & { … }` intersection local to the renderer file.
objectui#7655 published `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` from this
package, and both registrations already take them as their `schema` parameter, so the
map's value and the renderer's prop type are one declaration — the same property the
`'kanban'` arm gained in objectui#7664. Being declared here also makes them reachable:
`@object-ui/types` has zero workspace dependencies, which is exactly what blocked the
`kanban` case objectui#7645 measured, where the honoured type lived in a plugin.

Pinned in `src/__tests__/schema-registry-chatbot-keys-7704.test.ts` in two channels —
compile-time (`tsc -p tsconfig.test.json`: the keys survive in `keyof`, each value is
the face its renderer honours, and each value's own `type` literal is its key) and
runtime (a TypeScript-AST census of the interface source, plus each key selecting its
own arm through `safeValidateSchema`).

Scope: these two keys, whose authoring faces now exist — not a sweep of the map's other
entries, which objectui#7665 holds.
