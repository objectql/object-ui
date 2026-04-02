/**
 * useMetadataService
 *
 * React hook that creates a memoised `MetadataService` instance from the
 * current `ObjectStackAdapter` (via `useAdapter`).
 *
 * Returns `null` when the adapter is not yet available (e.g. while
 * the connection is being established).
 *
 * @module hooks/useMetadataService
 */

import { useMemo } from 'react';
import { useAdapter } from '../context/AdapterProvider';
import { MetadataService } from '../services/MetadataService';

export function useMetadataService(): MetadataService | null {
  const adapter = useAdapter();
  return useMemo(() => (adapter ? new MetadataService(adapter) : null), [adapter]);
}
