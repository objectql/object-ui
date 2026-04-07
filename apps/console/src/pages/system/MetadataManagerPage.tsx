/**
 * MetadataManagerPage
 *
 * Generic, registry-driven page for listing and managing metadata items of
 * any type (dashboard, page, report, etc.). The type is determined by the
 * `:metadataType` URL parameter and looked up in the metadata type registry.
 *
 * Features:
 * - Data fetched via `MetadataService.getItems(type)`
 * - Create / Edit / Delete with optimistic UI + toast feedback
 * - Search filtering by name / label
 * - Back-to-hub navigation
 * - Click item name to navigate to detail page
 *
 * @module pages/system/MetadataManagerPage
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Input,
} from '@object-ui/components';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@object-ui/auth';
import { useMetadataService } from '../../hooks/useMetadataService';
import { useMetadata } from '../../context/MetadataProvider';
import { getMetadataTypeConfig, type MetadataTypeConfig } from '../../config/metadataTypeRegistry';
import { MetadataFormDialog } from '../../components/MetadataFormDialog';
import { MetadataGrid } from '../../components/MetadataGrid';
import { getIcon } from '../../utils/getIcon';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataManagerPage() {
  const navigate = useNavigate();
  const { appName, metadataType } = useParams<{ appName?: string; metadataType: string }>();
  const basePath = appName ? `/apps/${appName}` : '';
  const metadataService = useMetadataService();
  const { refresh } = useMetadata();
  const { user } = useAuth();

  // Permission: only admin users can mutate metadata
  const isAdmin = user?.role === 'admin';

  // Resolve registry config
  const config: MetadataTypeConfig | undefined = metadataType
    ? getMetadataTypeConfig(metadataType)
    : undefined;

  // State
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);

  // Fetch items
  const fetchItems = useCallback(async () => {
    if (!metadataService || !metadataType) return;
    setLoading(true);
    try {
      const result = await metadataService.getItems(metadataType);
      // Filter out soft-deleted items
      setItems(result.filter((item) => !item._deleted));
    } catch {
      toast.error(`Failed to load ${config?.pluralLabel ?? metadataType}`);
    } finally {
      setLoading(false);
    }
  }, [metadataService, metadataType, config?.pluralLabel]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => {
      const name = String(item.name ?? '').toLowerCase();
      const label = String(item.label ?? '').toLowerCase();
      return name.includes(q) || label.includes(q);
    });
  }, [items, searchQuery]);

  // Handlers
  const handleDelete = useCallback(async (name: string) => {
    if (!metadataService || !metadataType) return;
    if (deletingName === name) {
      // Confirmed delete
      setSaving(true);
      try {
        await metadataService.deleteMetadataItem(metadataType, name);
        setItems((prev) => prev.filter((item) => item.name !== name));
        await refresh();
        toast.success(`${config?.label ?? 'Item'} "${name}" deleted`);
      } catch {
        toast.error(`Failed to delete "${name}"`);
      } finally {
        setSaving(false);
        setDeletingName(null);
      }
    } else {
      setDeletingName(name);
    }
  }, [metadataService, metadataType, deletingName, config?.label, refresh]);

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    setFormMode('create');
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((item: Record<string, unknown>) => {
    setEditingItem(item);
    setFormMode('edit');
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async (values: Record<string, string>) => {
    if (!metadataService || !metadataType) return;
    const name = values.name ?? String(editingItem?.name ?? '');
    if (!name) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = formMode === 'edit'
        ? { ...editingItem, ...values }
        : { ...values };
      await metadataService.saveMetadataItem(metadataType, name, data);
      await refresh();
      await fetchItems();
      toast.success(
        formMode === 'edit'
          ? `${config?.label ?? 'Item'} "${name}" updated`
          : `${config?.label ?? 'Item'} "${name}" created`,
      );
    } catch {
      toast.error(
        formMode === 'edit'
          ? `Failed to update "${name}"`
          : `Failed to create "${name}"`,
      );
      throw new Error(`Failed to save ${config?.label ?? 'item'} "${name}"`);
    } finally {
      setSaving(false);
    }
  }, [metadataService, metadataType, editingItem, formMode, config?.label, refresh, fetchItems]);

  // Unknown type guard
  if (!config) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="metadata-manager-page">
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg font-medium">Unknown metadata type: {metadataType}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate(`${basePath}/system`)}
          >
            Back to System Settings
          </Button>
        </div>
      </div>
    );
  }

  const Icon = getIcon(config.icon);
  const isEditable = config.editable !== false && isAdmin;

  // -------------------------------------------------------------------------
  // Custom list component rendering
  // -------------------------------------------------------------------------
  const ListComponent = config.listComponent;
  if (ListComponent) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="metadata-manager-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`${basePath}/system`)}
              data-testid="back-to-hub-btn"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="bg-primary/10 p-2 rounded-md shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {config.pluralLabel}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Custom list component */}
        <ListComponent
          config={config}
          basePath={basePath}
          metadataType={metadataType!}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Default list rendering (cards / grid)
  // -------------------------------------------------------------------------
  const pageActions = (config.actions ?? []).filter((a) => a.scope === 'page');
  const rowActions = (config.actions ?? []).filter((a) => a.scope === 'row');
  const listMode = config.listMode ?? 'card';
  const isGridMode = listMode === 'grid' || listMode === 'table';
  const columns = config.columns ?? [
    { key: 'name', label: 'Name' },
    { key: 'label', label: 'Label' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="metadata-manager-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`${basePath}/system`)}
            data-testid="back-to-hub-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="bg-primary/10 p-2 rounded-md shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {config.pluralLabel}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>

        {isEditable && (
          <Button onClick={handleCreate} data-testid="create-metadata-btn">
            <Plus className="mr-2 h-4 w-4" />
            New {config.label}
          </Button>
        )}
        {pageActions.length > 0 && (
          <div className="flex items-center gap-2">
            {pageActions.map((action) => (
              <Button
                key={action.key}
                variant={action.variant ?? 'outline'}
                onClick={() => action.handler?.()}
                data-testid={`page-action-${action.key}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${config.pluralLabel.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="metadata-search-input"
          />
        </div>
        <Badge variant="secondary" data-testid="metadata-count-badge">
          {filteredItems.length} {config.pluralLabel.toLowerCase()}
        </Badge>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="metadata-loading">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {config.pluralLabel.toLowerCase()}...
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="metadata-saving">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving...
        </div>
      )}

      {/* Items list */}
      {!loading && filteredItems.length === 0 && (
        <div className="text-center text-muted-foreground py-12" data-testid="metadata-empty">
          <p>No {config.pluralLabel.toLowerCase()} found.</p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && !isGridMode && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const name = String(item.name ?? '');
            const label = String(item.label ?? item.name ?? '');
            const description = String(item.description ?? '');
            return (
              <Card
                key={name}
                className="transition-colors hover:bg-accent/50 cursor-pointer"
                data-testid={`metadata-item-${name}`}
                onClick={() =>
                  navigate(`${basePath}/system/metadata/${metadataType}/${name}`)
                }
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{name}</p>
                    {description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
                    )}
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {rowActions.map((action) => (
                        <Button
                          key={action.key}
                          variant={action.variant ?? 'ghost'}
                          size="icon"
                          title={action.label}
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            action.handler?.(item);
                          }}
                          data-testid={`row-action-${action.key}-${name}`}
                        >
                          <span className="text-xs">{action.label.charAt(0)}</span>
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={`Edit ${config.label.toLowerCase()}`}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleEdit(item);
                        }}
                        disabled={saving}
                        data-testid={`edit-${name}-btn`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={deletingName === name ? 'Click again to confirm' : `Delete ${config.label.toLowerCase()}`}
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleDelete(name);
                        }}
                        disabled={saving}
                        data-testid={`delete-${name}-btn`}
                      >
                        <Trash2 className={`h-4 w-4 ${deletingName === name ? 'text-destructive' : ''}`} />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Grid / Table mode */}
      {!loading && filteredItems.length > 0 && isGridMode && (
        <MetadataGrid
          items={filteredItems}
          columns={columns}
          editable={isEditable}
          saving={saving}
          deletingName={deletingName}
          typeLabel={config.label.toLowerCase()}
          rowActions={rowActions}
          onItemClick={(name) =>
            navigate(`${basePath}/system/metadata/${metadataType}/${name}`)
          }
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Create/Edit dialog */}
      {isEditable && (
        <MetadataFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={formMode}
          typeLabel={config.label}
          formFields={config.formFields}
          initialValues={editingItem ?? undefined}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}
