# Basic Form Example

A beautiful contact form built entirely with JSON schema - no coding required!

## 🎯 What You'll Learn

- How to create forms using JSON schemas
- Tailwind CSS styling with Object UI
- Layout and composition patterns
- Input validation and required fields

## 🚀 Quick Start

From the repository root, run:

```bash
pnpm objectui serve examples/basic-form/app.json
```

Or using npx:

```bash
npx @object-ui/cli serve examples/basic-form/app.json
```

Then open http://localhost:3000 in your browser.

## ✨ Features Demonstrated

- ✅ **Text inputs** - First name, last name, email, phone
- ✅ **Textarea** - Multi-line message input
- ✅ **Form layout** - Grid layouts for responsive design
- ✅ **Buttons** - Primary and outline variants
- ✅ **Card component** - Container with title and description
- ✅ **Gradient backgrounds** - Modern visual design
- ✅ **Tailwind CSS** - Utility-first styling
- ✅ **Shadcn/UI** - Beautiful component primitives

## 📝 Schema Structure

The form is defined in `app.json` using a hierarchical schema:

```json
{
  "type": "div",
  "className": "...",
  "body": {
    "type": "card",
    "body": [
      {
        "type": "input",
        "label": "First Name",
        "required": true
      }
    ]
  }
}
```

## 🎨 Customization

### Change Colors

Modify the `className` properties to use different Tailwind colors:

```json
{
  "className": "bg-gradient-to-r from-blue-600 to-green-600"
}
```

### Add More Fields

Simply add more input objects to the `body` array:

```json
{
  "type": "input",
  "label": "Company",
  "placeholder": "Your company name"
}
```

### Modify Layout

Change grid columns for different layouts:

```json
{
  "className": "grid gap-6 md:grid-cols-3"
}
```

## 📚 Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Protocol Overview](../../docs/protocol/overview.md)
- [Component Reference](../../docs/api/components.md)
- [CLI Guide](../../docs/CLI_GUIDE.md)

## 🔗 Related Examples

- [Dashboard](../dashboard) - Full dashboard with metrics
- [Data Display](../data-display) - Tables, lists, and cards
- [Landing Page](../landing-page) - Marketing page example

---

**Built with ❤️ using [Object UI](https://www.objectui.org)**
