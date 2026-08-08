/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expandViewContainer } from '@objectstack/spec/ui';

/**
 * Runtime identity of an aggregated container's DEFAULT `list` view — asked of
 * the spec's view composer, never spelled out here (objectui#3770).
 *
 * A `defineView` container declares its default list under the `list` key. That
 * key is a SLOT in the authoring document, not the view's identity: the composer
 * (`expandViewContainer`, the same function the framework's loader and the i18n
 * extractor call) registers an unnamed default list as `<object>.default`, and a
 * named one as `<object>.<list.name>`. The renderer used to derive `list.name ||
 * 'list'` instead — a third spelling that no producer emits, so the default
 * list's translation key (`objects.<object>._views.default.label`, canonical per
 * objectstack#5164 ruling A) could never be reached and the label fell back to
 * English. Deriving the identity from the composer keeps this consumer on the one
 * spelling and inherits its rules (implicit `default`, author-supplied `name`,
 * collision renaming) instead of restating them.
 *
 * Call sites that hold the whole container (`MetadataProvider`) call
 * `expandViewContainer` directly and get every view's identity, folding
 * included. This helper is for the call sites that hold only the default list
 * body (`ObjectView`, reading `objectDef.list`).
 *
 * @param objectName - The bound object's name, as the runtime presents it.
 * @param list - The container's default `list` body, or a merged entry derived
 *   from it (already carrying the composer's qualified `name`).
 * @returns The qualified `<object>.<key>` view id, or `undefined` when `list` is
 *   not a view body.
 */
export function defaultListViewId(objectName: string, list: unknown): string | undefined {
  if (!list || typeof list !== 'object') return undefined;
  const declared = (list as { name?: unknown }).name;
  // Already the composer's qualified identity — `MetadataProvider` stamps it
  // onto every merged entry, and re-expanding it would double the prefix
  // (`crm_lead.crm_lead.default`).
  if (typeof declared === 'string' && declared.startsWith(`${objectName}.`)) {
    return declared;
  }
  return expandViewContainer(objectName, { list })[0]?.name;
}
