/**
 * 「能不能加这个学员」的口径用例。
 *
 * 这层判错的表现非常隐蔽：要么把有课的学员挡在外面，要么把没课的学员放进班
 * （等到点名才炸）。所以两端都要锁死。
 */
import { describe, expect, it } from 'vitest';
import type { Student } from '@/types/student';
import {
  evaluateStudent,
  getSubjectRemaining,
  partitionStudents,
} from '@/utils/student-subject-eligibility';

const student = (overrides: Partial<Student> = {}): Student =>
  ({
    id: 's1',
    name: '张三',
    teacher_id: '',
    invite_code: '',
    created_at: '',
    updated_at: '',
    ...overrides,
  }) as Student;

const PIANO = { id: 'sub-piano', name: '钢琴' };

describe('getSubjectRemaining', () => {
  it('返回该科目剩余（不是跨科目总数）', () => {
    const s = student({
      subject_hours: [
        { subjectId: 'sub-piano', subjectName: '钢琴', remaining: 12 },
        { subjectId: 'sub-art', subjectName: '美术', remaining: 3 },
      ],
    });
    expect(getSubjectRemaining(s, PIANO)).toBe(12);
    expect(getSubjectRemaining(s, { id: 'sub-art' })).toBe(3);
  });

  it('老数据把中文名写进 id 列 ⇒ 按名称兜底命中', () => {
    const s = student({
      subject_hours: [{ subjectId: '钢琴', subjectName: '钢琴', remaining: 5 }],
    });
    expect(getSubjectRemaining(s, { id: 'sub-piano', name: '钢琴' })).toBe(5);
  });

  it('字段缺失 ⇒ null（不是 0）——「不知道」和「没有了」必须可分', () => {
    expect(getSubjectRemaining(student(), PIANO)).toBeNull();
  });

  it('有字段但没有这个科目 ⇒ 0', () => {
    const s = student({
      subject_hours: [{ subjectId: 'sub-art', subjectName: '美术', remaining: 3 }],
    });
    expect(getSubjectRemaining(s, PIANO)).toBe(0);
  });

  it('两本账同一科目 ⇒ 后端已合并，取合并后的剩余', () => {
    const s = student({
      subject_hours: [
        {
          subjectId: 'sub-piano',
          subjectName: '钢琴',
          remaining: 11,
        },
      ],
    });
    expect(getSubjectRemaining(s, PIANO)).toBe(11);
  });
});

describe('evaluateStudent', () => {
  it('有剩余 ⇒ 通过', () => {
    const s = student({
      subject_hours: [{ subjectId: 'sub-piano', subjectName: '钢琴', remaining: 8 }],
    });
    expect(evaluateStudent(s, PIANO)).toMatchObject({ ok: true, blocking: false, remaining: 8 });
  });

  it('剩 0 ⇒ 硬拦 + 写明原因', () => {
    const s = student({
      subject_hours: [{ subjectId: 'sub-piano', subjectName: '钢琴', remaining: 0 }],
    });
    expect(evaluateStudent(s, PIANO)).toMatchObject({
      ok: false,
      blocking: true,
      reason: 'exhausted',
      label: '钢琴剩 0 课时',
    });
  });

  it('没有该科目 ⇒ 默认软提醒（可勾，但确认前要提示）', () => {
    const s = student({ subject_hours: [] });
    const result = evaluateStudent(s, PIANO);
    expect(result).toMatchObject({ ok: false, blocking: false, reason: 'no-subject' });
    expect(result.label).toBe('没有钢琴的课时');
  });

  it('strictMode 下「没有该科目」升级为硬拦', () => {
    const s = student({ subject_hours: [] });
    expect(evaluateStudent(s, PIANO, { strictMode: true }).blocking).toBe(true);
  });

  it('数据缺失 ⇒ 放行（不能因为接口没给字段把人全挡住）', () => {
    const result = evaluateStudent(student(), PIANO);
    expect(result).toMatchObject({ ok: true, blocking: false, dataMissing: true, remaining: null });
  });
});

describe('partitionStudents', () => {
  it('一次分成 可加 / 硬拦 / 需提醒 三组', () => {
    const ok = student({
      id: 'ok',
      subject_hours: [{ subjectId: 'sub-piano', subjectName: '钢琴', remaining: 5 }],
    });
    const empty = student({
      id: 'empty',
      subject_hours: [{ subjectId: 'sub-piano', subjectName: '钢琴', remaining: 0 }],
    });
    const none = student({ id: 'none', subject_hours: [] });

    const groups = partitionStudents([ok, empty, none], PIANO);
    expect(groups.ready.map((s) => s.id)).toEqual(['ok']);
    expect(groups.blocked.map((item) => item.student.id)).toEqual(['empty']);
    expect(groups.warned.map((item) => item.student.id)).toEqual(['none']);
    expect(groups.blocked[0].label).toBe('钢琴剩 0 课时');
  });

  it('strictMode：没有该科目的人也被划进硬拦', () => {
    const none = student({ id: 'none', subject_hours: [] });
    const groups = partitionStudents([none], PIANO, { strictMode: true });
    expect(groups.blocked).toHaveLength(1);
    expect(groups.warned).toHaveLength(0);
  });
});
