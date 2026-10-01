/**
 * 记录映射回归测试 —— 对应 harness rule `50-lesson-identity` §规则 1：
 * 「记录接口的序列化不许摘掉 `classId` / `scheduleId`」。
 *
 * 为什么值得单测：`isRecordOfLesson(record, target)` 第一步就是比归属
 * （`isSameLessonOwner`：有 `target.classId` 时要求 `record.class_id` 相等）。
 * 只要映射后 `class_id` 变 `undefined`，所有依赖它的判定就**恒为 false**，
 * 表现为「已点名状态/重复点名保护/补课试听幂等」静默失效 ⇒ 同班同天重复提交会重复消课（资损）。
 */
import { describe, expect, it } from 'vitest';
import { mapBackendLessonRecord } from '@/services/lesson-record';

const base = {
  id: 'r1',
  studentId: 'student-1',
  lessonDate: '2026-06-22',
  duration: 60,
  hoursUsed: 1,
  status: 'NORMAL' as const,
  createdAt: '2026-06-22T10:00:00.000Z',
};

describe('mapBackendLessonRecord：课节身份两列', () => {
  it('列表形状：扁平 classId / scheduleId 原样带过来（幂等判定的前提）', () => {
    const record = mapBackendLessonRecord({
      ...base,
      classId: 'class-1',
      scheduleId: 'schedule-1',
      className: '钢琴基础班',
    });

    expect(record.class_id).toBe('class-1');
    expect(record.schedule_id).toBe('schedule-1');
  });

  it('详情形状：没有扁平列时，从 class / schedule 对象兜底', () => {
    const record = mapBackendLessonRecord({
      ...base,
      class: { id: 'class-1', name: '钢琴基础班' },
      schedule: { id: 'schedule-1' },
    });

    expect(record.class_id).toBe('class-1');
    expect(record.schedule_id).toBe('schedule-1');
  });

  it('两列都缺 ⇒ class_id 为空（这就是后端必须返回扁平 classId 的原因）', () => {
    // 老列表接口的形状：只给 className，没有 classId / scheduleId
    const record = mapBackendLessonRecord({
      ...base,
      className: '钢琴基础班',
    });

    expect(record.class_id).toBeUndefined();
    expect(record.schedule_id).toBeUndefined();
  });
});
