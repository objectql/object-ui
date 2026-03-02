/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { Plus, ExternalLink } from 'lucide-react';
import type { DataSource } from '@object-ui/types';
import { useDetailTranslation } from './useDetailTranslation';

export interface RelatedListProps {
  title: string;
  type: 'list' | 'grid' | 'table';
  api?: string;
  data?: any[];
  schema?: any;
  columns?: any[];
  className?: string;
  dataSource?: DataSource;
  /** Callback when "New" button is clicked */
  onNew?: () => void;
  /** Callback when "View All" button is clicked */
  onViewAll?: () => void;
}

export const RelatedList: React.FC<RelatedListProps> = ({
  title,
  type,
  api,
  data = [],
  schema,
  columns,
  className,
  dataSource,
  onNew,
  onViewAll,
}) => {
  const [relatedData, setRelatedData] = React.useState(data);
  const [loading, setLoading] = React.useState(false);
  const { t } = useDetailTranslation();

  React.useEffect(() => {
    if (api && !data.length) {
      setLoading(true);
      if (dataSource && typeof dataSource.find === 'function') {
        dataSource.find(api).then((result) => {
          const items = Array.isArray(result)
            ? result
            : Array.isArray((result as any)?.data)
              ? (result as any).data
              : [];
          setRelatedData(items);
          setLoading(false);
        }).catch((err) => {
          console.error('Failed to fetch related data:', err);
          setLoading(false);
        });
      } else {
        fetch(api)
          .then(res => res.json())
          .then(result => {
            const items = Array.isArray(result) ? result : (result?.data || []);
            setRelatedData(items);
          })
          .catch(err => {
            console.error('Failed to fetch related data:', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [api, data, dataSource]);

  const viewSchema = React.useMemo(() => {
    if (schema) return schema;

    // Auto-generate schema based on type
    switch (type) {
      case 'grid':
      case 'table':
        return {
          type: 'data-table',
          data: relatedData,
          columns: columns || [],
          pagination: relatedData.length > 10,
          pageSize: 10,
        };
      case 'list':
        return {
          type: 'data-list',
          data: relatedData,
        };
      default:
        return { type: 'div', children: 'No view configured' };
    }
  }, [type, relatedData, columns, schema]);

  const recordCountText = relatedData.length === 1
    ? t('detail.relatedRecordOne', { count: relatedData.length })
    : t('detail.relatedRecords', { count: relatedData.length });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{title}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {recordCountText}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onNew && (
              <Button variant="ghost" size="sm" onClick={onNew} className="gap-1 h-7 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {t('detail.new')}
              </Button>
            )}
            {onViewAll && (
              <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 h-7 text-xs">
                {t('detail.viewAll')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            {t('detail.loading')}
          </div>
        ) : relatedData.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            {t('detail.noRelatedRecords')}
          </div>
        ) : (
          <SchemaRenderer schema={viewSchema} />
        )}
      </CardContent>
    </Card>
  );
};
