import { Schema, Types, model } from 'mongoose';

import { ReservationStatus } from '../types/reservation';

// Mongoose side of the Reservation schema in docs/openapi.yaml.
export interface ReservationDocument {
  resourceId: Types.ObjectId;
  userId: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<ReservationDocument>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

// Conflict checks look up one resource over a time window, so index those three fields.
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });

export const ReservationModel = model<ReservationDocument>('Reservation', reservationSchema);
