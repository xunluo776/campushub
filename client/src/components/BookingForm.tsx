import { useState } from 'react';
import type { FormEvent, JSX } from 'react';

import { createReservation, getErrorMessage } from '../api/campushubApi';
import type { Resource } from '../api/campushubApi';
import ErrorBanner from './ErrorBanner';

interface BookingFormProps {
  resource: Resource | null;
  userId: string;
  onBooked: () => void;
}

// Checks the form before anything is sent. Returns an error message, or null if it's fine.
// startTime/endTime are the raw datetime-local values, e.g. "2026-11-02T10:00".
function validateTimes(startTime: string, endTime: string): string | null {
  if (startTime === '' || endTime === '') {
    return 'Pick both a start time and an end time.';
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'One of the times is not a valid date.';
  }
  if (end.getTime() <= start.getTime()) {
    return 'End time has to be after the start time.';
  }
  if (start.getTime() < Date.now()) {
    return "Start time can't be in the past.";
  }
  return null;
}

function BookingForm({ resource, userId, onBooked }: BookingFormProps): JSX.Element {
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (resource === null) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Book a Resource</h2>
        <p className="text-sm text-gray-500">Pick a resource from the list to book it.</p>
      </section>
    );
  }

  // Keep a non-null copy so the async submit below doesn't have to re-check it.
  const selected: Resource = resource;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSuccessMessage(null);

    const validationError = validateTimes(startTime, endTime);
    if (validationError !== null) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      // datetime-local has no timezone, new Date() reads it as local time and
      // toISOString() turns it into the UTC ISO 8601 string the API expects.
      await createReservation({
        resourceId: selected.id,
        userId: userId,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
      setSuccessMessage(`Booked ${selected.name}. It now shows under My Bookings.`);
      setStartTime('');
      setEndTime('');
      onBooked();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Book a Resource</h2>
      <p className="mb-4 text-sm text-gray-600">
        {selected.name} <span className="text-gray-400">·</span> {selected.location}
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="startTime" className="mb-1 block text-sm font-medium text-gray-700">
            Start time
          </label>
          <input
            id="startTime"
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setError(null);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="endTime" className="mb-1 block text-sm font-medium text-gray-700">
            End time
          </label>
          <input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              setError(null);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {error !== null && <ErrorBanner message={error} />}

        {successMessage !== null && (
          <div
            role="status"
            className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {successMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isSubmitting ? 'Booking...' : 'Request Booking'}
        </button>
      </form>
    </section>
  );
}

export default BookingForm;
