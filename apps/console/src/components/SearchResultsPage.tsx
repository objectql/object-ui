/**
 * SearchResultsPage
 *
 * A dedicated search results page accessible via /apps/:appName/search?q=...
 * Extends the command palette with a full-page search experience, showing
 * objects, dashboards, pages, and reports matching the query.
 * @module
 */

import { useState, useMemo } from 'react';
import { useSearchParams, Link, useParams } from 'react-router-dom';
import {
  Input,
  Card,
  CardContent,
  Badge,
} from '@object-ui/components';
import {
  Search,
  Database,
  LayoutDashboard,
  FileText,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import appConfig from '../../objectstack.shared';

interface SearchResult {
  id: string;
  label: string;
  href: string;
  type: 'object' | 'dashboard' | 'page' | 'report';
  description?: string;
}

/** Flatten nested navigation groups into a flat list of leaf items */
function flattenNavigation(items: any[]): any[] {
  const result: any[] = [];
  for (const item of items) {
    if (item.type === 'group' && item.children) {
      result.push(...flattenNavigation(item.children));
    } else {
      result.push(item);
    }
  }
  return result;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  object: Database,
  dashboard: LayoutDashboard,
  page: FileText,
  report: BarChart3,
};

const TYPE_COLORS: Record<string, string> = {
  object: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  dashboard: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  page: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  report: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function SearchResultsPage() {
  const { appName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(queryParam);

  const apps = appConfig.apps || [];
  const activeApp = apps.find((a: any) => a.name === appName) || apps[0];
  const baseUrl = `/apps/${appName}`;

  // Build searchable items from navigation
  const allItems = useMemo((): SearchResult[] => {
    if (!activeApp) return [];
    const navItems = flattenNavigation(activeApp.navigation || []);
    return navItems.map((item: any) => {
      let href = '#';
      if (item.type === 'object') href = `${baseUrl}/${item.objectName}`;
      else if (item.type === 'dashboard') href = `${baseUrl}/dashboard/${item.dashboardName}`;
      else if (item.type === 'page') href = `${baseUrl}/page/${item.pageName}`;
      else if (item.type === 'report') href = `${baseUrl}/report/${item.reportName}`;

      return {
        id: item.id,
        label: item.label || item.objectName || item.dashboardName || item.pageName || item.reportName || '',
        href,
        type: item.type,
        description: item.description,
      };
    }).filter((item: SearchResult) => item.href !== '#');
  }, [activeApp, baseUrl]);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return allItems;
    const lower = query.toLowerCase();
    return allItems.filter(
      item =>
        item.label.toLowerCase().includes(lower) ||
        item.type.toLowerCase().includes(lower) ||
        (item.description && item.description.toLowerCase().includes(lower)),
    );
  }, [allItems, query]);

  const handleSearch = (value: string) => {
    setQuery(value);
    setSearchParams(value ? { q: value } : {});
  };

  // Group results by type
  const grouped = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      (groups[r.type] ||= []).push(r);
    }
    return groups;
  }, [results]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={baseUrl}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="text-xl font-semibold">Search</h1>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search objects, dashboards, pages, reports..."
          className="pl-10 h-11 text-base"
          autoFocus
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {query.trim()
          ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
          : `${allItems.length} items available`}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No results found</p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Try adjusting your search terms
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const TypeIcon = TYPE_ICONS[type] || Database;
            return (
              <div key={type}>
                <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TypeIcon className="h-4 w-4" />
                  {type.charAt(0).toUpperCase() + type.slice(1)}s
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {items.length}
                  </Badge>
                </h2>
                <div className="grid gap-2">
                  {items.map(item => (
                    <Link key={item.id} to={item.href}>
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded ${TYPE_COLORS[item.type] || ''}`}>
                            {(() => { const I = TYPE_ICONS[item.type] || Database; return <I className="h-4 w-4" />; })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.type}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
