import { HydratedDocument, Schema, model } from 'mongoose';

import { ResourceType } from '../types/reservation';

// Mongoose side of the Resource schema in docs/openapi.yaml. Field names and required
// flags have to match the contract.
export interface IResource {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export type ResourceDocument = HydratedDocument<IResource>;

const resourceSchema = new Schema<IResource>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['ROOM', 'EQUIPMENT', 'LAB'] },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ResourceModel = model<IResource>('Resource', resourceSchema);
