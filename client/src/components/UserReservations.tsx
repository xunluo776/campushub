import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import {
  cancelReservation,
  fetchResources,
  fetchUserReservations,
  getErrorMessage,
} from '../api/campushubApi';
import type { Reservation, ReservationStatus } from '../api/campushubApi';
import ErrorBanner from './ErrorBanner';

interface UserReservationsProps {
  userId: string;
  // App bumps this after a new booking so the list reloads.
  refreshKey: number;
}

const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  // Only drop the end date when the booking ends on the same day it starts.
  if (start.toDateString() === end.toDateString()) {
    return `${start.toLocaleString()} to ${end.toLocaleTimeString()}`;
  }
  return `${start.toLocaleString()} to ${end.toLocaleString()}`;
}

function UserReservations({ userId, refreshKey }: UserReservationsProps): JSX.Element {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // resourceId -> name, so the list can show "Study Room 302" instead of an id.
  const [resourceNames, setResourceNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState<number>(0);

  useEffect(() => {
    let ignore = false;

    async function load(): Promise<void> {
      try {
        const [userReservations, resources] = await Promise.all([
          fetchUserReservations(userId),
          fetchResources(),
        ]);
        if (ignore) {
          return;
        }

        // The API returns cancelled bookings too, this view only lists active ones.
        const active: Reservation[] = [];
        for (const reservation of userReservations) {
          if (reservation.status !== 'CANCELLED') {
            active.push(reservation);
          }
        }

        const names: Record<string, string> = {};
        for (const resource of resources) {
          names[resource.id] = resource.name;
        }

        setReservations(active);
        setResourceNames(names);
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
    // Updater form on purpose: handleCancel calls this after an await, and by then
    // reloadCount from this render may be out of date (e.g. Refresh was clicked meanwhile).
    setReloadCount((count) => count + 1);
  }

  async function handleCancel(reservationId: string): Promise<void> {
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

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">My Bookings</h2>
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="text-sm font-medium text-blue-600 hover:underline disabled:text-gray-400"
        >
          Refresh
        </button>
      </div>

      {cancelError !== null && (
        <div className="mb-3">
          <ErrorBanner message={cancelError} />
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading your bookings...</p>}

      {!isLoading && error !== null && <ErrorBanner message={error} onRetry={reload} />}

      {!isLoading && error === null && reservations.length === 0 && (
        <p className="text-sm text-gray-500">No active bookings for {userId}.</p>
      )}

      {!isLoading && error === null && reservations.length > 0 && (
        <ul className="space-y-3">
          {reservations.map((reservation) => (
            <li key={reservation.id} className="rounded-md border border-gray-200 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {resourceNames[reservation.resourceId] ?? reservation.resourceId}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[reservation.status]}`}
                >
                  {reservation.status}
                </span>
              </div>
              <p className="mb-2 text-sm text-gray-600">
                {formatTimeRange(reservation.startTime, reservation.endTime)}
              </p>
              <button
                type="button"
                onClick={() => handleCancel(reservation.id)}
                disabled={cancellingId !== null}
                className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancellingId === reservation.id ? 'Cancelling...' : 'Cancel Reservation'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default UserReservations;
