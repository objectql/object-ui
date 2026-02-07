
import { Spinner } from '@object-ui/components';
import { Database } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Logo/Icon */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
          <div className="relative bg-linear-to-br from-primary to-primary/80 p-4 rounded-2xl shadow-lg">
            <Database className="h-10 w-10 text-primary-foreground" />
          </div>
        </div>
        
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">ObjectStack Console</h1>
          <p className="text-sm text-muted-foreground">Initializing application...</p>
        </div>
        
        {/* Loading indicator */}
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-full">
          <Spinner className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Connecting to data source</span>
        </div>
      </div>
    </div>
  );
}
