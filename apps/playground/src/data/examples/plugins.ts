import codeEditorDemo from './plugins/code-editor-demo.json';
import chartsDemo from './plugins/charts-demo.json';
import markdownDemo from './plugins/markdown-demo.json';
import kanbanDemo from './plugins/kanban-demo.json';
import pluginsShowcase from './plugins/plugins-showcase.json';

export const plugins = {
  'code-editor-demo': JSON.stringify(codeEditorDemo, null, 2),
  'charts-demo': JSON.stringify(chartsDemo, null, 2),
  'markdown-demo': JSON.stringify(markdownDemo, null, 2),
  'kanban-demo': JSON.stringify(kanbanDemo, null, 2),
  'plugins-showcase': JSON.stringify(pluginsShowcase, null, 2)
};
