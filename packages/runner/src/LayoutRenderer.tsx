import React from 'react';
import type { AppSchema } from '@object-ui/types';
import * as LucideIcons from 'lucide-react';

interface LayoutRendererProps {
  app: AppSchema;
  children: React.ReactNode;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

// Helper to resolve icon from string name (e.g. "bar-chart" -> "BarChart")
const getIcon = (name?: string) => {
  if (!name) return null;
  
  // 1. Try direct match (e.g. "Home")
  if ((LucideIcons as any)[name]) return (LucideIcons as any)[name];

  // 2. Try PascalCase (e.g. "bar-chart" -> "BarChart")
  const pascalName = name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  if ((LucideIcons as any)[pascalName]) return (LucideIcons as any)[pascalName];

  return LucideIcons.Circle; // Fallback
};

export const LayoutRenderer = ({ app, children, currentPath, onNavigate }: LayoutRendererProps) => {
  const layout = app.layout || 'sidebar';

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  if (layout === 'empty') {
    return <main className={app.className}>{children}</main>;
  }

  return (
    <div className={`flex min-h-screen w-full bg-slate-50 ${app.className || ''}`}>
      {/* Sidebar - Only if configured */}
      {layout === 'sidebar' && (
        <aside className="w-64 flex-shrink-0 border-r bg-white hidden md:flex flex-col h-screen sticky top-0">
          <div className="h-16 flex items-center px-6 border-b font-bold text-xl tracking-tight text-slate-900">
            {app.logo ? (
              <img src={app.logo} alt={app.title} className="h-8 mr-2" />
            ) : <LucideIcons.Box className="h-6 w-6 mr-2 text-indigo-600" />}
            <span>{app.title || app.name || 'Object UI'}</span>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {app.menu?.map((item, index) => {
              const isActive = currentPath === item.path;
              const Icon = getIcon(item.icon);
              return (
                <a 
                  key={index}
                  href={item.path || '#'}
                  onClick={(e) => item.path && handleNavClick(e, item.path)}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md group transition-all duration-200 ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {Icon && <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />}
                  {item.label}
                </a>
              );
            })}
          </nav>
          {app.version && (
            <div className="p-4 border-t text-xs text-slate-500">
              v{app.version}
            </div>
          )}
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - Always shown in sidebar/header layouts */}
        <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm border-b shadow-sm z-10 sticky top-0">
           <div className="flex items-center">
             {/* Mobile toggle would go here */}
             <h1 className="text-lg font-semibold text-slate-800 md:hidden">
               {app.title || 'Object UI'}
             </h1>
             {/* Breadcrumbs placeholder or Search */}
             <div className="relative hidden md:block w-96">
                <LucideIcons.Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Type to search..." 
                  className="w-full h-9 pl-9 pr-4 rounded-md border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
             </div>
           </div>
           <div className="flex items-center gap-4">
             {/* Global Actions */}
             <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full">
               <LucideIcons.Bell className="h-5 w-5" />
               <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
             
             <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-medium text-sm">
                JD
             </div>
           </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
          <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
};
