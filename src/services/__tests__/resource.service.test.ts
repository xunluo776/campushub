import { ResourceModel } from '../../models/Resource.model';
import { ValidationError } from '../errors';
import { listResources } from '../resource.service';

// Same four resources as src/scripts/seed.ts.
beforeEach(async () => {
  await ResourceModel.insertMany([
    { name: 'Study Room 302', type: 'ROOM', location: 'Snell Library, Floor 3', isAvailable: true },
    {
      name: 'Study Room 415',
      type: 'ROOM',
      location: 'Snell Library, Floor 4',
      isAvailable: false,
    },
    { name: '3D Printer A', type: 'EQUIPMENT', location: 'Richards Hall', isAvailable: true },
    { name: 'Robotics Lab 1', type: 'LAB', location: 'ISEC, Room 142', isAvailable: true },
  ]);
});

async function names(type: unknown, isAvailable: unknown): Promise<string[]> {
  const resources = await listResources(type, isAvailable);
  return resources.map((r) => r.name);
}

describe('listResources', () => {
  it('returns everything sorted by name when no filter is given', async () => {
    expect(await names(undefined, undefined)).toEqual([
      '3D Printer A',
      'Robotics Lab 1',
      'Study Room 302',
      'Study Room 415',
    ]);
  });

  it.each([
    ['ROOM', ['Study Room 302', 'Study Room 415']],
    ['EQUIPMENT', ['3D Printer A']],
    ['LAB', ['Robotics Lab 1']],
  ])('filters by type=%s', async (type, expected) => {
    expect(await names(type, undefined)).toEqual(expected);
  });

  it('filters by isAvailable=true and isAvailable=false', async () => {
    expect(await names(undefined, 'true')).toEqual([
      '3D Printer A',
      'Robotics Lab 1',
      'Study Room 302',
    ]);
    expect(await names(undefined, 'false')).toEqual(['Study Room 415']);
  });

  it('combines type and isAvailable', async () => {
    expect(await names('ROOM', 'false')).toEqual(['Study Room 415']);
    expect(await names('LAB', 'false')).toEqual([]);
  });

  it('treats an unknown or lowercase type as "matches nothing", not an error', async () => {
    expect(await names('POOL', undefined)).toEqual([]);
    expect(await names('room', undefined)).toEqual([]);
  });

  it.each([[''], ['   '], [['ROOM', 'LAB']], [5]])('rejects type %p', async (type) => {
    await expect(listResources(type, undefined)).rejects.toThrow(ValidationError);
  });

  it.each([['yes'], ['1'], ['TRUE'], [''], [['true', 'false']]])(
    'rejects isAvailable %p',
    async (isAvailable) => {
      await expect(listResources(undefined, isAvailable)).rejects.toThrow(
        'isAvailable must be true or false when provided.',
      );
    },
  );
});
