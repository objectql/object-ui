import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const staticPath = path.join(__dirname, 'dist');

export default {
  staticPath,
  name: '@object-ui/console',
  version: '0.1.0'
};
