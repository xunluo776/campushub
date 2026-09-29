import { Schema, model } from 'mongoose';

import { UserRole } from '../types/reservation';

// Mongoose side of the User schema in docs/openapi.yaml.
export interface UserDocument {
  name: string;
  email: string;
  role: UserRole;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, required: true, enum: ['STUDENT', 'FACULTY', 'ADMIN'] },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>('User', userSchema);
