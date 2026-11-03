import { useEffect, useState } from 'react';

import {
  cancelReservation,
  createReservation,
  fetchUserReservations,
  getErrorMessage,
} from '../api/campushubApi';
import type { CreateReservationDTO, Reservation } from '../api/campushubApi';

export interface UseReservationsResult {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  cancel: (reservationId: string) => Promise<void>;
  cancellingId: string | null;
  cancelError: string | null;
}

// The student's active bookings plus the cancel action, used by UserReservations.
// refreshKey is bumped by App after a new booking so the list reloads.
export function useReservations(userId: string, refreshKey: number): UseReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState<number>(0);

  useEffect(() => {
    // Ignore the answer if userId/refreshKey changed again before it came back.
    let ignore = false;

    async function load(): Promise<void> {
      try {
        const all = await fetchUserReservations(userId);
        if (ignore) {
          return;
        }
        // The API returns cancelled bookings too, this view only lists active ones.
        const active: Reservation[] = [];
        for (const reservation of all) {
          if (reservation.status !== 'CANCELLED') {
            active.push(reservation);
          }
        }
        setReservations(active);
        setError(null);
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [userId, refreshKey, reloadCount]);

  function reload(): void {
    setIsLoading(true);
    // Updater form on purpose: cancel() calls this after an await, and by then
    // reloadCount from that render may be out of date (e.g. Refresh was clicked meanwhile).
    setReloadCount((count) => count + 1);
  }

  async function cancel(reservationId: string): Promise<void> {
    setCancelError(null);
    setCancellingId(reservationId);
    try {
      await cancelReservation(reservationId);
      // Refetch instead of editing the list by hand, so it always matches the server.
      reload();
    } catch (err) {
      setCancelError(getErrorMessage(err));
    } finally {
      setCancellingId(null);
    }
  }

  return { reservations, isLoading, error, reload, cancel, cancellingId, cancelError };
}

export interface UseCreateReservationResult {
  createBooking: (payload: CreateReservationDTO) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Submitting a new booking, used by BookingForm. createBooking returns true on success,
// on failure it returns false and `error` holds the message (409 -> the conflict text).
export function useCreateReservation(): UseCreateReservationResult {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function createBooking(payload: CreateReservationDTO): Promise<boolean> {
    setError(null);
    setIsSubmitting(true);
    try {
      await createReservation(payload);
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearError(): void {
    setError(null);
  }

  return { createBooking, isSubmitting, error, clearError };
}
