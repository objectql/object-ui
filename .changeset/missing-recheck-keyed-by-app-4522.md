---
'@object-ui/app-shell': patch
---

The console's post-publish readiness re-check now belongs to the app it ran for.

`AppContent` re-checks metadata once when a requested app is absent, because the
registry can lag a beat behind a publish — that refresh is what lets a
just-built app resolve on its own instead of flashing "App not available". The
state driving it recorded only THAT a re-check had run, never WHICH app it ran
for, and it was reset on exactly one condition: `requestedAppMissing` going
false.

Two missing apps in a row never satisfy that condition — `requestedAppMissing`
is true before the transition and true after it — so the state rode across the
navigation as "done" and the second app got no re-check at all. An app reached
second in one mount (the launcher, then a typo'd URL, then the real
freshly-published app; or two attempts while a build lands) was shown the
not-available screen with no refresh behind it. Retry still worked, so the cost
was one skipped refresh rather than a wrong screen.

The run is now stored with the app it ran for and read back only for that app,
the same keying the access probe alongside it already uses (objectui#4252 / PR
objectui#4521) rather than a second pattern in one file. The pre-existing reset
direction is unchanged and pinned: an app that becomes available and goes
missing again is re-checked afresh, an app that resolves is never re-checked,
and Retry still re-runs the check for the app on screen.
