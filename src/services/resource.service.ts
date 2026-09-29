import { Resource } from '../types/reservation';

// In-memory seed data so the contract endpoints are callable without a running MongoDB.
// The Mongoose model in src/models/resource.model.ts is the real storage schema.
const resources: Resource[] = [
  {
    id: 'res-101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
  },
  {
    id: 'res-102',
    name: 'Study Room 415',
    type: 'ROOM',
    location: 'Snell Library, Floor 4',
    isAvailable: false,
  },
  {
    id: 'res-201',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Richards Hall, Makerspace',
    isAvailable: true,
  },
  {
    id: 'res-301',
    name: 'Robotics Lab 1',
    type: 'LAB',
    location: 'ISEC, Room 142',
    isAvailable: true,
  },
];

// Business logic only. An unknown type is not an error here, it just matches nothing.
export async function listResources(type?: string): Promise<Resource[]> {
  if (type === undefined) {
    return resources;
  }

  const matches: Resource[] = [];
  for (const resource of resources) {
    if (resource.type === type) {
      matches.push(resource);
    }
  }
  return matches;
}
