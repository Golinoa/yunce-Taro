/**
 * 家长首页 service 聚合（Mock 路径）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/build-env', () => ({
  isUseMock: () => true,
}));

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('homeService 家长端', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getQuickEntries：家长 / 教师 / 校长分角色金刚区', async () => {
    const { homeService } = await import('@/services/home');
    const parentEntries = homeService.getQuickEntries('parent');
    const teacherEntries = homeService.getQuickEntries('teacher');
    const managerEntries = homeService.getQuickEntries('principal');

    expect(parentEntries).toHaveLength(8);
    expect(parentEntries.map((e) => e.label)).toEqual([
      '请假',
      '我要约课',
      '我的课表',
      '我的课时',
      '上课记录',
      '课后作业',
      '课堂点评',
      '成长档案',
    ]);
    expect(teacherEntries).toHaveLength(6);
    expect(teacherEntries[0]?.label).toBe('学员');
    expect(managerEntries[0]?.label).toBe('课时充值');
    expect(homeService.getQuickEntries(null)).toEqual(managerEntries);
  });

  it('getParent：聚合子女、今日课表与最多 2 张课包卡', async () => {
    const { homeService } = await import('@/services/home');
    const data = await homeService.getParent('user-parent-001');

    expect(data).not.toBeNull();
    expect(data!.students.length).toBeGreaterThan(0);
    expect(data!.packages.length).toBeGreaterThan(0);
    expect(data!.packages.length).toBeLessThanOrEqual(2);
    expect(data!.packages.every((p) => Boolean(p.studentId && p.name))).toBe(true);
    expect(Array.isArray(data!.todaySchedules)).toBe(true);
    for (const schedule of data!.todaySchedules) {
      expect(schedule.start_time).toMatch(/^\d{2}:\d{2}$/);
      expect(schedule.end_time).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('getParent：未知家长返回空聚合而非抛错', async () => {
    const { homeService } = await import('@/services/home');
    const data = await homeService.getParent('user-parent-not-exists');
    expect(data).not.toBeNull();
    expect(data!.students).toEqual([]);
    expect(data!.todaySchedules).toEqual([]);
    expect(data!.packages).toEqual([]);
  });
});
