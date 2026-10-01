/**
 * 点名状态映射回归 —— 请假 / 缺勤必须是后端认识的大写状态。
 *
 * 为什么值得单测（2026-10-01 实测出的真缺陷）：
 * `buildLessonRecordPayload` 原来只映射 `cancelled / makeup / normal`，
 * 传 `'leave'` / `'absent'` 会落成 `undefined` ⇒ 请求体**不带 status** ⇒ 后端按默认值落库。后果有两层：
 * 1. 请假被记成 `NORMAL`（点名里显示"已点名"而不是"请假"）；
 * 2. 缺勤路径同时带 `createDebt: true`，而后端规则是
 *    `if (input.createDebt && !isAbsent) throw 422「只有缺勤记录可以创建欠课」`
 *    ⇒ **缺勤记录根本建不出来**（点名提交时落进失败清单）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonRecordService } from '@/services/lesson-record';

const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/utils/request', () => request);

/** 后端创建接口的最小回包（用于映射回去） */
const backendRecord = {
  id: 'r1',
  studentId: 's1',
  lessonDate: '2026-06-22',
  duration: 60,
  hoursUsed: 0,
  status: 'NORMAL' as const,
  createdAt: '2026-06-22T10:00:00.000Z',
  updatedAt: '2026-06-22T10:00:00.000Z',
};

const base = {
  teacher_id: 't1',
  student_id: 's1',
  package_id: '',
  lesson_date: '2026-06-22',
  hours_used: 0,
};

describe('lessonRecordService.create：状态映射（后端枚举是大写）', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    ['normal', 'NORMAL'],
    ['makeup', 'MAKEUP'],
    ['leave', 'LEAVE'],
    ['absent', 'ABSENT'],
    ['cancelled', 'CANCELLED'],
  ] as const)('status=%s ⇒ 请求体 status=%s', async (input, expected) => {
    request.post.mockResolvedValue(backendRecord);

    await lessonRecordService.create({ ...base, status: input });

    const payload = request.post.mock.calls[0][1];
    expect(payload.status).toBe(expected);
  });

  it('缺勤必须与 createDebt 同时发出（否则后端 422：只有缺勤记录可以创建欠课）', async () => {
    request.post.mockResolvedValue(backendRecord);

    await lessonRecordService.create({
      ...base,
      hours_used: 1,
      status: 'absent',
      create_debt: true,
    });

    const payload = request.post.mock.calls[0][1];
    expect(payload.status).toBe('ABSENT');
    expect(payload.createDebt).toBe(true);
  });
});
