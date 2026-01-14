import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exampleCategories } from '../data/examples';
import { LayoutTemplate, ArrowRight, Component, Layers, Database, Shield, Box, FolderOpen } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-gray-900">
      {/* Hero Section */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <Box className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Object UI Studio</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/my-designs')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white border border-gray-200 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <FolderOpen className="w-4 h-4" />
              My Designs
            </button>
            <a 
              href="https://github.com/objectql/objectui" 
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white/50 hover:bg-white border border-gray-200 rounded-lg transition-all shadow-sm hover:shadow"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-20 relative">
          {/* Decorative elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute top-20 right-1/4 w-80 h-80 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full blur-3xl opacity-30 animate-pulse"></div>
          </div>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-full text-sm font-semibold text-indigo-700 mb-6 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Interactive Visual Editor
          </div>
          
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-gray-900 mb-6 leading-tight">
            Build Stunning Interfaces,<br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Purely from JSON.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 leading-relaxed">
            Object UI transforms JSON schemas into fully functional, accessible, and responsive React applications. 
            <br className="hidden sm:block" />
            <span className="font-semibold text-gray-700">Select a template below to start building.</span>
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {Object.keys(exampleCategories).map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`
                group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                ${activeCategory === category 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-300/50 scale-105' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200 hover:border-indigo-200 hover:shadow-md'}
              `}
            >
              <CategoryIcon name={category} />
              {category}
              {activeCategory === category && (
                <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                  {exampleCategories[category as keyof typeof exampleCategories].length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Examples Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exampleCategories[activeCategory as keyof typeof exampleCategories].map((key) => {
             // Try to parse the example to get a description or just format the title
             const title = key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
             
             return (
              <div 
                key={key}
                onClick={() => navigate(`/studio/${key}`)}
                className="group relative bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 cursor-pointer hover:border-indigo-400 hover:-translate-y-1 flex flex-col h-72"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-indigo-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 pointer-events-none z-10"></div>
                
                {/* Mock Preview Window */}
                <div className="bg-gradient-to-br from-gray-50 to-slate-100 border-b border-gray-200 p-6 flex-1 flex items-center justify-center overflow-hidden relative">
                    {/* Decorative grid */}
                    <div className="absolute inset-0 opacity-20 bg-dot-pattern-sm"></div>
                    
                    <div className="relative w-3/4 h-3/4 bg-white shadow-xl border-2 border-gray-300 rounded-xl flex flex-col group-hover:scale-110 transition-transform duration-500">
                      <div className="h-5 border-b-2 border-gray-200 bg-gradient-to-b from-gray-100 to-gray-50 flex items-center px-2 gap-1.5 rounded-t-xl">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-sm"></div>
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></div>
                      </div>
                      <div className="flex-1 p-3">
                        <div className="space-y-2.5">
                          <div className="h-2.5 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-full w-1/2 animate-pulse"></div>
                          <div className="h-2.5 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full w-3/4 animate-pulse [animation-delay:75ms]"></div>
                          <div className="h-2.5 bg-gradient-to-r from-purple-200 to-pink-200 rounded-full w-full animate-pulse [animation-delay:150ms]"></div>
                        </div>
                      </div>
                    </div>
                </div>

                <div className="p-6 relative z-10 bg-white border-t border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                    {title}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm font-semibold text-gray-500 group-hover:text-indigo-600 transition-colors">
                      Launch Studio
                      <ArrowRight className="w-4 h-4 ml-2 transform group-hover:translate-x-2 transition-transform" />
                    </div>
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      Try Now
                    </div>
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
