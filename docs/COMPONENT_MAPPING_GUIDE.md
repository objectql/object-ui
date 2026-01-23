# ObjectUI vs Shadcn: Component Mapping Guide

**Quick Reference**: Understanding the relationship between ObjectUI Renderer and Shadcn UI components

---

## Conceptual Distinction

### Shadcn UI Components
- 📦 **Pure UI Component Library**
- 🎨 Built on Radix UI + Tailwind CSS
- 💻 Requires writing React code
- 🔧 Controlled via Props

### ObjectUI Renderer
- 🔄 **Schema Interpreter**
- 📋 JSON configuration-driven
- 🚀 Zero-code usage
- 🔗 Automatic data binding and validation

---

## One-to-One Mapping

| Shadcn UI | ObjectUI Renderer | Enhanced Features |
|-----------|---------------|---------|
| `<Input />` | `{ type: "input" }` | ✅ Expressions, ✅ Validation, ✅ Data Binding |
| `<Button />` | `{ type: "button" }` | ✅ Action Mapping, ✅ Loading States |
| `<Select />` | `{ type: "select" }` | ✅ Dynamic Options, ✅ Remote Search |
| `<Dialog />` | `{ type: "dialog" }` | ✅ Conditional Display, ✅ Form Integration |
| `<Table />` | `{ type: "table" }` | ✅ Basic Table Rendering |
| `<Card />` | `{ type: "card" }` | ✅ Dynamic Content, ✅ Action Buttons |
| `<Form />` | `{ type: "form" }` | ✅ Validation Engine, ✅ Submit Handling |
| `<Tabs />` | `{ type: "tabs" }` | ✅ Dynamic Tabs, ✅ Lazy Loading |
| `<Badge />` | `{ type: "badge" }` | ✅ Status Mapping, ✅ Color Rules |
| `<Alert />` | `{ type: "alert" }` | ✅ Conditional Display, ✅ Auto-dismiss |

---

## ObjectUI Exclusive Components

These components have no direct Shadcn counterparts and are advanced business components unique to ObjectUI:

| Component | Type | Purpose |
|------|------|------|
| **data-table** | Complex Component | Advanced table with sorting/filtering/pagination |
| **timeline** | Complex Component | Timeline/Gantt chart |
| **filter-builder** | Complex Component | Visual query builder |
| **chatbot** | Complex Component | Chatbot interface |
| **tree-view** | Data Display | Tree structure |
| **statistic** | Data Display | Statistical metric cards |

---

## Usage Comparison

### Scenario 1: Simple Form

#### Shadcn Approach (React Code)
```tsx
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <Input 
        value={email} 
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <Input 
        type="password"
        value={password} 
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
      />
      <Button type="submit">Login</Button>
    </form>
  );
}
```

#### ObjectUI Approach (JSON Schema)
```json
{
  "type": "form",
  "api": "/api/login",
  "fields": [
    {
      "name": "email",
      "type": "input",
      "inputType": "email",
      "placeholder": "Email",
      "required": true
    },
    {
      "name": "password",
      "type": "input",
      "inputType": "password",
      "placeholder": "Password",
      "required": true
    }
  ],
  "actions": [
    {
      "type": "button",
      "label": "Login",
      "actionType": "submit"
    }
  ]
}
```

### Scenario 2: Data Table

#### Shadcn Approach
```tsx
import { Table } from '@/ui/table';

function UserTable() {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('name');
  
  useEffect(() => {
    fetchUsers(page, sort).then(setUsers);
  }, [page, sort]);
  
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead onClick={() => setSort('name')}>Name</TableHead>
            <TableHead onClick={() => setSort('email')}>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map(user => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination page={page} onChange={setPage} />
    </div>
  );
}
```

#### ObjectUI Approach
```json
{
  "type": "data-table",
  "api": "/api/users",
  "columns": [
    {
      "name": "name",
      "label": "Name",
      "sortable": true
    },
    {
      "name": "email",
      "label": "Email",
      "sortable": true
    }
  ],
  "pagination": {
    "pageSize": 20
  }
}
```

---

## Selection Guide

### Use Shadcn UI (Direct Native Components)
✅ Highly customized interaction logic required  
✅ Complex component behavior difficult to express in Schema  
✅ Performance-critical optimization (avoid Schema parsing overhead)  
✅ Existing large React component codebase  

### Use ObjectUI Renderer (Recommended)
✅ Rapidly build data management interfaces  
✅ Configuration-driven, easy to maintain  
✅ Dynamic UI required (fetch configuration from server)  
✅ Low-code/No-code platforms  
✅ AI-generated UI  

---

## Hybrid Approach

ObjectUI supports embedding custom React components within Schema:

```json
{
  "type": "page",
  "body": [
    {
      "type": "card",
      "title": "User Statistics",
      "body": {
        "type": "custom",
        "component": "CustomChart",
        "props": {
          "data": "${chartData}"
        }
      }
    },
    {
      "type": "data-table",
      "api": "/api/users"
    }
  ]
}
```

```tsx
// Register custom component
import { registerRenderer } from '@object-ui/react';
import CustomChart from './CustomChart';

registerRenderer('custom', ({ schema }) => {
  const Component = schema.component; // "CustomChart"
  return <CustomChart {...schema.props} />;
});
```

---

## Frequently Asked Questions

### Q: How is ObjectUI Renderer performance?
A: Compared to using Shadcn directly, there is a slight overhead (<10%), but with virtualization and caching optimizations, the difference is negligible in real-world applications.

### Q: Can I override ObjectUI Renderer styles?
A: Yes! You can override styles by passing Tailwind class names via the `className` property.

### Q: How do I extend components not supported by ObjectUI?
A: Use `registerRenderer` to register custom renderers, or use `type: "custom"` to embed React components.

### Q: Does ObjectUI Renderer support TypeScript?
A: Full support! All Schemas have complete TypeScript type definitions.

---

## Additional Resources

- 📚 [Component API Documentation](./components/)
- 🎨 [Storybook Examples](https://storybook.objectui.org)
- 🔧 [Custom Renderer Guide](./guide/custom-renderers.md)
- 💡 [Best Practices](./community/best-practices.md)

---

*Last Updated: 2026-01-23*
