import { ResourceDocument, ResourceModel } from '../models/Resource.model';
import { Resource, ResourceType } from '../../shared/types';
import { ValidationError } from './errors';

const RESOURCE_TYPES: ResourceType[] = ['ROOM', 'EQUIPMENT', 'LAB'];

// The filters GET /resources can pass to Mongo. Both are optional.
interface ResourceFilter {
  type?: ResourceType;
  isAvailable?: boolean;
}

// Turns a Mongoose document into the Resource shape from the contract.
function toResource(doc: ResourceDocument): Resource {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    location: doc.location,
    isAvailable: doc.isAvailable,
  };
}

// Query string values are always strings, so isAvailable comes in as "true" or "false".
// Anything else is a bad request.
function parseIsAvailable(isAvailable: unknown): boolean | undefined {
  if (isAvailable === undefined) {
    return undefined;
  }
  if (isAvailable === 'true') {
    return true;
  }
  if (isAvailable === 'false') {
    return false;
  }
  throw new ValidationError('VALIDATION_ERROR', 'isAvailable must be true or false when provided.');
}

// type and isAvailable come straight from the query string, so they can be anything until
// we check them. An unknown type is not an error, it just matches nothing.
export async function listResources(type: unknown, isAvailable: unknown): Promise<Resource[]> {
  const filter: ResourceFilter = {};

  if (type !== undefined) {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new ValidationError(
        'VALIDATION_ERROR',
        'type must be a non-empty string when provided.',
      );
    }
    if (!RESOURCE_TYPES.includes(type as ResourceType)) {
      return [];
    }
    filter.type = type as ResourceType;
  }

  const available = parseIsAvailable(isAvailable);
  if (available !== undefined) {
    filter.isAvailable = available;
  }

  const docs = await ResourceModel.find(filter).sort({ name: 1 });

  const resources: Resource[] = [];
  for (const doc of docs) {
    resources.push(toResource(doc));
  }
  return resources;
}
