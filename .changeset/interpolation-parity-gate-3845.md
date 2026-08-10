---
'@object-ui/app-shell': patch
---

Fail when a `t()` call site's arguments are not the holes its `en` value has, and delete the three that were inert

`scripts/check-i18n-call-site-keys.mjs` gains a fourth failure class, `interpolation-parity`: for a call site whose key resolves to a readable `en` leaf, the set of interpolation option names it passes must EQUAL the set of `{{hole}}` names in that value. Both directions fail, because they fail differently — an argument with no hole is dropped by i18next in silence, and a hole with no argument leaves its own braces in what the user reads.

Nothing else could see this. `all-locales-key-parity` does compare placeholder shape, but pack against pack, so ten packs agreeing on `Update` while the call site passes `version` is full parity. `check-i18n-en-drift` fires only when an `en` string changes. And objectui#3810's `default-value-drift` is satisfied the moment the call site's inline default matches the pack — which is exactly how `home.welcome` got here: its value was rewritten from `Welcome to {{product}}` to `Build your business system with AI`, the call site's default was later aligned to the new sentence, and the now-inert `product` argument stayed sitting beside it.

The repo-wide run found **3 inert arguments and 0 unfilled holes**, so the rule lands hard, with no baseline. All three arguments are deleted rather than answered with a new hole in `en.ts`:

- `marketplace.action.updateTo` — `version`, on a primary button reading a bare `Update` while its sister key in the same file renders `Update → v{{version}}`.
- `home.welcome` — `product`, so no white-label deployment's name has ever reached the console hero.
- `objectActions.resetPackageSetSuccess` — `label`, copied from the `deleteSuccess` branch next to it, whose sentence does name the record.

**No rendered output moves, on any path.** With a provider mounted, i18next dropped these arguments already. With none, react-i18next's `notReadyT` returns `optsOrDefaultValue.defaultValue` verbatim — there is no interpolation step on that path at all — and all three inline defaults are hole-free too, so the miss path is unaffected as well. Adding the hole instead would have been a copy change: it moves a string users read today and obliges the other nine packs through objectui#3650. The gate accepts either resolution; choosing between them is not its business, and objectui#3546's slice-five assertion — written to force this decision rather than let it be settled silently — now pins the chosen state.

One key is registered as filling its hole downstream: `auth.forgotPassword.successDescription` travels through `t()` with `{{email}}` intact because `ForgotPasswordForm` substitutes the address itself, once the form knows it. That entry silences the unfilled direction only — passing `email` to `t()` there would let i18next consume the hole and make the form append the address a second time, and the gate still reports it.
