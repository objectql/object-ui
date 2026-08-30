---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Setup › **Packaged automation** gains a packaged **actions** section beside its flows one —
the surface half of ADR-0126 §8 item 2 (objectui#6412; the engine, ledger and both dispatch
doors landed in objectstack#12348). The maintainer's pull, verbatim and untranslated:
「动作 可能是需要开关的，因为有的 action 我不想启用。」

Per packaged action the section does exactly **one** thing: **on/off for this scope**. That
is all the `sys_metadata_activation` ledger knows about an action, and the section claims
nothing more.

- **State** comes from the ledger's `metadata_type: 'action'` rows, read through the generic
  data API list the object itself sanctions for exactly this
  (`apiMethods: ['get', 'list']` — *"Reads stay open so operability surfaces can answer
  'what is disabled here?'"*). **Absence of a row means active**, so a stock boot shows
  everything armed.
- **Discovery** mirrors the runtime's own `collectActionDeclarations`: object-embedded
  `actions[]` from `GET /meta/object` **plus** standalone items from `GET /meta/action`, with
  the object-embedded declaration winning a `<object>:<action>` key clash. Listing only the
  first source would leave an administrator with no off-switch for a packaged standalone
  action.
- **Flips** invoke the L6 write door `POST /actions/_activation/:object/:action` with exactly
  the one key its body declares (`{ enabled }`); `global` is the object segment for an
  object-less action, the same spelling both dispatch doors take.

**⛔ No clone for actions.** The flows section keeps its own (§7.1); amendment ruling 3
charters the *switch* for actions and nothing else, and §8 keeps the clone half pre-chartered
until real pull appears. A clone control here would advertise machinery that does not exist —
which is also why the server's §5 refusal for actions recommends the platform operator and an
ordinary sibling action where the flow refusal recommends a clone.

**⛔ No drift or ancestry surface** (§9): no "customized" badge, no diff-vs-base, no
base-moved notice. The platform tracks no such lineage, so a surface showing it would be
showing something it had to invent. The absence is pinned against a response that smuggles
`clonedFrom` / `baseVersion` in, so it is enforced at the renderer and not merely by the wire.

Server refusals reach the operator **verbatim** — no client-side softening, no retry loop.
Three shapes are reachable in tests, each transcribed character-for-character from the
runtime's own message builders: the §5 posture gate (403 `PERMISSION_DENIED`, naming the
posture *and* the sanctioned path), the ambiguous-name refusal (409 `RESOURCE_CONFLICT`,
naming the objects a machine name collides across — a list nothing on the client could
reconstruct) and the no-ledger outage (503 `SERVICE_UNAVAILABLE`).

One further refusal is the section's own and it points the same way: a `hasMore` on the
ledger read is treated as a **load failure** rather than rendered. A dropped row reads as
"active", so a partial ledger would show a switched-off action as armed — the one direction
this section must not fail in.

The flows section is unchanged in behaviour. It gains a heading beside the new one, and the
page subtitle now says "Flows and actions" — that string moved in all ten packs together.
Nine new `packagedAutomation.*` keys land in `en` **and in all nine other packs** as real
translations; the two toggle-failure keys are artifact-neutral by wording and are reused
rather than duplicated.
