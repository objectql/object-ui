import React, { useCallback, useMemo } from 'react';
import { useDesigner } from '../context/DesignerContext';
import { ComponentRegistry } from '@object-ui/core';
import { Label } from '@object-ui/components';
import { Input } from '@object-ui/components';
import { Button } from '@object-ui/components';
import { Switch } from '@object-ui/components';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@object-ui/components"
import { Textarea } from '@object-ui/components';
import { ScrollArea } from '@object-ui/components';
import { Settings2, Trash2, Layers, Copy, ClipboardPaste } from 'lucide-react';
import { cn } from '@object-ui/components';
import type { ComponentInput } from '@object-ui/core';

interface PropertyPanelProps {
    className?: string;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = React.memo(({ className }) => {
    const { schema, selectedNodeId, updateNode, removeNode, copyNode, pasteNode, canPaste } = useDesigner();
    
    // Recursive finder - memoized to prevent recreation on every render
    const findNode = useCallback((node: any, id: string): any => {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.body) {
            if (Array.isArray(node.body)) {
                for (const child of node.body) {
                    const found = findNode(child, id);
                    if (found) return found;
                }
            } else if (typeof node.body === 'object') {
                return findNode(node.body, id);
            }
        }
        return null;
    }, []);
    
    const selectedNode = useMemo(() => 
        selectedNodeId ? findNode(schema, selectedNodeId) : null,
        [selectedNodeId, schema, findNode]
    );
    
    const config = useMemo(() => 
        selectedNode ? ComponentRegistry.getConfig(selectedNode.type) : null,
        [selectedNode]
    );

    const handleInputChange = useCallback((name: string, value: any) => {
        if (!selectedNodeId) return;
        
        // Special case: direct schema properties vs props which go into ...rest
        // Typically props are stored flat on the schema node in this implementation
        // or inside a 'props' object. The renderer spreads the schema node itself or schema.props.
        // Let's assume flat for simple properties like className, label, etc.
        updateNode(selectedNodeId, { [name]: value });
    }, [selectedNodeId, updateNode]);

    if (!selectedNode) {
        return (
            <div className={cn("flex flex-col h-full bg-white border-l w-80 items-center justify-center text-center p-6 text-gray-500", className)}>
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                     <Settings2 size={24} className="opacity-20" />
                </div>
                <h3 className="font-medium text-gray-900 mb-1">No Selection</h3>
                <p className="text-sm">Select a component on the canvas to edit its properties.</p>
            </div>
        );
    }

    const renderInput = (input: ComponentInput) => {
        const value = selectedNode[input.name] ?? input.defaultValue;

        switch (input.type) {
            case 'boolean':
                return (
                    <div className="flex items-center justify-between py-1">
                        <Label htmlFor={input.name} className="text-xs font-medium text-gray-600 cursor-pointer">{input.label || input.name}</Label>
                        <Switch 
                            id={input.name}
                            checked={!!value}
                            onCheckedChange={(checked) => handleInputChange(input.name, checked)}
                        />
                    </div>
                );
            case 'enum':
                const options = Array.isArray(input.enum) 
                    ? input.enum.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt)
                    : [];
                return (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">{input.label || input.name}</Label>
                        <Select 
                            value={String(value || '')} 
                            onValueChange={(val) => handleInputChange(input.name, val)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map(opt => (
                                    <SelectItem key={String(opt.value)} value={String(opt.value)} className="text-xs">
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            case 'number':
                return (
                    <div className="space-y-1.5">
                        <Label htmlFor={input.name} className="text-xs font-medium text-gray-600">{input.label || input.name}</Label>
                        <Input 
                            id={input.name}
                            type="number"
                            value={value || ''}
                            onChange={(e) => handleInputChange(input.name, parseFloat(e.target.value))}
                            className="h-8 text-xs"
                        />
                    </div>
                );
             case 'file': // Fallthrough to text for now
             case 'color': // Fallthrough to text for now
             case 'date': // Fallthrough to text for now
             case 'string':
             default:
                if (input.name === 'description' || input.type === 'string' && (input.label?.toLowerCase().includes('content') || input.label?.toLowerCase().includes('text'))) {
                     return (
                        <div className="space-y-1.5">
                            <Label htmlFor={input.name} className="text-xs font-medium text-gray-600">{input.label || input.name}</Label>
                            <Textarea
                                id={input.name}
                                value={value || ''}
                                onChange={(e) => handleInputChange(input.name, e.target.value)}
                                className="min-h-[80px] text-xs"
                            />
                        </div>
                    );
                }
                return (
                    <div className="space-y-1.5">
                        <Label htmlFor={input.name} className="text-xs font-medium text-gray-600">{input.label || input.name}</Label>
                        <Input 
                            id={input.name}
                            type="text"
                            value={value || ''}
                            onChange={(e) => handleInputChange(input.name, e.target.value)}
                            className="h-8 text-xs bg-white"
                        />
                    </div>
                );
        }
    };

    return (
        <div className={cn("flex flex-col h-full bg-white border-l w-80 shadow-xl shadow-gray-200/50 z-10 overflow-hidden", className)}>
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm tracking-tight">{config?.label || selectedNode.type}</span>
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded border uppercase">{selectedNode.type}</span>
                     </div>
                     <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[180px] font-mono opacity-60">ID: {selectedNode.id}</p>
                </div>
                <div className="flex items-center gap-1">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => copyNode(selectedNode.id)}
                        title="Copy Component (Ctrl+C)"
                    >
                        <Copy size={16} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-30"
                        onClick={() => pasteNode(selectedNodeId)}
                        disabled={!canPaste}
                        title="Paste Component (Ctrl+V)"
                    >
                        <ClipboardPaste size={16} />
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeNode?.(selectedNode.id)}
                        title="Delete Component (Delete)"
                    >
                        <Trash2 size={16} />
                    </Button>
                </div>
            </div>
            
            <ScrollArea className="flex-1 w-full">
                <div className="p-5 space-y-6 pb-20">
                    {/* Common Properties */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                             <Layers size={14} className="text-blue-600" />
                             <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Layout & Style</h4>
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="className" className="text-xs font-medium text-gray-600">Classes (Tailwind)</Label>
                            <Textarea
                                id="className" 
                                value={selectedNode.className || ''}
                                onChange={(e) => handleInputChange('className', e.target.value)}
                                className="font-mono text-[11px] h-20 bg-gray-50 border-gray-200 placeholder:text-gray-300"
                                placeholder="p-4 bg-white rounded-lg..."
                            />
                        </div>
                    </div>

                    {/* Component Specific Properties */}
                    {config?.inputs && config.inputs.length > 0 && (
                        <div className="space-y-4">
                             <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                <Settings2 size={14} className="text-blue-600" />
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Settings</h4>
                             </div>
                             <div className="space-y-4">
                                {config.inputs.filter(i => i.name !== 'className').map(input => (
                                    <div key={input.name}>
                                        {renderInput(input)}
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
});

PropertyPanel.displayName = 'PropertyPanel';
