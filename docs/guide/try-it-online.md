# Try It Online - Interactive Playground

Experience Object UI without installing anything! This guide shows you different ways to try Object UI online and experiment with schemas in real-time.

## 🎮 Online Playground Options

### Option 1: Official Showcase Website (Recommended)

Visit our hosted showcase to explore all components interactively:

**🔗 [https://showcase.objectui.org](https://showcase.objectui.org)** *(Coming Soon)*

**Features:**
- ✅ No installation required
- ✅ All components available
- ✅ Real-time rendering
- ✅ Copy-paste examples
- ✅ Mobile responsive

### Option 2: CodeSandbox Integration

Create a new Object UI project instantly on CodeSandbox:

**🔗 [Open in CodeSandbox](https://codesandbox.io/s/github/objectstack-ai/objectui-starter)** *(Template Coming Soon)*

**Features:**
- ✅ Full development environment
- ✅ Hot module reload
- ✅ Share your creations
- ✅ Fork and customize

### Option 3: StackBlitz Integration

Try Object UI with StackBlitz's instant IDE:

**🔗 [Open in StackBlitz](https://stackblitz.com/github/objectstack-ai/objectui-starter)** *(Template Coming Soon)*

**Features:**
- ✅ Browser-based VS Code
- ✅ Node.js runtime in browser
- ✅ GitHub integration
- ✅ Instant sharing

## 🚀 Quick Start in the Browser

### 1. Using the Visual Designer

The fastest way to create UIs is with our visual designer:

1. **Visit:** `https://studio.objectui.org` *(Coming Soon)*
2. **Drag and drop** components from the palette
3. **Configure** properties in the right panel
4. **Preview** in real-time
5. **Export** the JSON schema

**Perfect for:**
- Rapid prototyping
- Visual learners
- Non-technical users
- Quick mockups

### 2. Using the Schema Playground

For developers who prefer code:

1. **Visit:** `https://play.objectui.org` *(Coming Soon)*
2. **Write JSON** in the left editor
3. **See results** instantly on the right
4. **Save and share** your schemas

**Perfect for:**
- Learning the schema syntax
- Testing component combinations
- Debugging schemas
- Creating code examples

## 📝 Interactive Examples

While we're setting up the hosted services, you can try these local examples:

### Example 1: Simple Form

```json
{
  "type": "page",
  "title": "Contact Form",
  "body": {
    "type": "card",
    "className": "max-w-md mx-auto mt-8",
    "header": {
      "title": "Get in Touch"
    },
    "body": [
      {
        "type": "input",
        "name": "name",
        "label": "Your Name",
        "placeholder": "John Doe"
      },
      {
        "type": "input",
        "name": "email",
        "label": "Email",
        "inputType": "email",
        "placeholder": "john@example.com"
      },
      {
        "type": "textarea",
        "name": "message",
        "label": "Message",
        "placeholder": "Your message here..."
      },
      {
        "type": "button",
        "label": "Send Message",
        "className": "w-full"
      }
    ]
  }
}
```

**Try it:**
```bash
# Save the JSON above to contact-form.json
# Run it locally:
pnpm dlx @object-ui/cli serve contact-form.json
```

### Example 2: Dashboard

```json
{
  "type": "page",
  "title": "Analytics Dashboard",
  "body": {
    "type": "stack",
    "spacing": 6,
    "children": [
      {
        "type": "grid",
        "columns": 3,
        "gap": 4,
        "items": [
          {
            "type": "card",
            "body": {
              "type": "statistic",
              "title": "Total Users",
              "value": "12,459",
              "trend": "+12%"
            }
          },
          {
            "type": "card",
            "body": {
              "type": "statistic",
              "title": "Revenue",
              "value": "$45,231",
              "trend": "+8%"
            }
          },
          {
            "type": "card",
            "body": {
              "type": "statistic",
              "title": "Orders",
              "value": "1,234",
              "trend": "-3%"
            }
          }
        ]
      }
    ]
  }
}
```

### Example 3: Data Table

```json
{
  "type": "page",
  "title": "Users",
  "body": {
    "type": "card",
    "body": {
      "type": "table",
      "columns": [
        { "key": "name", "title": "Name" },
        { "key": "email", "title": "Email" },
        { "key": "role", "title": "Role" }
      ],
      "data": [
        { "name": "Alice Johnson", "email": "alice@example.com", "role": "Admin" },
        { "name": "Bob Smith", "email": "bob@example.com", "role": "User" },
        { "name": "Carol White", "email": "carol@example.com", "role": "Editor" }
      ]
    }
  }
}
```

## 🎯 Learning Path: Try These Examples in Order

### Beginner Level

1. **Hello World** - A simple text component
2. **Styled Button** - A button with custom Tailwind classes
3. **Basic Form** - Input fields and submission
4. **Card Layout** - Container with header and body

### Intermediate Level

5. **Grid Dashboard** - Multi-column layout with statistics
6. **Tabbed Interface** - Navigation with tabs
7. **Data Table** - Display data in a table
8. **Form with Validation** - Inputs with validation rules

### Advanced Level

9. **Multi-Step Form** - Wizard-style form flow
10. **Kanban Board** - Drag-and-drop interface
11. **Data Visualization** - Charts and graphs
12. **Real-time Dashboard** - Dynamic data updates

## 🛠️ Development Workflow

### Local + Online Hybrid

Combine local development with online sharing:

```bash
# 1. Develop locally
pnpm dev my-app.json

# 2. Test in browser at localhost:3000

# 3. Share via GitHub Gist
# Copy your JSON to: https://gist.github.com

# 4. Load in online playground
# Visit: https://play.objectui.org?gist=YOUR_GIST_ID
```

### GitHub Integration

Connect directly to your repository:

1. **Create** a repository with `app.json`
2. **Visit** `https://play.objectui.org?repo=username/repo`
3. **Edit** and see changes live
4. **Commit** changes back to GitHub

*(Feature coming soon)*

## 📱 Mobile Testing

Test your schemas on mobile devices without deployment:

### Using Tunneling Services

```bash
# Install localtunnel
npm install -g localtunnel

# Run your app locally
pnpm dev my-app.json

# Create public URL
lt --port 3000

# Access the generated URL on any device
```

### Using ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Run your app
pnpm dev my-app.json

# Create tunnel
ngrok http 3000

# Share the ngrok URL
```

## 🔧 Browser DevTools Integration

### Schema Inspector

When running locally, press **F12** to open DevTools:

1. Open the **Console** tab
2. Type: `window.__OBJECT_UI_INSPECTOR__`
3. Inspect the current schema and state

### React DevTools

Install React DevTools extension to:
- Inspect component hierarchy
- View component props
- Debug state changes
- Monitor re-renders

## 💾 Saving and Sharing Your Work

### Export Options

From the online playground:

1. **Download JSON** - Save schema to your computer
2. **Copy to Clipboard** - Quick copy-paste
3. **Share Link** - Generate shareable URL
4. **Export to CodeSandbox** - Continue in full IDE
5. **Export to GitHub** - Create repository

### Embedding

Embed your Object UI creation in your website:

```html
<iframe 
  src="https://play.objectui.org/embed/YOUR_SCHEMA_ID"
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

## 🎓 Learning Resources

### Interactive Tutorials

Follow step-by-step guides in the playground:

1. **Getting Started** - 5-minute intro
2. **Building Forms** - 15-minute tutorial
3. **Layout Mastery** - 20-minute deep dive
4. **Advanced Patterns** - 30-minute workshop

*(Tutorials coming soon to `https://learn.objectui.org`)*

### Video Walkthroughs

Watch and code along:
- **YouTube Channel:** [Object UI Tutorials](https://youtube.com/@objectui)
- **Quick Tips:** 2-minute component showcases
- **Deep Dives:** 15-minute component explorations
- **Live Coding:** Weekly live streams

## 🤝 Community Showcase

Share your creations with the community:

1. **Create** something awesome
2. **Share** on Twitter/X with #ObjectUI
3. **Get featured** in our weekly showcase
4. **Inspire** others

**Community Gallery:** [https://showcase.objectui.org/community](https://showcase.objectui.org/community) *(Coming Soon)*

## 🚀 Next Steps

After trying Object UI online:

1. ✅ **Install locally** - [Installation Guide](./installation.md)
2. ✅ **Read the docs** - [Documentation](./introduction.md)
3. ✅ **Join community** - [GitHub Discussions](https://github.com/objectstack-ai/objectui/discussions)
4. ✅ **Build something** - [Quick Start](./quick-start.md)

## 🐛 Troubleshooting

### Playground Not Loading

- Clear browser cache
- Try incognito/private mode
- Check browser console for errors
- Try a different browser

### Schema Not Rendering

- Validate JSON syntax
- Check for required properties
- Review error messages in console
- Compare with working examples

### Performance Issues

- Reduce number of components
- Use pagination for large lists
- Optimize images
- Check browser DevTools Performance tab

## 📞 Need Help?

- 💬 [Discord Community](https://discord.gg/objectui)
- 🐛 [Report Issues](https://github.com/objectstack-ai/objectui/issues)
- 📧 [Email Support](mailto:support@objectui.org)
- 💡 [Stack Overflow](https://stackoverflow.com/questions/tagged/object-ui)

---

**Ready to start building?** Choose your preferred platform above and start creating!
