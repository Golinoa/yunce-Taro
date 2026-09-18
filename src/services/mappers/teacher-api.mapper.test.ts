import { describe, expect, it } from 'vitest';
import { mapBackendSalarySettings, mapBackendTeacherToUI } from './teacher-api.mapper';

describe('mapBackendSalarySettings', () => {
  it('keeps push disabled when the backend omits the legacy field', () => {
    expect(mapBackendSalarySettings({ payDay: 15 })).toEqual({
      payDay: 15,
      pushDaysBefore: 3,
      autoConfirm: false,
      pushEnabled: false,
    });
  });
});

describe('mapBackendTeacherToUI', () => {
  it('reads back the applied salary template and persisted rule snapshot', () => {
    const teacher = mapBackendTeacherToUI({
      id: 'teacher-1',
      name: '测试老师',
      salaryTemplateId: 'template-1',
      salaryModel: {
        base: 5000,
        rules: { fixedBaseAmount: 5000, attendanceMode: 'per_student_per_lesson' },
      },
    });

    expect(teacher.salaryTemplateId).toBe('template-1');
    expect(teacher.base).toBe(5000);
    expect(teacher.salaryRule).toEqual({
      fixedBaseAmount: 5000,
      attendanceMode: 'per_student_per_lesson',
    });
  });
});
