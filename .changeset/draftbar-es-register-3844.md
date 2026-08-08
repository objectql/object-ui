---
'@object-ui/i18n': patch
---

`preview.draftBar` speaks one second person in `es` — the draft-preview banner no
longer switches from tú to usted when a Spanish user publishes (#3844)

`DraftPreviewBar` renders two mutually exclusive sentences in the same strip of
the same banner: `message` while there are unpublished changes, `messageClean`
once there are none. In `es` the two disagreed on register — `message` was tú
(`estás viendo`, `publiques`) while `messageClean` (`ve`) and `sampleDataBody`
(`Está`, `su`, `Publíquela`) were usted. So a Spanish user who pressed Publish
watched the banner change person: same component, same position, same session.

This is a third defect class in the value-domain blind spot behind #3582 and
#3625, and no gate in the repo can see it. Both `es` values are correct
translations of their `en` sentences — nothing is missing, nothing is stale, and
nothing holds English. The inconsistency is *internal to one pack, on one UI
surface*: `scripts/check-i18n-call-site-keys.mjs` only asks whether a key exists
in `en`, `all-locales-key-parity` compares key sets and placeholder shapes and
never reads values, and `scripts/check-i18n-en-drift.mjs` only fires when an `en`
value moves — these two `en` values never moved.

`message` is the value that changes, because usted is what the pack already says
everywhere around it: the `es` pack censuses 102 usted markers to 30 tú (tú being
the marked exception, concentrated in the auth, report-editor and organizations
neighbourhoods that #3546 slice two deliberately ruled informal); the other three
strings of this same object were already usted; and #3546 slice five gave the 19
new `preview.unpublishedBar.*` / `preview.history.*` keys usted on the strength
of `home.pendingDrafts.published` ("¡Publicado! Sus cambios están activos."). Two
smaller divergences inside the same sentence are closed with it, so the banner's
two halves stop disagreeing about wording as well as person:

- **`—` instead of `:`** in `messageClean`, matching `en`, where both sentences
  open `Draft preview — `. That is the whole of `messageClean`'s diff.
- **`activo` instead of `en producción`** for "live". The pack spells this concept
  `activo` in four neighbouring places including `publishCta` in this very object
  ("Publicar para verlo activo"), and it reserves *producción* for the actual
  production environment (`environment.entitlement.planLockedBody`), so the
  outlier was ambiguous as well as inconsistent.
- **`Vista previa del borrador`** as the shared opening, `del` being the form
  `messageClean` already used.

No `en` value changes (the en-drift gate reports 0), no key is added or removed
(so `all-locales-key-parity` is untouched by construction), and the nine other
packs are not touched. The diff is two values in one file.

Re-voicing the whole `preview` namespace to tú was considered and rejected — a
much larger change that would collide with the adjacent `marketplace.*` (9:0
usted) and `console.ai.*`. `preview.empty.notReadyDescription` therefore stays tú
here, since #3844's ruling is this banner only; it is filed as #3875 rather than
waved through, because `PreviewDraftEmptyState` renders *underneath*
`DraftPreviewBar` and so those two show usted and tú on screen at the same time.
After this change the `preview` namespace is 23 usted to that 1 tú.

A gate that checks "one register per namespace" is deliberately **not** here:
recognising usted vs tú needs real morphology, and token matching demonstrably
cannot — in this pack the token `revisa` is usted in `console.ai.empty.build`
(es.ts:1365, "…y usted revisa y publica.") and tú in
`auth.forgotPassword.successTitle` (es.ts:1918, "Revisa tu correo electrónico"),
the same eight letters in opposite registers. The neighbourhood boundary such a
gate would police is human judgement anyway — #3546 slice two's "same rule,
different answer". A new `draftBar-es-register-3844.test.ts` pins the four `es`
values byte for byte instead, plus the `en` literals, so a future reword of
either `en` sentence fails in the same PR that reworded it.
