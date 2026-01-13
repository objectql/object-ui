const fs = require('fs');
const path = require('path');

const uiDir = path.resolve('packages/components/src/ui');
const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'));

const exports = files.map(f => {
  const name = f.replace('.tsx', '');
  return `export * from './${name}';`;
}).join('\n');

fs.writeFileSync(path.join(uiDir, 'index.ts'), exports);
console.log('Created packages/components/src/ui/index.ts');
