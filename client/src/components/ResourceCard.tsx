import type { JSX } from 'react';

import type { Resource, ResourceType } from '../api/campushubApi';

interface ResourceCardProps {
  resource: Resource;
  isSelected: boolean;
  onSelect: (resource: Resource) => void;
}

const TYPE_LABELS: Record<ResourceType, string> = {
  ROOM: 'Study Room',
  EQUIPMENT: 'Equipment',
  LAB: 'Lab',
};

// One resource in the ResourceList grid.
function ResourceCard({ resource, isSelected, onSelect }: ResourceCardProps): JSX.Element {
  return (
    <div
      className={
        isSelected
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
          {isSelected ? 'Selected' : 'Book'}
        </button>
      </div>
    </div>
  );
}

export default ResourceCard;
