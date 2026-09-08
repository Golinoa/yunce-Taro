import { describe, expect, it } from 'vitest';
import { buildRoomWriteBody } from '@/services/campus';

describe('buildRoomWriteBody', () => {
  it('仅保留 name/capacity/status/venueId/campusId，剥离预约扩展字段', () => {
    const body = buildRoomWriteBody({
      venueId: 'v1',
      campusId: 'c1',
      name: '琴房 A',
      capacity: 4,
      status: 'active',
      bookingEnabled: true,
      photos: ['https://x'],
      openTimeStart: '09:00',
      pricePerSession: 100,
      timeBasedPricing: true,
      managerUserId: 'u1',
    } as Parameters<typeof buildRoomWriteBody>[0] & Record<string, unknown>);
    expect(body).toEqual({
      venueId: 'v1',
      campusId: 'c1',
      name: '琴房 A',
      capacity: 4,
      status: 'active',
    });
    expect(body).not.toHaveProperty('bookingEnabled');
    expect(body).not.toHaveProperty('photos');
    expect(body).not.toHaveProperty('managerUserId');
  });
});
