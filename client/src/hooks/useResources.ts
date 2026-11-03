import { useEffect, useState } from 'react';

import { fetchResources, getErrorMessage } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/campushubApi';

// '' means "all types".
export type ResourceFilter = ResourceType | '';

export interface UseResourcesResult {
  resources: Resource[];
  typeFilter: ResourceFilter;
  setTypeFilter: (value: ResourceFilter) => void;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// Campus resources with a type filter. ResourceList uses it for the cards, and
// UserReservations uses it to show resource names instead of ids.
export function useResources(): UseResourcesResult {
  const [typeFilter, setTypeFilterState] = useState<ResourceFilter>('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this reruns the effect, used by reload().
  const [reloadCount, setReloadCount] = useState<number>(0);

  useEffect(() => {
    // Ignore the answer if the filter changed again before it came back.
    let ignore = false;

    async function load(): Promise<void> {
      try {
        const data = await fetchResources(typeFilter);
        if (!ignore) {
          setResources(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [typeFilter, reloadCount]);

  function setTypeFilter(value: ResourceFilter): void {
    if (value === typeFilter) {
      return;
    }
    setIsLoading(true);
    setTypeFilterState(value);
  }

  function reload(): void {
    setIsLoading(true);
    setError(null);
    setReloadCount((count) => count + 1);
  }

  return { resources, typeFilter, setTypeFilter, isLoading, error, reload };
}
