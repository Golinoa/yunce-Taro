/**
 * 今日课表 / 排课卡片：解析课程分类展示名。
 * 用户可自建分类（仍映射 class/group/private 模式），展示应以分类名称为准，而非写死「班课/团课/私教」。
 */
import { listCourseCategoriesSync } from '@/data/course-category';
import { CLASSES } from '@/data/mock-database';
import type { CourseCategoryMode } from '@/types/course-category';

/** 按班级关联的分类 ID 解析名称（支持用户自定义分类） */
export function resolveCategoryLabelByClassId(classId?: string): string | undefined {
  if (!classId) return undefined;
  const cls = CLASSES.find((item) => item.id === classId);
  if (!cls?.categoryId) return undefined;
  return listCourseCategoriesSync().find((item) => item.id === cls.categoryId)?.name;
}

/** 按分类 ID 直接解析 */
export function resolveCategoryLabelByCategoryId(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  return listCourseCategoriesSync().find((item) => item.id === categoryId)?.name;
}

/** 无班级关联时，按模式回退到系统内置分类名 */
export function resolveCategoryLabelByMode(mode?: CourseCategoryMode): string | undefined {
  if (!mode) return undefined;
  const system = listCourseCategoriesSync().find((item) => item.isSystem && item.mode === mode);
  return system?.name;
}
