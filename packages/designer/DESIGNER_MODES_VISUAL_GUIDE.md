# Visual Guide: Designer Modes Comparison

## Overview

Object UI Designer now offers three specialized modes, each optimized for specific design tasks. This guide provides a visual comparison to help you choose the right mode for your needs.

---

## 🎨 Designer Mode Comparison

### 1. Form Designer (`mode="form"`)

**Purpose**: Specialized for building forms with validation and field management

**Visual Identity**:
- Header: Emerald/Teal gradient background
- Branding: `Form Designer` title
- Color Scheme: Green accents for form-focused workflow

**Component Palette**:

```
┌─────────────────────────────┐
│  Form Designer              │
├─────────────────────────────┤
│ Search: [        ] 🔍       │
├─────────────────────────────┤
│ FORM FIELDS                 │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │📝│ │📋│ │☑️│ │🔘│        │
│ └──┘ └──┘ └──┘ └──┘        │
│ input textarea checkbox     │
│                             │
│ ┌──┐ ┌──┐ ┌──┐             │
│ │🔀│ │🔽│ │🏷️│             │
│ └──┘ └──┘ └──┘             │
│ switch select label         │
│                             │
│ FORM ACTIONS                │
│ ┌──┐                        │
│ │🔘│                        │
│ └──┘                        │
│ button                      │
│                             │
│ FORM LAYOUT                 │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │📦│ │📇│ │⚡│ │➖│        │
│ └──┘ └──┘ └──┘ └──┘        │
│ card stack grid separator   │
└─────────────────────────────┘
```

**Typical Use Cases**:
- Contact forms
- User registration
- Data entry forms
- Survey forms
- Login/signup pages

**Component Count**: ~15 components

---

### 2. Layout Designer (`mode="layout"`)

**Purpose**: Specialized for designing page layouts and structures

**Visual Identity**:
- Header: Blue/Indigo gradient background
- Branding: `Page Layout Designer` title
- Color Scheme: Blue accents for structural design

**Component Palette**:

```
┌─────────────────────────────┐
│  Page Layout Designer       │
├─────────────────────────────┤
│ Search: [        ] 🔍       │
├─────────────────────────────┤
│ CONTAINERS                  │
│ ┌──┐ ┌──┐ ┌──┐             │
│ │📦│ │📇│ │⚡│             │
│ └──┘ └──┘ └──┘             │
│ div  card  grid             │
│                             │
│ LAYOUT                      │
│ ┌──┐ ┌──┐                  │
│ │📚│ │➖│                  │
│ └──┘ └──┘                  │
│ stack separator             │
│                             │
│ NAVIGATION                  │
│ ┌──┐ ┌──┐ ┌──┐             │
│ │📑│ │🥖│ │☰│             │
│ └──┘ └──┘ └──┘             │
│ tabs breadcrumb menubar     │
│                             │
│ CONTENT                     │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │📝│ │🖼️│ │🔘│             │
│ └──┘ └──┘ └──┘             │
│ text image button           │
└─────────────────────────────┘
```

**Typical Use Cases**:
- Dashboard layouts
- Landing pages
- Admin panel structures
- Multi-column layouts
- Navigation hierarchies

**Component Count**: ~15 components

---

### 3. General Designer (`mode="general"` or default)

**Purpose**: Full-featured designer for any UI design task

**Visual Identity**:
- Header: Purple/Pink gradient background
- Branding: `General Designer` title
- Color Scheme: Purple accents for versatility

**Component Palette**:

```
┌─────────────────────────────┐
│  General Designer           │
├─────────────────────────────┤
│ Search: [        ] 🔍       │
├─────────────────────────────┤
│ LAYOUT                      │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│ │📦│ │📇│ │📚│ │⚡│ │➖│  │
│ └──┘ └──┘ └──┘ └──┘ └──┘  │
│                             │
│ FORM                        │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│ │📝│ │🔘│ │☑️│ │🔀│ │🔽│  │
│ └──┘ └──┘ └──┘ └──┘ └──┘  │
│                             │
│ DATA DISPLAY                │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐  │
│ │📄│ │🖼️│ │🏷️│ │👤│ │📊│  │
│ └──┘ └──┘ └──┘ └──┘ └──┘  │
│                             │
│ FEEDBACK                    │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │🔔│ │📊│ │💀│ │💬│        │
│ └──┘ └──┘ └──┘ └──┘        │
│                             │
│ OVERLAY                     │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │📱│ │🗃️│ │💭│ │📌│        │
│ └──┘ └──┘ └──┘ └──┘        │
│                             │
│ NAVIGATION                  │
│ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│ │📑│ │🥖│ │📄│ │☰│        │
│ └──┘ └──┘ └──┘ └──┘        │
└─────────────────────────────┘
```

**Typical Use Cases**:
- Complex applications
- Custom components
- Prototyping
- Full-featured UIs
- When you need maximum flexibility

**Component Count**: 30+ components

---

## 🎯 Quick Comparison Table

| Feature | Form Designer | Layout Designer | General Designer |
|---------|--------------|-----------------|------------------|
| **Primary Use** | Forms | Page Layouts | Everything |
| **Complexity** | 🟢 Low | 🟡 Medium | 🔴 High |
| **Components** | 15 | 15 | 30+ |
| **Learning Curve** | Easiest | Easy | Moderate |
| **Specialization** | High | High | None |
| **Flexibility** | Limited | Limited | Maximum |

---

## 💡 Choosing the Right Mode

### Use Form Designer When:
- ✅ Building forms exclusively
- ✅ You need validation-focused tools
- ✅ Working on data entry interfaces
- ✅ Team members are form specialists

### Use Layout Designer When:
- ✅ Designing page structures
- ✅ Creating navigation systems
- ✅ Building dashboard layouts
- ✅ Focusing on responsive grids

### Use General Designer When:
- ✅ Need all component types
- ✅ Building complex applications
- ✅ Prototyping various UI patterns
- ✅ Require maximum flexibility

---

## 🔄 Switching Between Modes

You can easily switch between modes in your code:

```tsx
import { Designer } from '@object-ui/designer';
import { useState } from 'react';

function App() {
  const [mode, setMode] = useState<'form' | 'layout' | 'general'>('general');
  
  return (
    <div>
      {/* Mode selector */}
      <nav>
        <button onClick={() => setMode('form')}>Form</button>
        <button onClick={() => setMode('layout')}>Layout</button>
        <button onClick={() => setMode('general')}>General</button>
      </nav>
      
      {/* Designer with selected mode */}
      <Designer mode={mode} />
    </div>
  );
}
```

---

## 📊 Component Distribution

```
Form Designer Components (15):
├── Form Fields (7): input, textarea, select, checkbox, switch, label, button
├── Layout (4): div, card, stack, grid, separator
└── Display (2): text, badge

Layout Designer Components (15):
├── Containers (3): div, card, grid
├── Layout (2): stack, separator
├── Navigation (4): tabs, breadcrumb, menubar, pagination
├── Content (3): text, image, button
└── Display (3): table, badge, avatar

General Designer Components (30+):
└── All categories: Layout, Form, Data Display, Feedback, Overlay, Navigation
```

---

## 🎨 Visual Differentiation

Each designer mode has distinct visual branding to help users quickly identify which mode they're using:

| Mode | Header Color | Gradient | Icon Theme |
|------|-------------|----------|------------|
| Form | Emerald/Teal | `from-emerald-50 to-teal-50` | 🟢 Green |
| Layout | Blue/Indigo | `from-blue-50 to-indigo-50` | 🔵 Blue |
| General | Purple/Pink | `from-purple-50 to-pink-50` | 🟣 Purple |

---

## 🚀 Best Practices

1. **Start Specialized**: Begin with Form or Layout designer for focused work
2. **Export and Upgrade**: Design in specialized mode, export schema, open in General if needed
3. **Team Workflow**: Assign Form Designer to form specialists, Layout Designer to UI designers
4. **Prototyping**: Use General Designer for initial exploration, then switch to specialized modes
5. **Component Consistency**: Specialized modes encourage using appropriate components for the task

---

## 📚 Related Documentation

- [Specialized Designers Guide](./SPECIALIZED_DESIGNERS.md) - Detailed API documentation
- [Main Designer README](./README.md) - General designer documentation
- [Examples](../../examples/designer-modes/) - Interactive demo application
- [Migration Guide](./SPECIALIZED_DESIGNERS.md#migration-guide) - Upgrading from previous versions
