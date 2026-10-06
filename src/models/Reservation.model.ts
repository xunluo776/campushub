import { HydratedDocument, Schema, Types, model } from 'mongoose';

import { ReservationStatus } from '../types/reservation';

// Mongoose side of the Reservation schema in docs/openapi.yaml.
// userId stays a plain string for now because there is no user/auth module yet and the
// contract uses ids like "user-456".
export interface IReservation {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

export type ReservationDocument = HydratedDocument<IReservation>;

const reservationSchema = new Schema<IReservation>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    userId: { type: String, required: true, trim: true },
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
// GET /reservations/user/:userId looks up by user.
reservationSchema.index({ userId: 1 });

export const ReservationModel = model<IReservation>('Reservation', reservationSchema);
