import { SchemaRenderer } from './index';
import type { SchemaNode } from '@object-ui/protocol';

export const renderChildren = (children: SchemaNode | SchemaNode[] | undefined) => {
  if (!children) return null;
  if (Array.isArray(children)) {
    return children.map((child, idx) => <SchemaRenderer key={idx} schema={child} />);
  }
  return <SchemaRenderer schema={children} />;
};
