import { describe, expect, it } from 'vitest';
import { __leaveMappersForTest } from './leave';

describe('leave mappers (Q2-4)', () => {
  it('映射审批状态', () => {
    expect(__leaveMappersForTest.mapBackendLeaveStatus('APPROVED')).toBe('approved');
    expect(__leaveMappersForTest.mapBackendLeaveStatus('REJECTED')).toBe('rejected');
    expect(__leaveMappersForTest.mapBackendLeaveStatus('PENDING')).toBe('pending');
  });

  it('映射请假记录字段', () => {
    const leave = __leaveMappersForTest.mapBackendLeave({
      id: 'l1',
      studentId: 's1',
      studentName: '小明',
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      reason: '事假',
      status: 'PENDING',
      createdAt: '2026-09-01T00:00:00.000Z',
    });
    expect(leave.student_id).toBe('s1');
    expect(leave.original_date).toBe('2026-09-01');
    expect(leave.student?.name).toBe('小明');
  });
});
