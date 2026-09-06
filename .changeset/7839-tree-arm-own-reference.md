---
'@object-ui/plugin-tree': patch
---

`ObjectTree`'s parent-pointer auto-detection accepts a `tree` field only when it is
this object's own (objectui#7839, objectstack#14892 follow-up).

A hierarchy is parent/child **within one object**, so `@objectstack/spec` refuses a
`tree` field whose `reference` names any other object (`refuseForeignTreeReference`);
`reference` stays optional on a `tree`, where it is a redundant self-annotation.
`detectParentField` returned the first `type: 'tree'` field whatever its `reference`
said, so a foreign-shaped one was silently picked as the parent pointer and the forest
was grouped on a pointer into a table it does not point at. It now mirrors the spec's
own kernel predicate `hasDetectableParentField` term for term — accept when `reference`
is absent, or when it equals the bound `objectName` — and the `objectName` guard comes
with it: an object whose name we do not know cannot be self-referenced.

Skipping rather than returning also removes a masking bug the old early-return hid: a
foreign `tree` declared before a self-referencing `lookup` used to win by position and
the lookup never got its turn. The `lookup` / `master_detail` arm is otherwise
unchanged.

Reachability is narrow and stated rather than oversold: the refused shape does not
survive `ObjectSchema.parse` on a spec carrying that rule, so it is unreachable from
parsed metadata and reachable from a hand-built one — `getObjectSchema` is a required
member of the published `DataSource` interface, so a third-party implementation reaches
this reader raw. Note also that the renderer tightens **ahead** of the spec copy this
repo installs: `@objectstack/spec@17.2.0` still accepts the foreign shape at parse
(measured), so until that pin moves this function is the only door.
