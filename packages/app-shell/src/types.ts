import type { ReactNode } from 'react';

/**
 * Generic data source interface
 * Third-party systems can implement this to connect their own backends
 */
export interface DataSource {
  find(objectName: string, params?: any): Promise<any>;
  findOne(objectName: string, id: string, params?: any): Promise<any>;
  create(objectName: string, data: any): Promise<any>;
  update(objectName: string, id: string, data: any): Promise<any>;
  delete(objectName: string, id: string): Promise<void>;
  getMetadata?(): Promise<any>;
  [key: string]: any; // Allow additional methods
}

export interface AppShellProps {
  /** Sidebar component (optional) */
  sidebar?: ReactNode;
  /** Header component (optional) */
  header?: ReactNode;
  /** Footer component (optional) */
  footer?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Custom className */
  className?: string;
}

export interface ObjectRendererProps {
  /** Object API name */
  objectName: string;
  /** View ID (optional) */
  viewId?: string;
  /** Data source for CRUD operations */
  dataSource: DataSource;
  /** Callback when a record is clicked */
  onRecordClick?: (record: any) => void;
  /** Callback when edit is triggered */
  onEdit?: (record: any) => void;
  /** Object metadata (optional, will fetch if not provided) */
  objectDef?: any;
  /** Refresh key to force re-render */
  refreshKey?: number;
}

export interface DashboardRendererProps {
  /** Dashboard schema */
  schema: any;
  /** Data source for widgets */
  dataSource: DataSource;
  /** Dashboard name */
  dashboardName?: string;
}

export interface PageRendererProps {
  /** Page schema */
  schema: any;
  /** Page name */
  pageName?: string;
}

export interface FormRendererProps {
  /** Form schema */
  schema: any;
  /** Data source for form submission */
  dataSource: DataSource;
  /** Form mode */
  mode?: 'create' | 'edit';
  /** Record ID (for edit mode) */
  recordId?: string;
  /** Success callback */
  onSuccess?: (result: any) => void;
  /** Cancel callback */
  onCancel?: () => void;
  /** Object definition */
  objectDef?: any;
}
