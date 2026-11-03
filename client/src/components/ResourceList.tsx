import type { JSX } from 'react';

import type { Resource } from '../api/campushubApi';
import { useResources } from '../hooks/useResources';
import type { ResourceFilter } from '../hooks/useResources';
import ErrorBanner from './ErrorBanner';
import ResourceCard from './ResourceCard';

interface ResourceListProps {
  selectedResourceId: string | null;
  onSelect: (resource: Resource) => void;
}

interface FilterOption {
  label: string;
  value: ResourceFilter;
}

const FILTERS: FilterOption[] = [
  { label: 'All', value: '' },
  { label: 'Study Rooms', value: 'ROOM' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Labs', value: 'LAB' },
];

function ResourceList({ selectedResourceId, onSelect }: ResourceListProps): JSX.Element {
  const { resources, typeFilter, setTypeFilter, isLoading, error, reload } = useResources();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Campus Resources</h2>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              onClick={() => setTypeFilter(filter.value)}
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

      {!isLoading && error !== null && <ErrorBanner message={error} onRetry={reload} />}

      {!isLoading && error === null && resources.length === 0 && (
        <p className="text-sm text-gray-500">No resources match this filter.</p>
      )}

      {!isLoading && error === null && resources.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              isSelected={resource.id === selectedResourceId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default ResourceList;
