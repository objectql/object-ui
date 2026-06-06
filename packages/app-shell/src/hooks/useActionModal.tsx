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
 * modal action can open any page/form/list. Back-compat: a string target
 * (e.g. "create_opportunity") or `{ objectName, mode }` opens a <ModalForm>.
 *
 * Returns `{ modalHandler, modalElement }`: pass `modalHandler` as the
 * ActionProvider `onModal`, and render `modalElement` once in the subtree.
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
import { SchemaRenderer } from '@object-ui/react';
import { ModalForm } from '@object-ui/plugin-form';

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

/** Normalize the opaque `schema` arg the ActionRunner passes into a descriptor. */
export function normalizeModalSchema(schema: any): ModalDescriptor {
  if (typeof schema === 'string') {
    const m = schema.match(/^(create|new|add|edit|update)_(.+)$/);
    if (m) return { objectName: m[2], mode: m[1] === 'edit' || m[1] === 'update' ? 'edit' : 'create' };
    return { objectName: schema, mode: 'create' };
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

  const close = useCallback((r: ActionResult) => {
    setState((s) => {
      s?.resolve(r);
      return null;
    });
  }, []);

  const modalHandler = useCallback(
    (schema: any) =>
      new Promise<ActionResult>((resolve) => {
        setState({ d: normalizeModalSchema(schema), resolve });
      }),
    [],
  );

  let modalElement: React.ReactNode = null;
  if (state) {
    const d = state.d;
    const onOpenChange = (open: boolean) => {
      if (!open) close({ success: false });
    };

    if (d.objectName && !d.content) {
      modalElement = (
        <ModalForm
          schema={{
            type: 'object-form',
            formType: 'modal',
            objectName: d.objectName,
            mode: d.mode || 'create',
            recordId: d.recordId,
            title: d.title,
            description: d.description,
            fields: d.fields,
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

  return { modalHandler, modalElement, closeModal: close };
}
