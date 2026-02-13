/**
 * Stub for @hotcrm/ai used by the console build.
 *
 * The real @hotcrm/ai package provides ML/AI utilities that are not
 * needed for UI metadata rendering.  This stub satisfies the import
 * so that the hotcrm plugin modules can be loaded without errors.
 */

export class PredictionService {
  constructor(..._args: any[]) {}
  async predict(..._args: any[]): Promise<any> { return {}; }
}

export class ExplainabilityService {
  constructor(..._args: any[]) {}
  async explain(..._args: any[]): Promise<any> { return {}; }
}

export class ModelRegistry {
  constructor(..._args: any[]) {}
}

export class CacheManager {
  constructor(..._args: any[]) {}
}

export class PerformanceMonitor {
  constructor(..._args: any[]) {}
}

export const AIUtils = {};

export function calculateConfidence(..._args: any[]): number { return 0; }
export function normalizeScore(..._args: any[]): number { return 0; }
export function weightedAverage(..._args: any[]): number { return 0; }
export function sigmoid(..._args: any[]): number { return 0; }
export function cosineSimilarity(..._args: any[]): number { return 0; }
export function standardDeviation(..._args: any[]): number { return 0; }
export function detectOutliers(..._args: any[]): any[] { return []; }
export function movingAverage(..._args: any[]): number[] { return []; }
export function exponentialSmoothing(..._args: any[]): number[] { return []; }
export function calculateTrend(..._args: any[]): any { return {}; }
export function minMaxScale(..._args: any[]): number[] { return []; }
export function zScoreNormalize(..._args: any[]): number[] { return []; }
export function pearsonCorrelation(..._args: any[]): number { return 0; }
export function kMeansClustering(..._args: any[]): any { return {}; }
