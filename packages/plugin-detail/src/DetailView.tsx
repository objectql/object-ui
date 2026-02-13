/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { 
  cn, 
  Button, 
  Skeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@object-ui/components';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  MoreHorizontal, 
  Share2, 
  Copy, 
  Download, 
  History, 
  Star,
  StarOff,
} from 'lucide-react';
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
  const [isFavorite, setIsFavorite] = React.useState(false);

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
      fetch(`${schema.api}/${schema.resourceId}`)
        .then(res => res.json())
        .then(result => {
          setData(result?.data || result);
        })
        .catch(err => {
          console.error('Failed to fetch detail data:', err);
        })
        .finally(() => setLoading(false));
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

  const handleShare = React.useCallback(() => {
    // Share functionality - could trigger share dialog or copy link
    if (navigator.share && schema.objectName && schema.resourceId) {
      navigator.share({
        title: schema.title || 'Record Details',
        text: `${schema.objectName} #${schema.resourceId}`,
        url: window.location.href,
      }).catch((err) => console.log('Share failed:', err));
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href).then(() => {
        console.log('Link copied to clipboard');
      });
    }
  }, [schema]);

  const handleDuplicate = React.useCallback(() => {
    // Duplicate functionality - could navigate to create page with prefilled data
    console.log('Duplicate record:', data);
  }, [data]);

  const handleExport = React.useCallback(() => {
    // Export functionality - could download as JSON, PDF, etc.
    console.log('Export record:', data);
  }, [data]);

  const handleViewHistory = React.useCallback(() => {
    // View history functionality
    console.log('View history for record:', schema.resourceId);
  }, [schema]);

  const handleToggleFavorite = React.useCallback(() => {
    setIsFavorite(!isFavorite);
  }, [isFavorite]);

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
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
        {/* Header - Airtable-inspired layout */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {(schema.showBack ?? true) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 mt-1">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Back</TooltipContent>
              </Tooltip>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{schema.title || 'Details'}</h1>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={handleToggleFavorite}
                    >
                      {isFavorite ? (
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ) : (
                        <StarOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  </TooltipContent>
                </Tooltip>
              </div>
              {schema.objectName && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <span className="font-medium">{schema.objectName}</span>
                  <span className="text-muted-foreground/60">•</span>
                  <span>#{schema.resourceId}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {schema.actions?.map((action, index) => (
              <SchemaRenderer key={index} schema={action} data={data} />
            ))}

            {/* Share Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>

            {/* Edit Button */}
            {schema.showEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="default" onClick={handleEdit} className="gap-2">
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit record</TooltipContent>
              </Tooltip>
            )}

            {/* More Actions Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewHistory}>
                  <History className="h-4 w-4 mr-2" />
                  View history
                </DropdownMenuItem>
                {schema.showDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
              dataSource={dataSource}
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
    </TooltipProvider>
  );
};
