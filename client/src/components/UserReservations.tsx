import type { JSX } from 'react';

import { useReservations } from '../hooks/useReservations';
import { useResources } from '../hooks/useResources';
import ErrorBanner from './ErrorBanner';
import ReservationItem from './ReservationItem';

interface UserReservationsProps {
  userId: string;
  // App bumps this after a new booking so the list reloads.
  refreshKey: number;
}

function UserReservations({ userId, refreshKey }: UserReservationsProps): JSX.Element {
  const { reservations, isLoading, error, reload, cancel, cancellingId, cancelError } =
    useReservations(userId, refreshKey);
  // Only used for names. If it fails the list just falls back to showing resource ids.
  const { resources } = useResources();

  const resourceNames: Record<string, string> = {};
  for (const resource of resources) {
    resourceNames[resource.id] = resource.name;
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
            <ReservationItem
              key={reservation.id}
              reservation={reservation}
              resourceName={resourceNames[reservation.resourceId] ?? reservation.resourceId}
              isCancelling={cancellingId === reservation.id}
              disabled={cancellingId !== null}
              onCancel={cancel}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default UserReservations;
