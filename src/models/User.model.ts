import { HydratedDocument, Schema, model } from 'mongoose';

import { UserRole } from '../types/reservation';

// Mongoose side of the User schema in docs/openapi.yaml.
export interface IUser {
  name: string;
  email: string;
  role: UserRole;
}

export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, required: true, enum: ['STUDENT', 'FACULTY', 'ADMIN'] },
  },
  { timestamps: true },
);

export const UserModel = model<IUser>('User', userSchema);
