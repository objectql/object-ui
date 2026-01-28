
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'packages/components/shadcn-components.json');

try {
  const data = fs.readFileSync(filePath, 'utf8');
  // Replace old registry URL with new one
  const updatedData = data.replace(/https:\/\/ui\.shadcn\.com\/registry\/styles\//g, 'https://ui.shadcn.com/r/styles/');
  
  fs.writeFileSync(filePath, updatedData, 'utf8');
  console.log('Successfully updated registry URLs in shadcn-components.json');
} catch (err) {
  console.error('Error updating file:', err);
  process.exit(1);
}
