// vite.config.ts
import { defineConfig } from "file:///home/runner/work/objectui/objectui/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.32_lightningcss@1.30.2/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/work/objectui/objectui/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.32_lightningcss@1.30.2_/node_modules/@vitejs/plugin-react/dist/index.js";
import dts from "file:///home/runner/work/objectui/objectui/node_modules/.pnpm/vite-plugin-dts@3.9.1_@types+node@20.19.32_rollup@4.57.1_typescript@5.9.3_vite@5.4.21_@_ae4b0c05a4016cf982a2bb7bb3261b62/node_modules/vite-plugin-dts/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/runner/work/objectui/objectui/packages/plugin-report";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ["src"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "node_modules"],
      skipDiagnostics: true
    })
  ],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "./src"),
      "@object-ui/core": resolve(__vite_injected_original_dirname, "../core/src"),
      "@object-ui/types": resolve(__vite_injected_original_dirname, "../types/src"),
      "@object-ui/react": resolve(__vite_injected_original_dirname, "../react/src"),
      "@object-ui/components": resolve(__vite_injected_original_dirname, "../components/src"),
      "@object-ui/fields": resolve(__vite_injected_original_dirname, "../fields/src")
    }
  },
  build: {
    lib: {
      entry: resolve(__vite_injected_original_dirname, "src/index.tsx"),
      name: "ObjectUIPluginReport",
      fileName: "index"
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "@object-ui/components",
        "@object-ui/core",
        "@object-ui/react",
        "@object-ui/types",
        "tailwind-merge",
        "clsx",
        "lucide-react"
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@object-ui/components": "ObjectUIComponents",
          "@object-ui/core": "ObjectUICore",
          "@object-ui/react": "ObjectUIReact",
          "@object-ui/types": "ObjectUITypes"
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29yay9vYmplY3R1aS9vYmplY3R1aS9wYWNrYWdlcy9wbHVnaW4tcmVwb3J0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29yay9vYmplY3R1aS9vYmplY3R1aS9wYWNrYWdlcy9wbHVnaW4tcmVwb3J0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3JrL29iamVjdHVpL29iamVjdHVpL3BhY2thZ2VzL3BsdWdpbi1yZXBvcnQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgZHRzIGZyb20gJ3ZpdGUtcGx1Z2luLWR0cyc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIGR0cyh7XG4gICAgICBpbnNlcnRUeXBlc0VudHJ5OiB0cnVlLFxuICAgICAgaW5jbHVkZTogWydzcmMnXSxcbiAgICAgIGV4Y2x1ZGU6IFsnKiovKi50ZXN0LnRzJywgJyoqLyoudGVzdC50c3gnLCAnbm9kZV9tb2R1bGVzJ10sXG4gICAgICBza2lwRGlhZ25vc3RpY3M6IHRydWUsXG4gICAgfSksXG4gIF0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAnQG9iamVjdC11aS9jb3JlJzogcmVzb2x2ZShfX2Rpcm5hbWUsICcuLi9jb3JlL3NyYycpLFxuICAgICAgJ0BvYmplY3QtdWkvdHlwZXMnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uL3R5cGVzL3NyYycpLFxuICAgICAgJ0BvYmplY3QtdWkvcmVhY3QnOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uL3JlYWN0L3NyYycpLFxuICAgICAgJ0BvYmplY3QtdWkvY29tcG9uZW50cyc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vY29tcG9uZW50cy9zcmMnKSxcbiAgICAgICdAb2JqZWN0LXVpL2ZpZWxkcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vZmllbGRzL3NyYycpLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgbGliOiB7XG4gICAgICBlbnRyeTogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvaW5kZXgudHN4JyksXG4gICAgICBuYW1lOiAnT2JqZWN0VUlQbHVnaW5SZXBvcnQnLFxuICAgICAgZmlsZU5hbWU6ICdpbmRleCcsXG4gICAgfSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBleHRlcm5hbDogW1xuICAgICAgICAncmVhY3QnLFxuICAgICAgICAncmVhY3QtZG9tJyxcbiAgICAgICAgJ0BvYmplY3QtdWkvY29tcG9uZW50cycsXG4gICAgICAgICdAb2JqZWN0LXVpL2NvcmUnLFxuICAgICAgICAnQG9iamVjdC11aS9yZWFjdCcsXG4gICAgICAgICdAb2JqZWN0LXVpL3R5cGVzJyxcbiAgICAgICAgJ3RhaWx3aW5kLW1lcmdlJyxcbiAgICAgICAgJ2Nsc3gnLFxuICAgICAgICAnbHVjaWRlLXJlYWN0J1xuICAgICAgXSxcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgcmVhY3Q6ICdSZWFjdCcsXG4gICAgICAgICAgJ3JlYWN0LWRvbSc6ICdSZWFjdERPTScsXG4gICAgICAgICAgJ0BvYmplY3QtdWkvY29tcG9uZW50cyc6ICdPYmplY3RVSUNvbXBvbmVudHMnLFxuICAgICAgICAgICdAb2JqZWN0LXVpL2NvcmUnOiAnT2JqZWN0VUlDb3JlJyxcbiAgICAgICAgICAnQG9iamVjdC11aS9yZWFjdCc6ICdPYmplY3RVSVJlYWN0JyxcbiAgICAgICAgICAnQG9iamVjdC11aS90eXBlcyc6ICdPYmplY3RVSVR5cGVzJyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgdGVzdDoge1xuICAgIGdsb2JhbHM6IHRydWUsXG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgc2V0dXBGaWxlczogJy4vdml0ZXN0LnNldHVwLnRzJyxcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVyxTQUFTLG9CQUFvQjtBQUM3WCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxTQUFTO0FBQ2hCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixJQUFJO0FBQUEsTUFDRixrQkFBa0I7QUFBQSxNQUNsQixTQUFTLENBQUMsS0FBSztBQUFBLE1BQ2YsU0FBUyxDQUFDLGdCQUFnQixpQkFBaUIsY0FBYztBQUFBLE1BQ3pELGlCQUFpQjtBQUFBLElBQ25CLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQy9CLG1CQUFtQixRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUNuRCxvQkFBb0IsUUFBUSxrQ0FBVyxjQUFjO0FBQUEsTUFDckQsb0JBQW9CLFFBQVEsa0NBQVcsY0FBYztBQUFBLE1BQ3JELHlCQUF5QixRQUFRLGtDQUFXLG1CQUFtQjtBQUFBLE1BQy9ELHFCQUFxQixRQUFRLGtDQUFXLGVBQWU7QUFBQSxJQUN6RDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLEtBQUs7QUFBQSxNQUNILE9BQU8sUUFBUSxrQ0FBVyxlQUFlO0FBQUEsTUFDekMsTUFBTTtBQUFBLE1BQ04sVUFBVTtBQUFBLElBQ1o7QUFBQSxJQUNBLGVBQWU7QUFBQSxNQUNiLFVBQVU7QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixTQUFTO0FBQUEsVUFDUCxPQUFPO0FBQUEsVUFDUCxhQUFhO0FBQUEsVUFDYix5QkFBeUI7QUFBQSxVQUN6QixtQkFBbUI7QUFBQSxVQUNuQixvQkFBb0I7QUFBQSxVQUNwQixvQkFBb0I7QUFBQSxRQUN0QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBLElBQ0osU0FBUztBQUFBLElBQ1QsYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLEVBQ2Q7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
