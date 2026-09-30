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

  it('详情请求走 date 锚点，周期决定区间粒度', async () => {
    await dataCenterService.getFinanceDetail({
      date: '2026-09-29',
      periodType: 'day',
      campusId: 'campus-1',
    });
    await dataCenterService.getSalaryDetail({ date: '2026-09-29', periodType: 'year' });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      '/data-center/finance/detail?date=2026-09-29&periodType=day&campusId=campus-1',
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      '/data-center/salary/detail?date=2026-09-29&periodType=year',
    );
  });

  it('空值参数不拼进 URL（历史上 month= 空串被判 400 的根因）', async () => {
    await dataCenterService.getMemberDetail({ month: '', periodType: 'month' });
    await dataCenterService.getCardDetail({ date: '', periodType: 'month' });

    expect(getMock).toHaveBeenNthCalledWith(1, '/data-center/member/detail?periodType=month');
    expect(getMock).toHaveBeenNthCalledWith(2, '/data-center/card/detail?periodType=month');
  });
});
