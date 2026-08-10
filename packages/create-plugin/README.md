# @object-ui/create-plugin

CLI tool to quickly scaffold new ObjectUI plugins with best practices.

## Usage

```bash
# Using pnpm
pnpm create @object-ui/plugin my-plugin

# Using npm
npm create @object-ui/plugin my-plugin

# Using npx
npx @object-ui/create-plugin my-plugin
```

## What Gets Generated

The tool creates a complete plugin package structure:

```
packages/plugin-my-plugin/
├── src/
│   ├── index.tsx           # Plugin export & registration
│   ├── MyPluginImpl.tsx    # Component implementation
│   ├── MyPluginImpl.test.tsx # Tests
│   └── types.ts            # Schema definitions
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.setup.ts         # Registers the jest-dom matchers
└── README.md
```

## Features

- ✅ TypeScript support out of the box
- ✅ Vite build configuration
- ✅ Component registration with ComponentRegistry
- ✅ Runnable Vitest setup — jsdom environment, Testing Library and the jest-dom
  matchers are all declared, so `pnpm test` is green on the first run
- ✅ Proper package.json with workspace dependencies
- ✅ README template
- ✅ Type definitions

## Interactive Mode

Run without arguments for interactive prompts:

```bash
pnpm create @object-ui/plugin
```

You'll be prompted for:
- Plugin name
- Description
- Author name

## Options

```bash
pnpm create @object-ui/plugin my-plugin --description "My awesome plugin" --author "Your Name"
```

## After Creation

1. Navigate to the plugin directory:
   ```bash
   cd packages/plugin-my-plugin
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the plugin:
   ```bash
   pnpm build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Links

- 📚 [Documentation](https://www.objectui.org/docs/guide/plugin-development)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/create-plugin)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
