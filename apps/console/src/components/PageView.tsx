/**
 * Page View Component
 * Renders a custom page based on the pageName parameter
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import appConfig from '../../objectstack.shared';

export function PageView() {
  const { pageName } = useParams<{ pageName: string }>();
  const [searchParams] = useSearchParams();
  const { showDebug, toggleDebug } = useMetadataInspector();
  
  // Find page definition in config
  // In a real implementation, this would fetch from the server
  const page = appConfig.pages?.find((p: any) => p.name === pageName);

  if (!page) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <EmptyTitle>Page Not Found</EmptyTitle>
          <EmptyDescription>The page "{pageName}" could not be found.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Convert URL search params to an object for the page context
  const params = Object.fromEntries(searchParams.entries());

  return (
    <div className="flex flex-row h-full w-full overflow-hidden relative">
        <div className="flex-1 overflow-auto h-full relative group">
             <div className={`absolute top-2 right-2 z-50 transition-opacity ${showDebug ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                 <MetadataToggle open={showDebug} onToggle={toggleDebug} />
             </div>
             <SchemaRenderer 
                schema={{
                    type: 'page',
                    ...page,
                    context: { ...(page as any).context, params }
                }} 
             />
        </div>
        <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Page Configuration', data: page }]}
        />
    </div>
  );
}
