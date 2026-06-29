/* ADR-0080: headless dump of the public-tier component manifest.
 * Registers everything the console does, then serializes getPublicConfigs(). */
import '@object-ui/components';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-form';
import '@object-ui/plugin-view';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-report';
import '@object-ui/plugin-tree';
import { ComponentRegistry } from '@object-ui/core';
import { manifestFromConfigs } from '@object-ui/sdui-parser';

const manifest = manifestFromConfigs(ComponentRegistry.getPublicConfigs() as never);
const json = JSON.stringify(manifest, null, 2);
document.getElementById('out')!.textContent = json;
(window as unknown as { __MANIFEST: string }).__MANIFEST = json;
