/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectView Component
 * 
 * A complete object management interface that combines ObjectTable and ObjectForm.
 * Provides list view with integrated search, filters, and create/edit operations.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { ObjectViewSchema, ObjectTableSchema, ObjectFormSchema } from '@object-ui/types';
import type { ObjectQLDataSource } from '@object-ui/data-objectql';
import { ObjectTable } from './ObjectTable';
import { ObjectForm } from './ObjectForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  Button,
  Input,
} from '@object-ui/components';
import { Plus, Search, RefreshCw, Filter, X } from 'lucide-react';

export interface ObjectViewProps {
  /**
   * The schema configuration for the view
   */
  schema: ObjectViewSchema;
  
  /**
   * ObjectQL data source
   */
  dataSource: ObjectQLDataSource;
  
  /**
   * Additional CSS class
   */
  className?: string;
}

type FormMode = 'create' | 'edit' | 'view';

/**
 * ObjectView Component
 * 
 * Renders a complete object management interface with table and forms.
 * 
 * @example
 * ```tsx
 * <ObjectView
 *   schema={{
 *     type: 'object-view',
 *     objectName: 'users',
 *     layout: 'drawer',
 *     showSearch: true,
 *     showFilters: true
 *   }}
 *   dataSource={objectQLDataSource}
 * />
 * ```
 */
export const ObjectView: React.FC<ObjectViewProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const [objectSchema, setObjectSchema] = useState<Record<string, unknown> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch object schema from ObjectQL
  useEffect(() => {
    const fetchObjectSchema = async () => {
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };

    if (schema.objectName && dataSource) {
      fetchObjectSchema();
    }
  }, [schema.objectName, dataSource]);

  // Determine layout mode
  const layout = schema.layout || 'drawer';
  
  // Determine enabled operations
  const operations = schema.operations || schema.table?.operations || {
    create: true,
    read: true,
    update: true,
    delete: true,
  };

  // Handle create action
  const handleCreate = useCallback(() => {
    if (layout === 'page' && schema.onNavigate) {
      schema.onNavigate('new', 'edit');
    } else {
      setFormMode('create');
      setSelectedRecord(null);
      setIsFormOpen(true);
    }
  }, [layout, schema]);

  // Handle edit action
  const handleEdit = useCallback((record: Record<string, unknown>) => {
    if (layout === 'page' && schema.onNavigate) {
      const recordId = record._id || record.id;
      schema.onNavigate(recordId as string | number, 'edit');
    } else {
      setFormMode('edit');
      setSelectedRecord(record);
      setIsFormOpen(true);
    }
  }, [layout, schema]);

  // Handle view action
  const handleView = useCallback((record: Record<string, unknown>) => {
    if (layout === 'page' && schema.onNavigate) {
      const recordId = record._id || record.id;
      schema.onNavigate(recordId as string | number, 'view');
    } else {
      setFormMode('view');
      setSelectedRecord(record);
      setIsFormOpen(true);
    }
  }, [layout, schema]);

  // Handle row click
  const handleRowClick = useCallback((record: Record<string, unknown>) => {
    if (operations.read !== false) {
      handleView(record);
    }
  }, [operations.read, handleView]);

  // Handle delete action
  const handleDelete = useCallback((_record: Record<string, unknown>) => {
    // Trigger table refresh after delete
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle bulk delete action
  const handleBulkDelete = useCallback((_records: Record<string, unknown>[]) => {
    // Trigger table refresh after bulk delete
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle form submission
  const handleFormSuccess = useCallback(() => {
    // Close the form
    setIsFormOpen(false);
    setSelectedRecord(null);
    
    // Trigger table refresh
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle form cancellation
  const handleFormCancel = useCallback(() => {
    setIsFormOpen(false);
    setSelectedRecord(null);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Build table schema
  const tableSchema: ObjectTableSchema = {
    type: 'object-table',
    objectName: schema.objectName,
    title: schema.table?.title,
    description: schema.table?.description,
    fields: schema.table?.fields,
    columns: schema.table?.columns,
    operations: {
      ...operations,
      create: false, // Create is handled by the view's create button
    },
    defaultFilters: schema.table?.defaultFilters,
    defaultSort: schema.table?.defaultSort,
    pageSize: schema.table?.pageSize,
    selectable: schema.table?.selectable,
    className: schema.table?.className,
  };

  // Build form schema
  const buildFormSchema = (): ObjectFormSchema => {
    const recordId = selectedRecord ? (selectedRecord._id || selectedRecord.id) as string | number | undefined : undefined;
    
    return {
      type: 'object-form',
      objectName: schema.objectName,
      mode: formMode,
      recordId,
      title: schema.form?.title,
      description: schema.form?.description,
      fields: schema.form?.fields,
      customFields: schema.form?.customFields,
      groups: schema.form?.groups,
      layout: schema.form?.layout,
      columns: schema.form?.columns,
      showSubmit: schema.form?.showSubmit,
      submitText: schema.form?.submitText,
      showCancel: schema.form?.showCancel,
      cancelText: schema.form?.cancelText,
      showReset: schema.form?.showReset,
      initialValues: schema.form?.initialValues,
      readOnly: schema.form?.readOnly || formMode === 'view',
      className: schema.form?.className,
      onSuccess: handleFormSuccess,
      onCancel: handleFormCancel,
    };
  };

  // Get form title based on mode
  const getFormTitle = (): string => {
    if (schema.form?.title) return schema.form.title;
    
    const objectLabel = (objectSchema?.label as string) || schema.objectName;
    
    switch (formMode) {
      case 'create':
        return `Create ${objectLabel}`;
      case 'edit':
        return `Edit ${objectLabel}`;
      case 'view':
        return `View ${objectLabel}`;
      default:
        return objectLabel;
    }
  };

  // Render the form in a drawer
  const renderDrawerForm = () => (
    <Drawer open={isFormOpen} onOpenChange={setIsFormOpen} direction="right">
      <DrawerContent className="w-full sm:max-w-2xl">
        <DrawerHeader>
          <DrawerTitle>{getFormTitle()}</DrawerTitle>
          {schema.form?.description && (
            <DrawerDescription>{schema.form.description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ObjectForm
            schema={buildFormSchema()}
            dataSource={dataSource}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );

  // Render the form in a modal
  const renderModalForm = () => (
    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getFormTitle()}</DialogTitle>
          {schema.form?.description && (
            <DialogDescription>{schema.form.description}</DialogDescription>
          )}
        </DialogHeader>
        <ObjectForm
          schema={buildFormSchema()}
          dataSource={dataSource}
        />
      </DialogContent>
    </Dialog>
  );

  // Render toolbar
  const renderToolbar = () => {
    const showSearchBox = schema.showSearch !== false;
    const showFiltersButton = schema.showFilters !== false;
    const showCreateButton = schema.showCreate !== false && operations.create !== false;
    const showRefreshButton = schema.showRefresh !== false;
    
    // Don't render toolbar if no elements are shown
    if (!showSearchBox && !showFiltersButton && !showCreateButton && !showRefreshButton) {
      return null;
    }

    return (
      <div className="flex flex-col gap-4 mb-4">
        {/* Main toolbar row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Search */}
          <div className="flex-1 max-w-md">
            {showSearchBox && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search ${objectSchema?.label || schema.objectName}...`}
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </div>
          
          {/* Right side: Actions */}
          <div className="flex items-center gap-2">
            {showFiltersButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filters
                {showFilters && (
                  <X className="h-3 w-3 ml-1" />
                )}
              </Button>
            )}
            
            {showRefreshButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            
            {showCreateButton && (
              <Button
                size="sm"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                Create
              </Button>
            )}
          </div>
        </div>
        
        {/* Filter panel (shown when filters are active) */}
        {showFilters && (
          <div className="p-4 border rounded-md bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Filter functionality will be integrated with FilterBuilder component
            </p>
            {/* TODO: Integrate FilterBuilder component here */}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      {/* Title and description */}
      {(schema.title || schema.description) && (
        <div className="mb-6">
          {schema.title && (
            <h2 className="text-2xl font-bold tracking-tight">{schema.title}</h2>
          )}
          {schema.description && (
            <p className="text-muted-foreground mt-1">{schema.description}</p>
          )}
        </div>
      )}
      
      {/* Toolbar */}
      {renderToolbar()}
      
      {/* Table */}
      <ObjectTable
        key={refreshKey}
        schema={tableSchema}
        dataSource={dataSource}
        onRowClick={handleRowClick}
        onEdit={operations.update !== false ? handleEdit : undefined}
        onDelete={operations.delete !== false ? handleDelete : undefined}
        onBulkDelete={operations.delete !== false ? handleBulkDelete : undefined}
      />
      
      {/* Form (drawer or modal) */}
      {layout === 'drawer' && renderDrawerForm()}
      {layout === 'modal' && renderModalForm()}
    </div>
  );
};
