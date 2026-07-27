/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * useActionModal — a reusable `onModal` handler for the ActionProvider that
 * renders an action's modal envelope in the right container by `placement`:
 *
 *   placement: 'center'      → Dialog (sized sm|default|lg|xl)
 *   placement: 'fullscreen'  → Dialog, near-viewport
 *   placement: 'side'        → Sheet (right|left)
 *   placement: 'bottom'      → Drawer (bottom sheet)
 *
 * `content` is an arbitrary SchemaNode rendered via <SchemaRenderer>, so a
 * modal action can open any page/form/list. `{ objectName, mode }` opens a
 * <ModalForm> (what a lookup field's inline "create the referenced record"
 * passes).
 *
 * A STRING target — what `type: 'modal'` actions carry — is resolved through
 * {@link resolveModalTarget}: page first, then object. See that function for
 * why the order matters.
 *
 * Returns `{ modalHandler, modalElement, resolveModalTarget }`: pass
 * `modalHandler` as the ActionProvider `onModal`, render `modalElement` once in
 * the subtree, and use `resolveModalTarget` to ask — without opening anything —
 * whether a target names something this hook can render.
 */
import React, { useCallback, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from '@object-ui/components';
import { SchemaRenderer, useMetadata } from '@object-ui/react';
import { ModalForm } from '@object-ui/plugin-form';
import { resolveFormViewLayout } from '../utils/recordFormNavigation';

type Placement = 'center' | 'side' | 'bottom' | 'fullscreen';
type ModalSize = 'sm' | 'default' | 'lg' | 'xl' | 'full';

export interface ModalDescriptor {
  placement?: Placement;
  side?: 'left' | 'right';
  size?: ModalSize;
  title?: string;
  description?: string;
  /** Arbitrary SchemaNode rendered inside the chosen container. */
  content?: any;
  /** Back-compat: open an object form. */
  objectName?: string;
  mode?: string;
  recordId?: string;
  fields?: any;
  /**
   * An UNRESOLVED string target, straight off a `type: 'modal'` action. It
   * names a page or an object; which one is only knowable by asking the
   * metadata service, so `normalizeModalSchema` (pure) records the name here
   * and {@link resolveModalTarget} (async) turns it into a renderable
   * descriptor. Never rendered directly.
   */
  targetName?: string;
}

type ActionResult = { success: boolean; reload?: boolean; data?: any; [k: string]: any };

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  default: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-[95vw] sm:w-full',
};
const SIDE_SIZE_CLASS: Partial<Record<ModalSize, string>> = {
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
  full: 'sm:max-w-[95vw]',
};

/**
 * Normalize the opaque `schema` arg the ActionRunner passes into a descriptor.
 *
 * A STRING is left UNRESOLVED (`targetName`) rather than assumed to be an
 * object name. Per the spec, a `type: 'modal'` action's `target` is "the
 * modal/page name to open" — so reading it as an object name sent every
 * page-targeting modal action to `GET /meta/object/<page>`, which 400s, and the
 * dialog rendered <ModalForm>'s "Error loading form — Bad Request" instead of
 * the page (framework#3530). `resolveModalTarget` decides page-vs-object by
 * asking the metadata service.
 *
 * The `create_`/`new_`/`add_`/`edit_`/`update_` prefix convention still yields
 * an object-form guess, but it is now only a FALLBACK: it rides alongside
 * `targetName` so a page actually named `create_opportunity` wins over the
 * object `opportunity` it would otherwise be parsed into.
 */
export function normalizeModalSchema(schema: any): ModalDescriptor {
  if (typeof schema === 'string') {
    const m = schema.match(/^(create|new|add|edit|update)_(.+)$/);
    if (m) {
      return {
        targetName: schema,
        objectName: m[2],
        mode: m[1] === 'edit' || m[1] === 'update' ? 'edit' : 'create',
      };
    }
    return { targetName: schema };
  }
  if (schema && typeof schema === 'object') {
    // A bare SchemaNode (has `type` but isn't a modal descriptor) → render as content.
    if (schema.type && !schema.content && !schema.objectName && !schema.placement) {
      return { content: schema };
    }
    return schema as ModalDescriptor;
  }
  return {};
}

export function useActionModal(dataSource?: any) {
  const [state, setState] = useState<{ d: ModalDescriptor; resolve: (r: ActionResult) => void } | null>(null);
  // Object metadata — degrades to an empty list outside a MetadataProvider
  // (see useMetadata). Used to resolve the object's default form view so the
  // create/edit modal honors its curated sections + field selection/order.
  // `getItem` fetches ONE named item on demand, so resolving a modal target
  // never drags in the whole (lazily loaded) page or object list — this hook is
  // mounted at the console root, where an eager list read would cost every page.
  const { objects, getItem } = useMetadata();

  const close = useCallback((r: ActionResult) => {
    setState((s) => {
      s?.resolve(r);
      return null;
    });
  }, []);

  /**
   * Turn whatever the ActionRunner handed us into a descriptor this hook can
   * actually render, or `null` when the target names nothing renderable.
   *
   * Resolution order for a string target is PAGE FIRST, then object, because
   * that is what the spec says the name means — `type: 'modal'` documents
   * `target` as "the modal/page name to open". Probing the object first would
   * re-introduce framework#3530 in reverse for any app whose page and object
   * share a name.
   *
   * A `null` return is not an error by itself: the console runtimes read it as
   * "this isn't a client-rendered modal" and fall through to the action's
   * server-side handler, which is how a modal action whose target names a
   * registered `engine.registerAction` handler still completes.
   */
  const resolveModalTarget = useCallback(
    async (schema: any): Promise<ModalDescriptor | null> => {
      const d = normalizeModalSchema(schema);
      const targetName = d.targetName;
      if (!targetName) {
        // Already renderable (content / objectName descriptor), or empty.
        return d.content || d.objectName ? d : null;
      }

      const page = await getItem('page', targetName);
      if (page) {
        // Rendered exactly like PageView does it: the page item IS the schema
        // node, with `type` naming the page kind ('record' | 'utility' | …).
        return {
          placement: d.placement ?? 'center',
          size: d.size ?? 'xl',
          title: d.title ?? (page as any).label ?? undefined,
          description: d.description,
          content: { ...(page as any), type: (page as any).type || 'page' },
        };
      }

      // Object fallback: the `create_x`/`edit_x` prefix guess first (it names a
      // different object than the raw target), then the raw target itself.
      for (const objectName of [d.objectName, targetName]) {
        if (!objectName) continue;
        if (await getItem('object', objectName)) {
          return { ...d, targetName: undefined, objectName, mode: d.mode ?? 'create' };
        }
      }
      return null;
    },
    [getItem],
  );

  const modalHandler = useCallback(
    async (schema: any): Promise<ActionResult> => {
      const d = await resolveModalTarget(schema);
      if (!d) {
        const name = normalizeModalSchema(schema).targetName;
        return {
          success: false,
          error: name
            ? `Modal target "${name}" matches no page or object — a modal action's \`target\` names the page to open.`
            : 'Modal action has no target to open.',
        };
      }
      return new Promise<ActionResult>((resolve) => {
        setState({ d, resolve });
      });
    },
    [resolveModalTarget],
  );

  let modalElement: React.ReactNode = null;
  if (state) {
    const d = state.d;
    const onOpenChange = (open: boolean) => {
      if (!open) close({ success: false });
    };

    if (d.objectName && !d.content) {
      // Honor the object's default FORM VIEW (curated sections + field
      // selection/order + master-detail subforms) unless the action descriptor
      // passed an explicit field list. Without this the modal falls back to the
      // raw object schema — every field, in schema order. Mirrors the global
      // New/Edit modal in AppContent so action-opened forms stay consistent.
      const viewLayout = (d.fields || (d as any).sections)
        ? {}
        : resolveFormViewLayout(objects.find((o: any) => o?.name === d.objectName));
      modalElement = (
        <ModalForm
          schema={{
            type: 'object-form',
            formType: 'modal',
            objectName: d.objectName,
            mode: (d.mode as 'create' | 'view' | 'edit') || 'create',
            recordId: d.recordId,
            title: d.title,
            description: d.description,
            fields: d.fields,
            ...viewLayout,
            modalSize: d.size,
            open: true,
            onOpenChange,
            onSuccess: (data: any) => close({ success: true, reload: true, data }),
            onCancel: () => close({ success: false }),
            showSubmit: true,
            showCancel: true,
          }}
          dataSource={dataSource}
        />
      );
    } else {
      const placement: Placement = d.placement || 'center';
      const body = d.content ? (
        <SchemaRenderer schema={d.content} />
      ) : d.description ? (
        <p className="text-sm text-muted-foreground">{d.description}</p>
      ) : null;

      if (placement === 'side') {
        modalElement = (
          <Sheet open onOpenChange={onOpenChange}>
            <SheetContent side={d.side || 'right'} className={cn('w-full overflow-y-auto', SIDE_SIZE_CLASS[d.size || 'default'])}>
              {d.title && (
                <SheetHeader>
                  <SheetTitle>{d.title}</SheetTitle>
                  {d.description && <SheetDescription>{d.description}</SheetDescription>}
                </SheetHeader>
              )}
              <div className="py-3">{body}</div>
            </SheetContent>
          </Sheet>
        );
      } else if (placement === 'bottom') {
        modalElement = (
          <Drawer open onOpenChange={onOpenChange}>
            <DrawerContent>
              {d.title && (
                <DrawerHeader>
                  <DrawerTitle>{d.title}</DrawerTitle>
                  {d.description && <DrawerDescription>{d.description}</DrawerDescription>}
                </DrawerHeader>
              )}
              <div className="max-h-[75vh] overflow-y-auto px-4 pb-6">{body}</div>
            </DrawerContent>
          </Drawer>
        );
      } else {
        modalElement = (
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent
              className={cn(
                placement === 'fullscreen'
                  ? 'h-[95vh] w-full max-w-[98vw] overflow-y-auto'
                  : SIZE_CLASS[d.size || 'default'],
              )}
            >
              {d.title && (
                <DialogHeader>
                  <DialogTitle>{d.title}</DialogTitle>
                  {d.description && <DialogDescription>{d.description}</DialogDescription>}
                </DialogHeader>
              )}
              <div>{body}</div>
              {!d.content && (
                <div className="flex justify-end">
                  <Button onClick={() => close({ success: true })}>OK</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      }
    }
  }

  return { modalHandler, modalElement, closeModal: close, resolveModalTarget };
}
