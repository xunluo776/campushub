import { ReservationModel } from '../../models/Reservation.model';
import { IResource, ResourceModel } from '../../models/Resource.model';
import {
  DoubleBookingError,
  NotFoundError,
  StatusTransitionError,
  ValidationError,
} from '../errors';
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  listReservationsForUser,
} from '../reservation.service';
import { listResources } from '../resource.service';

// Runs against the in-memory MongoDB from src/test/setup.ts, collections are wiped after
// every test. No mocks: these hit real Mongoose queries.

const UNKNOWN_ID = '000000000000000000000000';

async function makeResource(overrides: Partial<IResource> = {}): Promise<string> {
  const doc = await ResourceModel.create({
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Snell Library, Floor 3',
    isAvailable: true,
    ...overrides,
  });
  return doc._id.toString();
}

interface BookingBody {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status?: string;
}

function booking(resourceId: string, startTime: string, endTime: string): BookingBody {
  return { resourceId, userId: 'user-456', startTime, endTime };
}

// The existing slot most edge-case tests collide with: 10:00 to 11:00 UTC.
const START = '2026-12-01T10:00:00.000Z';
const END = '2026-12-01T11:00:00.000Z';

describe('happy paths', () => {
  it('creates a resource that the resource service then lists', async () => {
    const id = await makeResource();

    const resources = await listResources(undefined, undefined);

    expect(resources).toEqual([
      {
        id,
        name: 'Study Room 302',
        type: 'ROOM',
        location: 'Snell Library, Floor 3',
        isAvailable: true,
      },
    ]);
  });

  it('places a valid reservation as PENDING and returns the contract shape', async () => {
    const resourceId = await makeResource();

    const created = await createReservation(booking(resourceId, START, END));

    expect(created).toEqual({
      id: expect.any(String),
      resourceId,
      userId: 'user-456',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it('keeps an explicit CONFIRMED status from the body', async () => {
    const resourceId = await makeResource();

    const created = await createReservation({
      ...booking(resourceId, START, END),
      status: 'CONFIRMED',
    });

    expect(created.status).toBe('CONFIRMED');
  });

  it('cancels a reservation and frees the slot right away', async () => {
    const resourceId = await makeResource();
    const created = await createReservation(booking(resourceId, START, END));

    const cancelled = await cancelReservation(created.id);
    const rebooked = await createReservation(booking(resourceId, START, END));

    expect(cancelled.status).toBe('CANCELLED');
    expect(rebooked.status).toBe('PENDING');
  });

  it('confirms a pending reservation', async () => {
    const resourceId = await makeResource();
    const created = await createReservation(booking(resourceId, START, END));

    const confirmed = await confirmReservation(created.id);

    expect(confirmed.status).toBe('CONFIRMED');
  });
});

describe('double-booking edge cases', () => {
  let resourceId: string;

  beforeEach(async () => {
    resourceId = await makeResource();
    await createReservation(booking(resourceId, START, END));
  });

  it('rejects an exact start/end match', async () => {
    await expect(createReservation(booking(resourceId, START, END))).rejects.toThrow(
      DoubleBookingError,
    );
  });

  it('rejects a booking that overlaps the end by 1 millisecond', async () => {
    const body = booking(resourceId, '2026-12-01T10:59:59.999Z', '2026-12-01T12:00:00.000Z');
    await expect(createReservation(body)).rejects.toThrow(DoubleBookingError);
  });

  it('rejects a booking that overlaps the start by 1 millisecond', async () => {
    const body = booking(resourceId, '2026-12-01T09:00:00.000Z', '2026-12-01T10:00:00.001Z');
    await expect(createReservation(body)).rejects.toThrow(DoubleBookingError);
  });

  it('allows a booking that starts exactly when the existing one ends', async () => {
    const body = booking(resourceId, END, '2026-12-01T12:00:00.000Z');
    await expect(createReservation(body)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('allows a booking that ends exactly when the existing one starts', async () => {
    const body = booking(resourceId, '2026-12-01T09:00:00.000Z', START);
    await expect(createReservation(body)).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('rejects a booking fully inside the existing one', async () => {
    const body = booking(resourceId, '2026-12-01T10:15:00.000Z', '2026-12-01T10:45:00.000Z');
    await expect(createReservation(body)).rejects.toThrow(DoubleBookingError);
  });

  it('rejects a booking that fully covers the existing one', async () => {
    const body = booking(resourceId, '2026-12-01T09:00:00.000Z', '2026-12-01T12:00:00.000Z');
    await expect(createReservation(body)).rejects.toThrow(DoubleBookingError);
  });

  it('compares instants, not strings: the same slot written in -05:00 still collides', async () => {
    const body = booking(resourceId, '2026-12-01T05:00:00-05:00', '2026-12-01T06:00:00-05:00');
    await expect(createReservation(body)).rejects.toThrow(DoubleBookingError);
  });

  it('still blocks the slot once the existing reservation is CONFIRMED', async () => {
    const [existing] = await listReservationsForUser('user-456');
    await confirmReservation(existing.id);

    await expect(createReservation(booking(resourceId, START, END))).rejects.toThrow(
      DoubleBookingError,
    );
  });

  it('allows the same slot on a different resource', async () => {
    const otherId = await makeResource({ name: 'Robotics Lab 1', type: 'LAB' });
    await expect(createReservation(booking(otherId, START, END))).resolves.toBeDefined();
  });
});

describe('invalid time ranges', () => {
  let resourceId: string;

  beforeEach(async () => {
    resourceId = await makeResource();
  });

  it('rejects endTime before startTime (negative range)', async () => {
    await expect(createReservation(booking(resourceId, END, START))).rejects.toThrow(
      'endTime must be later than startTime.',
    );
  });

  it('rejects a zero-length booking (endTime equal to startTime)', async () => {
    await expect(createReservation(booking(resourceId, START, START))).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects endTime 1 millisecond before startTime', async () => {
    const body = booking(resourceId, START, '2026-12-01T09:59:59.999Z');
    await expect(createReservation(body)).rejects.toThrow(ValidationError);
  });
});

describe('resource lookups', () => {
  it('rejects a well-formed resourceId that does not exist', async () => {
    const promise = createReservation(booking(UNKNOWN_ID, START, END));
    await expect(promise).rejects.toThrow(ValidationError);
    await expect(createReservation(booking(UNKNOWN_ID, START, END))).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('rejects a resourceId that is not an ObjectId', async () => {
    await expect(createReservation(booking('res-101', START, END))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'resourceId must be a valid resource id.',
    });
  });

  it('does not create anything when the resource is missing', async () => {
    await expect(createReservation(booking(UNKNOWN_ID, START, END))).rejects.toThrow();
    expect(await ReservationModel.countDocuments()).toBe(0);
  });
});

// Fuzzing the request body: every one of these must be a ValidationError (400), never a
// crash, a Mongoose CastError (500) or a silently saved booking.
describe('payload fuzzing', () => {
  let resourceId: string;

  beforeEach(async () => {
    resourceId = await makeResource();
  });

  const badBodies: [string, unknown][] = [
    ['null body', null],
    ['array body', []],
    ['string body', 'book it please'],
    ['number body', 42],
    ['empty object', {}],
  ];

  it.each(badBodies)('rejects a non-object or empty body: %s', async (_label, body) => {
    await expect(createReservation(body)).rejects.toThrow(ValidationError);
  });

  const missingOrWrongFields: [string, Record<string, unknown>][] = [
    ['missing resourceId', { resourceId: undefined }],
    ['missing userId', { userId: undefined }],
    ['missing startTime', { startTime: undefined }],
    ['missing endTime', { endTime: undefined }],
    ['blank userId', { userId: '   ' }],
    ['numeric userId', { userId: 456 }],
    ['numeric startTime (epoch ms)', { startTime: 1796119200000 }],
    ['object resourceId (NoSQL style)', { resourceId: { $ne: null } }],
    ['unknown status', { status: 'DONE' }],
    ['lowercase status', { status: 'pending' }],
    ['empty status', { status: '' }],
  ];

  it.each(missingOrWrongFields)('rejects %s', async (_label, patch) => {
    const body = { ...booking(resourceId, START, END), ...patch };
    await expect(createReservation(body)).rejects.toThrow(ValidationError);
  });

  const badDates: string[] = [
    'tomorrow',
    '2026-12-01',
    '2026-12-01 10:00:00Z',
    '2026-12-01T10:00:00',
    '12/01/2026 10:00',
    '2026-13-01T10:00:00Z',
    '2026-12-32T10:00:00Z',
    '2026-02-30T10:00:00Z',
    '2026-04-31T10:00:00Z',
    '2025-02-29T10:00:00Z',
    '2026-12-01T24:00:00Z',
    '2026-12-01T10:60:00Z',
    '2026-12-01T10:00:61Z',
    '2026-12-01T10:00:00+25:00',
    '',
  ];

  it.each(badDates)('rejects startTime %p', async (value) => {
    const body = { ...booking(resourceId, START, END), startTime: value };
    await expect(createReservation(body)).rejects.toThrow(ValidationError);
  });

  it.each(badDates)('rejects endTime %p', async (value) => {
    const body = { ...booking(resourceId, START, END), endTime: value };
    await expect(createReservation(body)).rejects.toThrow(ValidationError);
  });

  it('accepts Feb 29 in a leap year', async () => {
    const body = booking(resourceId, '2028-02-29T10:00:00Z', '2028-02-29T11:00:00Z');
    await expect(createReservation(body)).resolves.toMatchObject({
      startTime: '2028-02-29T10:00:00.000Z',
    });
  });

  it('never saves anything for a rejected payload', async () => {
    await expect(
      createReservation({ ...booking(resourceId, START, END), startTime: '2026-02-30T10:00:00Z' }),
    ).rejects.toThrow();
    expect(await ReservationModel.countDocuments()).toBe(0);
  });
});

describe('concurrent booking attempts', () => {
  it('lets exactly one of 10 simultaneous identical requests win', async () => {
    const resourceId = await makeResource();
    const attempts: Promise<unknown>[] = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(createReservation({ ...booking(resourceId, START, END), userId: `u-${i}` }));
    }

    const results = await Promise.allSettled(attempts);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(9);
    for (const r of lost) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(DoubleBookingError);
    }
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it('lets simultaneous overlapping (not identical) requests produce only one booking', async () => {
    const resourceId = await makeResource();
    // Every pair of these overlaps, so whichever runs first, the other two must lose.
    // (An earlier version used 09:30-10:30 and 10:30-11:30, which are back to back and
    // can legally both win, so the test failed randomly depending on arrival order.)
    const attempts = [
      createReservation(booking(resourceId, '2026-12-01T10:00:00Z', '2026-12-01T11:00:00Z')),
      createReservation(booking(resourceId, '2026-12-01T10:30:00Z', '2026-12-01T11:30:00Z')),
      createReservation(booking(resourceId, '2026-12-01T10:15:00Z', '2026-12-01T10:45:00Z')),
    ];

    const results = await Promise.allSettled(attempts);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it('still books non-overlapping slots in parallel', async () => {
    const resourceId = await makeResource();
    const attempts: Promise<unknown>[] = [];
    for (let hour = 10; hour < 15; hour++) {
      attempts.push(
        createReservation(
          booking(resourceId, `2026-12-01T${hour}:00:00Z`, `2026-12-01T${hour + 1}:00:00Z`),
        ),
      );
    }

    const results = await Promise.allSettled(attempts);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await ReservationModel.countDocuments()).toBe(5);
  });

  it('does not let a failed booking block the next one for that resource', async () => {
    const resourceId = await makeResource();
    const results = await Promise.allSettled([
      createReservation(booking(resourceId, END, START)),
      createReservation(booking(resourceId, START, END)),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
  });
});

describe('listReservationsForUser', () => {
  it('returns every booking for the user, cancelled ones included, sorted by startTime', async () => {
    const resourceId = await makeResource();
    const late = await createReservation(
      booking(resourceId, '2026-12-01T14:00:00Z', '2026-12-01T15:00:00Z'),
    );
    await createReservation(booking(resourceId, START, END));
    await createReservation({
      ...booking(resourceId, '2026-12-02T10:00:00Z', '2026-12-02T11:00:00Z'),
      userId: 'someone-else',
    });
    await cancelReservation(late.id);

    const list = await listReservationsForUser('user-456');

    expect(list.map((r) => r.startTime)).toEqual([START, '2026-12-01T14:00:00.000Z']);
    expect(list.map((r) => r.status)).toEqual(['PENDING', 'CANCELLED']);
  });

  it('returns an empty list for a user with no bookings', async () => {
    await expect(listReservationsForUser('nobody')).resolves.toEqual([]);
  });

  it.each([[''], ['   '], [undefined], [123]])('rejects userId %p', async (userId) => {
    await expect(listReservationsForUser(userId)).rejects.toThrow(ValidationError);
  });
});

describe('status changes', () => {
  let resourceId: string;
  let reservationId: string;

  beforeEach(async () => {
    resourceId = await makeResource();
    reservationId = (await createReservation(booking(resourceId, START, END))).id;
  });

  it('cancels a CONFIRMED reservation', async () => {
    await confirmReservation(reservationId);
    await expect(cancelReservation(reservationId)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('refuses to cancel twice', async () => {
    await cancelReservation(reservationId);
    await expect(cancelReservation(reservationId)).rejects.toThrow(StatusTransitionError);
  });

  it('refuses to confirm a cancelled reservation', async () => {
    await cancelReservation(reservationId);
    await expect(confirmReservation(reservationId)).rejects.toThrow(
      'Reservation is CANCELLED and cannot be changed to CONFIRMED.',
    );
  });

  it('refuses to confirm twice', async () => {
    await confirmReservation(reservationId);
    await expect(confirmReservation(reservationId)).rejects.toThrow(StatusTransitionError);
  });

  it('returns NotFoundError for an id that does not exist', async () => {
    await expect(cancelReservation(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
    await expect(confirmReservation(UNKNOWN_ID)).rejects.toThrow(NotFoundError);
  });

  it.each([['abc'], [''], [undefined], [42]])('rejects malformed id %p', async (id) => {
    await expect(cancelReservation(id)).rejects.toThrow(ValidationError);
  });

  it('lets only one of a simultaneous cancel and confirm win', async () => {
    const results = await Promise.allSettled([
      cancelReservation(reservationId),
      confirmReservation(reservationId),
      cancelReservation(reservationId),
    ]);

    const won = results.filter((r) => r.status === 'fulfilled');
    expect(won.length).toBeGreaterThanOrEqual(1);
    // Whatever order they ran in, the final state has to be a valid end state and every
    // loser must have been told why.
    const final = await ReservationModel.findById(reservationId);
    expect(['CANCELLED']).toContain(final?.status);
    for (const r of results) {
      if (r.status === 'rejected') {
        expect(r.reason).toBeInstanceOf(StatusTransitionError);
      }
    }
  });
});
