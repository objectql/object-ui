# Showcase - Explore All Components

The Object UI Showcase is a comprehensive, interactive demo that demonstrates all available components, layouts, and features. It's the best way to explore what Object UI can do and see real examples you can copy into your own projects.

## 🎯 What's in the Showcase?

The showcase is organized into categories, each demonstrating different aspects of the Object UI component library:

### 📦 Basic Components
- **Div** - Container elements with flexible styling
- **Text** - Typography and text rendering
- **HTML** - Raw HTML content rendering
- **Icon** - Lucide icon integration
- **Image** - Image display and optimization
- **Separator** - Visual dividers

### 📐 Layout Components
- **Flex** - Flexbox layouts
- **Grid** - CSS Grid layouts
- **Stack** - Vertical/horizontal stacks
- **Card** - Card containers with headers and footers
- **Container** - Responsive containers
- **Tabs** - Tabbed interfaces
- **Header Bar** - Application headers
- **Sidebar** - Navigation sidebars

### 📝 Form Components
- **Button** - Interactive buttons with variants
- **Input** - Text input fields
- **Textarea** - Multi-line text input
- **Select** - Dropdown selections
- **Checkbox** - Boolean selections
- **Radio Group** - Single choice from options
- **Switch** - Toggle switches
- **Slider** - Range sliders
- **Date Picker** - Date selection
- **Calendar** - Calendar views
- **Input OTP** - One-time password input
- **Toggle** - Toggle buttons
- **File Upload** - File input handling

### 📊 Data Display
- **List** - Ordered and unordered lists
- **Table** - Data tables
- **Avatar** - User avatars
- **Badge** - Status badges
- **Alert** - Alert messages
- **Statistic** - Statistical displays
- **Tree View** - Hierarchical data

### 🔔 Feedback Components
- **Toaster** - Toast notifications
- **Progress** - Progress bars
- **Loading** - Loading indicators
- **Skeleton** - Loading placeholders

### 🎭 Overlay Components
- **Dialog** - Modal dialogs
- **Sheet** - Side panels
- **Drawer** - Bottom drawers
- **Popover** - Popover menus
- **Tooltip** - Tooltips
- **Hover Card** - Hover information cards
- **Alert Dialog** - Confirmation dialogs
- **Dropdown Menu** - Dropdown menus
- **Context Menu** - Right-click menus

### 📂 Disclosure Components
- **Accordion** - Collapsible sections
- **Collapsible** - Show/hide content

### 🎨 Complex Components
- **Data Table** - Advanced sortable, filterable tables
- **Kanban** - Kanban board views
- **Filter Builder** - Dynamic filter creation
- **Calendar View** - Full calendar components
- **Timeline** - Timeline visualizations
- **Charts** - Data visualization charts
- **Carousel** - Image/content carousels
- **Resizable** - Resizable panels
- **Scroll Area** - Custom scrollable areas
- **Chatbot** - Chat interfaces

## 🚀 Running the Showcase Locally

### Quick Start

The easiest way to run the showcase is using the built-in command:

```bash
# Clone the repository
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# Install dependencies
pnpm install

# Build the packages
pnpm build

# Run the showcase
pnpm showcase
```

This will start the showcase at `http://localhost:3000` and automatically open it in your browser.

### Using the CLI

If you have the Object UI CLI installed globally:

```bash
# Install CLI
npm install -g @object-ui/cli

# Navigate to the repository
cd objectui

# Run the showcase
objectui showcase
```

### Development Mode

For development with hot reload:

```bash
pnpm dev:showcase
```

Or using the CLI directly:

```bash
node packages/cli/dist/cli.js dev examples/showcase/app.json
```

## 📖 How to Use the Showcase

### Navigation

The showcase uses a **sidebar layout** with a hierarchical navigation menu:

1. Click on any category (e.g., "Form", "Layout") to expand it
2. Select a specific component to view its demo
3. Use the top navigation for quick access to features

### Viewing Component Examples

Each component page typically includes:

- **Live Preview** - See the component in action
- **Multiple Variants** - Different styles and configurations
- **Interactive Examples** - Try different states and options
- **JSON Schema** - View the schema that generates each example

### Copying Examples

To use an example in your own project:

1. Navigate to the component you want to use
2. View the page source in `examples/showcase/pages/`
3. Copy the JSON schema
4. Paste it into your own `app.json` or page schema

**Example:** To find the Button component schema:

```bash
cat examples/showcase/pages/form/button.json
```

## 🎓 Learning from the Showcase

### Step 1: Explore by Category

Start with **Basic Components** to understand fundamental building blocks:
- How `div` containers work with Tailwind classes
- How `text` components render typography
- How `icon` components integrate Lucide icons

### Step 2: Study Layout Patterns

Move to **Layout Components** to see how to structure pages:
- `flex` for flexible layouts
- `grid` for structured grids
- `card` for contained content sections

### Step 3: Build Forms

Explore **Form Components** to see validation, state management, and user input:
- Input field variants
- Select dropdowns
- Date pickers
- Form submission handling

### Step 4: Display Data

Check out **Data Display** components for showing information:
- Tables with sorting and filtering
- Lists with custom rendering
- Statistics and metrics

### Step 5: Advanced Patterns

Finally, explore **Complex Components** for advanced use cases:
- Data tables with pagination
- Kanban boards with drag-and-drop
- Charts and visualizations
- Rich interactions

## 🎨 Customization Examples

The showcase demonstrates Object UI's **Tailwind-first** philosophy. Every component accepts a `className` prop for styling:

```json
{
  "type": "button",
  "label": "Custom Button",
  "className": "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
}
```

### Color Themes

See how components adapt to different themes:
- Light mode (default)
- Dark mode (via `dark:` classes)
- Custom color schemes

### Size Variants

Most components support multiple sizes:
```json
{
  "type": "button",
  "size": "sm",     // Small
  "size": "default", // Default
  "size": "lg"      // Large
}
```

### Style Variants

Buttons, cards, and other components have built-in variants:
```json
{
  "type": "button",
  "variant": "default",   // Primary
  "variant": "secondary", // Secondary
  "variant": "outline",   // Outlined
  "variant": "ghost",     // Ghost
  "variant": "destructive" // Destructive
}
```

## 📁 Showcase File Structure

The showcase is built entirely from JSON files:

```
examples/showcase/
├── app.json           # Main application configuration
└── pages/             # Component demonstration pages
    ├── index.json     # Dashboard/home page
    ├── basic/         # Basic components
    │   ├── div.json
    │   ├── text.json
    │   └── ...
    ├── layout/        # Layout components
    ├── form/          # Form components
    ├── data-display/  # Data display components
    ├── feedback/      # Feedback components
    ├── overlay/       # Overlay components
    ├── disclosure/    # Disclosure components
    └── complex/       # Complex components
```

Each page is a standalone JSON schema that demonstrates specific components.

## 🌐 Deploying Your Own Showcase

Want to deploy the showcase to your own website? See our [Showcase Deployment Guide](../deployment/showcase-deployment.md) for:

- Static site deployment (Vercel, Netlify, GitHub Pages)
- Docker containerization
- Embedding in existing websites
- Custom domain configuration

## 💡 Tips and Best Practices

### Use as a Reference

The showcase is your **living documentation**. Whenever you need to implement a component:

1. Find it in the showcase
2. Interact with it to understand behavior
3. Copy the JSON schema
4. Customize for your needs

### Experiment Locally

The showcase is perfect for experimentation:

1. Clone the repository
2. Edit JSON files in `examples/showcase/pages/`
3. See changes instantly with hot reload
4. No compilation or build step needed

### Share Examples

When reporting issues or asking for help:

1. Create a minimal example in the showcase format
2. Share the JSON schema
3. Others can reproduce it instantly

## 🔗 Related Resources

- [Component Reference](../components/) - Detailed component documentation
- [Quick Start Guide](./quick-start.md) - Get started with Object UI
- [Schema Rendering](./schema-rendering.md) - Understand how schemas work
- [Try It Online](./try-it-online.md) - Use the online playground

## 🤝 Contributing to the Showcase

Found a component that's missing from the showcase? Want to add more examples?

1. Create a new JSON file in the appropriate category
2. Follow the existing pattern
3. Submit a pull request

See our [Contributing Guide](../../CONTRIBUTING.md) for details.

---

**Ready to explore?** Run `pnpm showcase` and start discovering what Object UI can do!
