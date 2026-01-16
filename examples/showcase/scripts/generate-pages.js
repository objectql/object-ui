
const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, '../app.json');
const pagesDir = path.resolve(__dirname, '../pages');

const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Helper to create page wrapper
const page = (title, description, ...children) => ({
    type: "page",
    title: `${title} - Object UI`,
    body: [
        {
            type: "div",
            className: "space-y-6 container mx-auto py-6 max-w-4xl",
            children: [
                {
                    type: "div",
                    className: "space-y-2",
                    children: [
                        { type: "text", value: title, className: "text-3xl font-bold tracking-tight" },
                        { type: "text", value: description, className: "text-lg text-muted-foreground" }
                    ]
                },
                { type: "separator", className: "my-6" },
                ...children
            ]
        }
    ]
});

// Helper for Component Preview Card
const preview = (title, ...content) => ({
    type: "div",
    className: "grid gap-4",
    children: [
        { type: "text", value: title, className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" },
        { 
            type: "card", 
            className: "p-6 flex items-center justify-center min-h-[150px] bg-background/50 border shadow-sm",
            children: content.length === 1 ? content[0] : { type: "div", className: "w-full space-y-4", children: content }
        }
    ]
});

const TEMPLATES = {
    // Basic
    'div': () => page("Div", "A fundamental container component.",
        preview("Basic Container", 
            { type: "div", className: "p-4 bg-muted rounded-md border", children: [{ type: "text", value: "This is a div container" }] }
        ),
        preview("Styled Container",
            { type: "div", className: "p-6 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl shadow-lg", children: [{ type: "text", value: "Gradient Div" }] }
        )
    ),
    'text': () => page("Text", "Typography components.",
        preview("Headings", 
            { type: "div", className: "space-y-4", children: [
                { type: "text", value: "Heading 1", className: "text-4xl font-extrabold lg:text-5xl" },
                { type: "text", value: "Heading 2", className: "text-3xl font-semibold border-b pb-2" },
                { type: "text", value: "Heading 3", className: "text-2xl font-semibold" },
                { type: "text", value: "Heading 4", className: "text-xl font-semibold" },
            ]}
        ),
        preview("Paragraphs",
            { type: "div", className: "space-y-4", children: [
                { type: "text", value: "Leading: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", className: "text-xl text-muted-foreground" },
                { type: "text", value: "Regular: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.", className: "leading-7" },
                { type: "text", value: "Small: Lorem ipsum dolor sit amet.", className: "text-sm font-medium leading-none" },
                { type: "text", value: "Muted: Lorem ipsum dolor sit amet.", className: "text-sm text-muted-foreground" },
            ]}
        )
    ),
    'icon': () => page("Icon", "Lucide icons implementation.",
        preview("Basic Icons", 
             { type: "div", className: "flex gap-6 text-2xl", children: [
                 { type: "icon", name: "home", className: "w-6 h-6" },
                 { type: "icon", name: "user", className: "w-6 h-6 text-blue-500" },
                 { type: "icon", name: "settings", className: "w-6 h-6 animate-spin" },
                 { type: "icon", name: "heart", className: "w-6 h-6 text-red-500 fill-current" }
             ]}
        )
    ),
    'image': () => page("Image", "Display images.",
        preview("Responsive Image",
            { type: "image", src: "https://images.unsplash.com/photo-1579353977828-2a4eab540b9a?w=800&q=80", alt: "Example", className: "rounded-lg object-cover h-64 w-full" }
        ),
        preview("Avatar Style",
            { type: "image", src: "https://github.com/shadcn.png", className: "rounded-full w-24 h-24 border-4 border-white shadow-lg" }
        )
    ),
    'separator': () => page("Separator", "Visually or semantically separates content.",
         preview("Horizontal",
             { type: "div", className: "w-full", children: [
                 { type: "div", className: "space-y-1", children: [
                     { type: "text", value: "Radix Primitives", className: "text-sm font-medium leading-none" },
                     { type: "text", value: "An open-source UI component library.", className: "text-sm text-muted-foreground" }
                 ]},
                 { type: "separator", className: "my-4" },
                 { type: "div", className: "flex h-5 items-center space-x-4 text-sm", children: [
                     { type: "text", value: "Blog" },
                     { type: "separator", orientation: "vertical" },
                     { type: "text", value: "Docs" },
                     { type: "separator", orientation: "vertical" },
                     { type: "text", value: "Source" }
                 ]}
             ]}
         )
    ),

    // Layout
    'flex': () => page("Flex", "One-dimensional layout.",
        preview("Flex Row",
            { type: "flex", className: "gap-4", children: [
                { type: "div", className: "w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center", children: [{ type: "text", value: "1" }] },
                { type: "div", className: "w-16 h-16 bg-blue-200 dark:bg-blue-800 rounded flex items-center justify-center", children: [{ type: "text", value: "2" }] },
                { type: "div", className: "w-16 h-16 bg-blue-300 dark:bg-blue-700 rounded flex items-center justify-center", children: [{ type: "text", value: "3" }] }
            ]}
        ),
        preview("Flex Column",
            { type: "flex", direction: "column", className: "gap-2 w-full", children: [
                { type: "div", className: "p-4 bg-muted rounded", children: [{ type: "text", value: "Item 1" }] },
                { type: "div", className: "p-4 bg-muted rounded", children: [{ type: "text", value: "Item 2" }] }
            ]}
        )
    ),
    'grid': () => page("Grid", "CSS Grid layout.",
        preview("Responsive Grid",
             { type: "grid", className: "grid-cols-2 md:grid-cols-4 gap-4", children: [
                 { type: "div", className: "h-24 bg-red-100 dark:bg-red-900 rounded" },
                 { type: "div", className: "h-24 bg-green-100 dark:bg-green-900 rounded" },
                 { type: "div", className: "h-24 bg-blue-100 dark:bg-blue-900 rounded" },
                 { type: "div", className: "h-24 bg-yellow-100 dark:bg-yellow-900 rounded" }
             ]}
        )
    ),
    'card': () => page("Card", "Displays a card with header, content, and footer.",
        preview("Simple Card",
            { type: "card", title: "Create project", description: "Deploy your new project in one-click.", className: "w-[350px]", 
              children: [
                  { type: "form", className: "space-y-4", children: [ 
                      { type: "input", label: "Name", placeholder: "Name of your project" },
                      { type: "select", label: "Framework", placeholder: "Select", options: [{label: "Next.js", value: "next"}, {label: "SvelteKit", value: "svelte"}] }
                  ]}
              ], 
              footer: [
                { type: "button", label: "Cancel", variant: "outline" },
                { type: "button", label: "Deploy" }
            ]}
        )
    ),
    'tabs': () => page("Tabs", "Switch between views.",
        preview("Account Settings",
            { type: "tabs", defaultValue: "account", className: "w-[400px]", items: [
                { label: "Account", value: "account", content: { type: "card", title: "Account", description: "Make changes to your account here.", children: [{ type: "div", className: "space-y-4 pt-4", children: [{ type: "input", label: "Name", defaultValue: "Pedro Duarte" }, { type: "input", label: "Username", defaultValue: "@peduarte" }] }], footer: [{ type: "button", label: "Save changes" }] } },
                { label: "Password", value: "password", content: { type: "card", title: "Password", description: "Change your password here.", children: [{ type: "div", className: "space-y-4 pt-4", children: [{ type: "input", label: "Current Password", type: "password" }, { type: "input", label: "New Password", type: "password" }] }], footer: [{ type: "button", label: "Save password" }] } }
            ]}
        )
    ),

    // Forms
    'button': () => page("Button", "Trigger actions.",
        preview("Variants",
            { type: "div", className: "flex flex-wrap gap-4", children: [
                { type: "button", label: "Default" },
                { type: "button", label: "Secondary", variant: "secondary" },
                { type: "button", label: "Destructive", variant: "destructive" },
                { type: "button", label: "Outline", variant: "outline" },
                { type: "button", label: "Ghost", variant: "ghost" },
                { type: "button", label: "Link", variant: "link" }
            ]}
        ),
        preview("Sizes",
             { type: "div", className: "flex items-center gap-4", children: [
                 { type: "button", label: "Default", size: "default" },
                 { type: "button", label: "Small", size: "sm" },
                 { type: "button", label: "Large", size: "lg" },
                 { type: "button", size: "icon", icon: "chevron-right" }
             ]}
        ),
        preview("With Icon",
             { type: "div", className: "flex items-center gap-4", children: [
                 { type: "button", label: "Email", icon: "mail", className: "gap-2" },
                 { type: "button", label: "Loading", disabled: true, children: [{ type: "icon", name: "loader-2", className: "mr-2 h-4 w-4 animate-spin" }, "Please wait"] }
             ]}
        )
    ),
    'input': () => page("Input", "Accept user input.",
        preview("Types",
             { type: "div", className: "space-y-4 max-w-sm w-full", children: [
                 { type: "input", label: "Email", placeholder: "m@example.com", type: "email" },
                 { type: "input", label: "Password", type: "password" },
                 { type: "input", label: "With Helper", description: "This is your public display name." },
                 { type: "input", label: "Disabled", disabled: true, value: "Can't touch this" }
             ]}
        ),
        preview("With Button",
            { type: "div", className: "flex w-full max-w-sm items-center space-x-2", children: [
                { type: "input", placeholder: "Email", className: "flex-1" },
                { type: "button", label: "Subscribe" }
            ]}
        )
    ),
    'select': () => page("Select", "Dropdown selection.",
         preview("Basic Select",
             { type: "select", label: "Theme", placeholder: "Select a theme", options: [
                 { label: "Light", value: "light" },
                 { label: "Dark", value: "dark" },
                 { label: "System", value: "system" }
             ], className: "w-[180px]" }
         )
    ),
    'checkbox': () => page("Checkbox", "Toggle selection.",
         preview("Basic Checkbox",
             { type: "div", className: "flex items-center space-x-2", children: [
                 { type: "checkbox", id: "terms" },
                 { type: "label", htmlFor: "terms", value: "Accept terms and conditions", className: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" }
             ]}
         )
    ),
    'switch': () => page("Switch", "Toggle state.",
         preview("Airplane Mode",
             { type: "div", className: "flex items-center space-x-2", children: [
                 { type: "switch", id: "airplane-mode" },
                 { type: "label", htmlFor: "airplane-mode", value: "Airplane Mode" }
             ]}
         )
    ),
    'slider': () => page("Slider", "Range selection.",
         preview("Volume",
             { type: "div", className: "w-full max-w-sm space-y-4", children: [
                 { type: "slider", defaultValue: [50], max: 100, step: 1 }
             ]}
         )
    ),
    'date-picker': () => page("Date Picker", "Date selection.",
         preview("Pick a date",
             { type: "div", className: "max-w-xs", children: [{ type: "date-picker" }] }
         )
    ),
    'textarea': () => page("Textarea", "Multiline text input.",
         preview("Bio",
             { type: "textarea", placeholder: "Type your message here.", className: "max-w-md", label: "Description", description: "Your message will be copied to the support team." }
         )
    ),

    // Data Display
    'table': () => page("Table", "Tabular data display.",
        preview("Users",
            { type: "table", 
              caption: "A list of your recent invoices.",
              columns: [
                  { name: "invoice", label: "Invoice" },
                  { name: "status", label: "Status" },
                  { name: "method", label: "Method" },
                  { name: "amount", label: "Amount", className: "text-right" }
              ],
              data: [
                  { invoice: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" },
                  { invoice: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" },
                  { invoice: "INV003", status: "Unpaid", method: "Bank Transfer", amount: "$350.00" },
                  { invoice: "INV004", status: "Paid", method: "Credit Card", amount: "$450.00" },
                  { invoice: "INV005", status: "Paid", method: "PayPal", amount: "$550.00" },
                  { invoice: "INV006", status: "Pending", method: "Bank Transfer", amount: "$200.00" },
                  { invoice: "INV007", status: "Unpaid", method: "Credit Card", amount: "$300.00" }
              ]
            }
        )
    ),
    'list': () => page("List", "List layout.",
        preview("Simple List",
             { type: "list", className: "w-full max-w-md border rounded-md p-4", items: ["Item 1", "Item 2", "Item 3"] }
        )
    ),
    'badge': () => page("Badge", "Status indicators.",
        preview("Variants",
            { type: "div", className: "flex gap-2", children: [
                { type: "badge", content: "Default" },
                { type: "badge", content: "Secondary", variant: "secondary" },
                { type: "badge", content: "Destructive", variant: "destructive" },
                { type: "badge", content: "Outline", variant: "outline" }
            ]}
        )
    ),
    'alert': () => page("Alert", "Important messages.",
        preview("Examples",
             { type: "div", className: "space-y-4 w-full max-w-md", children: [
                 { type: "alert", icon: "terminal", title: "Heads up!", description: "You can add components to your app using the cli." },
                 { type: "alert", variant: "destructive", icon: "alert-circle", title: "Error", description: "Your session has expired. Please log in again." }
             ]}
        )
    ),
    'avatar': () => page("Avatar", "User profile image.",
        preview("Avatars",
            { type: "div", className: "flex gap-4", children: [
                { type: "avatar", src: "https://github.com/shadcn.png", fallback: "CN" },
                { type: "avatar", fallback: "JD" }
            ]}
        )
    ),

    // Overlay
    'dialog': () => page("Dialog", "Modal window.",
        preview("Edit Profile",
            { 
                type: "dialog", 
                trigger: [{ type: "button", label: "Open Dialog", variant: "outline" }],
                title: "Edit Profile",
                description: "Make changes to your profile here.",
                content: [{ type: "div", className: "py-4 gap-4 grid", children: [
                     { type: "div", className: "grid grid-cols-4 items-center gap-4", children: [{ type: "label", value: "Name", className: "text-right" }, { type: "input", value: "Pedro Duarte", className: "col-span-3" }]},
                     { type: "div", className: "grid grid-cols-4 items-center gap-4", children: [{ type: "label", value: "Username", className: "text-right" }, { type: "input", value: "@peduarte", className: "col-span-3" }]}
                ]}],
                footer: [{ type: "button", label: "Save Changes" }]
            }
        )
    ),
    'sheet': () => page("Sheet", "Side drawer.",
        preview("Right Sheet",
            { 
               type: "sheet", 
               side: "right",
               trigger: [{ type: "button", label: "Open Sheet", variant: "outline" }],
               title: "Edit Profile",
               description: "Make changes to your profile here. Click save when you're done.",
               content: [{ type: "div", className: "py-4 gap-4 grid", children: [
                     { type: "div", className: "grid grid-cols-4 items-center gap-4", children: [{ type: "label", value: "Name", className: "text-right" }, { type: "input", value: "Pedro Duarte", className: "col-span-3" }]},
                     { type: "div", className: "grid grid-cols-4 items-center gap-4", children: [{ type: "label", value: "Username", className: "text-right" }, { type: "input", value: "@peduarte", className: "col-span-3" }]}
                ]}],
               footer: [{ type: "button", label: "Save changes" }]
            }
        )
    ),
    'popover': () => page("Popover", "Floating content.",
         preview("Settings",
             { 
                 type: "popover", 
                 trigger: [{ type: "button", label: "Open Popover", variant: "outline" }], 
                 content: [{ type: "div", className: "grid gap-4", children: [
                     { type: "div", className: "space-y-2", children: [{ type: "text", value: "Dimensions", className: "font-medium leading-none" }, { type: "text", value: "Set the dimensions for the layer.", className: "text-sm text-muted-foreground" }]},
                     { type: "div", className: "grid gap-2", children: [
                         { type: "div", className: "grid grid-cols-3 items-center gap-4", children: [{ type: "label", value: "Width" }, { type: "input", value: "100%", className: "col-span-2 h-8" }]},
                         { type: "div", className: "grid grid-cols-3 items-center gap-4", children: [{ type: "label", value: "Height" }, { type: "input", value: "25px", className: "col-span-2 h-8" }]},
                     ]}
                 ]}] 
             }
         )
    ),
    'tooltip': () => page("Tooltip", "Hover info.",
         preview("Hover me",
             { type: "tooltip", content: "Add to library", trigger: [{ type: "button", label: "Hover", variant: "outline" }] }
         )
    ),

    // Complex / Charts
    'charts': () => page("Charts", "Data visualizations.",
        preview("Bar Chart",
             { type: "bar-chart", className: "h-[300px]", 
               data: [{name: "Jan", total: 100}, {name: "Feb", total: 150}, {name: "Mar", total: 200}, {name: "Apr", total: 180}], 
               index: "name", categories: ["total"], colors: ["neutral"] }
        )
    ),
    
    // Disclosure
    'accordion': () => page("Accordion", "Vertically stacked set of interactive headings.",
         preview("FAQ",
             { type: "div", className: "w-full max-w-md", children: [
                 { type: "accordion", items: [
                     { value: "item-1", trigger: "Is it accessible?", content: "Yes. It adheres to the WAI-ARIA design pattern." },
                     { value: "item-2", trigger: "Is it styled?", content: "Yes. It comes with default styles that matches the other components' aesthetic." },
                     { value: "item-3", trigger: "Is it animated?", content: "Yes. It's animated by default, but you can disable it if you prefer." }
                 ]}
             ]}
         )
    ),
    
    // Feedback
    'progress': () => page("Progress", "Displays an indicator showing the completion progress of a task.",
         preview("Example",
             { type: "div", className: "w-full max-w-md space-y-4", children: [
                 { type: "progress", value: 33 },
                 { type: "progress", value: 80, className: "h-2" }
             ]}
         )
    )
};

function getTemplate(label, componentType) {
    // 1. Try exact match in map
    const key = componentType;
    if (TEMPLATES[key]) return TEMPLATES[key]();

    // 2. Fallback
    return page(label, `Examples of the ${label} component.`,
        preview("Default",
             { type: "card", className: "p-6", children: [{ type: "text", value: `TODO: Implement ${label} examples` }] }
        )
    );
}

function processMenu(menuItem) {
    if (menuItem.children) {
        menuItem.children.forEach(processMenu);
    } else if (menuItem.path && menuItem.path.startsWith('/')) {
        const filePath = path.join(pagesDir, menuItem.path + '.json');
        const dir = path.dirname(filePath);
        ensureDir(dir);

        // Always overwrite to ensure new designs are applied
        const componentType = menuItem.label.toLowerCase().replace(/\s+/g, '-');
        // Match path end for key (e.g. /form/input -> input)
        const key = menuItem.path.split('/').pop();
        
        console.log(`Generating ${filePath} for ${key}`);
        const content = getTemplate(menuItem.label, key);
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    }
}

appConfig.menu.forEach(processMenu);
console.log('Done generating pages with new designs.');
