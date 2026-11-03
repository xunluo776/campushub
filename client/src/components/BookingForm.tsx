import { useState } from 'react';
import type { FormEvent, JSX } from 'react';

import type { Resource } from '../api/campushubApi';
import { useCreateReservation } from '../hooks/useReservations';
import DateTimeField from './DateTimeField';
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { createBooking, isSubmitting, error: submitError, clearError } = useCreateReservation();

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
  const shownError = validationError ?? submitError;

  function handleTimeChange(setter: (value: string) => void, value: string): void {
    setter(value);
    setValidationError(null);
    clearError();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSuccessMessage(null);

    const problem = validateTimes(startTime, endTime);
    setValidationError(problem);
    if (problem !== null) {
      return;
    }

    // datetime-local has no timezone, new Date() reads it as local time and
    // toISOString() turns it into the UTC ISO 8601 string the API expects.
    const booked = await createBooking({
      resourceId: selected.id,
      userId: userId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
    if (booked) {
      setSuccessMessage(`Booked ${selected.name}. It now shows under My Bookings.`);
      setStartTime('');
      setEndTime('');
      onBooked();
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Book a Resource</h2>
      <p className="mb-4 text-sm text-gray-600">
        {selected.name} <span className="text-gray-400">·</span> {selected.location}
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <DateTimeField
          id="startTime"
          label="Start time"
          value={startTime}
          onChange={(value) => handleTimeChange(setStartTime, value)}
        />
        <DateTimeField
          id="endTime"
          label="End time"
          value={endTime}
          onChange={(value) => handleTimeChange(setEndTime, value)}
        />

        {shownError !== null && <ErrorBanner message={shownError} />}

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
