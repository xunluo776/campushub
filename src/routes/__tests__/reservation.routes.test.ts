import request from 'supertest';

import app from '../../app';
import { ReservationModel } from '../../models/Reservation.model';
import { ResourceModel } from '../../models/Resource.model';

// End-to-end HTTP tests: real Express app (routes -> controllers -> services -> models)
// against the in-memory MongoDB from src/test/setup.ts. Nothing is mocked except where a
// test needs to force a database failure.

const API = '/api/v1';
const UNKNOWN_ID = '000000000000000000000000';
const START = '2026-12-01T10:00:00.000Z';
const END = '2026-12-01T11:00:00.000Z';

let roomId: string;

beforeEach(async () => {
  const [room] = await ResourceModel.insertMany([
    { name: 'Study Room 302', type: 'ROOM', location: 'Snell Library, Floor 3', isAvailable: true },
    {
      name: 'Study Room 415',
      type: 'ROOM',
      location: 'Snell Library, Floor 4',
      isAvailable: false,
    },
    { name: '3D Printer A', type: 'EQUIPMENT', location: 'Richards Hall', isAvailable: true },
    { name: 'Robotics Lab 1', type: 'LAB', location: 'ISEC, Room 142', isAvailable: true },
  ]);
  roomId = room._id.toString();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function bookRoom(startTime = START, endTime = END, userId = 'user-456'): request.Test {
  return request(app)
    .post(`${API}/reservations`)
    .send({ resourceId: roomId, userId, startTime, endTime });
}

describe('POST /api/v1/reservations', () => {
  it('returns 201 Created with the stored reservation', async () => {
    const res = await bookRoom();

    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      id: expect.any(String),
      resourceId: roomId,
      userId: 'user-456',
      startTime: START,
      endTime: END,
      status: 'PENDING',
    });
  });

  it('returns 409 Conflict for an overlapping booking', async () => {
    await bookRoom().expect(201);

    const res = await bookRoom('2026-12-01T10:30:00.000Z', '2026-12-01T11:30:00.000Z', 'u-2');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 'DOUBLE_BOOKING',
      message: 'Resource is already reserved for this time slot.',
    });
  });

  it('returns 409 for an exact duplicate and 201 for a back-to-back slot', async () => {
    await bookRoom().expect(201);
    await bookRoom().expect(409);
    await bookRoom(END, '2026-12-01T12:00:00.000Z').expect(201);
  });

  it('lets only one of several simultaneous identical POSTs through', async () => {
    const responses = await Promise.all([bookRoom(), bookRoom(), bookRoom(), bookRoom()]);

    const codes = responses.map((r) => r.status).sort();
    expect(codes).toEqual([201, 409, 409, 409]);
    expect(await ReservationModel.countDocuments()).toBe(1);
  });

  it.each([
    ['endTime before startTime', { startTime: END, endTime: START }],
    ['an unparseable date', { startTime: 'next tuesday' }],
    ['an impossible calendar date', { startTime: '2026-02-30T10:00:00Z' }],
    ['a missing userId', { userId: undefined }],
    ['a bad status', { status: 'DONE' }],
  ])('returns 400 for %s', async (_label, patch) => {
    const body = { resourceId: roomId, userId: 'user-456', startTime: START, endTime: END };
    const res = await request(app)
      .post(`${API}/reservations`)
      .send({ ...body, ...patch });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 RESOURCE_NOT_FOUND for a resource that does not exist', async () => {
    const res = await request(app)
      .post(`${API}/reservations`)
      .send({ resourceId: UNKNOWN_ID, userId: 'u', startTime: START, endTime: END });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('returns 400 (not 500) for a malformed JSON body', async () => {
    const res = await request(app)
      .post(`${API}/reservations`)
      .set('Content-Type', 'application/json')
      .send('{"resourceId": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request body must be valid JSON.',
    });
  });

  it('returns 500 INTERNAL_ERROR when the database fails', async () => {
    jest.spyOn(ResourceModel, 'exists').mockRejectedValueOnce(new Error('database is down'));

    const res = await bookRoom();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: 'INTERNAL_ERROR', message: 'database is down' });
  });
});

describe('GET /api/v1/resources', () => {
  async function namesFor(query: string): Promise<string[]> {
    const res = await request(app).get(`${API}/resources${query}`).expect(200);
    return res.body.map((r: { name: string }) => r.name);
  }

  it('returns 200 with every resource when there is no filter', async () => {
    expect(await namesFor('')).toHaveLength(4);
  });

  it('filters by type', async () => {
    expect(await namesFor('?type=ROOM')).toEqual(['Study Room 302', 'Study Room 415']);
    expect(await namesFor('?type=LAB')).toEqual(['Robotics Lab 1']);
  });

  it('filters by isAvailable', async () => {
    expect(await namesFor('?isAvailable=false')).toEqual(['Study Room 415']);
  });

  it('combines type and isAvailable', async () => {
    expect(await namesFor('?type=ROOM&isAvailable=true')).toEqual(['Study Room 302']);
  });

  it('returns 200 with an empty list for an unknown type', async () => {
    expect(await namesFor('?type=POOL')).toEqual([]);
  });

  it.each(['?type=', '?isAvailable=yes', '?isAvailable=true&isAvailable=false'])(
    'returns 400 for %s',
    async (query) => {
      const res = await request(app).get(`${API}/resources${query}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    },
  );
});

describe('GET /api/v1/reservations/user/:userId', () => {
  it('returns 200 with all of the user’s bookings, cancelled ones included', async () => {
    const first = await bookRoom();
    await bookRoom('2026-12-01T12:00:00.000Z', '2026-12-01T13:00:00.000Z');
    await bookRoom('2026-12-01T14:00:00.000Z', '2026-12-01T15:00:00.000Z', 'someone-else');
    await request(app).patch(`${API}/reservations/${first.body.id}/cancel`).expect(200);

    const res = await request(app).get(`${API}/reservations/user/user-456`);

    expect(res.status).toBe(200);
    expect(res.body.map((r: { status: string }) => r.status)).toEqual(['CANCELLED', 'PENDING']);
  });

  it('returns 400 for a blank userId', async () => {
    const res = await request(app).get(`${API}/reservations/user/%20`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/reservations/:id/cancel and /confirm', () => {
  it('cancels (200), refuses a second cancel (409) and frees the slot', async () => {
    const created = await bookRoom();
    const url = `${API}/reservations/${created.body.id}/cancel`;

    const first = await request(app).patch(url);
    const second = await request(app).patch(url);

    expect(first.status).toBe(200);
    expect(first.body.status).toBe('CANCELLED');
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('INVALID_STATUS_TRANSITION');
    await bookRoom().expect(201);
  });

  it('confirms a pending reservation (200) and refuses to confirm it again (409)', async () => {
    const created = await bookRoom();
    const url = `${API}/reservations/${created.body.id}/confirm`;

    const first = await request(app).patch(url);
    const second = await request(app).patch(url);

    expect(first.status).toBe(200);
    expect(first.body.status).toBe('CONFIRMED');
    expect(second.status).toBe(409);
  });

  it.each(['cancel', 'confirm'])('returns 404 for an unknown id on /%s', async (action) => {
    const res = await request(app).patch(`${API}/reservations/${UNKNOWN_ID}/${action}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESERVATION_NOT_FOUND');
  });

  it.each(['cancel', 'confirm'])('returns 400 for a malformed id on /%s', async (action) => {
    const res = await request(app).patch(`${API}/reservations/abc/${action}`);
    expect(res.status).toBe(400);
  });
});

describe('other routes', () => {
  it('GET /api/v1/health returns 200 with the database state', async () => {
    const res = await request(app).get(`${API}/health`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'campushub-backend',
      environment: 'test',
      database: 'connected',
    });
  });

  it('returns 404 NOT_FOUND for an unknown route or wrong method', async () => {
    await request(app).get(`${API}/nope`).expect(404);
    const res = await request(app).put(`${API}/reservations/${UNKNOWN_ID}/cancel`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
