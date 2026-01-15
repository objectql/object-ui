# Landing Page Example

A complete marketing landing page built entirely with JSON - perfect for showcasing products and features!

## 🎯 What You'll Learn

- Hero sections with call-to-action buttons
- Feature cards with icons
- Statistics/metrics display
- Code comparison sections
- Gradient backgrounds and effects
- Full-page layouts
- Footer sections

## 🚀 Quick Start

From the repository root, run:

```bash
pnpm objectui serve examples/landing-page/app.json
```

Or using npx:

```bash
npx @object-ui/cli serve examples/landing-page/app.json
```

Then open http://localhost:3000 in your browser.

## ✨ Features Demonstrated

- ✅ **Hero Section** - Large header with gradient background
- ✅ **Feature Cards** - 3-column grid with hover effects
- ✅ **Code Comparison** - Before/after code examples
- ✅ **Statistics** - Metrics cards with numbers
- ✅ **CTA Section** - Call-to-action with code snippet
- ✅ **Footer** - Simple footer with links
- ✅ **Gradient Backgrounds** - Multiple gradient styles
- ✅ **Hover Animations** - Scale and shadow effects
- ✅ **Responsive Layout** - Mobile-friendly design

## 📐 Page Structure

### 1. Hero Section
Gradient background with large heading and CTA buttons

### 2. Features Section
Three-column grid showcasing benefits

### 3. Code Comparison
Side-by-side comparison of traditional vs Object UI approach

### 4. Social Proof
Statistics showing metrics (users, components, coverage, size)

### 5. CTA Section
Final call-to-action with installation instructions

### 6. Footer
Links and copyright information

## 🎨 Customization

### Change Hero Colors

Modify the gradient in the hero section:

```json
{
  "className": "bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600"
}
```

### Update Feature Cards

Change icons, titles, and descriptions:

```json
{
  "type": "text",
  "content": "🎯",
  "className": "text-5xl"
},
{
  "type": "text",
  "content": "Your Feature",
  "className": "text-2xl font-bold"
}
```

### Modify Statistics

Update the numbers and labels:

```json
{
  "type": "text",
  "content": "25K+",
  "className": "text-4xl font-bold text-blue-600 mb-2"
},
{
  "type": "text",
  "content": "Happy Users",
  "className": "text-sm text-muted-foreground"
}
```

### Add More Sections

Insert new sections between existing ones:

```json
{
  "type": "div",
  "className": "container mx-auto px-6 py-20",
  "body": [
    {
      "type": "card",
      "title": "New Section",
      "body": { ... }
    }
  ]
}
```

## 📚 Design Patterns

### Full-Width Gradient Header

```json
{
  "type": "div",
  "className": "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600",
  "body": {
    "type": "div",
    "className": "container mx-auto px-6 py-20"
  }
}
```

### Feature Card with Hover Effect

```json
{
  "type": "card",
  "className": "shadow-2xl border-0 bg-gradient-to-br from-blue-50 to-cyan-50 hover:scale-105 transition-transform"
}
```

### Code Block Display

```json
{
  "type": "div",
  "className": "bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200",
  "body": {
    "type": "div",
    "className": "font-mono text-sm space-y-1"
  }
}
```

### Backdrop Blur Effect

```json
{
  "className": "bg-black/30 backdrop-blur-lg rounded-2xl p-8 border border-white/20"
}
```

## 🎨 Color Themes

### Primary Gradient (Purple-Pink)
```
from-indigo-600 via-purple-600 to-pink-600
```

### Feature Card Gradients
- Blue: `from-blue-50 to-cyan-50`
- Purple: `from-purple-50 to-pink-50`
- Green: `from-green-50 to-emerald-50`

### Background Gradients
- Slate: `from-slate-50 to-gray-100`
- Warm: `from-orange-50 to-red-50`

## 📊 Sections Breakdown

### Hero (Lines 1-50)
- Gradient background
- Large heading
- Description text
- Two CTA buttons

### Features (Lines 51-120)
- Section heading
- 3-column grid
- Feature cards with icons

### Comparison (Lines 121-180)
- Side-by-side code
- Visual differentiation
- Before/after pattern

### Stats (Lines 181-220)
- 4-column grid
- Large numbers
- Small labels

### Final CTA (Lines 221-270)
- Code snippet
- Installation commands
- Action buttons

### Footer (Lines 271-290)
- Links
- Copyright
- Dark background

## 📚 Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Protocol Overview](../../docs/protocol/overview.md)
- [Page Components](../../docs/protocol/page.md)
- [Tailwind Gradients](https://tailwindcss.com/docs/gradient-color-stops)

## 🔗 Related Examples

- [Dashboard](../dashboard) - Analytics interface
- [Basic Form](../basic-form) - Contact form
- [Data Display](../data-display) - Lists and cards

---

**Built with ❤️ using [Object UI](https://www.objectui.org)**
