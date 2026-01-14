import React, { useState } from 'react';
import { 
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@object-ui/components";
import { Button } from '@object-ui/components';
import { Keyboard, Command } from 'lucide-react';
import { cn } from '@object-ui/components';

interface ShortcutItem {
    keys: string[];
    description: string;
    category: string;
}

const shortcuts: ShortcutItem[] = [
    // Editing
    { keys: ['Ctrl/⌘', 'Z'], description: 'Undo last action', category: 'Editing' },
    { keys: ['Ctrl/⌘', 'Y'], description: 'Redo last action', category: 'Editing' },
    { keys: ['⌘', 'Shift', 'Z'], description: 'Redo (Mac alternative)', category: 'Editing' },
    
    // Clipboard
    { keys: ['Ctrl/⌘', 'C'], description: 'Copy selected component', category: 'Clipboard' },
    { keys: ['Ctrl/⌘', 'X'], description: 'Cut selected component', category: 'Clipboard' },
    { keys: ['Ctrl/⌘', 'V'], description: 'Paste component', category: 'Clipboard' },
    { keys: ['Ctrl/⌘', 'D'], description: 'Duplicate selected component', category: 'Clipboard' },
    
    // Navigation & Organization
    { keys: ['Ctrl/⌘', '↑'], description: 'Move component up in tree', category: 'Organization' },
    { keys: ['Ctrl/⌘', '↓'], description: 'Move component down in tree', category: 'Organization' },
    { keys: ['Delete'], description: 'Delete selected component', category: 'Editing' },
    { keys: ['Backspace'], description: 'Delete selected component (Alt)', category: 'Editing' },
];

const KeyboardKey: React.FC<{ keyLabel: string }> = ({ keyLabel }) => (
    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded shadow-sm">
        {keyLabel}
    </kbd>
);

export const KeyboardShortcutsHelp: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
        if (!acc[shortcut.category]) {
            acc[shortcut.category] = [];
        }
        acc[shortcut.category].push(shortcut);
        return acc;
    }, {} as Record<string, ShortcutItem[]>);
    
    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                title="Keyboard Shortcuts"
            >
                <Keyboard size={16} />
            </Button>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Command size={20} className="text-blue-600" />
                            Keyboard Shortcuts
                        </DialogTitle>
                        <DialogDescription>
                            Speed up your workflow with these keyboard shortcuts
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 mt-4">
                        {Object.entries(groupedShortcuts).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                                    {category}
                                </h3>
                                <div className="space-y-2">
                                    {items.map((shortcut, idx) => (
                                        <div 
                                            key={idx}
                                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="text-sm text-gray-700">
                                                {shortcut.description}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, keyIdx) => (
                                                    <React.Fragment key={keyIdx}>
                                                        <KeyboardKey keyLabel={key} />
                                                        {keyIdx < shortcut.keys.length - 1 && (
                                                            <span className="text-gray-400 mx-1">+</span>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 pt-4 border-t">
                        <p className="text-xs text-gray-500 text-center">
                            <strong>Note:</strong> Copy, cut, paste, and duplicate shortcuts work only when not editing text in input fields.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

KeyboardShortcutsHelp.displayName = 'KeyboardShortcutsHelp';
