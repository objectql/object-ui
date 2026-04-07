/**
 * MetadataDetailPage
 *
 * Generic, registry-driven detail page for viewing a single metadata item.
 * Supports editing via the MetadataFormDialog and custom detail renderers
 * via the registry's `detailComponent` configuration.
 *
 * Route: `/system/metadata/:metadataType/:itemName`
 *
 * @module pages/system/MetadataDetailPage
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@object-ui/components';
import {
  ArrowLeft,
  Pencil,
  Loader2,
  LayoutDashboard,
  FileText,
  BarChart3,
  Database,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@object-ui/auth';
import { useMetadataService } from '../../hooks/useMetadataService';
import { useMetadata } from '../../context/MetadataProvider';
import { getMetadataTypeConfig, DEFAULT_FORM_FIELDS, type MetadataTypeConfig } from '../../config/metadataTypeRegistry';
import { MetadataFormDialog } from '../../components/MetadataFormDialog';

// ---------------------------------------------------------------------------
// Icon resolver (same as MetadataManagerPage)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'layout-dashboard': LayoutDashboard,
  'file-text': FileText,
  'bar-chart-3': BarChart3,
  'database': Database,
  'layout-grid': LayoutGrid,
};

function resolveIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? Database;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataDetailPage() {
  const navigate = useNavigate();
  const { appName, metadataType, itemName } = useParams<{
    appName?: string;
    metadataType: string;
    itemName: string;
  }>();
  const basePath = appName ? `/apps/${appName}` : '';
  const metadataService = useMetadataService();
  const { refresh } = useMetadata();
  const { user } = useAuth();

  // Permission: only admin users can mutate metadata
  const isAdmin = user?.role === 'admin';

  const config: MetadataTypeConfig | undefined = metadataType
    ? getMetadataTypeConfig(metadataType)
    : undefined;

  const [item, setItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch the single item by finding it in the list
  const fetchItem = useCallback(async () => {
    if (!metadataService || !metadataType || !itemName) return;
    setLoading(true);
    try {
      const items = await metadataService.getItems(metadataType);
      const found = items.find(
        (i) => String(i.name) === itemName && !i._deleted,
      );
      setItem(found ?? null);
    } catch {
      toast.error(`Failed to load ${config?.label ?? metadataType}`);
    } finally {
      setLoading(false);
    }
  }, [metadataService, metadataType, itemName, config?.label]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  // Save handler for the edit dialog
  const handleSave = useCallback(
    async (values: Record<string, string>) => {
      if (!metadataService || !metadataType || !itemName) return;
      setSaving(true);
      try {
        const data: Record<string, unknown> = { ...item, ...values };
        await metadataService.saveMetadataItem(metadataType, itemName, data);
        await refresh();
        await fetchItem();
        toast.success(`${config?.label ?? 'Item'} "${itemName}" updated`);
      } catch {
        toast.error(`Failed to update "${itemName}"`);
        throw new Error(`Failed to save ${config?.label ?? 'item'} "${itemName}"`);
      } finally {
        setSaving(false);
      }
    },
    [metadataService, metadataType, itemName, item, config?.label, refresh, fetchItem],
  );

  const listPath = `${basePath}/system/metadata/${metadataType ?? ''}`;

  // Unknown type guard
  if (!config) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="metadata-detail-page">
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg font-medium">Unknown metadata type: {metadataType}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`${basePath}/system`)}>
            Back to System Settings
          </Button>
        </div>
      </div>
    );
  }

  const Icon = resolveIcon(config.icon);
  const isEditable = config.editable !== false && isAdmin;
  const fields = config.formFields ?? DEFAULT_FORM_FIELDS;
  const CustomDetail = config.detailComponent;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="metadata-detail-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(listPath)}
            data-testid="back-to-list-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="bg-primary/10 p-2 rounded-md shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {loading ? 'Loading...' : String(item?.label ?? item?.name ?? itemName)}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{config.label} Details</p>
          </div>
        </div>

        {isEditable && !loading && item && (
          <Button
            variant="outline"
            onClick={() => setEditOpen(true)}
            disabled={saving}
            data-testid="detail-edit-btn"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="detail-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      )}

      {/* Not found */}
      {!loading && !item && (
        <div className="text-center text-muted-foreground py-12" data-testid="detail-not-found">
          <p className="text-lg font-medium">
            {config.label} &quot;{itemName}&quot; not found.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(listPath)}>
            Back to {config.pluralLabel}
          </Button>
        </div>
      )}

      {/* Detail content */}
      {!loading && item && (
        <>
          {CustomDetail ? (
            <CustomDetail item={item} />
          ) : (
            <Card data-testid="detail-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary">{config.label}</Badge>
                  {String(item.name ?? '')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-sm font-medium text-muted-foreground">{field.label}</dt>
                      <dd className="mt-1 text-sm">{String(item[field.key] ?? '—')}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Edit dialog */}
      {isEditable && item && (
        <MetadataFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          typeLabel={config.label}
          formFields={config.formFields}
          initialValues={item}
          onSubmit={handleSave}
        />
      )}
    </div>
  );
}
