# Changelog

All notable changes to @object-ui/designer will be documented in this file.

## [Unreleased]

### Added - Major Feature Enhancements

#### Core Functionality
- ✨ **Undo/Redo System**: Full history management with 50-item capacity
  - Keyboard shortcuts: `Ctrl+Z` for undo, `Ctrl+Y` for redo
  - Visual indicators in toolbar showing undo/redo availability
  
- ✨ **Copy/Paste Components**: Duplicate components easily
  - Copy with `Ctrl+C` / `Cmd+C`
  - Paste with `Ctrl+V` / `Cmd+V`
  - Works with keyboard shortcuts and toolbar buttons
  
- ✨ **JSON Import/Export**: 
  - Import from file or paste JSON directly
  - Export to file or copy to clipboard
  - Full schema validation on import
  
- ✨ **Component Search**: Quickly find components in the palette
  - Real-time search filtering
  - Searches by component type and label
  - Clear search with X button

- ✨ **Smart Drag & Drop**: Intelligent insertion positioning
  - Drop position detection (top/bottom half)
  - Visual drop zone indicators
  - Smooth animations during drag operations

#### Visual Enhancements
- 🎨 **Enhanced Selection Feedback**:
  - Component type label on selection
  - Gradient-styled selection indicators
  - Box shadow for better depth perception
  - Hover states with subtle outlines
  
- 🎨 **Improved Empty State**:
  - Helpful getting started guide
  - Quick reference for keyboard shortcuts
  - Beautiful gradient design
  - Clear call-to-action

- 🎨 **Better Component Icons**:
  - Comprehensive icon mapping for 20+ component types
  - Category-specific icons (Layout, Form, Data Display, etc.)
  - Consistent visual language throughout

- 🎨 **Drag Feedback**:
  - Custom drag preview
  - Drop zone indicators showing "Drop to move here" / "Drop to add here"
  - Dimmed source component during drag
  - Smooth transitions

#### UX Improvements
- 📱 **Responsive Viewport Modes**:
  - Desktop view (1024px)
  - Tablet view (768px)
  - Mobile view (375px)
  - Smooth transitions between modes
  - Visual toggle in toolbar

- 💡 **Tooltips Throughout**:
  - Contextual help on all toolbar buttons
  - Keyboard shortcut hints
  - Viewport size information
  - Component action tooltips

- ⌨️ **Comprehensive Keyboard Shortcuts**:
  - `Ctrl+Z` / `Cmd+Z`: Undo
  - `Ctrl+Y` / `Cmd+Y`: Redo
  - `Ctrl+C` / `Cmd+C`: Copy component
  - `Ctrl+V` / `Cmd+V`: Paste component
  - `Delete` / `Backspace`: Delete component
  - Smart detection to avoid conflicts with text editing

- 🔍 **Zoom Controls**:
  - Zoom in/out buttons
  - Reset to 100% button
  - Visual zoom percentage indicator
  - Smooth scaling animations

#### Developer Experience
- 🛠️ **Better Type Definitions**:
  - ViewportMode type export
  - Enhanced DesignerContext interface
  - Improved component prop types

- 📝 **Comprehensive Documentation**:
  - Updated README with all new features
  - Keyboard shortcuts reference table
  - Feature roadmap with completion status
  - Usage examples for all features

### Changed
- 🔄 Improved Canvas component with viewport-aware sizing
- 🔄 Enhanced PropertyPanel with copy/paste/delete action buttons
- 🔄 Refactored Toolbar with better organization and dialogs
- 🔄 Better ComponentPalette with search and filtering
- 🔄 SchemaRenderer now includes `data-obj-type` attribute for better debugging

### Technical Improvements
- Optimized history management to prevent memory leaks
- Improved drag-drop performance with better event handling
- Enhanced state management with proper React hooks usage
- Added proper TypeScript strict mode compatibility
- Better separation of concerns in context management

---

## [0.1.0] - Initial Release

### Added
- Basic visual schema editor
- Drag and drop from component palette
- Component reordering in canvas
- Property panel for component configuration
- Basic toolbar
- Component categories (Layout, Form, Data Display, Feedback, Overlay, Navigation)

