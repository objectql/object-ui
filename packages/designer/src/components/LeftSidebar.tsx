import React, { useState } from 'react';
import { ComponentPalette } from './ComponentPalette';
import { ComponentTree } from './ComponentTree';
import { cn } from '@object-ui/components';
import { Layers, Box } from 'lucide-react';

interface LeftSidebarProps {
  className?: string;
}

type TabType = 'palette' | 'tree';

export const LeftSidebar: React.FC<LeftSidebarProps> = React.memo(({ className }) => {
  const [activeTab, setActiveTab] = useState<TabType>('palette');

  return (
    <div className={cn("flex flex-col h-full bg-white border-r w-72", className)}>
      {/* Tab Headers */}
      <div className="flex border-b bg-gray-50/50 shrink-0">
        <button
          onClick={() => setActiveTab('palette')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
            activeTab === 'palette'
              ? "text-blue-600 bg-white border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
          )}
        >
          <Box size={16} />
          <span>Components</span>
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all relative",
            activeTab === 'tree'
              ? "text-blue-600 bg-white border-b-2 border-blue-600"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50"
          )}
        >
          <Layers size={16} />
          <span>Tree</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'palette' ? (
          <ComponentPalette className="h-full border-r-0" />
        ) : (
          <ComponentTree className="h-full border-r-0" />
        )}
      </div>
    </div>
  );
});

LeftSidebar.displayName = 'LeftSidebar';
