
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
console.log(`Working directory: ${root}`);

const files = {
    'examples/crm-app/src/mocks/browser.ts': `
import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { config as crmConfig } from '@object-ui/example-crm';
import { http, HttpResponse } from 'msw';

let kernel: ObjectKernel | null = null;

export async function startMockServer() {
  if (kernel) return kernel;

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  const driver = new InMemoryDriver();

  // Create kernel with MiniKernel architecture
  kernel = new ObjectKernel();
  
  kernel
    // Register ObjectQL engine
    .use(new ObjectQLPlugin())
    // Register the driver
    .use(new DriverPlugin(driver, 'memory'))
    // Load app config as a plugin
    .use(new AppPlugin(crmConfig))
    // MSW Plugin (intercepts network requests)
    .use(new MSWPlugin({
      enableBrowser: true,
      baseUrl: '/api/v1',
      logRequests: true,
      customHandlers: [
          // Custom handlers that are not part of standard CRUD
          http.get('/api/bootstrap', async () => {
             try {
                // Use IDataEngine interface directly via driver
                // const user = (await driver.findOne('user', 'current')) || {};
                const contacts = await driver.find('contact', { object: 'contact' });
                const opportunities = await driver.find('opportunity', { object: 'opportunity' });
                const stats = { revenue: 125000, leads: 45, deals: 12 };

                return HttpResponse.json({
                    user: { name: "Demo User", role: "admin" }, // simple mock
                    stats,
                    contacts,
                    opportunities
                });
             } catch (e) {
                 console.error(e);
                 return new HttpResponse(null, { status: 500 });
             }
          })
      ]
    }));
  
  await kernel.bootstrap();

  // Seed Data
  await initializeMockData(driver);
  
  return kernel;
}

// Helper to seed data into the in-memory driver
async function initializeMockData(driver: InMemoryDriver) {
    console.log('[MockServer] Initializing mock data from manifest...');
    
    // @ts-ignore
    const manifest = crmConfig.manifest;
    if (manifest && manifest.data) {
        for (const dataSet of manifest.data) {
            console.log(\`[MockServer] Seeding \${dataSet.object}...\`);
            if (dataSet.records) {
                for (const record of dataSet.records) {
                    await driver.create(dataSet.object, record);
                }
            }
        }
    }
}
`,
    'examples/crm-app/src/client.ts': `
import { ObjectStackClient } from '@objectstack/client';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

// Correct Configuration: baseUrl should be empty string when using MSW to intercept relative paths
// The MSWPlugin is mounted at /api/v1, so request to '/api/v1/...' are intercepted.
const CONFIG = {
  baseUrl: '', 
  fetch: globalThis.fetch.bind(globalThis)
};

export const client = new ObjectStackClient(CONFIG);

export const dataSource = new ObjectStackAdapter({
    ...CONFIG,
    token: 'mock-token'
});

export const initClient = async () => {
    console.log('[Client] Initializing connection to ObjectStack...');
    await Promise.all([
        client.connect(),
        dataSource.connect()
    ]);
    console.log('[Client] Connected and Ready');
}
`,
    'examples/crm-app/src/main.tsx': `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { startMockServer } from './mocks/browser';
import { initClient } from './client';

async function bootstrap() {
  // 1. Start MSW Mock Server (Critical: Must be first)
  if (process.env.NODE_ENV === 'development') {
    console.log('🛑 Bootstrapping Mock Server...');
    await startMockServer();
  }

  // 2. Initialize Clients (Must happen AFTER MSW is ready)
  // This ensures discovery requests (/api/v1/metadata) are intercepted by MSW
  // instead of falling through to the Vite Dev Server (which returns 404 HTML).
  console.log('🔌 Connecting Clients...');
  await initClient(); 

  // 3. Render React App
  console.log('🚀 Rendering App...');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch(err => {
    console.error("FATAL: Application failed to start", err);
    document.body.innerHTML = \`<div style="color:red; padding: 20px;"><h1>Application Error</h1><pre>\${err.message}</pre></div>\`;
});
`
};

// 1. Write core files
console.log('Writing corrected source files...');
for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim());
    console.log(`✅ Updated ${filePath}`);
}

// 2. Remove problematic files
const filesToRemove = [
    'examples/crm-app/src/config/dataSource.ts',
    'examples/crm-app/src/mocks/runtime.ts'
];
console.log('Cleaning up obsolete files...');
for (const f of filesToRemove) {
    const fullPath = path.join(root, f);
    if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️  Deleted ${f}`);
    }
}

// 3. Fix Imports in App.tsx
console.log('Fixing imports in App.tsx...');
const appTsxPath = path.join(root, 'examples/crm-app/src/App.tsx');
if (fs.existsSync(appTsxPath)) {
    let content = fs.readFileSync(appTsxPath, 'utf-8');
    
    // Remove old import
    content = content.replace(/import\s+{\s*dataSource\s*}\s*from\s*['"].\/config\/dataSource['"];?/g, '');
    
    // Ensure new import exists
    if (!content.includes(`import { client, dataSource } from './client'`)) {
        // Replace known import or add top level
        if (content.includes(`import { client } from './client'`)) {
            content = content.replace(`import { client } from './client'`, `import { client, dataSource } from './client'`);
        } else {
             // Fallback: Add to top
             const lines = content.split('\n');
             let lastImportIdx = -1;
             for(let i=0; i<lines.length; i++) {
                 if(lines[i].trim().startsWith('import')) lastImportIdx = i;
             }
             lines.splice(lastImportIdx + 1, 0, `import { client, dataSource } from './client';`);
             content = lines.join('\n');
        }
    }
    fs.writeFileSync(appTsxPath, content);
    console.log(`✅ Patched App.tsx`);
}

// 4. Verify Build
console.log('Verifying build...');
try {
    execSync('pnpm --filter @examples/crm-app build', { stdio: 'inherit', cwd: root });
    console.log('🎉 BUILD SUCCESSFUL! The application files are now consistent.');
} catch (e) {
    console.error('❌ BUILD FAILED. Please review the errors above.');
    process.exit(1);
}
