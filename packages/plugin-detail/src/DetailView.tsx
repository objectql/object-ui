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
  Badge,
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
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DetailSection } from './DetailSection';
import { DetailTabs } from './DetailTabs';
import { RelatedList } from './RelatedList';
import { RecordComments } from './RecordComments';
import { ActivityTimeline } from './ActivityTimeline';
import { SchemaRenderer } from '@object-ui/react';
import { buildExpandFields } from '@object-ui/core';
import type { DetailViewSchema, DataSource } from '@object-ui/types';

export interface DetailViewProps {
  schema: DetailViewSchema;
  dataSource?: DataSource;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  /** Enable inline editing toggle for detail fields */
  inlineEdit?: boolean;
  /** Callback when a field value is saved inline */
  onFieldSave?: (field: string, value: any, record: any) => void | Promise<void>;
}

export const DetailView: React.FC<DetailViewProps> = ({
  schema,
  dataSource,
  className,
  onEdit,
  onDelete,
  onBack,
  inlineEdit = false,
  onFieldSave,
}) => {
  const [data, setData] = React.useState<any>(schema.data);
  const [loading, setLoading] = React.useState(!schema.data && !!((schema.api && schema.resourceId) || (dataSource && schema.objectName && schema.resourceId)));
  const [isFavorite, setIsFavorite] = React.useState(false);
  const [isInlineEditing, setIsInlineEditing] = React.useState(false);
  const [editedValues, setEditedValues] = React.useState<Record<string, any>>({});
  const [objectSchema, setObjectSchema] = React.useState<any>(null);

  // Fetch objectSchema + data with $expand when DataSource is provided
  React.useEffect(() => {
    let isMounted = true;

    // If inline data provided, use it
     if (schema.data) {
        setData(schema.data);
        setLoading(false);
        return;
    }

    if (dataSource && schema.objectName && schema.resourceId) {
      setLoading(true);
      const objectName = schema.objectName;
      const resourceId = schema.resourceId;
      const prefix = `${objectName}-`;

      // Collect all visible fields from sections and top-level fields
      const allFields = [
        ...(schema.sections?.flatMap(s => s.fields) || []),
        ...(schema.fields || []),
      ];

      // Load objectSchema first, then fetch data with $expand
      const schemaPromise = dataSource.getObjectSchema
        ? dataSource.getObjectSchema(objectName).catch(() => null)
        : Promise.resolve(null);

      schemaPromise.then((resolvedSchema) => {
        if (!isMounted) return;
        if (resolvedSchema) {
          setObjectSchema(resolvedSchema);
        }

        // Compute $expand from objectSchema
        const expandFields = buildExpandFields(resolvedSchema?.fields, allFields);
        const params = expandFields.length > 0 ? { $expand: expandFields } : undefined;

        return dataSource.findOne(objectName, resourceId, params).then((result) => {
          if (!isMounted) return;
          if (result) {
            setData(result);
            setLoading(false);
            return;
          }
          // Fallback: try alternate ID format for backward compatibility
          const altId = resourceId.startsWith(prefix)
            ? resourceId.slice(prefix.length)   // strip prefix
            : `${prefix}${resourceId}`;          // prepend prefix
          return dataSource.findOne(objectName, altId, params).then((fallbackResult) => {
            if (isMounted) {
              setData(fallbackResult);
              setLoading(false);
            }
          }).catch(() => {
            if (isMounted) {
              setData(null);
              setLoading(false);
            }
          });
        });
      }).catch((err) => {
         if (isMounted) {
           console.error('Failed to fetch detail data:', err);
           setLoading(false);
         }
      });
    } else if (schema.api && schema.resourceId) {
      setLoading(true);
      fetch(`${schema.api}/${schema.resourceId}`)
        .then(res => res.json())
        .then(result => {
          if (isMounted) {
            setData(result?.data || result);
          }
        })
        .catch(err => {
          console.error('Failed to fetch detail data:', err);
        })
        .finally(() => { if (isMounted) setLoading(false); });
    }

    return () => { isMounted = false; };
  }, [schema.api, schema.resourceId, schema.objectName, dataSource, schema.sections, schema.fields]);

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

  const handleInlineEditToggle = React.useCallback(() => {
    if (isInlineEditing) {
      // Save changes
      const changes = Object.entries(editedValues);
      if (changes.length > 0) {
        const updatedData = { ...data, ...editedValues };
        setData(updatedData);
        changes.forEach(([field, value]) => {
          onFieldSave?.(field, value, updatedData);
        });
      }
      setEditedValues({});
    }
    setIsInlineEditing(!isInlineEditing);
  }, [isInlineEditing, editedValues, data, onFieldSave]);

  const handleInlineFieldChange = React.useCallback((field: string, value: any) => {
    setEditedValues(prev => ({ ...prev, [field]: value }));
  }, []);

  // Keyboard shortcuts for prev/next record navigation (← / →)
  React.useEffect(() => {
    if (!schema.recordNavigation) return;
    const nav = schema.recordNavigation;
    const handler = (e: KeyboardEvent) => {
      // Skip when focus is inside an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && nav.currentIndex > 0) {
        e.preventDefault();
        nav.onNavigate(nav.recordIds[nav.currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && nav.currentIndex < nav.recordIds.length - 1) {
        e.preventDefault();
        nav.onNavigate(nav.recordIds[nav.currentIndex + 1]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [schema.recordNavigation]);

  if (loading || schema.loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!data && !schema.data) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
        <p className="text-lg font-semibold">Record not found</p>
        <p className="text-sm text-muted-foreground mt-1">
          The record you are looking for does not exist or may have been deleted.
        </p>
        {(schema.showBack ?? true) && (
          <Button variant="outline" size="sm" onClick={handleBack} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
        {/* Header - Airtable-inspired layout */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4 pb-4 border-b">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
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
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold truncate">
                  {(schema.primaryField && data?.[schema.primaryField]) || schema.title || 'Details'}
                </h1>
                {schema.summaryFields?.map((fieldName) => {
                  const val = data?.[fieldName];
                  if (val === null || val === undefined || val === '') return null;
                  return (
                    <Badge key={fieldName} variant="secondary" className="text-xs" aria-label={`${fieldName}: ${val}`}>
                      {String(val)}
                    </Badge>
                  );
                })}
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

          <div className="flex flex-wrap items-center gap-1.5 shrink-0 w-full sm:w-auto">
            {/* Prev/Next Record Navigation */}
            {schema.recordNavigation && (
              <div className="flex items-center gap-1 mr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={schema.recordNavigation.currentIndex <= 0}
                      onClick={() => {
                        const nav = schema.recordNavigation!;
                        if (nav.currentIndex > 0) {
                          nav.onNavigate(nav.recordIds[nav.currentIndex - 1]);
                        }
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Previous record</TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
                  {schema.recordNavigation.currentIndex + 1} of {schema.recordNavigation.recordIds.length}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={schema.recordNavigation.currentIndex >= schema.recordNavigation.recordIds.length - 1}
                      onClick={() => {
                        const nav = schema.recordNavigation!;
                        if (nav.currentIndex < nav.recordIds.length - 1) {
                          nav.onNavigate(nav.recordIds[nav.currentIndex + 1]);
                        }
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Next record</TooltipContent>
                </Tooltip>
              </div>
            )}

            {schema.actions?.map((action, index) => (
              <SchemaRenderer key={index} schema={action} data={data} />
            ))}

            {/* Inline Edit Toggle */}
            {inlineEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={isInlineEditing ? 'default' : 'outline'} 
                    size="sm"
                    onClick={handleInlineEditToggle}
                    className="gap-2"
                  >
                    {isInlineEditing ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span className="hidden sm:inline">Save</span>
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Edit inline</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isInlineEditing ? 'Save changes' : 'Edit fields inline'}
                </TooltipContent>
              </Tooltip>
            )}

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
              <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-48 max-h-[60vh] overflow-y-auto">
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
        <div className="space-y-3 sm:space-y-4">
          {schema.sections.map((section, index) => (
            <DetailSection
              key={index}
              section={section}
              data={{ ...data, ...editedValues }}
              objectSchema={objectSchema}
              isEditing={isInlineEditing}
              onFieldChange={handleInlineFieldChange}
            />
          ))}
        </div>
      )}

      {/* Direct Fields (if no sections) */}
      {schema.fields && schema.fields.length > 0 && !schema.sections?.length && (
        <DetailSection
          section={{
            fields: schema.fields,
            columns: schema.columns,
          }}
          data={{ ...data, ...editedValues }}
          objectSchema={objectSchema}
          isEditing={isInlineEditing}
          onFieldChange={handleInlineFieldChange}
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

      {/* Comments */}
      {schema.comments && (
        <RecordComments
          comments={schema.comments}
          onAddComment={schema.onAddComment}
        />
      )}

      {/* Activity Timeline */}
      {schema.activities && schema.activities.length > 0 && (
        <ActivityTimeline activities={schema.activities} />
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
