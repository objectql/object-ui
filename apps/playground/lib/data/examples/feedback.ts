import loadingStates from './feedback/loading-states.json';
import progressIndicators from './feedback/progress-indicators.json';
import skeletonLoading from './feedback/skeleton-loading.json';

export const feedback = {
  'loading-states': JSON.stringify(loadingStates, null, 2),
  'progress-indicators': JSON.stringify(progressIndicators, null, 2),
  'skeleton-loading': JSON.stringify(skeletonLoading, null, 2)
};
