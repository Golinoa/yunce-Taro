/**
 * 今日课表 / 排课卡片：解析课程分类展示名
 * 用户可自建分类（仍映射 class/group/private 模式），展示应以分类名称为准。
 * 生产构建将 schedule-category-mock 替换为 stub，避免打入 mock-database。
 */
import { CATEGORY_MODE_LABEL } from '@/constants/course-category-ui';
import type { CourseCategoryMode } from '@/types/course-category';
import {
  resolveCategoryLabelByCategoryIdImpl,
  resolveCategoryLabelByClassIdImpl,
} from '@/utils/schedule-category-mock';

/** 按班级关联的分类 ID 解析名称（支持用户自定义分类） */
export function resolveCategoryLabelByClassId(classId?: string): string | undefined {
  if (!classId) return undefined;
  return resolveCategoryLabelByClassIdImpl(classId);
}

/** 按分类 ID 直接解析 */
export function resolveCategoryLabelByCategoryId(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  return resolveCategoryLabelByCategoryIdImpl(categoryId);
}

/** 无班级关联时，按模式回退到系统内置分类名 */
export function resolveCategoryLabelByMode(mode?: CourseCategoryMode): string | undefined {
  if (!mode) return undefined;
  return CATEGORY_MODE_LABEL[mode];
}
