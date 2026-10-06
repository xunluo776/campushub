import mongoose from 'mongoose';

import { connectDatabase } from '../config/database';
import { ReservationModel } from '../models/Reservation.model';
import { IResource, ResourceModel } from '../models/Resource.model';

// Dev-only script: wipes resources and reservations and loads the same sample resources
// the Lab 2 in-memory service had. Run with `npm run seed`. Not part of the request path,
// which is why it talks to the models directly.
const sampleResources: IResource[] = [
  { name: 'Study Room 302', type: 'ROOM', location: 'Snell Library, Floor 3', isAvailable: true },
  { name: 'Study Room 415', type: 'ROOM', location: 'Snell Library, Floor 4', isAvailable: false },
  {
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Richards Hall, Makerspace',
    isAvailable: true,
  },
  { name: 'Robotics Lab 1', type: 'LAB', location: 'ISEC, Room 142', isAvailable: true },
];

async function seed(): Promise<void> {
  await connectDatabase();

  await ReservationModel.deleteMany({});
  await ResourceModel.deleteMany({});
  const created = await ResourceModel.insertMany(sampleResources);

  console.log('Seeded resources:');
  for (const doc of created) {
    console.log(`  ${doc._id.toString()}  ${doc.type}  ${doc.name}`);
  }

  await mongoose.disconnect();
}

seed().catch(async (error: unknown) => {
  console.error('Seeding failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
