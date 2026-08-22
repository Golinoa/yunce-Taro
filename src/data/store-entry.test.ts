import { describe, it, expect, vi } from 'vitest';
import { campusService } from '@/services/campus';
import { mockSubmitStoreEntry } from '@/data/store-entry';

/**
 * 门店入驻提交回归测试（对应修复 L-18）
 * mock 同步建校区：返回 status 'approved' 且携带 campusId；
 * 门店类型正确映射为校区类型（总店→main，分店→self）。
 */
vi.mock('@/services/campus', () => ({
  campusService: {
    add: vi.fn(async (data: any) => ({ id: 'campus_test_1', ...data })),
  },
}));

describe('门店入驻提交（L-18）', () => {
  it('mock 同步建校区：返回 approved 且携带 campusId', async () => {
    const result = await mockSubmitStoreEntry({
      name: '瑜伽旗舰店',
      type: '总店',
      region: ['浙江省', '杭州市', '西湖区'],
      address: '文三路 100 号',
      contactName: '王校长',
      contactPhone: '13900000001',
    });

    expect(result.status).toBe('approved');
    expect(result.campusId).toBe('campus_test_1');
  });

  it('门店类型正确映射为校区类型（分店→self，非主校区）', async () => {
    const add = campusService.add as unknown as ReturnType<typeof vi.fn>;
    add.mockClear();

    await mockSubmitStoreEntry({
      name: '分店A',
      type: '分店',
      region: ['浙江省', '杭州市', '西湖区'],
      address: '文三路 200 号',
      contactName: '李店长',
      contactPhone: '13900000002',
    });

    expect(add.mock.calls[0][0].type).toBe('self');
    expect(add.mock.calls[0][0].isMain).toBe(false);
  });
});
