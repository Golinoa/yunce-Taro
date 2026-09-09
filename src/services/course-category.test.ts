import { describe, expect, it } from 'vitest';
import { courseCategoryService } from '@/services/course-category';

describe('courseCategoryService', () => {
  it('fails explicitly while no backend contract exists', async () => {
    await expect(courseCategoryService.getList()).rejects.toThrow(
      'course-category 后端尚未提供课程分类列表接口',
    );
    await expect(courseCategoryService.getById('category-1')).rejects.toThrow(
      'course-category 后端尚未提供课程分类详情接口',
    );
  });
});
