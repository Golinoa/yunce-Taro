import Taro from '@tarojs/taro';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildInviteLessonKey,
  findInviteLandingSuccess,
  isInviteLessonKeyComplete,
  saveInviteLandingSuccess,
} from './invite-landing-success';

vi.mock('@tarojs/taro', () => {
  const store = new Map<string, unknown>();
  return {
    default: {
      getStorageSync: (key: string) => store.get(key),
      setStorageSync: (key: string, value: unknown) => {
        store.set(key, value);
      },
      __store: store,
    },
  };
});

describe('invite-landing-success lesson scope', () => {
  beforeEach(() => {
    (Taro as unknown as { __store: Map<string, unknown> }).__store.clear();
  });

  it('builds different keys for two time slots from the same teacher', () => {
    const slotA = buildInviteLessonKey({
      type: 'class_lesson',
      teacherId: 't1',
      campusId: 'c1',
      classId: 'cls-1',
      scheduleId: 'sch-a',
      date: '2026-09-01',
      start: '14:00',
      end: '15:00',
    });
    const slotB = buildInviteLessonKey({
      type: 'class_lesson',
      teacherId: 't1',
      campusId: 'c1',
      classId: 'cls-1',
      scheduleId: 'sch-b',
      date: '2026-09-01',
      start: '16:00',
      end: '17:00',
    });
    expect(slotA).not.toBe(slotB);
    expect(isInviteLessonKeyComplete(slotA)).toBe(true);
  });

  it('only restores success for the booked slot, not another slot', () => {
    const slotA = buildInviteLessonKey({
      type: 'class_lesson',
      teacherId: 't1',
      campusId: 'c1',
      classId: 'cls-1',
      scheduleId: 'sch-a',
      date: '2026-09-01',
      start: '14:00',
      end: '15:00',
    });
    const slotB = buildInviteLessonKey({
      type: 'class_lesson',
      teacherId: 't1',
      campusId: 'c1',
      classId: 'cls-1',
      scheduleId: 'sch-b',
      date: '2026-09-01',
      start: '16:00',
      end: '17:00',
    });

    saveInviteLandingSuccess({
      lessonKey: slotA,
      visitorKey: 'vk-1',
      parentUserId: 'parent-1',
      childName: '小明',
      childAge: '7',
      childGender: 'male',
      parentPhone: '13800000000',
      bookedAt: '2026-08-30T12:00:00.000Z',
    });

    expect(
      findInviteLandingSuccess({
        lessonKey: slotA,
        visitorKey: 'vk-1',
        parentUserId: 'parent-1',
      })?.childName,
    ).toBe('小明');

    expect(
      findInviteLandingSuccess({
        lessonKey: slotB,
        visitorKey: 'vk-1',
        parentUserId: 'parent-1',
      }),
    ).toBeNull();
  });
});
