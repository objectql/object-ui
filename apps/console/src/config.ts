export interface ObjectStackConfig {
  name?: string;
  version?: string;
  description?: string;
  build?: {
    outDir?: string;
    sourcemap?: boolean;
    minify?: boolean;
    target?: string;
  };
  datasources?: Record<string, {
    driver: string;
    [key: string]: any;
  }>;
  plugins?: (string | any)[];
  dev?: {
    port?: number;
    host?: string;
    watch?: boolean;
    hotReload?: boolean;
  };
  deploy?: {
    target: string;
    region?: string;
  };
  // Runtime config (merged from stack)
  objects?: any[];
  apps?: any[];
  dashboards?: any[];
  pages?: any[];
  manifest?: {
    data?: any[];
  };
}

export function defineConfig(config: ObjectStackConfig) {
  return config;
}
