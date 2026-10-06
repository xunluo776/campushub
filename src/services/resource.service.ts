import { ResourceDocument, ResourceModel } from '../models/Resource.model';
import { Resource, ResourceType } from '../types/reservation';
import { ValidationError } from './errors';

const RESOURCE_TYPES: ResourceType[] = ['ROOM', 'EQUIPMENT', 'LAB'];

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

// type comes straight from the query string, so it can be anything until we check it.
// An unknown type is not an error, it just matches nothing.
export async function listResources(type: unknown): Promise<Resource[]> {
  let docs: ResourceDocument[];

  if (type === undefined) {
    docs = await ResourceModel.find().sort({ name: 1 });
  } else {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new ValidationError(
        'VALIDATION_ERROR',
        'type must be a non-empty string when provided.',
      );
    }
    if (!RESOURCE_TYPES.includes(type as ResourceType)) {
      return [];
    }
    docs = await ResourceModel.find({ type: type as ResourceType }).sort({ name: 1 });
  }

  const resources: Resource[] = [];
  for (const doc of docs) {
    resources.push(toResource(doc));
  }
  return resources;
}
