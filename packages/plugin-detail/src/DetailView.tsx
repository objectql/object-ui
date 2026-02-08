/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Skeleton } from '@object-ui/components';
import { ArrowLeft, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import { SchemaRenderer } from '@object-ui/react';
import type { DetailViewSchema, DataSource } from '@object-ui/types';

export interface DetailViewProps {
  schema: DetailViewSchema;
  dataSource?: DataSource;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  schema,
  dataSource,
  className,
  onEdit,
  onDelete,
  onBack,
}) => {
  const [data, setData] = React.useState<any>(schema.data);
  const [loading, setLoading] = React.useState(!schema.data && !!((schema.api && schema.resourceId) || (dataSource && schema.objectName && schema.resourceId)));

  // Fetch data if API or DataSource provided
  React.useEffect(() => {
    // If inline data provided, use it
     if (schema.data) {
        setData(schema.data);
        setLoading(false);
        return;
    }

    if (dataSource && schema.objectName && schema.resourceId) {
      setLoading(true);
      dataSource.findOne(schema.objectName, schema.resourceId).then((result) => {
         setData(result);
         setLoading(false);
      }).catch((err) => {
         console.error('Failed to fetch detail data:', err);
         setLoading(false);
      });
    } else if (schema.api && schema.resourceId) {
      setLoading(true);
      // TODO: Fetch from API
      // This would integrate with the data provider
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  }, [schema.api, schema.resourceId]);

  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack();
    } else if (schema.onNavigate) {
      // SPA-aware navigation
      const backUrl = schema.backUrl || (schema.objectName ? `/${schema.objectName}` : '/');
      schema.onNavigate(backUrl, { replace: true });
    } else if (schema.backUrl) {
      window.location.href = schema.backUrl;
    } else {
      window.history.back();
    }
  }, [onBack, schema]);

  const handleEdit = React.useCallback(() => {
    if (onEdit) {
      onEdit();
    } else if (schema.onNavigate && schema.editUrl) {
      // SPA-aware navigation
      schema.onNavigate(schema.editUrl);
    } else if (schema.onNavigate && schema.objectName && schema.resourceId) {
      // Build edit URL from object + resource
      schema.onNavigate(`/${schema.objectName}/${schema.resourceId}/edit`);
    } else if (schema.editUrl) {
      window.location.href = schema.editUrl;
    }
  }, [onEdit, schema]);

  const handleDelete = React.useCallback(() => {
    const confirmMessage = schema.deleteConfirmation || 'Are you sure you want to delete this record?';
    // Use window.confirm as fallback — the ActionProvider's onConfirm handler
    // will intercept this if wired up via the action system.
    if (window.confirm(confirmMessage)) {
      onDelete?.();
      // Navigate back after deletion if onNavigate available
      if (schema.onNavigate && schema.objectName) {
        schema.onNavigate(`/${schema.objectName}`, { replace: true });
      }
    }
  }, [onDelete, schema]);

  if (loading || schema.loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {(schema.showBack ?? true) && (
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{schema.title || 'Details'}</h1>
            {schema.objectName && (
              <p className="text-sm text-muted-foreground mt-1">
                {schema.objectName} #{schema.resourceId}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {schema.actions?.map((action, index) => (
            <SchemaRenderer key={index} schema={action} data={data} />
          ))}

          {schema.showEdit && (
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}

          {schema.showDelete && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}

          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Custom Header */}
      {schema.header && (
        <div>
          <SchemaRenderer schema={schema.header} data={data} />
        </div>
      )}

      {/* Sections */}
      {schema.sections && schema.sections.length > 0 && (
        <div className="space-y-4">
          {schema.sections.map((section, index) => (
            <DetailSection
              key={index}
              section={section}
              data={data}
            />
          ))}
        </div>
      )}

      {/* Direct Fields (if no sections) */}
      {schema.fields && schema.fields.length > 0 && !schema.sections?.length && (
        <DetailSection
          section={{
            fields: schema.fields,
            columns: schema.columns || 2,
          }}
          data={data}
        />
      )}

      {/* Tabs */}
      {schema.tabs && schema.tabs.length > 0 && (
        <DetailTabs tabs={schema.tabs} data={data} />
      )}

      {/* Related Lists */}
      {schema.related && schema.related.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Related</h2>
          {schema.related.map((related, index) => (
            <RelatedList
              key={index}
              title={related.title}
              type={related.type}
              api={related.api}
              data={related.data}
              columns={related.columns as any}
            />
          ))}
        </div>
      )}

      {/* Custom Footer */}
      {schema.footer && (
        <div>
          <SchemaRenderer schema={schema.footer} data={data} />
        </div>
      )}
    </div>
  );
};
