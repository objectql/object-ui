---
'@object-ui/fields': patch
---

An image field's declared `maxSize` is enforced before the upload starts, not after it finishes

`ImageField` received a `maxSize` and ignored it. `paramToField` copies `maxSize` onto the field config for every action param regardless of type, so an image param declared with a 5 MB limit handed the widget its constraint and the widget uploaded anyway: a 6.3 MB PNG fired the full `presigned → PUT → complete` chain and rendered a thumbnail, with no rejection anywhere. The sibling file param, declared the same way, refused the identical pick without a single request. Reported from a QA run driving the two side by side (objectui#4141).

Both of the widget's upload doors now check the limit first. The native picker rejects oversize picks before any request, keeping FileField's partial-acceptance rule — the in-limit members of a multi-select still upload, and only the oversize ones are reported. The crop dialog is the second door and needed the check in its own right: the cropper re-encodes to PNG, so cropping an in-limit JPEG can produce a blob *over* the limit, and it is the crop's size that is uploaded. A rejected pick or crop now surfaces the same message the file widget has always shown, in a new error row — this widget had no surface for rejections before, because it never rejected anything.

The guard itself moved into one shared `maxSizeError` helper that both widgets call, rather than a second copy living in the image widget. The check is the only thing between a declared limit and a real upload, and a per-widget copy is what let these two drift apart unnoticed in the first place. Both widgets also share the existing `fields.file.exceedsMaxSize` message: it names a file and a limit, says nothing file-specific, and is already translated in all built-in locales, so no new key was added and no translation is pending. FileField's own behavior is unchanged — same threshold, same message, same partial acceptance.

An undeclared `maxSize` still means unrestricted; the falsy check is preserved deliberately, so a missing limit can never be read as a zero-byte one.
