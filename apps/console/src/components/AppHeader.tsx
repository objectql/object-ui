import { useLocation, useParams, Link } from 'react-router-dom';
import { 
  Breadcrumb, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbList, 
  BreadcrumbPage, 
  BreadcrumbSeparator,
  SidebarTrigger,
  Button,
  Separator,
} from '@object-ui/components';
import { Search, Bell, HelpCircle } from 'lucide-react';

import { ModeToggle } from './mode-toggle';
import { ConnectionStatus } from './ConnectionStatus';
import type { ConnectionState } from '../dataSource';

export function AppHeader({ appName, objects, connectionState }: { appName: string, objects: any[], connectionState?: ConnectionState }) {
    const location = useLocation();
    const params = useParams();
    
    // Parse the current route to build breadcrumbs
    const pathParts = location.pathname.split('/').filter(Boolean);
    // pathParts: ['apps', 'crm_app', 'contact', 'view', 'all'] or ['apps', 'crm_app', 'dashboard', 'crm_dashboard']
    
    const appNameFromRoute = params.appName || pathParts[1];
    const routeType = pathParts[2]; // 'contact', 'dashboard', 'page', 'report'
    
    // Determine breadcrumb items
    const breadcrumbItems: { label: string; href?: string }[] = [
      { label: appName, href: `/apps/${appNameFromRoute}` }
    ];
    
    if (routeType === 'dashboard') {
      breadcrumbItems.push({ label: 'Dashboard' });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: pathParts[3] });
      }
    } else if (routeType === 'page') {
      breadcrumbItems.push({ label: 'Page' });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: pathParts[3] });
      }
    } else if (routeType === 'report') {
      breadcrumbItems.push({ label: 'Report' });
      if (pathParts[3]) {
        breadcrumbItems.push({ label: pathParts[3] });
      }
    } else if (routeType) {
      // Object route
      const currentObject = objects.find((o: any) => o.name === routeType);
      if (currentObject) {
        breadcrumbItems.push({ 
          label: currentObject.label || routeType,
          href: `/apps/${appNameFromRoute}/${routeType}`
        });
        
        // Check if viewing a specific record
        if (pathParts[3] === 'record' && pathParts[4]) {
          breadcrumbItems.push({ label: `Record ${pathParts[4].slice(0, 8)}...` });
        } else if (pathParts[3] === 'view' && pathParts[4]) {
          breadcrumbItems.push({ label: pathParts[4] });
        }
      }
    }

    return (
        <div className="flex items-center justify-between w-full h-full px-2 md:px-4 gap-2">
             <div className="flex items-center gap-2">
                {/* Mobile sidebar trigger */}
                <SidebarTrigger className="md:hidden" />
                <Separator orientation="vertical" className="h-4 md:hidden" />
                
                <Breadcrumb className="hidden sm:flex">
                  <BreadcrumbList>
                    {breadcrumbItems.map((item, index) => (
                      <BreadcrumbItem key={index}>
                        {index > 0 && <BreadcrumbSeparator />}
                        {index === breadcrumbItems.length - 1 || !item.href ? (
                          <BreadcrumbPage>{item.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={item.href}>{item.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
                
                {/* Mobile: Just show current page */}
                <span className="text-sm font-medium sm:hidden truncate max-w-37.5">
                  {breadcrumbItems[breadcrumbItems.length - 1]?.label || appName}
                </span>
             </div>
             
             <div className="flex items-center gap-1 md:gap-2">
                {/* Connection Status */}
                {connectionState && <ConnectionStatus state={connectionState} />}
                
                {/* Search - Desktop — opens ⌘K command palette */}
                <button
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                  className="hidden lg:flex relative items-center gap-2 w-50 xl:w-70 h-8 px-3 text-sm rounded-md border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Search className="h-4 w-4" />
                  <span className="flex-1 text-left">Search...</span>
                  <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </button>
                
                {/* Search button - Mobile/Tablet */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-8 w-8"
                  onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                >
                  <Search className="h-4 w-4" />
                </Button>
                
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                  <Bell className="h-4 w-4" />
                </Button>
                
                {/* Help */}
                <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex">
                  <HelpCircle className="h-4 w-4" />
                </Button>
                
                {/* Theme toggle */}
                <ModeToggle />
             </div>
        </div>
    );
}
