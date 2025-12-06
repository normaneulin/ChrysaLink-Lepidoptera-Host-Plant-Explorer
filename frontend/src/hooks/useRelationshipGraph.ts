/**
 * Hook for fetching and managing relationship graph data
 */

import { useState, useEffect, useCallback } from 'react';
import { relationshipService } from '../services/relationshipService';
import { GraphData, RelationshipFilter } from '../types/relationship';

interface UseRelationshipGraphOptions {
  filters?: RelationshipFilter;
  autoFetch?: boolean;
}

interface UseRelationshipGraphReturn {
  graphData: GraphData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: (filters?: RelationshipFilter) => Promise<void>;
  clearCache: () => void;
}

/**
 * Hook to fetch relationship graph data
 * Handles loading, error states, and caching
 */
export function useRelationshipGraph(
  options: UseRelationshipGraphOptions = {}
): UseRelationshipGraphReturn {
  const { filters, autoFetch = true } = options;
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (filtersToUse?: RelationshipFilter) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await relationshipService.getGraphData(filtersToUse || filters);
      setGraphData(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Failed to fetch relationship graph:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  const refetch = useCallback(
    async (newFilters?: RelationshipFilter) => {
      await fetchData(newFilters || filters);
    },
    [fetchData, filters]
  );

  const clearCache = useCallback(() => {
    relationshipService.clearCache();
  }, []);

  return {
    graphData,
    isLoading,
    error,
    refetch,
    clearCache,
  };
}
