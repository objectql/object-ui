# Object UI Documentation Site (Fumadocs Migration - In Progress)

This is the official documentation site for Object UI, being migrated to [Fumadocs](https://fumadocs.vercel.app/).

## Status

🚧 **Work in Progress** - The site structure is complete but there are issues with the fumadocs source API integration that need to be resolved.

### Completed
- ✅ Next.js 15 + TypeScript setup
- ✅ Tailwind CSS configuration  
- ✅ Fumadocs UI integration
- ✅ MDX content processing
- ✅ Basic documentation pages created
- ✅ Homepage and layout structure

### Known Issues
- ⚠️ Route generation not working - investigating fumadocs 15.x API changes
- The `.source` output from fumadocs-mdx needs proper integration with loader
- `createMDXSource` API compatibility issue with runtime-processed docs/meta

## Development

```bash
# Install dependencies
pnpm install

# Start development server (NOTE: routes currently return 404)
pnpm dev

# Build for production
pnpm build
```

## Project Structure

```
apps/site/
├── app/                  # Next.js app directory
│   ├── docs/            # Documentation pages
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Homepage
├── content/             # MDX documentation content
│   └── docs/            # Documentation markdown files
├── lib/                 # Library code
│   └── source.ts        # Fumadocs source configuration
├── public/              # Static assets
├── next.config.mjs      # Next.js configuration
├── tailwind.config.ts   # Tailwind CSS configuration
└── source.config.ts     # Fumadocs MDX configuration
```

## Technical Notes

The fumadocs-mdx compiler generates a `.source` directory with processed docs and meta exports. These are wrapped by `_runtime.doc()` and `_runtime.meta()` functions. The correct integration with fumadocs-core's `loader` and `createMDXSource` needs investigation based on fumadocs 15.x API.

## Next Steps

1. Investigate correct fumadocs 15.x API for integrating `.source` exports
2. Fix route generation to resolve 404 errors
3. Add search functionality
4. Migrate remaining documentation content
5. Set up deployment

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [Fumadocs](https://fumadocs.vercel.app/) - Documentation framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type safety

