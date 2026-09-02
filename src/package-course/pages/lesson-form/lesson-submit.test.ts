import { describe, expect, it, vi } from 'vitest';
import { createSubmitLock } from '@/utils/submit-lock';
import {
  buildClassAttendanceSummary,
  filterChangedAttendanceStudents,
  resolveLessonSubmitKind,
  validateClassSubmit,
  validateHoursUsed,
  validateIncrementalEditSave,
  validateSingleSubmit,
  validateSupplementSave,
  withSubmitLock,
} from './lesson-submit';

describe('lesson-submit helpers (Q2-2)', () => {
  it('resolveLessonSubmitKind 按模式分流', () => {
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: true,
        mode: 'class',
        isAlreadyChecked: false,
        attendanceMode: 'view',
      }),
    ).toBe('blocked-edit');
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'single',
        isAlreadyChecked: false,
        attendanceMode: 'view',
      }),
    ).toBe('single');
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'class',
        isAlreadyChecked: true,
        attendanceMode: 'supplement',
      }),
    ).toBe('supplement');
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'class',
        isAlreadyChecked: true,
        attendanceMode: 'edit',
      }),
    ).toBe('edit');
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'class',
        isAlreadyChecked: false,
        attendanceMode: 'view',
      }),
    ).toBe('class');
  });

  it('validate* 覆盖关键前置条件', () => {
    expect(validateHoursUsed(0)).toBe('消课课时必须大于0');
    expect(validateHoursUsed(1)).toBeNull();
    expect(
      validateSupplementSave({ selectedClassId: null, supplementCount: 1, hoursUsed: 1 }),
    ).toBe('请选择班级');
    expect(
      validateSupplementSave({ selectedClassId: 'c1', supplementCount: 0, hoursUsed: 1 }),
    ).toBe('请先补录学员');
    expect(
      validateSupplementSave({ selectedClassId: 'c1', supplementCount: 2, hoursUsed: 0 }),
    ).toBe('消课课时必须大于0');
    expect(validateIncrementalEditSave({ selectedClassId: null, hoursUsed: 1 })).toBe('请选择班级');
    expect(validateIncrementalEditSave({ selectedClassId: 'c1', hoursUsed: 0 })).toBe(
      '消课课时必须大于0',
    );
    expect(validateIncrementalEditSave({ selectedClassId: 'c1', hoursUsed: 1 })).toBeNull();
    expect(validateSingleSubmit({ hasStudent: false, hasPackage: true, hoursUsed: 1 })).toBe(
      '请选择学生',
    );
    expect(validateSingleSubmit({ hasStudent: true, hasPackage: false, hoursUsed: 1 })).toBe(
      '没有可用课包',
    );
    expect(validateSingleSubmit({ hasStudent: true, hasPackage: true, hoursUsed: 0 })).toBe(
      '消课课时必须大于0',
    );
    expect(
      validateClassSubmit({ selectedClassId: null, formalCount: 1, trialCount: 0, hoursUsed: 1 }),
    ).toBe('请选择班级');
    expect(
      validateClassSubmit({ selectedClassId: 'c1', formalCount: 0, trialCount: 0, hoursUsed: 1 }),
    ).toBe('班级内暂无学员');
    expect(
      validateClassSubmit({ selectedClassId: 'c1', formalCount: 0, trialCount: 2, hoursUsed: 0 }),
    ).toBe('消课课时必须大于0');
    expect(
      validateClassSubmit({ selectedClassId: 'c1', formalCount: 0, trialCount: 1, hoursUsed: 1 }),
    ).toBeNull();
  });

  it('resolveLessonSubmitKind：已点名但非补录/编辑态回落 class', () => {
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'class',
        isAlreadyChecked: true,
        attendanceMode: 'view',
      }),
    ).toBe('class');
    expect(
      resolveLessonSubmitKind({
        isEditEntryAttempt: false,
        mode: 'class',
        isAlreadyChecked: true,
        attendanceMode: 'normal',
      }),
    ).toBe('class');
  });

  it('buildClassAttendanceSummary 含试听分态', () => {
    expect(
      buildClassAttendanceSummary({
        presentCount: 2,
        leaveCount: 1,
        absentCount: 0,
        hoursUsed: 1,
        trialPresentCount: 1,
        trialAbsentCount: 0,
        hasTrials: true,
      }),
    ).toContain('试听学员签到1名');
    expect(
      buildClassAttendanceSummary({
        presentCount: 0,
        leaveCount: 1,
        absentCount: 2,
        hoursUsed: 1,
        trialPresentCount: 0,
        trialAbsentCount: 0,
        hasTrials: false,
      }),
    ).toContain('不扣减课时');
  });

  it('filterChangedAttendanceStudents 只返回相对基线有变更的学员', () => {
    const baseline = new Map([
      ['a', 'checked' as const],
      ['b', 'absent' as const],
    ]);
    const changed = filterChangedAttendanceStudents(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      (id) => (id === 'a' ? 'checked' : id === 'b' ? 'leave' : 'absent'),
      baseline,
    );
    expect(changed.map((s) => s.id)).toEqual(['b']);
  });

  it('filterChangedAttendanceStudents：空名单与缺基线（默认 absent）', () => {
    expect(
      filterChangedAttendanceStudents([], () => 'checked', new Map([['a', 'checked']])),
    ).toEqual([]);

    const baseline = new Map([['a', 'checked' as const]]);
    const changed = filterChangedAttendanceStudents(
      [{ id: 'a' }, { id: 'orphan' }],
      (id) => (id === 'a' ? 'checked' : 'leave'),
      baseline,
    );
    // orphan 无基线视为 absent → leave 算变更；a 未变
    expect(changed.map((s) => s.id)).toEqual(['orphan']);
  });

  it('withSubmitLock：占用中二次提交 busy，且不执行 work', async () => {
    const lock = createSubmitLock();
    const setSubmitting = vi.fn();
    const work = vi.fn(async () => undefined);

    expect(lock.tryAcquire()).toBe(true);
    await expect(withSubmitLock(lock, setSubmitting, work)).resolves.toBe('busy');
    expect(work).not.toHaveBeenCalled();
    expect(setSubmitting).not.toHaveBeenCalled();

    lock.release();
    await expect(withSubmitLock(lock, setSubmitting, work)).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
    expect(setSubmitting).toHaveBeenCalledWith(true);
    expect(setSubmitting).toHaveBeenLastCalledWith(false);
    expect(lock.isLocked()).toBe(false);
  });

  it('withSubmitLock：work 抛错仍释放锁并复位 submitting（防重入）', async () => {
    const lock = createSubmitLock();
    const setSubmitting = vi.fn();
    const boom = new Error('persist failed');

    await expect(
      withSubmitLock(lock, setSubmitting, async () => {
        throw boom;
      }),
    ).rejects.toThrow('persist failed');

    expect(lock.isLocked()).toBe(false);
    expect(setSubmitting).toHaveBeenCalledWith(true);
    expect(setSubmitting).toHaveBeenLastCalledWith(false);

    const work = vi.fn(async () => undefined);
    await expect(withSubmitLock(lock, setSubmitting, work)).resolves.toBe('ok');
    expect(work).toHaveBeenCalledTimes(1);
  });
});
