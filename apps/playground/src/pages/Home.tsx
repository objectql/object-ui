import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exampleCategories } from '../data/examples';
import { LayoutTemplate, ArrowRight, Component, Layers, Database, Shield, Box, FolderOpen, Plus } from 'lucide-react';

const CategoryIcon = ({ name }: { name: string }) => {
  switch (name) {
    case 'Primitives': return <Component className="w-5 h-5" />;
    case 'Layouts': return <Layers className="w-5 h-5" />;
    case 'Data Display': return <Database className="w-5 h-5" />;
    case 'Forms': return <Shield className="w-5 h-5" />;
    case 'Complex': return <Box className="w-5 h-5" />;
    default: return <LayoutTemplate className="w-5 h-5" />;
  }
};

export const Home = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('Layouts');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-background border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Box className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-base">Object UI Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/studio/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              onClick={() => navigate('/my-designs')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              My Designs
            </button>
            <a 
              href="https://github.com/objectql/objectui" 
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Quick Actions */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Quick Start</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/my-designs')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-muted rounded-md transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Open Saved
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-4">
          <div className="flex items-center gap-2 border-b border-border">
            {Object.keys(exampleCategories).map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
                  ${activeCategory === category 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
                `}
              >
                <CategoryIcon name={category} />
                {category}
                <span
                  className={`text-xs ${activeCategory === category ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  ({exampleCategories[category as keyof typeof exampleCategories].length})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {exampleCategories[activeCategory as keyof typeof exampleCategories].map((key) => {
             const title = key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
             
             return (
              <div 
                key={key}
                onClick={() => navigate(`/studio/${key}`)}
                className="group bg-card rounded-lg border border-border overflow-hidden hover:border-primary hover:shadow-md transition-all cursor-pointer"
              >
                {/* Preview */}
                <div className="bg-muted p-4 aspect-video flex items-center justify-center border-b border-border">
                  <div className="w-full h-full bg-background rounded border border-border flex flex-col shadow-sm">
                    <div className="h-4 border-b border-border bg-muted flex items-center px-1.5 gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex-1 p-2">
                      <div className="space-y-1.5">
                        <div className="h-1.5 bg-muted rounded w-1/2"></div>
                        <div className="h-1.5 bg-muted rounded w-3/4"></div>
                        <div className="h-1.5 bg-muted rounded w-full"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-sm font-medium group-hover:text-primary transition-colors mb-1">
                    {title}
                  </h3>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>Open in Studio</span>
                    <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
             );
          })}
        </div>
      </main>
    </div>
  );
};
