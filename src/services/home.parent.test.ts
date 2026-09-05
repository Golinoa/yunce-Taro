/**
 * 家长首页 service（真 API 契约）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { homeService } from '@/services/home';

const getMock = vi.fn();

vi.mock('@/utils/build-env', () => ({
  isUseMock: () => false,
  isDevApiEnv: () => true,
  getApiBaseUrl: () => 'https://dev.chancore.cn/api/app/v1',
}));

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('homeService 家长端', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('getQuickEntries：家长 / 教师 / 校长分角色金刚区', () => {
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

  it('getParent：聚合 GET /home/parent', async () => {
    getMock.mockResolvedValueOnce({
      students: [
        {
          id: 'stu-001',
          name: '张小明',
          avatar: null,
          remainingHours: 15,
          packages: [
            {
              id: 'pkg-1',
              name: '钢琴课包',
              totalHours: 60,
              usedHours: 45,
              remainingHours: 15,
            },
            {
              id: 'pkg-2',
              name: '乐理课包',
              totalHours: 24,
              usedHours: 19,
              remainingHours: 5,
            },
          ],
        },
      ],
      todaySchedules: [
        {
          id: 'sch-1',
          startTime: '14:00',
          endTime: '15:00',
          class: { id: 'cls-001', name: '钢琴' },
        },
      ],
    });

    const data = await homeService.getParent('user-parent-001');

    expect(getMock).toHaveBeenCalledWith('/home/parent');
    expect(data).not.toBeNull();
    expect(data!.students.length).toBeGreaterThan(0);
    expect(data!.packages.length).toBeGreaterThan(0);
    expect(data!.packages.length).toBeLessThanOrEqual(2);
    expect(Array.isArray(data!.todaySchedules)).toBe(true);
  });

  it('getParent：带 campusId 时拼 query', async () => {
    getMock.mockResolvedValueOnce({
      students: [],
      todaySchedules: [],
      packages: [],
      unreadCount: 0,
    });
    await homeService.getParent('user-parent-001', 'campus-east');
    expect(getMock).toHaveBeenCalledWith('/home/parent?campusId=campus-east');
  });

  it('getParent：接口失败返回 null 而非抛错', async () => {
    getMock.mockRejectedValueOnce(new Error('network'));
    const data = await homeService.getParent('user-parent-not-exists');
    expect(data).toBeNull();
  });
});
