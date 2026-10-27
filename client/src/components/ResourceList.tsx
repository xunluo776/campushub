import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { fetchResources, getErrorMessage } from '../api/campushubApi';
import type { Resource, ResourceType } from '../api/campushubApi';
import ErrorBanner from './ErrorBanner';

interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

interface FilterOption {
  label: string;
  value: ResourceType | '';
}

const FILTERS: FilterOption[] = [
  { label: 'All', value: '' },
  { label: 'Study Rooms', value: 'ROOM' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Labs', value: 'LAB' },
];

const TYPE_LABELS: Record<ResourceType, string> = {
  ROOM: 'Study Room',
  EQUIPMENT: 'Equipment',
  LAB: 'Lab',
};

function ResourceList({ selectedResourceId, onSelect }: ResourceListProps): JSX.Element {
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping this reruns the effect, used by the retry button.
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

  function handleFilterChange(value: ResourceType | ''): void {
    if (value === typeFilter) {
      return;
    }
    setIsLoading(true);
    setTypeFilter(value);
  }

  function handleRetry(): void {
    setIsLoading(true);
    setError(null);
    setReloadCount((count) => count + 1);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Campus Resources</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => handleFilterChange(filter.value)}
              className={
                filter.value === typeFilter
                  ? 'rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white'
                  : 'rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200'
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Loading resources...</p>}

      {!isLoading && error !== null && <ErrorBanner message={error} onRetry={handleRetry} />}

      {!isLoading && error === null && resources.length === 0 && (
        <p className="text-sm text-gray-500">No resources match this filter.</p>
      )}

      {!isLoading && error === null && resources.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource) => (
            <div
              key={resource.id}
              className={
                resource.id === selectedResourceId
                  ? 'rounded-lg border-2 border-blue-500 p-4'
                  : 'rounded-lg border border-gray-200 p-4'
              }
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-medium text-gray-900">{resource.name}</h3>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {TYPE_LABELS[resource.type]}
                </span>
              </div>
              <p className="mb-3 text-sm text-gray-600">{resource.location}</p>
              <div className="flex items-center justify-between">
                {resource.isAvailable ? (
                  <span className="text-xs font-medium text-green-700">Available</span>
                ) : (
                  <span className="text-xs font-medium text-gray-500">Not available</span>
                )}
                <button
                  type="button"
                  disabled={!resource.isAvailable}
                  onClick={() => onSelect(resource)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {resource.id === selectedResourceId ? 'Selected' : 'Book'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ResourceList;
