# @object-ui/plugin-ai

AI-powered components for Object UI — form assistance, recommendations, and natural language queries.

## Features

- 🤖 **AI Form Assist** - Intelligent field suggestions and auto-fill for forms
- 💡 **AI Recommendations** - Display AI-generated recommendations in list, grid, or carousel layouts
- 🗣️ **Natural Language Query** - Let users query data using natural language
- 📦 **Auto-registered** - Components register with `ComponentRegistry` on import
- 🎯 **Type-Safe** - Full TypeScript support

## Installation

```bash
npm install @object-ui/plugin-ai
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0
- `@object-ui/core`

## Quick Start

```tsx
import { AIFormAssist, AIRecommendations, NLQueryInput } from '@object-ui/plugin-ai';

function SmartForm() {
  return (
    <div>
      <AIFormAssist
        formId="new-contact"
        objectName="Contact"
        fields={['name', 'email', 'company']}
        showConfidence
      />
    </div>
  );
}

function RecommendationsPanel() {
  return (
    <AIRecommendations
      objectName="Product"
      maxResults={5}
      layout="grid"
      recommendations={recommendationsData}
    />
  );
}

function SearchBar() {
  return (
    <NLQueryInput
      objectName="Order"
      placeholder="Ask a question about your orders..."
      suggestions={['Show orders from last week', 'Top customers by revenue']}
    />
  );
}
```

## API

### AIFormAssist

AI-powered form field suggestions and auto-fill:

```tsx
<AIFormAssist
  formId="new-lead"
  objectName="Lead"
  fields={['name', 'email', 'phone']}
  autoFill={false}
  showConfidence
  showReasoning={false}
/>
```

### AIRecommendations

Display AI-generated recommendations:

```tsx
<AIRecommendations
  objectName="Product"
  recommendations={data}
  maxResults={10}
  layout="list"       // 'list' | 'grid' | 'carousel'
  showScores={false}
  emptyMessage="No recommendations available"
/>
```

### NLQueryInput

Natural language query input for data exploration:

```tsx
<NLQueryInput
  objectName="Order"
  placeholder="Ask anything..."
  suggestions={['Recent orders', 'Revenue by month']}
  showHistory={false}
/>
```

### Schema-Driven Usage

Components auto-register with `ComponentRegistry`:

```json
{
  "type": "ai-form-assist",
  "formId": "new-contact",
  "objectName": "Contact",
  "fields": ["name", "email"],
  "showConfidence": true
}
```

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-ai)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-ai)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
