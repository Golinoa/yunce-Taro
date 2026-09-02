import { describe, expect, it } from 'vitest';
import type { Class } from '@/types/class';
import type { TeacherUIModel } from '@/types/teacher';
import { getTeacherSelectionInfo } from './teacher-selection';

const teachers: Record<string, TeacherUIModel> = {
  t1: { id: 't1', name: '主讲甲', role: 'lead' } as TeacherUIModel,
  t2: { id: 't2', name: '助教乙', role: 'assist' } as TeacherUIModel,
};

describe('getTeacherSelectionInfo (Q2-3)', () => {
  it('从班级 teachers 解析主讲/助教', () => {
    const classInfo = {
      id: 'c1',
      teachers: ['t1', 't2'],
      teacher_id: 't1',
    } as Class;
    const info = getTeacherSelectionInfo({
      classInfo,
      teacherById: teachers,
    });
    expect(info.leadTeacherId).toBe('t1');
    expect(info.assistantTeacherId).toBe('t2');
    expect(info.assistantTeacherName).toBe('助教乙');
  });

  it('无班级时用 fallback', () => {
    const info = getTeacherSelectionInfo({
      classInfo: null,
      teacherById: teachers,
      fallbackTeacherId: 't1',
      fallbackTeacherName: '主讲甲',
      fallbackAssistantTeacherId: 't2',
    });
    expect(info.leadTeacherId).toBe('t1');
    expect(info.assistantTeacherId).toBe('t2');
  });
});
