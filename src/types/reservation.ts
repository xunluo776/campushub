// TypeScript mirror of the schemas in docs/openapi.yaml. The contract is the source of
// truth, so field names and optionality here have to match it exactly.

export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type UserRole = 'STUDENT' | 'FACULTY' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
}

// What a client is allowed to send to POST /reservations. id is server generated and
// status defaults to PENDING, which is why both are left out here.
export interface CreateReservationInput {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status?: ReservationStatus;
}

export interface ErrorResponse {
  code: string;
  message: string;
}
