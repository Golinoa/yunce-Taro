import { describe, expect, it } from 'vitest';
import {
  decodeInviteLandingParam,
  formatInviteLandingDateLabel,
  formatInviteLandingTimeLabel,
  genderLabelOf,
  hasInviteLandingLessonContext,
  isInviteLandingGroupBook,
  parseInviteLandingParams,
  resolveInviteLandingCourseTitle,
} from './invite-landing-params';

describe('invite-landing-params (L1 试听落地)', () => {
  it('decode：空串 / 合法编码 / 非法编码容错', () => {
    expect(decodeInviteLandingParam()).toBe('');
    expect(decodeInviteLandingParam('%E8%80%81%E5%B8%88')).toBe('老师');
    expect(decodeInviteLandingParam('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('parse：归一化 type / st / guest / course↔classId', () => {
    const parsed = parseInviteLandingParams({
      t: 'tea-1',
      c: 'cam-1',
      type: 'group_slot',
      st: 'qr',
      guest: '1',
      course: 'cls-9',
      date: '2026-09-03',
      start: '10:00',
      end: '11:00',
      className: '少儿游泳',
    });
    expect(parsed).toMatchObject({
      t: 'tea-1',
      c: 'cam-1',
      type: 'group_slot',
      st: 'qr',
      guest: true,
      course: 'cls-9',
      classId: 'cls-9',
      className: '少儿游泳',
    });
    expect(parseInviteLandingParams({ t: 'a', c: 'b', type: 'class_lesson' }).type).toBe(
      'class_lesson',
    );
    expect(parseInviteLandingParams({ t: 'a', c: 'b', type: 'other' }).type).toBeUndefined();
    expect(parseInviteLandingParams({ t: 'a', c: 'b', guest: 'true' }).guest).toBe(true);
    expect(parseInviteLandingParams({ t: 'a', c: 'b', st: 'share_link' }).st).toBe('share_link');
  });

  it('展示派生：日期/时段/课名/团课/场次上下文/性别', () => {
    expect(formatInviteLandingDateLabel('')).toBe('');
    expect(formatInviteLandingDateLabel('not-a-date')).toBe('not-a-date');
    expect(formatInviteLandingDateLabel('2026-09-03')).toMatch(/9月3日/);
    expect(formatInviteLandingTimeLabel('10:00', '11:00')).toBe('10:00–11:00');
    expect(formatInviteLandingTimeLabel('10:00')).toBe('');
    expect(resolveInviteLandingCourseTitle({ className: 'A班' })).toBe('A班');
    expect(resolveInviteLandingCourseTitle({ type: 'group_slot' })).toBe('团课');
    expect(resolveInviteLandingCourseTitle({})).toBe('班课试听');
    expect(isInviteLandingGroupBook('group_slot')).toBe(true);
    expect(isInviteLandingGroupBook('class_lesson')).toBe(false);
    expect(
      hasInviteLandingLessonContext({
        classId: 'c',
        date: '2026-09-03',
        start: '10:00',
        end: '11:00',
      }),
    ).toBe(true);
    expect(hasInviteLandingLessonContext({ classId: 'c', date: '2026-09-03' })).toBe(false);
    expect(genderLabelOf('male')).toBe('男');
    expect(genderLabelOf('female')).toBe('女');
    expect(genderLabelOf('')).toBe('');
  });
});
