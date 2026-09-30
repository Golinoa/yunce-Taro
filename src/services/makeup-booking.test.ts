/**
 * 补课预约 Service 单测
 *
 * 重点钉住一个真实事故：后端 `mapBooking` 返回 **camelCase**（lessonDate / startTime /
 * scheduleId…），前端类型是 **snake_case**。早先 service 直接把响应当成前端类型用、
 * 没有任何映射 ⇒ `b.lesson_date` / `b.start_time` 恒为 undefined，
 * `getByClassDate` 的防御过滤把所有补课预约**全部过滤掉**
 * （表现为「补课学员从不出现在点名名单」）。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getMakeupBookingsByClassDate } from './makeup-booking';

const mockGet = vi.fn();
const mockPost = vi.fn();

// vi.mock 会被提升到 import 之前，故这里用静态 import 即可
vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => mockGet(...(args as [])),
  post: (...args: unknown[]) => mockPost(...(args as [])),
}));

/** 后端真实形状（camelCase） */
const backendRow = {
  id: 'mb-1',
  organizationId: 'org-1',
  campusId: null,
  studentId: 'stu-1',
  classId: 'class-1',
  originalClassId: null,
  leaveRequestId: null,
  lessonDate: '2026-10-05',
  startTime: '09:00',
  endTime: '10:00',
  scheduleId: 'sched-0900',
  teacherId: 't-1',
  teacherName: '张老师',
  source: 'teacher',
  note: null,
  status: 'confirmed',
  createdBy: 'u-1',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('getMakeupBookingsByClassDate', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
  });

  it('把后端 camelCase 映射成前端 snake_case（否则过滤会全军覆没）', async () => {
    mockGet.mockResolvedValue({ list: [backendRow] });

    const list = await getMakeupBookingsByClassDate({
      classId: 'class-1',
      lessonDate: '2026-10-05',
      startTime: '09:00',
    });

    expect(list).toHaveLength(1);
    expect(list[0].lesson_date).toBe('2026-10-05');
    expect(list[0].start_time).toBe('09:00');
    expect(list[0].student_id).toBe('stu-1');
    // 「哪一节」的排课编号：有了它，同日调课改了时段也不会失配
    expect(list[0].schedule_id).toBe('sched-0900');
  });

  it('时段不匹配的同班同天预约被排除（只认这一节）', async () => {
    mockGet.mockResolvedValue({
      list: [{ ...backendRow, id: 'mb-2', startTime: '14:00', scheduleId: 'sched-1400' }],
    });

    const list = await getMakeupBookingsByClassDate({
      classId: 'class-1',
      lessonDate: '2026-10-05',
      startTime: '09:00',
    });

    expect(list).toHaveLength(0);
  });

  it('未确认（pending / cancelled）的预约不进名单', async () => {
    mockGet.mockResolvedValue({
      list: [
        { ...backendRow, id: 'mb-3', status: 'pending' },
        { ...backendRow, id: 'mb-4', status: 'cancelled' },
      ],
    });

    const list = await getMakeupBookingsByClassDate({
      classId: 'class-1',
      lessonDate: '2026-10-05',
    });

    expect(list).toHaveLength(0);
  });
});
