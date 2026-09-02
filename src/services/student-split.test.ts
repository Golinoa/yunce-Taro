import { describe, expect, it } from 'vitest';
import { __notificationMappersForTest } from './notification';
import { mapBackendStudentParent } from './student-parents';

describe('mapBackendStudentParent (Q2-4)', () => {
  it('把 profileId 映射为 parent_id 供通知 receiver', () => {
    const mapped = mapBackendStudentParent('stu-1', {
      id: 'bind-1',
      profileId: 'profile-p1',
      createdAt: '2026-09-02T00:00:00.000Z',
      profile: { nickname: '张爸', phone: '13800138000', avatar: null },
    });
    expect(mapped.parent_id).toBe('profile-p1');
    expect(mapped.parent?.name).toBe('张爸');
    expect(mapped.student_id).toBe('stu-1');
  });
});

describe('notification type mappers (Q2-4)', () => {
  const { mapBackendNotificationType, mapFrontendNotificationType } = __notificationMappersForTest;

  it('CHECKIN / leave 标题分流', () => {
    expect(mapBackendNotificationType({ type: 'CHECKIN', title: '消课' })).toBe('lesson_complete');
    expect(mapBackendNotificationType({ type: 'LEAVE', title: '请假申请' })).toBe('leave_request');
    expect(mapBackendNotificationType({ type: 'LEAVE', title: '审批结果' })).toBe('leave_response');
  });

  it('前端类型回写后端枚举', () => {
    expect(mapFrontendNotificationType('lesson_complete')).toBe('CHECKIN');
    expect(mapFrontendNotificationType('schedule_change')).toBe('SCHEDULE');
    expect(mapFrontendNotificationType(undefined, '课时已核销')).toBe('CHECKIN');
  });
});
