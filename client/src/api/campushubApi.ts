import axios from 'axios';

// Types copied from the schemas in docs/openapi.yaml. The contract is the source of truth,
// so field names and optional fields here have to match it.

export type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

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

// Body for POST /reservations. startTime and endTime are ISO 8601 strings, and status is
// left out because the server defaults it to PENDING.
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

export const CONFLICT_MESSAGE = 'This resource is already reserved for the selected time window.';

// Relative base URL, the Vite dev server proxies /api to the backend (see vite.config.ts).
// The timeout stops a request from hanging forever and leaving a spinner on screen.
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

// GET /resources, optionally filtered by type.
export async function fetchResources(type?: string): Promise<Resource[]> {
  const params: { type?: string } = {};
  if (type !== undefined && type !== '') {
    params.type = type;
  }
  const response = await api.get<Resource[]>('/resources', { params: params });
  return response.data;
}

// POST /reservations. A 409 means the slot overlaps an existing booking.
export async function createReservation(payload: CreateReservationDTO): Promise<Reservation> {
  const response = await api.post<Reservation>('/reservations', payload);
  return response.data;
}

// GET /reservations/user/{userId}. Returns every booking, cancelled ones included.
export async function fetchUserReservations(userId: string): Promise<Reservation[]> {
  const response = await api.get<Reservation[]>(`/reservations/user/${encodeURIComponent(userId)}`);
  return response.data;
}

// PATCH /reservations/{id}/cancel
export async function cancelReservation(reservationId: string): Promise<Reservation> {
  const response = await api.patch<Reservation>(
    `/reservations/${encodeURIComponent(reservationId)}/cancel`,
  );
  return response.data;
}

// PATCH /reservations/{id}/confirm
export async function confirmReservation(reservationId: string): Promise<Reservation> {
  const response = await api.patch<Reservation>(
    `/reservations/${encodeURIComponent(reservationId)}/confirm`,
  );
  return response.data;
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const record = data as Record<string, unknown>;
  return typeof record.code === 'string' && typeof record.message === 'string';
}

// Turns whatever a request threw into a message the components can show.
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return 'The server took too long to answer. Try again.';
    }
    if (error.response === undefined) {
      return 'Could not reach the CampusHub server. Is the backend running?';
    }

    const status = error.response.status;
    const data: unknown = error.response.data;

    if (status === 409 && isErrorResponse(data) && data.code === 'DOUBLE_BOOKING') {
      return CONFLICT_MESSAGE;
    }
    // 5xx messages are internal (e.g. a raw database error), and the dev proxy sends an
    // empty 5xx when the backend isn't running, so don't show the server's text here.
    if (status >= 500) {
      return 'The CampusHub server had a problem. Try again in a moment.';
    }
    if (isErrorResponse(data)) {
      return data.message;
    }
    return `Request failed with status ${status}.`;
  }

  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
}
