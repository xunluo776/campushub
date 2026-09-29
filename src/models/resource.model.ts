import { Schema, model } from 'mongoose';

import { ResourceType } from '../types/reservation';

// Mongoose side of the Resource schema in docs/openapi.yaml. Field names and required
// flags have to match the contract.
export interface ResourceDocument {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

const resourceSchema = new Schema<ResourceDocument>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['ROOM', 'EQUIPMENT', 'LAB'] },
    location: { type: String, required: true, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const ResourceModel = model<ResourceDocument>('Resource', resourceSchema);
