import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COURSE_CATEGORY_CONFIGS,
  resolveCourseCategoriesFromApi,
} from './course-category-defaults';

describe('resolveCourseCategoriesFromApi', () => {
  it('API 返回空数组时保留默认班课/团课/私教且独立展示', () => {
    const result = resolveCourseCategoriesFromApi([]);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.name)).toEqual(['班课', '团课', '私教']);
    expect(result.every((c) => c.independentDisplay === true)).toBe(true);
    expect(result.map((c) => c.id)).toEqual(DEFAULT_COURSE_CATEGORY_CONFIGS.map((c) => c.id));
  });

  it('API 有数据时按 sortOrder 使用远端列表', () => {
    const custom: typeof DEFAULT_COURSE_CATEGORY_CONFIGS = [
      {
        ...DEFAULT_COURSE_CATEGORY_CONFIGS[0],
        id: 'custom-1',
        name: '自定义',
        sortOrder: 2,
        independentDisplay: false,
      },
      {
        ...DEFAULT_COURSE_CATEGORY_CONFIGS[1],
        id: 'custom-2',
        name: '甲',
        sortOrder: 1,
        independentDisplay: true,
      },
    ];
    const result = resolveCourseCategoriesFromApi(custom);
    expect(result.map((c) => c.id)).toEqual(['custom-2', 'custom-1']);
  });
});
