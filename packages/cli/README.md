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

### `objectui dev [schema]`

Start a development server with hot reload. Opens browser automatically.

```bash
objectui dev app.json
objectui dev my-schema.json --port 8080
objectui dev --no-open
```

**Arguments:**
- `[schema]` - Path to JSON/YAML schema file (default: `app.json`)

**Options:**
- `-p, --port <port>` - Port to run the server on (default: `3000`)
- `-h, --host <host>` - Host to bind the server to (default: `localhost`)
- `--no-open` - Do not open browser automatically

### `objectui build [schema]`

Build your application for production deployment.

```bash
objectui build app.json
objectui build --out-dir build
objectui build --clean
```

**Arguments:**
- `[schema]` - Path to JSON/YAML schema file (default: `app.json`)

**Options:**
- `-o, --out-dir <dir>` - Output directory (default: `dist`)
- `--clean` - Clean output directory before build

### `objectui start`

Serve the production build locally.

```bash
objectui start
objectui start --port 8080
objectui start --dir build
```

**Options:**
- `-p, --port <port>` - Port to run the server on (default: `3000`)
- `-h, --host <host>` - Host to bind the server to (default: `0.0.0.0`)
- `-d, --dir <dir>` - Directory to serve (default: `dist`)

### `objectui serve [schema]`

Start a development server (legacy command, use `dev` instead).

```bash
objectui serve app.json
objectui serve my-schema.json --port 8080
```

**Arguments:**
- `[schema]` - Path to JSON schema file (default: `app.json`)

**Options:**
- `-p, --port <port>` - Port to run the server on (default: `3000`)
- `-h, --host <host>` - Host to bind the server to (default: `localhost`)

### `objectui lint`

Lint the generated application code using ESLint.

```bash
objectui lint
objectui lint --fix
```

**Options:**
- `--fix` - Automatically fix linting issues

**Note:** Run `objectui dev` first to generate the application before linting.

### `objectui test`

Run tests for the application using Vitest.

```bash
objectui test
objectui test --watch
objectui test --coverage
objectui test --ui
```

**Options:**
- `-w, --watch` - Run tests in watch mode
- `-c, --coverage` - Generate test coverage report
- `--ui` - Run tests with Vitest UI

**Note:** Run `objectui dev` first to generate the application before testing.

## Quick Start

1. Create a new application:
   ```bash
   objectui init my-dashboard --template dashboard
   cd my-dashboard
   ```

2. Start the development server:
   ```bash
   objectui dev app.json
   ```

3. Lint your code (optional):
   ```bash
   objectui lint
   ```

4. Run tests (optional):
   ```bash
   objectui test
   ```

5. Build for production:
   ```bash
   objectui build app.json
   ```

6. Serve the production build:
   ```bash
   objectui start
   ```

Your app will be running at http://localhost:3000!

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
