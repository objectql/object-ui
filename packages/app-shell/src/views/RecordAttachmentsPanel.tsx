/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { Paperclip, Upload, Trash2, Download, Loader2 } from 'lucide-react';
import { createObjectStackUploadAdapter } from '@object-ui/providers';
import { useObjectTranslation } from '@object-ui/react';

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
 * Downloads go through the stable `/storage/files/:fileId` endpoint,
 * which 302-redirects to a freshly signed URL on every request.
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
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Same base-URL convention as RecordDetailView's raw API fetches: the
  // Vite dev console proxies same-origin `/api` unless VITE_SERVER_URL
  // points elsewhere.
  const baseUrl = (import.meta as any).env?.VITE_SERVER_URL || '';
  const adapter = React.useMemo(
    () => createObjectStackUploadAdapter({ baseUrl, scope: 'attachments' }),
    [baseUrl],
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
    } catch {
      // A 404 (table not provisioned on older stacks) is tolerated silently;
      // the panel just stays empty.
      setRows([]);
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
            ...(currentUserId ? { uploaded_by: currentUserId } : {}),
          });
        }
        await refresh();
      } catch (err: any) {
        setError(String(err?.message ?? err));
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
        setError(String(err?.message ?? err));
      }
    },
    [dataSource],
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
              <a
                href={`${baseUrl}/api/v1/storage/files/${encodeURIComponent(row.file_id)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
                aria-label={t('detail.downloadAttachment', { defaultValue: 'Download' })}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
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
