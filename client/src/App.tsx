import { useState } from 'react';
import type { FormEvent, JSX } from 'react';

import type { Resource } from './api/campushubApi';
import BookingForm from './components/BookingForm';
import ResourceList from './components/ResourceList';
import UserReservations from './components/UserReservations';

// There's no login yet, so the "current student" is just an id typed in the header.
const DEFAULT_USER_ID = 'user-456';

function App(): JSX.Element {
  const [userIdInput, setUserIdInput] = useState<string>(DEFAULT_USER_ID);
  const [userId, setUserId] = useState<string>(DEFAULT_USER_ID);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  // Goes up by one after each booking so My Bookings knows to reload.
  const [bookingsVersion, setBookingsVersion] = useState<number>(0);

  function handleSwitchUser(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = userIdInput.trim();
    if (trimmed === '') {
      return;
    }
    setUserId(trimmed);
  }

  function handleBooked(): void {
    setBookingsVersion((version) => version + 1);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">CampusHub</h1>
          <form onSubmit={handleSwitchUser} className="flex items-center gap-2">
            <label htmlFor="userId" className="text-sm text-gray-600">
              Signed in as
            </label>
            <input
              id="userId"
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-800 px-3 py-1 text-sm font-medium text-white hover:bg-gray-900"
            >
              Switch
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ResourceList
            selectedResourceId={selectedResource === null ? null : selectedResource.id}
            onSelect={setSelectedResource}
          />
        </div>
        <div className="space-y-6">
          {/* key resets the form (times, messages) when a different resource is picked */}
          <BookingForm
            key={selectedResource === null ? 'none' : selectedResource.id}
            resource={selectedResource}
            userId={userId}
            onBooked={handleBooked}
          />
          {/* key remounts it on a user switch so it shows the loading state, not the old list */}
          <UserReservations key={userId} userId={userId} refreshKey={bookingsVersion} />
        </div>
      </main>
    </div>
  );
}

export default App;
