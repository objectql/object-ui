# Data Display Example

Showcase of various data display patterns - profiles, lists, progress bars, badges, and more!

## 🎯 What You'll Learn

- User profile cards with avatars
- Task lists with status indicators
- Progress bars and statistics
- Achievement badges
- Status badges and labels
- Hover effects and transitions

## 🚀 Quick Start

From the repository root, run:

```bash
pnpm objectui serve examples/data-display/app.json
```

Or using npx:

```bash
npx @object-ui/cli serve examples/data-display/app.json
```

Then open http://localhost:3000 in your browser.

## ✨ Features Demonstrated

- ✅ **User Profiles** - Avatar circles with gradient backgrounds
- ✅ **Status Badges** - Color-coded pills (Active, Premium, etc.)
- ✅ **Task Lists** - Checkboxes with border accents
- ✅ **Progress Bars** - Visual representation of metrics
- ✅ **Achievement Cards** - Badge display with icons
- ✅ **Hover Effects** - Interactive state changes
- ✅ **Color Coding** - Different colors for different states
- ✅ **Responsive Grids** - Adaptive layouts

## 📊 Component Patterns

### User Profile Card

```json
{
  "type": "div",
  "className": "flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg",
  "body": [
    {
      "type": "div",
      "className": "w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold",
      "body": { "type": "text", "content": "JD" }
    }
  ]
}
```

### Status Badge

```json
{
  "type": "div",
  "className": "px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full",
  "body": { "type": "text", "content": "✓ Active" }
}
```

### Task Item with Border Accent

```json
{
  "type": "div",
  "className": "flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg border-l-4 border-l-green-500"
}
```

### Progress Bar

```json
{
  "type": "div",
  "className": "space-y-2",
  "body": [
    {
      "type": "div",
      "className": "flex items-center justify-between",
      "body": [
        { "type": "text", "content": "Completion Rate", "className": "text-sm font-medium" },
        { "type": "text", "content": "85%", "className": "text-sm font-bold text-green-600" }
      ]
    },
    {
      "type": "progress",
      "value": 85,
      "className": "h-2"
    }
  ]
}
```

## 🎨 Color Schemes

### Status Colors

- **Green** (`green-500`) - Success, completed, active
- **Blue** (`blue-500`) - In progress, information
- **Orange** (`orange-500`) - Warning, pending
- **Red** (`red-500`) - Error, urgent
- **Purple** (`purple-500`) - Premium, special

### Gradient Backgrounds

```json
{
  "className": "bg-gradient-to-r from-blue-50 to-cyan-50"
}
```

Available gradients:
- `from-blue-50 to-cyan-50` - Cool blue
- `from-purple-50 to-pink-50` - Warm purple
- `from-indigo-50 to-purple-50` - Deep indigo
- `from-yellow-50 to-orange-50` - Warm yellow

## 🎨 Customization

### Change Avatar Initials

```json
{
  "type": "text",
  "content": "AB"
}
```

### Modify Task Status

Change the border color and status text:

```json
{
  "className": "border-l-4 border-l-purple-500"
}
```

### Adjust Progress Values

Change the `value` property (0-100):

```json
{
  "type": "progress",
  "value": 65
}
```

### Add More Profiles

Duplicate a profile card and modify:

```json
{
  "type": "div",
  "className": "flex items-center gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100",
  "body": [
    {
      "type": "div",
      "className": "w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-2xl font-bold",
      "body": { "type": "text", "content": "XY" }
    }
  ]
}
```

## 📚 Advanced Techniques

### Hover Transitions

```json
{
  "className": "hover:bg-gray-50 transition-colors"
}
```

### Box Shadows

```json
{
  "className": "shadow-xl"
}
```

### Border Accents

```json
{
  "className": "border-l-4 border-l-blue-500"
}
```

## 📚 Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Progress Component](../../docs/api/components.md#progress)
- [Card Component](../../docs/api/components.md#card)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)

## 🔗 Related Examples

- [Dashboard](../dashboard) - Metrics and analytics
- [Basic Form](../basic-form) - Form inputs
- [Landing Page](../landing-page) - Marketing content

---

**Built with ❤️ using [Object UI](https://www.objectui.org)**
