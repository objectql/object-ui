/**
 * ActionConfirmDialog — Promise-based confirmation dialog for action execution.
 *
 * Uses Shadcn AlertDialog to replace window.confirm with a styled, accessible
 * confirmation dialog. Renders only when state.open is true.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';

export interface ConfirmDialogState {
  open: boolean;
  message: string;
  options?: { title?: string; confirmText?: string; cancelText?: string };
  resolve?: (value: boolean) => void;
}

interface ActionConfirmDialogProps {
  state: ConfirmDialogState;
  onOpenChange: (open: boolean) => void;
}

export function ActionConfirmDialog({ state, onOpenChange }: ActionConfirmDialogProps) {
  const { t } = useObjectTranslation();
  const handleConfirm = () => {
    state.resolve?.(true);
    onOpenChange(false);
  };

  const handleCancel = () => {
    state.resolve?.(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={state.open} onOpenChange={(open) => {
      if (!open) handleCancel();
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.options?.title || t('actionConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>{state.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {state.options?.cancelText || t('actionConfirm.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {state.options?.confirmText || t('actionConfirm.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
