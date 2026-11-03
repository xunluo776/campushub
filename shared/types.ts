// Shared TypeScript mirror of the schemas in docs/openapi.yaml. Both the backend (src/) and
// the React client (client/) import from this one file, so the two sides can't drift
// apart. Types only: no runtime code, so it costs nothing in either build.

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

// Body for POST /reservations. id is server generated and status defaults to PENDING,
// which is why both are left out. startTime/endTime are ISO 8601 strings.
export interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status?: ReservationStatus;
}

// Every failing endpoint returns this shape.
export interface ErrorResponse {
  code: string;
  message: string;
}
