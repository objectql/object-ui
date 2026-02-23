/**
 * App Management Page
 *
 * Lists all configured applications with search, enable/disable toggle,
 * delete, set-default, and navigation to create/edit pages.
 */

import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Input,
} from '@object-ui/components';
import {
  Plus,
  LayoutGrid,
  Trash2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Star,
  ExternalLink,
  Search,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';

export function AppManagementPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = `/apps/${appName}`;
  const { apps, refresh } = useMetadata();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Filter apps by search query
  const filteredApps = (apps || []).filter((app: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (app.name || '').toLowerCase().includes(q) ||
      (app.label || '').toLowerCase().includes(q) ||
      (app.description || '').toLowerCase().includes(q)
    );
  });

  const toggleSelect = useCallback((name: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredApps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApps.map((a: any) => a.name)));
    }
  }, [selectedIds.size, filteredApps]);

  const handleToggleActive = useCallback(async (app: any) => {
    setProcessing(true);
    try {
      const newActive = app.active === false;
      // TODO: Replace with real API call when backend supports app management
      toast.success(`${app.label || app.name} ${newActive ? 'enabled' : 'disabled'}`);
      await refresh();
    } catch {
      toast.error('Failed to toggle app status');
    } finally {
      setProcessing(false);
    }
  }, [refresh]);

  const handleSetDefault = useCallback(async (app: any) => {
    setProcessing(true);
    try {
      // TODO: Replace with real API call when backend supports app management
      toast.success(`${app.label || app.name} set as default`);
      await refresh();
    } catch {
      toast.error('Failed to set default app');
    } finally {
      setProcessing(false);
    }
  }, [refresh]);

  const handleDelete = useCallback(async (appToDelete: any) => {
    if (confirmDelete !== appToDelete.name) {
      setConfirmDelete(appToDelete.name);
      return;
    }
    setProcessing(true);
    try {
      // TODO: Replace with real API call when backend supports app management
      toast.success(`${appToDelete.label || appToDelete.name} deleted`);
      setConfirmDelete(null);
      await refresh();
    } catch {
      toast.error('Failed to delete app');
    } finally {
      setProcessing(false);
    }
  }, [confirmDelete, refresh]);

  const handleBulkToggle = useCallback(async (active: boolean) => {
    setProcessing(true);
    try {
      // TODO: Replace with real API call when backend supports app management
      toast.success(`${selectedIds.size} apps ${active ? 'enabled' : 'disabled'}`);
      setSelectedIds(new Set());
      await refresh();
    } catch {
      toast.error('Bulk operation failed');
    } finally {
      setProcessing(false);
    }
  }, [selectedIds, refresh]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all configured applications
          </p>
        </div>
        <Button onClick={() => navigate(`${basePath}/create-app`)} data-testid="create-app-btn">
          <Plus className="h-4 w-4 mr-2" />
          New App
        </Button>
      </div>

      {/* Search & Bulk Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="pl-8"
            data-testid="app-search-input"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)} disabled={processing}>
              Enable
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)} disabled={processing}>
              Disable
            </Button>
          </div>
        )}
      </div>

      {/* Select All */}
      {filteredApps.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={selectedIds.size === filteredApps.length && filteredApps.length > 0}
            onChange={toggleSelectAll}
            className="rounded border-input"
            aria-label="Select all apps"
          />
          <span>Select all ({filteredApps.length})</span>
        </div>
      )}

      {/* App List */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="no-apps-message">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No apps found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredApps.map((app: any) => {
            const isActive = app.active !== false;
            const isDefault = app.isDefault === true;
            const isDeleting = confirmDelete === app.name;

            return (
              <Card key={app.name} className={!isActive ? 'opacity-60' : ''} data-testid={`app-card-${app.name}`}>
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(app.name)}
                    onChange={() => toggleSelect(app.name)}
                    className="rounded border-input shrink-0"
                    aria-label={`Select ${app.label || app.name}`}
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{app.label || app.name}</span>
                      {isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                      <Badge variant={isActive ? 'secondary' : 'outline'} className="text-xs">
                        {isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {app.description && (
                      <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Open app"
                      onClick={() => navigate(`/apps/${app.name}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit app"
                      onClick={() => navigate(`${basePath}/edit-app/${app.name}`)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isActive ? 'Disable app' : 'Enable app'}
                      onClick={() => handleToggleActive(app)}
                      disabled={processing}
                    >
                      {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Set as default"
                      onClick={() => handleSetDefault(app)}
                      disabled={processing || isDefault}
                    >
                      <Star className={`h-4 w-4 ${isDefault ? 'fill-current text-yellow-500' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isDeleting ? 'Click again to confirm delete' : 'Delete app'}
                      onClick={() => handleDelete(app)}
                      disabled={processing}
                      className={isDeleting ? 'text-destructive' : ''}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
