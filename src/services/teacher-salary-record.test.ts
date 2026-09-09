import { describe, expect, it } from 'vitest';
import { calcTotal } from '@/domain/teacher-salary';
import { mapBackendTeacherToUI } from '@/services/mappers/teacher-api.mapper';

describe('按月工资快照映射', () => {
  it('使用后端所选月份记录，不取 payHistory[0] 或当前模型推导金额', () => {
    const teacher = mapBackendTeacherToUI({
      id: 't1',
      name: '教师一',
      base: 999,
      payHistory: [{ month: '2026-09', amount: 999, status: 'paid' }],
      salaryRecord: {
        id: 'sr-aug',
        teacherId: 't1',
        month: '2026-08',
        amount: 1234,
        status: 'confirmed',
        paidAt: null,
      },
    });
    expect(teacher.salaryStatus).toBe('confirmed');
    expect(teacher.selectedSalaryRecord?.month).toBe('2026-08');
    expect(calcTotal(teacher)).toBe(1234);
  });

  it('uses selected month paidAt instead of the newest history entry', () => {
    const teacher = mapBackendTeacherToUI({
      id: 't1',
      payHistory: [
        { month: '2026-09', amount: 999, status: 'paid', paidAt: '2026-09-30T00:00:00.000Z' },
      ],
      salaryRecord: {
        id: 'sr-aug',
        teacherId: 't1',
        month: '2026-08',
        amount: 1234,
        status: 'confirmed',
        paidAt: '2026-08-31T00:00:00.000Z',
      },
    });
    expect(teacher.paidAt).toBe('2026-08-31T00:00:00.000Z');
  });

  it('所选月份无记录时金额冻结为 0，避免用最新模型伪造历史工资', () => {
    const teacher = mapBackendTeacherToUI({
      id: 't1',
      name: '教师一',
      base: 999,
      salaryRecord: null,
    });
    expect(teacher.salaryStatus).toBe('pending');
    expect(teacher.selectedSalaryRecord).toBeNull();
    expect(calcTotal(teacher)).toBe(0);
  });
});
