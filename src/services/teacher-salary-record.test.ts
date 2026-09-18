import { describe, expect, it } from 'vitest';
import { buildSalaryAdjustmentDrafts, calcTotal } from '@/domain/teacher-salary';
import { mapBackendTeacherToUI } from '@/services/mappers/teacher-api.mapper';

describe('工资调整提交', () => {
  it('把奖金、罚款、社保、底薪差额和自定义项全部转换为可持久化明细', () => {
    expect(
      buildSalaryAdjustmentDrafts(
        {
          base: '1200',
          lateFine: '10',
          otherFine: '20',
          bonusAmount: '100',
          socialInsurance: '50',
          customRows: [{ reason: '代课奖励', amount: '30', type: 'bonus' }],
        },
        1000,
      ),
    ).toEqual([
      { reason: '底薪调整', amount: 200, type: 'bonus' },
      { reason: '个人社保', amount: 50, type: 'deduct' },
      { reason: '迟到罚款', amount: 10, type: 'deduct' },
      { reason: '其他罚款', amount: 20, type: 'deduct' },
      { reason: '奖金', amount: 100, type: 'bonus' },
      { reason: '代课奖励', amount: 30, type: 'bonus' },
    ]);
  });

  it('忽略零金额并把底薪下调记为扣款', () => {
    expect(
      buildSalaryAdjustmentDrafts(
        {
          base: '800',
          lateFine: '',
          otherFine: '0',
          bonusAmount: '',
          socialInsurance: '',
          customRows: [],
        },
        1000,
      ),
    ).toEqual([{ reason: '底薪调整', amount: 200, type: 'deduct' }]);
  });
});

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

  it('所选月份无记录时展示当前待核对金额，不伪造已确认快照', () => {
    const teacher = mapBackendTeacherToUI({
      id: 't1',
      name: '教师一',
      salaryModel: { base: 999 },
      salaryRecord: null,
    });
    expect(teacher.salaryStatus).toBe('pending');
    expect(teacher.selectedSalaryRecord).toBeNull();
    expect(calcTotal(teacher)).toBe(999);
  });
});
