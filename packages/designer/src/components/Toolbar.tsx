import React from 'react';
import { Button } from '@object-ui/components';
import { 
    Monitor, 
    Smartphone, 
    Tablet, 
    Undo, 
    Redo, 
    Play, 
    Share2, 
} from 'lucide-react';

export const Toolbar: React.FC = () => {
    return (
        <div className="h-14 border-b bg-white flex items-center px-4 justify-between shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    O
                </div>
                <h1 className="font-semibold text-gray-800 tracking-tight hidden sm:block">Object UI</h1>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full border hidden sm:block">Beta</span>
            </div>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md border mx-auto">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all">
                    <Monitor size={16} />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all">
                    <Tablet size={16} />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all">
                    <Smartphone size={16} />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-2 border-r pr-2 hidden sm:flex">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                        <Undo size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900">
                        <Redo size={16} />
                    </Button>
                </div>
                
                <Button variant="outline" size="sm" className="h-8 gap-2 hidden md:flex border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Share2 size={14} />
                    <span className="text-xs">Share</span>
                </Button>

                <Button variant="default" size="sm" className="h-8 gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm text-white border-none">
                    <Play size={12} fill="currentColor" />
                    <span className="text-xs font-medium">Preview</span>
                </Button>
            </div>
        </div>
    );
};
