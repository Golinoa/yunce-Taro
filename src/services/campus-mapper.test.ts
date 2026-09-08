import { describe, expect, it } from 'vitest';
import { mapBackendCampus, mapBusinessCategories, mapCampusTags } from '@/services/campus-mapper';

describe('campus-mapper', () => {
  it('mapCampusTags：裁剪长度与数量', () => {
    expect(mapCampusTags(['ab', '123456', 'a', 'b', 'c'])).toEqual(['ab', '12345', 'a', 'b']);
    expect(mapCampusTags(null)).toEqual([]);
  });

  it('mapBusinessCategories：过滤非法项', () => {
    expect(
      mapBusinessCategories([
        { categoryId: 'art', subIds: ['art_music', 1, ''] },
        { categoryId: '', subIds: [] },
        'x',
      ]),
    ).toEqual([{ categoryId: 'art', subIds: ['art_music'] }]);
  });

  it('mapBackendCampus：主档字段回填', () => {
    const campus = mapBackendCampus({
      id: 'c1',
      name: '总校',
      licenseName: '执照',
      contactName: '王五',
      region: '广东省-深圳市-南山区',
      intro: '介绍',
      businessCategories: [{ categoryId: 'yoga', subIds: ['yoga_normal'] }],
      tags: ['瑜伽'],
    });
    expect(campus.licenseName).toBe('执照');
    expect(campus.contactName).toBe('王五');
    expect(campus.region).toBe('广东省-深圳市-南山区');
    expect(campus.intro).toBe('介绍');
    expect(campus.businessCategories).toEqual([{ categoryId: 'yoga', subIds: ['yoga_normal'] }]);
    expect(campus.tags).toEqual(['瑜伽']);
  });
});
