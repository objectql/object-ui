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
└── README.md
```

## Features

- ✅ TypeScript support out of the box
- ✅ Vite build configuration
- ✅ Component registration with ComponentRegistry
- ✅ Test setup with Vitest
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

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/guide/plugin-development)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/create-plugin)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
