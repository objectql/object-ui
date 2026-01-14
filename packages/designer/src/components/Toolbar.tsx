import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@object-ui/components';
import { 
    Monitor, 
    Smartphone, 
    Tablet, 
    Undo, 
    Redo, 
    Play, 
    Share2,
    Download,
    Upload,
    Copy,
    FileJson,
    Layers,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@object-ui/components";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@object-ui/components";
import { Textarea } from '@object-ui/components';
import { useDesigner } from '../context/DesignerContext';
import { cn } from '@object-ui/components';

export const Toolbar: React.FC = React.memo(() => {
    const { 
        schema, 
        setSchema, 
        undo, 
        redo, 
        canUndo, 
        canRedo, 
        viewportMode, 
        setViewportMode,
        showComponentTree,
        setShowComponentTree
    } = useDesigner();
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importJson, setImportJson] = useState('');
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = useCallback(() => {
        const json = JSON.stringify(schema, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'schema.json';
        a.click();
        URL.revokeObjectURL(url);
    }, [schema]);

    const handleCopyJson = useCallback(async () => {
        try {
            const json = JSON.stringify(schema, null, 2);
            await navigator.clipboard.writeText(json);
            // Could add a toast notification here for success
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            // Fallback: could show an error message or use a different copy method
        }
    }, [schema]);

    const handleImport = useCallback(() => {
        try {
            setImportError('');
            const parsed = JSON.parse(importJson);
            setSchema(parsed);
            setShowImportDialog(false);
            setImportJson('');
        } catch (error) {
            setImportError(error instanceof Error ? error.message : 'Invalid JSON');
        }
    }, [importJson, setSchema]);

    const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = event.target?.result as string;
                const parsed = JSON.parse(json);
                setSchema(parsed);
            } catch (error) {
                setImportError(error instanceof Error ? error.message : 'Failed to import JSON file');
                setShowImportDialog(true);
            }
        };
        reader.readAsText(file);
    }, [setSchema]);

    return (
        <TooltipProvider delayDuration={300}>
            <div className="h-14 border-b bg-white flex items-center px-4 justify-between shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        O
                    </div>
                    <h1 className="font-semibold text-gray-800 tracking-tight hidden sm:block">Object UI Designer</h1>
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-200 hidden sm:block font-medium">Beta</span>
                </div>

                {/* Center Controls */}
                <div className="flex items-center gap-2">
                    {/* Viewport Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md border">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-8 w-8 p-0 transition-all",
                                        viewportMode === 'desktop' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-white hover:text-blue-600"
                                    )}
                                    onClick={() => setViewportMode('desktop')}
                                >
                                    <Monitor size={16} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Desktop View (1024px)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-8 w-8 p-0 transition-all",
                                        viewportMode === 'tablet' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-white hover:text-blue-600"
                                    )}
                                    onClick={() => setViewportMode('tablet')}
                                >
                                    <Tablet size={16} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tablet View (768px)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={cn(
                                        "h-8 w-8 p-0 transition-all",
                                        viewportMode === 'mobile' ? "bg-white text-blue-600 shadow-sm" : "hover:bg-white hover:text-blue-600"
                                    )}
                                    onClick={() => setViewportMode('mobile')}
                                >
                                    <Smartphone size={16} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mobile View (375px)</TooltipContent>
                        </Tooltip>
                    </div>
                    
                    {/* Component Tree Toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className={cn(
                                    "h-8 w-8 p-0 transition-all",
                                    showComponentTree ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
                                )}
                                onClick={() => setShowComponentTree(!showComponentTree)}
                            >
                                <Layers size={16} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {showComponentTree ? 'Hide' : 'Show'} Component Tree
                        </TooltipContent>
                    </Tooltip>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
                {/* Undo/Redo */}
                <div className="flex items-center gap-1 mr-2 border-r pr-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                        onClick={undo}
                        disabled={!canUndo}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo size={16} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                        onClick={redo}
                        disabled={!canRedo}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo size={16} />
                    </Button>
                </div>

                {/* Import/Export */}
                <div className="flex items-center gap-1 mr-2 border-r pr-2">
                    <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                                title="Import JSON"
                            >
                                <Upload size={16} />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Import Schema</DialogTitle>
                                <DialogDescription>
                                    Paste your JSON schema below or upload a file.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileImport}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full"
                                    >
                                        <Upload size={16} className="mr-2" />
                                        Upload JSON File
                                    </Button>
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
                                        <div className="flex-1 border-t"></div>
                                        <div className="px-2 text-xs text-gray-500">or paste JSON</div>
                                        <div className="flex-1 border-t"></div>
                                    </div>
                                </div>
                                <Textarea
                                    value={importJson}
                                    onChange={(e) => setImportJson(e.target.value)}
                                    placeholder='{"type": "div", "body": []}'
                                    className="font-mono text-xs h-64"
                                />
                                {importError && (
                                    <p className="text-sm text-red-600">{importError}</p>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleImport}>
                                        Import
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
                        <DialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                                title="Export JSON"
                            >
                                <Download size={16} />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Export Schema</DialogTitle>
                                <DialogDescription>
                                    Copy the JSON schema or download it as a file.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Textarea
                                    value={JSON.stringify(schema, null, 2)}
                                    readOnly
                                    className="font-mono text-xs h-64"
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={handleCopyJson}>
                                        <Copy size={16} className="mr-2" />
                                        Copy to Clipboard
                                    </Button>
                                    <Button onClick={handleExport}>
                                        <Download size={16} className="mr-2" />
                                        Download File
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-2 hidden md:flex border-gray-200 text-gray-600 hover:bg-gray-50"
                    onClick={async () => {
                        try {
                            const json = JSON.stringify(schema, null, 2);
                            await navigator.clipboard.writeText(json);
                        } catch (error) {
                            console.error('Failed to copy to clipboard:', error);
                        }
                    }}
                    title="Copy schema JSON to clipboard"
                >
                    <FileJson size={14} />
                    <span className="text-xs">Copy JSON</span>
                </Button>

                <Button 
                    variant="default" 
                    size="sm" 
                    className="h-8 gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm text-white border-none"
                    onClick={() => window.open('about:blank')}
                    title="Preview in new window"
                >
                    <Play size={12} fill="currentColor" />
                    <span className="text-xs font-medium">Preview</span>
                </Button>
            </div>
        </div>
        </TooltipProvider>
    );
});

Toolbar.displayName = 'Toolbar';
