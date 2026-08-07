# @object-ui/cli

> Standalone CLI for **Object UI** — scaffold, develop, build, lint, test and validate
> JSON/YAML schema-driven applications.

```bash
npm install -g @object-ui/cli
# or one-shot:
npx @object-ui/cli dev app.json
```

## Why standalone?

ObjectUI is a **protocol-agnostic** rendering engine (Rule #1). Its CLI is a
self-contained frontend toolchain — like `vite`, `next`, or `astro` — and is
**not** distributed as a plugin of any meta-CLI.

If you want to aggregate it under another host CLI (e.g. an `os` umbrella),
write a thin wrapper in that host's repo that shells out to `objectui`. Don't
re-shape this package to its conventions.

## Commands

### `objectui init [name]`

Create a new Object UI application with a sample schema.

```bash
objectui init my-app
objectui init my-app --template form
objectui init . --template dashboard
```

**Options**
- `-t, --template <template>` — `simple`, `form`, or `dashboard` (default: `dashboard`)

### `objectui dev [schema]`

Start a development server with hot reload. Opens the browser automatically.

```bash
objectui dev app.json
objectui dev my-schema.json --port 8080
objectui dev --no-open
```

**Options**
- `-p, --port <port>` — default `3000`
- `-h, --host <host>` — default `localhost`
- `--no-open` — do not open browser

### `objectui build [schema]`

Build the application for production.

```bash
objectui build app.json
objectui build --out-dir build
objectui build --clean
```

**Options**
- `-o, --out-dir <dir>` — default `dist`
- `--clean` — clean output directory before build

### `objectui start`

Serve the production build locally.

```bash
objectui start
objectui start --port 8080 --dir build
```

**Options**
- `-p, --port <port>` — default `3000`
- `-h, --host <host>` — default `0.0.0.0`
- `-d, --dir <dir>` — default `dist`

### `objectui serve [schema]`

Legacy alias of `dev` (kept for older scripts).

### `objectui lint`

Lint the generated application code via ESLint.

```bash
objectui lint --fix
```

### `objectui test`

Run the application's tests via Vitest.

```bash
objectui test --watch
objectui test --coverage
objectui test --ui
```

### `objectui generate <type> <name>` (alias `g`)

Generate new resources (`resource`/`object`, `page`, `plugin`).

### `objectui add <component>`

Add a new component renderer to your project.

### `objectui validate [schema]`

Validate a schema file against the ObjectUI specification.

### `objectui check`, `objectui doctor`, `objectui studio`, `objectui analyze`, `objectui create plugin <name>`

Utility commands — see `objectui --help`.

## Quick start

```bash
objectui init my-dashboard --template dashboard
cd my-dashboard
objectui dev app.json
```

## Programmatic API

```ts
import { serve, init } from '@object-ui/cli';

await serve('app.json', { port: '3000', host: 'localhost' });
await init('my-app', { template: 'dashboard' });
```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/utilities/cli)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/cli)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)

## License

MIT — see [LICENSE](./LICENSE).
