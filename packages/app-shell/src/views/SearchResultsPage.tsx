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
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';
import { matchAppBySegment } from '../utils/appRoute';
import { resolveHref } from '@object-ui/layout';
import { useAuth } from '@object-ui/auth';

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
  const { t } = useObjectTranslation();
  const { appName } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(queryParam);

  const { apps: metadataApps } = useMetadata();
  const apps = metadataApps || [];
  const activeApp = matchAppBySegment(apps, appName) || apps[0];
  const baseUrl = `/apps/${appName}`;
  const { user } = useAuth();

  // Build searchable items from navigation
  const allItems = useMemo((): SearchResult[] => {
    if (!activeApp) return [];
    const navItems = flattenNavigation(activeApp.navigation || []);
    const templateContext = { currentUserId: user?.id ?? null };
    return navItems.map((item: any) => {
      const { href } = resolveHref(item, baseUrl, templateContext);

      return {
        id: item.id,
        label: item.label || item.objectName || item.dashboardName || item.pageName || item.reportName || '',
        href,
        type: item.type,
        description: item.description,
      };
    }).filter((item: SearchResult) => item.href !== '#');
  }, [activeApp, baseUrl, user?.id]);

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
          {t('search.back')}
        </Link>
        <h1 className="text-xl font-semibold">{t('search.title')}</h1>
      </div>

      {/* Search input */}
      <div className="relative">
        <label htmlFor="search-results-input" className="sr-only">{t('search.placeholder')}</label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="search-results-input"
          value={query}
          onChange={(e: any) => handleSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="pl-10 h-11 text-base"
          autoFocus
        />
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {query.trim()
          ? t(results.length === 1 ? 'search.resultsCount' : 'search.resultsCountPlural', { count: results.length, query })
          : t('search.itemsAvailable', { count: allItems.length })}
      </div>

      {/* Results */}
      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">{t('search.noResults')}</p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            {t('search.noResultsHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const TypeIcon = TYPE_ICONS[type] || Database;
            const typeLabelKey = `search.type${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
            const badgeKey = `search.badge${type.charAt(0).toUpperCase()}${type.slice(1)}`;
            return (
              <div key={type}>
                <h2 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <TypeIcon className="h-4 w-4" />
                  {t(typeLabelKey)}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {items.length}
                  </Badge>
                </h2>
                <div className="grid gap-2">
                  {items.map(item => {
                    const ItemIcon = TYPE_ICONS[item.type] || Database;
                    const itemBadgeKey = `search.badge${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`;
                    return (
                    <Link key={item.id} to={item.href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded ${TYPE_COLORS[item.type] || ''}`}>
                            <ItemIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {t(itemBadgeKey)}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
