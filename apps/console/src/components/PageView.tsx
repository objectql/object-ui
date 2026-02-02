/**
 * Page View Component
 * Renders a custom page based on the pageName parameter
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { PageRenderer } from '@object-ui/components';
import appConfig from '../../objectstack.config';

export function PageView() {
  const { pageName } = useParams<{ pageName: string }>();
  const [searchParams] = useSearchParams();
  
  // Find page definition in config
  // In a real implementation, this would fetch from the server
  const page = appConfig.pages?.find((p: any) => p.name === pageName);

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground">
          The page "{pageName}" could not be found.
        </p>
      </div>
    );
  }

  // Convert URL search params to an object for the page context
  const params = Object.fromEntries(searchParams.entries());

  return (
    <PageRenderer 
      schema={{
        type: 'page',
        ...page,
        // Pass URL params to page context if needed
        context: { ...page.context, params }
      }} 
    />
  );
}
