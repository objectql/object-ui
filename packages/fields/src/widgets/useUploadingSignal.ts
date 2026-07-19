import { useEffect, useRef } from 'react';

/**
 * Notify a parent whenever an upload widget's in-progress state flips. Used by
 * hosts that must block a submit until the presigned upload resolves — e.g.
 * `ActionParamDialog` disables Confirm so a `file`/`image` param can't be
 * submitted mid-upload (the value only becomes the fileId once the upload
 * settles). Fires with the latest callback and only when `uploading` actually
 * changes, so an inline arrow prop doesn't thrash the parent every render.
 */
export function useUploadingSignal(
  uploading: boolean,
  onUploadingChange?: (uploading: boolean) => void,
): void {
  const ref = useRef(onUploadingChange);
  ref.current = onUploadingChange;
  useEffect(() => {
    ref.current?.(uploading);
  }, [uploading]);
}
