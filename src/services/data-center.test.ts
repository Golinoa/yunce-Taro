import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataCenterService } from '@/services/data-center';

const getMock = vi.fn();

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: vi.fn(),
}));

describe('dataCenterService 校区请求契约', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({});
  });

  it('概览和趋势请求带当前校区', async () => {
    await dataCenterService.getVenueOverview({ campusId: 'campus-1' });
    await dataCenterService.getRevenueTrend({ period: 'month', campusId: 'campus-1' });

    expect(getMock).toHaveBeenNthCalledWith(1, '/data-center/venue-overview?campusId=campus-1');
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/data-center/revenue-trend?period=month&campusId=campus-1',
    );
  });

  it('详情请求保留周期参数并带当前校区', async () => {
    await dataCenterService.getMemberDetail({
      month: '2026-09',
      periodType: 'month',
      campusId: 'campus-1',
    });

    expect(getMock).toHaveBeenCalledWith(
      '/data-center/member/detail?month=2026-09&periodType=month&campusId=campus-1',
    );
  });
});
