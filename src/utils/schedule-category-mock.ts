/**
 * Mock 专用：课表分类名解析（生产构建时由 webpack 替换为 stub）
 */
import { listCourseCategoriesSync } from '@/data/course-category';
import { CLASSES } from '@/data/mock-database';

export function resolveCategoryLabelByClassIdImpl(classId: string): string | undefined {
  const cls = CLASSES.find((item) => item.id === classId);
  if (!cls?.categoryId) return undefined;
  return listCourseCategoriesSync().find((item) => item.id === cls.categoryId)?.name;
}

export function resolveCategoryLabelByCategoryIdImpl(categoryId: string): string | undefined {
  return listCourseCategoriesSync().find((item) => item.id === categoryId)?.name;
}
