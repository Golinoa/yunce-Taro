import { describe, expect, it } from 'vitest';
import {
  buildStudentRechargeTodoDesc,
  buildStudentRechargeTodoTitle,
  buildStudentRechargeTodoUrl,
  isStudentRechargeTodoId,
  normalizeStudentRechargeTodoDesc,
  parseStudentIdFromRechargeTodoId,
  resolveDefaultRechargeAssigneeIds,
} from './student-recharge-todo';

describe('student-recharge-todo', () => {
  it('统一标题格式', () => {
    expect(buildStudentRechargeTodoTitle('小明')).toBe('「小明」课时续费提醒');
  });

  it('统一描述格式', () => {
    expect(buildStudentRechargeTodoDesc(3)).toBe('剩余 3 课时 · 请尽快跟进续费');
    expect(buildStudentRechargeTodoDesc(0, { exhausted: true })).toBe(
      '课时已用尽 · 请尽快跟进续费',
    );
  });

  it('从预警 info 归一化描述', () => {
    expect(normalizeStudentRechargeTodoDesc('剩余 2 课时')).toBe('剩余 2 课时 · 请尽快跟进续费');
    expect(normalizeStudentRechargeTodoDesc('课时已用尽')).toBe('课时已用尽 · 请尽快跟进续费');
  });

  it('去处理跳转学员详情', () => {
    expect(buildStudentRechargeTodoUrl('stu-027')).toBe(
      '/package-student/pages/student-detail/index?id=stu-027',
    );
    expect(isStudentRechargeTodoId('alert-recharge-stu-027')).toBe(true);
    expect(parseStudentIdFromRechargeTodoId('alert-recharge-stu-027')).toBe('stu-027');
  });

  it('默认参与人含校长、管理员、负责老师', () => {
    const ids = resolveDefaultRechargeAssigneeIds({
      responsibleTeacherId: 'teacher-002',
      campusId: 'campus-center',
      staff: [
        {
          id: 'teacher-principal-001',
          identity: 'principal',
          orgRole: 'admin',
          campusIds: ['campus-center', 'campus-east'],
        },
        {
          id: 'teacher-002',
          identity: 'teacher',
          orgRole: 'principal',
          campusIds: ['campus-center'],
        },
        {
          id: 'teacher-004',
          identity: 'teacher',
          orgRole: 'teacher',
          campusIds: ['campus-west'],
        },
      ],
    });
    expect(ids).toEqual(['teacher-002', 'teacher-principal-001']);
  });
});
