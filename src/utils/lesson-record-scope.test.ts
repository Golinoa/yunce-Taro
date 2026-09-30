import { describe, expect, it } from 'vitest';
import { isRecordOfLesson } from '@/utils/lesson-record-scope';

const record = (over: Partial<Parameters<typeof isRecordOfLesson>[0]> = {}) => ({
  class_id: 'c1',
  lesson_date: '2026-10-05',
  schedule_id: 's-0900',
  ...over,
});

describe('isRecordOfLesson（消课/点名记录的「哪一节」口径）', () => {
  it('班级或日期不一致直接排除', () => {
    expect(isRecordOfLesson(record(), { classId: 'c2', lessonDate: '2026-10-05' })).toBe(false);
    expect(isRecordOfLesson(record(), { classId: 'c1', lessonDate: '2026-10-12' })).toBe(false);
  });

  it('两边都有 scheduleId 时必须相等（同班同一天多节课隔离）', () => {
    const target = { classId: 'c1', lessonDate: '2026-10-05', scheduleId: 's-0900' };
    expect(isRecordOfLesson(record(), target)).toBe(true);
    // 同一天 14:00 那节的记录不能出现在 09:00 这节
    expect(isRecordOfLesson(record({ schedule_id: 's-1400' }), target)).toBe(false);
    expect(
      isRecordOfLesson(record({ schedule_id: 's-1400' }), { ...target, scheduleId: 's-1400' }),
    ).toBe(true);
  });

  it('目标没有 scheduleId（从班级列表进入，不知道是哪一节）⇒ 不区分', () => {
    const target = { classId: 'c1', lessonDate: '2026-10-05' };
    expect(isRecordOfLesson(record(), target)).toBe(true);
    expect(isRecordOfLesson(record({ schedule_id: 's-1400' }), target)).toBe(true);
    expect(isRecordOfLesson(record({ schedule_id: null }), target)).toBe(true);
  });

  it('记录没有 scheduleId（老数据 / 写入时没带）⇒ 不区分，不能被藏起来', () => {
    const target = { classId: 'c1', lessonDate: '2026-10-05', scheduleId: 's-0900' };
    expect(isRecordOfLesson(record({ schedule_id: null }), target)).toBe(true);
    expect(isRecordOfLesson(record({ schedule_id: '' }), target)).toBe(true);
    expect(isRecordOfLesson(record({ schedule_id: undefined }), target)).toBe(true);
  });

  it('空白字符视为未填', () => {
    const target = { classId: 'c1', lessonDate: '2026-10-05', scheduleId: '  ' };
    expect(isRecordOfLesson(record({ schedule_id: 's-1400' }), target)).toBe(true);
  });

  it('scheduleId 前后空格归一后再比', () => {
    const target = { classId: 'c1', lessonDate: '2026-10-05', scheduleId: ' s-0900 ' };
    expect(isRecordOfLesson(record(), target)).toBe(true);
  });
});
