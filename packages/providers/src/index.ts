/**
 * @object-ui/providers
 *
 * Reusable context providers for ObjectUI applications
 */

export { DataSourceProvider, useDataSource } from './DataSourceProvider';
export { MetadataProvider, useMetadata } from './MetadataProvider';
export { ThemeProvider, useTheme } from './ThemeProvider';
export {
  UploadProvider,
  useUpload,
  createObjectUrlAdapter,
  createS3Adapter,
  createAzureBlobAdapter,
  createObjectStackUploadAdapter,
} from './UploadProvider';

export type {
  DataSourceProviderProps,
  MetadataProviderProps,
  ThemeProviderProps,
  ThemePreference,
} from './types';

export type {
  UploadAdapter,
  UploadOptions,
  UploadResult,
  UploadProviderProps,
  S3AdapterOptions,
  AzureBlobAdapterOptions,
  ObjectStackUploadAdapterOptions,
} from './UploadProvider';
