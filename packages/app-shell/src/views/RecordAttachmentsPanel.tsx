/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { Paperclip, Upload, Trash2, Download, Loader2, Lock } from 'lucide-react';
import { createObjectStackUploadAdapter } from '@object-ui/providers';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { useObjectTranslation, isPermissionError } from '@object-ui/react';

/**
 * RecordAttachmentsPanel — generic record Attachments surface (#2727,
 * Salesforce "Notes & Attachments" parity).
 *
 * Rendered by RecordDetailView ONLY when the object declares
 * `enable: { files: true }` (opt-in; the server rejects sys_attachment
 * rows targeting any other object with 403 FILES_DISABLED, so this panel
 * and the enforcement seam always agree).
 *
 * Storage model: one `sys_file` row per uploaded blob (three-step
 * presigned upload via @object-ui/providers' ObjectStack adapter), one
 * `sys_attachment` join row linking it to `(parent_object, parent_id)`.
 * Downloads fetch a short-lived signed URL from `/storage/files/:fileId/url`
 * with the console's Bearer token (the endpoint requires an authenticated
 * session for attachments-scope files, #2970), then open it.
 */

interface AttachmentRow {
  id: string;
  file_id: string;
  file_name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  created_at?: string | null;
  uploaded_by?: string | null;
}

export interface RecordAttachmentsPanelProps {
  objectName: string;
  recordId: string;
  /** ObjectUI DataSource (sys_attachment CRUD goes through the generic data path). */
  dataSource: any;
  /** Current user id, stamped on `uploaded_by`. */
  currentUserId?: string | null;
  className?: string;
}

function formatSize(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RecordAttachmentsPanel: React.FC<RecordAttachmentsPanelProps> = ({
  objectName,
  recordId,
  dataSource,
  currentUserId,
  className,
}) => {
  const { t } = useObjectTranslation();
  const [rows, setRows] = React.useState<AttachmentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /**
   * The list read was refused for AUTHORIZATION reasons (#4269).
   *
   * Kept separate from `rows.length === 0` because the two say opposite
   * things and only one of them is an assertion the panel is entitled to
   * make. "No attachments yet" claims the record HOLDS nothing; a 403 says
   * only that this caller may not look. Folding the second into the first
   * told a denied member that a record with 2095+ attachments was empty —
   * and offered an Upload the server would refuse.
   */
  const [listDenied, setListDenied] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Same base-URL convention as RecordDetailView's raw API fetches: the
  // Vite dev console proxies same-origin `/api` unless VITE_SERVER_URL
  // points elsewhere.
  const baseUrl = (import.meta as any).env?.VITE_SERVER_URL || '';
  // One authenticated fetch (Bearer token from localStorage) reused for the
  // upload adapter and the download-URL fetch — the storage routes require a
  // session and there is no cookie for `credentials: 'include'` to carry.
  const authFetch = React.useMemo(() => createAuthenticatedFetch(), []);
  const adapter = React.useMemo(
    () => createObjectStackUploadAdapter({ baseUrl, scope: 'attachments', fetchImpl: authFetch }),
    [baseUrl, authFetch],
  );

  /** Map the server's fail-closed 40x codes (#2755, #2970) to friendly copy. */
  const friendlyError = React.useCallback(
    (err: unknown): string => {
      const anyErr = err as { code?: string; message?: unknown } | null;
      const raw = String(anyErr?.message ?? err ?? '');
      const has = (code: string) => anyErr?.code === code || raw.includes(code);
      if (has('ATTACHMENT_DELETE_DENIED')) {
        return t('detail.attachmentDeleteDenied', {
          defaultValue: 'Only the uploader or someone who can edit this record may delete this attachment.',
        });
      }
      if (has('ATTACHMENT_PARENT_ACCESS')) {
        return t('detail.attachmentParentAccessDenied', {
          defaultValue: "You don't have access to attach files to this record.",
        });
      }
      if (has('ATTACHMENT_DOWNLOAD_DENIED')) {
        return t('detail.attachmentDownloadDenied', {
          defaultValue: "You don't have access to download this attachment.",
        });
      }
      if (has('AUTH_REQUIRED')) {
        return t('detail.attachmentAuthRequired', {
          defaultValue: 'Please sign in to download this attachment.',
        });
      }
      if (has('PERMISSION_DENIED')) {
        return t('detail.attachmentPermissionDenied', {
          defaultValue: "You don't have permission to do that.",
        });
      }
      return raw;
    },
    [t],
  );

  const refresh = React.useCallback(async () => {
    if (!dataSource || !objectName || !recordId) return;
    setLoading(true);
    try {
      const res: any = await dataSource.find('sys_attachment', {
        $filter: { parent_object: objectName, parent_id: recordId },
        $orderby: { created_at: 'desc' },
        $top: 100,
      });
      const items: AttachmentRow[] = Array.isArray(res) ? res : res?.data ?? [];
      setRows(items);
      setListDenied(false);
    } catch (err) {
      setRows([]);
      // An authorization refusal is NOT an empty record (#4269). The house
      // predicate is the same one the kanban/calendar/form surfaces branch
      // on — HTTP 403, `PERMISSION_DENIED`/`FORBIDDEN`, or an RLS denial.
      // The adapter throws it: `find()` degrades only a non-authz 404 to
      // `{ data: [], total: 0 }` (data-objectstack, objectui#4408), so a 403
      // reaches this catch as a decorated throw.
      //
      // Nothing from the error is rendered — the denied state below shows the
      // i18n sentence and nothing else. objectui#2532's failure mode (raw
      // dump / status code / leaked row) must stay absent, and `setError` is
      // deliberately NOT called here.
      setListDenied(isPermissionError(err));
      // Everything else keeps the pre-existing behaviour: a 404 (table not
      // provisioned on older stacks) and any network/5xx failure are tolerated
      // silently and the panel stays empty. That swallow is the SAME defect
      // class one status over — an unreachable server also renders "No
      // attachments yet" — but the honest unknown-vs-empty split is a separate
      // change (filed, not fixed here) and this line pins today's behaviour
      // rather than quietly widening the fix.
    } finally {
      setLoading(false);
    }
  }, [dataSource, objectName, recordId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleFiles = React.useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !dataSource) return;
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          // 1) blob → sys_file via the canonical presigned three-step flow
          const uploaded = await adapter.upload(file);
          const fileId = (uploaded.meta as any)?.fileId as string | undefined;
          if (!fileId) throw new Error('Upload did not return a fileId');
          // 2) join row → sys_attachment (server enforces enable.files)
          await dataSource.create('sys_attachment', {
            parent_object: objectName,
            parent_id: recordId,
            file_id: fileId,
            file_name: uploaded.name ?? file.name,
            mime_type: uploaded.mimeType ?? file.type,
            size: uploaded.size ?? file.size,
            // Back-compat with pre-#2755 servers; a current server stamps
            // `uploaded_by` from the session and ignores this value.
            ...(currentUserId ? { uploaded_by: currentUserId } : {}),
          });
        }
        await refresh();
      } catch (err: any) {
        setError(friendlyError(err));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [adapter, dataSource, objectName, recordId, currentUserId, refresh],
  );

  const handleDelete = React.useCallback(
    async (row: AttachmentRow) => {
      if (!dataSource) return;
      setError(null);
      try {
        await dataSource.delete('sys_attachment', row.id);
        setRows((prev) => prev.filter((r) => r.id !== row.id));
      } catch (err: any) {
        // The delete button deliberately renders for every row: the server
        // is the gate (uploader-or-parent-editor, #2755) and the client
        // lacks the parent-edit data to pre-compute it — a denial surfaces
        // here as friendly copy instead.
        setError(friendlyError(err));
      }
    },
    [dataSource, friendlyError],
  );

  const handleDownload = React.useCallback(
    async (row: AttachmentRow) => {
      setError(null);
      try {
        // The stable `/files/:fileId` endpoint now requires an authenticated
        // session for attachments-scope files (#2970) — an <a href> can't
        // carry the Bearer token. Fetch a short-lived signed URL with auth,
        // then open it (the signed URL itself needs no credentials).
        const res = await authFetch(
          `${baseUrl}/api/v1/storage/files/${encodeURIComponent(row.file_id)}/url`,
        );
        if (!res.ok) {
          let code: string | undefined;
          try {
            // Read BOTH error dialects, the same way the success branch below
            // reads both `url` shapes. The storage service moved its error
            // code from a sibling of `error` into the declared
            // `{ success: false, error: { code, message } }` envelope
            // (objectstack#3675); a console build is deployed independently of
            // the server it talks to, so it has to keep understanding the
            // older top-level `code` too. Without the nested branch the 401/403
            // downgrade silently to "Download failed (403)" and the friendly
            // copy below never fires.
            const body = (await res.json()) as { code?: string; error?: { code?: string } } | null;
            code = body?.error?.code ?? body?.code;
          } catch {
            /* non-JSON body */
          }
          throw Object.assign(new Error(code ?? `Download failed (${res.status})`), { code });
        }
        const body = await res.json();
        // Both URL dialects, for the same independent-deploy reason as the
        // error branch above: the route answered a bare `{ url }` until
        // objectstack#3689 moved it into the declared
        // `{ success: true, data: { url } }` envelope.
        const url: string | undefined = body?.url ?? body?.data?.url;
        if (!url) throw new Error('Download URL missing from response');
        const target = /^https?:/i.test(url) ? url : `${baseUrl}${url}`;
        window.open(target, '_blank', 'noopener,noreferrer');
      } catch (err: any) {
        setError(friendlyError(err));
      }
    },
    [authFetch, baseUrl, friendlyError],
  );

  return (
    <div className={cn('rounded-lg border bg-card', className)} data-testid="record-attachments-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <span>{t('detail.attachments', { defaultValue: 'Attachments' })}</span>
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">({rows.length})</span>
          )}
        </div>
        {/*
          No Upload affordance under a denied list (#4269). The button was
          previously unconditional — its only gate was `uploading` — so a
          member the server had just refused was still invited to upload into
          a record whose parent it cannot read, a click the `beforeInsert`
          gate answers with 403 ATTACHMENT_PARENT_ACCESS. Hiding it here
          changes nothing for every other caller: this is the sole condition
          added to a control that had none.
        */}
        {!listDenied && (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {t('detail.uploadAttachment', { defaultValue: 'Upload' })}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive border-b" role="alert">
          {error}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('detail.loadingAttachments', { defaultValue: 'Loading attachments…' })}
        </div>
      ) : listDenied ? (
        // Checked BEFORE the empty state, and rendering only the i18n
        // sentence: no status code, no server message, no row (#2532).
        <div
          className="px-4 py-6 text-sm text-muted-foreground flex items-center gap-2"
          data-testid="record-attachments-denied"
        >
          <Lock className="h-4 w-4 shrink-0" />
          {t('detail.attachmentsAccessDenied', {
            defaultValue: "You don't have access to these attachments.",
          })}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          {t('detail.noAttachments', { defaultValue: 'No attachments yet. Upload a file to get started.' })}
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
              <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{row.file_name || row.file_id}</div>
                <div className="text-xs text-muted-foreground">
                  {[formatSize(row.size), row.mime_type || undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('detail.downloadAttachment', { defaultValue: 'Download' })}
                onClick={() => void handleDownload(row)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={t('detail.deleteAttachment', { defaultValue: 'Delete attachment' })}
                onClick={() => void handleDelete(row)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecordAttachmentsPanel;
