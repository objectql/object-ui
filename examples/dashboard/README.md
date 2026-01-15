# Dashboard Example

A complete analytics dashboard with metrics, activity feed, and quick actions - built entirely from JSON!

## 🎯 What You'll Learn

- Complex dashboard layouts using JSON schemas
- Metric cards with visual indicators
- Activity feeds with timestamps
- Sticky headers and responsive grids
- Advanced Tailwind CSS patterns

## 🚀 Quick Start

From the repository root, run:

```bash
pnpm objectui serve examples/dashboard/app.json
```

Or using npx:

```bash
npx @object-ui/cli serve examples/dashboard/app.json
```

Then open http://localhost:3000 in your browser.

## ✨ Features Demonstrated

- ✅ **Metric Cards** - Revenue, users, sales, and activity metrics
- ✅ **Sticky Header** - Navigation bar that stays at the top
- ✅ **Activity Feed** - Real-time updates with status indicators
- ✅ **Grid Layouts** - Responsive 4-column and 2-column grids
- ✅ **Color Accents** - Left borders with different colors per card
- ✅ **Hover Effects** - Shadow transitions on cards
- ✅ **Icon Support** - Emoji icons for visual appeal
- ✅ **Quick Actions** - Button list for common tasks
- ✅ **Pro Tips** - Informational callout boxes

## 📊 Dashboard Components

### Metric Cards

Each metric card displays:
- Icon and label
- Large number value
- Trend indicator (↑/↓)
- Percentage change
- Color-coded left border

```json
{
  "type": "card",
  "className": "border-l-4 border-l-blue-500",
  "body": [
    {
      "type": "text",
      "content": "$45,231.89",
      "className": "text-3xl font-bold text-blue-600"
    }
  ]
}
```

### Activity Feed

Timeline-style list with:
- Status dots (colored indicators)
- Activity title
- Description text
- Timestamp
- Border separators

### Quick Actions

List of actionable buttons:
- Full-width buttons
- Left-aligned text
- Icon prefixes
- Outline variant

## 🎨 Customization

### Change Metric Values

Edit the `content` properties in the metric cards:

```json
{
  "type": "text",
  "content": "$99,999.99",
  "className": "text-3xl font-bold text-blue-600"
}
```

### Modify Colors

Change the border and text colors:

```json
{
  "className": "border-l-4 border-l-red-500"
}
```

Available colors: blue, green, purple, orange, red, pink, etc.

### Add More Metrics

Duplicate a card object and modify its content:

```json
{
  "type": "card",
  "className": "shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-yellow-500",
  "body": [...]
}
```

### Adjust Grid Columns

Change the number of columns:

```json
{
  "className": "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
}
```

## 📚 Advanced Patterns

### Sticky Header

```json
{
  "type": "div",
  "className": "sticky top-0 z-50 shadow-sm"
}
```

### Responsive Grid

```json
{
  "className": "grid gap-4 md:grid-cols-2 lg:grid-cols-4"
}
```

This creates:
- 1 column on mobile
- 2 columns on tablet (md)
- 4 columns on desktop (lg)

### Hover Effects

```json
{
  "className": "hover:shadow-md transition-shadow"
}
```

## 📚 Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Protocol Overview](../../docs/protocol/overview.md)
- [Component Reference](../../docs/api/components.md)
- [Tailwind CSS Grid](https://tailwindcss.com/docs/grid-template-columns)

## 🔗 Related Examples

- [Basic Form](../basic-form) - Contact form example
- [Data Display](../data-display) - Tables and lists
- [Landing Page](../landing-page) - Marketing page

---

**Built with ❤️ using [Object UI](https://www.objectui.org)**
