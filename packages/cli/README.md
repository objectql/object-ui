# Object UI CLI

CLI tool for Object UI - Build applications from JSON schemas.

## Installation

```bash
npm install -g @object-ui/cli
```

Or use with npx:

```bash
npx @object-ui/cli serve app.json
```

## Commands

### `objectui init [name]`

Create a new Object UI application with a sample schema.

```bash
objectui init my-app
objectui init my-app --template form
objectui init . --template dashboard
```

**Options:**
- `-t, --template <template>` - Template to use: `simple`, `form`, or `dashboard` (default: `dashboard`)

**Templates:**
- **simple**: A minimal getting started template
- **form**: A contact form with validation
- **dashboard**: A full dashboard with metrics and charts

### `objectui serve [schema]`

Start a development server to render your JSON schema.

```bash
objectui serve app.json
objectui serve my-schema.json --port 8080
```

**Arguments:**
- `[schema]` - Path to JSON schema file (default: `app.json`)

**Options:**
- `-p, --port <port>` - Port to run the server on (default: `3000`)
- `-h, --host <host>` - Host to bind the server to (default: `localhost`)

## Quick Start

1. Create a new application:
   ```bash
   objectui init my-dashboard --template dashboard
   cd my-dashboard
   ```

2. Start the development server:
   ```bash
   objectui serve app.json
   ```

3. Open http://localhost:3000 in your browser

4. Edit `app.json` to customize your application

## Example Schema

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center",
  "body": {
    "type": "card",
    "title": "Hello World",
    "body": {
      "type": "text",
      "content": "Welcome to Object UI!"
    }
  }
}
```

## Learn More

- [Object UI Documentation](https://www.objectui.org)
- [Schema Reference](https://www.objectui.org/docs/protocol/overview)
- [Component Library](https://www.objectui.org/docs/api/components)

## License

MIT
