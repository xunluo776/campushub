import type { JSX } from 'react';

import type { Reservation, ReservationStatus } from '../api/campushubApi';

interface ReservationItemProps {
  reservation: Reservation;
  resourceName: string;
  isCancelling: boolean;
  // Disables every Cancel button while any one cancel is in flight.
  disabled: boolean;
  onCancel: (reservationId: string) => void;
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

// One booking in the My Bookings list.
function ReservationItem({
  reservation,
  resourceName,
  isCancelling,
  disabled,
  onCancel,
}: ReservationItemProps): JSX.Element {
  return (
    <li className="rounded-md border border-gray-200 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{resourceName}</span>
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
        onClick={() => onCancel(reservation.id)}
        disabled={disabled}
        className="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCancelling ? 'Cancelling...' : 'Cancel Reservation'}
      </button>
    </li>
  );
}

export default ReservationItem;
