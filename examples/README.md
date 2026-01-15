# Object UI Examples

Welcome to the Object UI examples directory! This collection showcases the power of JSON-driven UI development with real-world examples.

## 📚 Example Categories

### 🎯 JSON Schema Examples (New!)

These examples demonstrate the new JSON project specification - pure JSON schemas that can be rendered directly with the Object UI CLI or SchemaRenderer.

| Example | Description | Difficulty | Features |
|---------|-------------|------------|----------|
| [**basic-form**](./basic-form) | Beautiful contact form | ⭐ Beginner | Forms, inputs, validation, buttons |
| [**dashboard**](./dashboard) | Analytics dashboard | ⭐⭐ Intermediate | Metrics, activity feeds, grids |
| [**data-display**](./data-display) | Data visualization patterns | ⭐⭐ Intermediate | Lists, profiles, badges, progress |
| [**landing-page**](./landing-page) | Marketing landing page | ⭐⭐⭐ Advanced | Hero sections, CTAs, full layouts |
| [**cli-demo**](./cli-demo) | CLI demonstration | ⭐ Beginner | Bilingual form, gradient backgrounds |

### 🔧 Integration Examples

| Example | Description | Type |
|---------|-------------|------|
| [**objectql-integration**](./objectql-integration) | ObjectQL backend integration | API Integration |
| [**prototype**](./prototype) | React/Vite prototype app | Full Application |

## 🚀 Quick Start

### Option 1: Use Object UI CLI (Recommended)

```bash
# Install CLI globally
npm install -g @object-ui/cli

# Run any JSON example
objectui serve examples/basic-form/app.json
objectui serve examples/dashboard/app.json
objectui serve examples/landing-page/app.json
```

### Option 2: From Repository Root

```bash
# Using pnpm
pnpm objectui serve examples/basic-form/app.json

# Using npx
npx @object-ui/cli serve examples/dashboard/app.json
```

### Option 3: Run Prototype App

```bash
cd examples/prototype
pnpm install
pnpm dev
```

## 📖 Learning Path

### 1️⃣ **Start Here: Basic Form**
Learn the fundamentals of JSON schemas
- Input components
- Layout patterns
- Styling with Tailwind

```bash
objectui serve examples/basic-form/app.json
```

### 2️⃣ **Next: Data Display**
Explore data visualization patterns
- Lists and cards
- Badges and status indicators
- Progress bars

```bash
objectui serve examples/data-display/app.json
```

### 3️⃣ **Then: Dashboard**
Build complex layouts
- Metric cards
- Activity feeds
- Responsive grids

```bash
objectui serve examples/dashboard/app.json
```

### 4️⃣ **Finally: Landing Page**
Master full-page designs
- Hero sections
- Marketing layouts
- Advanced compositions

```bash
objectui serve examples/landing-page/app.json
```

## 🎨 What You'll Learn

### JSON Schema Patterns
- Component composition
- Layout structures
- Responsive design
- Styling with Tailwind CSS

### Component Types
- **Layout**: `div`, `card`, `flex`
- **Typography**: `text`, headings
- **Forms**: `input`, `textarea`, `button`
- **Data**: `progress`, lists, tables
- **Visual**: `separator`, badges, avatars

### Styling Techniques
- Gradient backgrounds
- Hover effects
- Shadow transitions
- Color schemes
- Responsive breakpoints

## 📂 Example Structure

Each JSON example follows this structure:

```
example-name/
├── app.json          # The main JSON schema
├── README.md         # Detailed documentation
└── .gitignore        # Git ignore file (if needed)
```

## 🎯 Features by Example

### Basic Form
✅ Text inputs and textarea  
✅ Form validation  
✅ Button variants  
✅ Card containers  
✅ Grid layouts  

### Dashboard
✅ Metric cards with trends  
✅ Activity timeline  
✅ Sticky headers  
✅ Color-coded borders  
✅ Hover animations  

### Data Display
✅ User profile cards  
✅ Status badges  
✅ Progress bars  
✅ Task lists  
✅ Achievement displays  

### Landing Page
✅ Hero sections  
✅ Feature grids  
✅ Call-to-action  
✅ Statistics display  
✅ Full-page layouts  
✅ Footer sections  

### CLI Demo
✅ Bilingual support (中文/English)  
✅ Emoji icons  
✅ Gradient backgrounds  
✅ Modern styling  

## 🛠️ Customization

All examples are fully customizable! Edit the `app.json` files to:

- Change colors and styling
- Add or remove components
- Modify layouts
- Adjust content
- Try different patterns

Example:

```json
{
  "type": "button",
  "label": "Click Me",
  "className": "bg-blue-500 hover:bg-blue-600"
}
```

## 📚 Documentation

- [Protocol Overview](../docs/protocol/overview.md)
- [Component Reference](../docs/api/components.md)
- [CLI Guide](../docs/CLI_GUIDE.md)
- [Quick Start](../docs/guide/quick-start.md)

## 🔗 Related Resources

- [Object UI Documentation](https://www.objectui.org)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Shadcn/UI Components](https://ui.shadcn.com)
- [React Documentation](https://react.dev)

## 💡 Tips

1. **Start Simple**: Begin with the basic-form example
2. **Experiment**: Modify the JSON and see changes in real-time
3. **Learn Patterns**: Each example showcases different design patterns
4. **Mix & Match**: Combine components from different examples
5. **Read READMEs**: Each example has detailed documentation

## 🤝 Contributing

Want to add more examples? We'd love your contributions!

1. Create a new directory under `examples/`
2. Add your `app.json` schema
3. Write a comprehensive `README.md`
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## ❓ Need Help?

- [Open an Issue](https://github.com/objectstack-ai/objectui/issues)
- [Join Discussions](https://github.com/objectstack-ai/objectui/discussions)
- [Read the Docs](https://www.objectui.org)

## 📝 License

All examples are released under the [MIT License](../LICENSE).

---

**Built with ❤️ using [Object UI](https://www.objectui.org)**

Start building amazing UIs with JSON today! 🚀
