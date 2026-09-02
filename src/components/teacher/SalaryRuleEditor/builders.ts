import type { CourseCategoryConfig } from '@/types/course-category';
import type { CourseTemplate } from '@/types/course-template';
import type {
  CategoryLessonFee,
  CourseFeeItem,
  CourseGroupFee,
  CourseGroupType,
} from '@/types/teacher';

export function uid() {
  return `r${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** 把课程分类模式映射为分组类型 */
export function toGroupType(mode: string): CourseGroupType {
  if (mode === 'class' || mode === 'group' || mode === 'private') return mode;
  return 'custom';
}

/** 根据分类和课程模板构建/补全「按课程设置」分组 */
export function buildCourseGroupFees(
  categories: CourseCategoryConfig[],
  templates: CourseTemplate[],
  existing: CourseGroupFee[],
): CourseGroupFee[] {
  return categories.map((cat) => {
    const existingGroup = existing.find((g) => g.categoryId === cat.id);
    const groupType = toGroupType(cat.mode);
    const catTemplates = templates.filter((t) => t.categoryId === cat.id);
    const existingCourses = existingGroup?.courses || [];

    const courses: CourseFeeItem[] = catTemplates.map((t) => {
      const existingCourse = existingCourses.find((c) => c.courseId === t.id);
      return {
        id: existingCourse?.id || uid(),
        courseId: t.id,
        courseName: t.name,
        useRevenueShare: existingCourse?.useRevenueShare ?? false,
        rate: existingCourse?.rate ?? '',
      };
    });

    return {
      categoryId: cat.id,
      groupType,
      groupName: cat.name,
      useRevenueShare: existingGroup?.useRevenueShare ?? false,
      courses,
    };
  });
}

/** 创建单个分类的默认单独设置 */
export function createDefaultCategoryLessonFee(cat: CourseCategoryConfig): CategoryLessonFee {
  return {
    id: uid(),
    categoryId: cat.id,
    name: cat.name,
    groupType: toGroupType(cat.mode),
    algorithm: 'default',
    fixedRate: '',
    tiers: [{ id: uid(), threshold: '', rate: '' }],
    feeBasis: 'hours',
    calcMethod: 'tier_unified',
    perfTiers: [{ id: uid(), threshold: '', rate: '' }],
    perfPayoutMode: 'revenue_share',
  };
}

/** 根据分类构建/补全「按课程分类单独设置」 */
export function buildCategoryLessonFees(
  categories: CourseCategoryConfig[],
  existing: CategoryLessonFee[],
): CategoryLessonFee[] {
  return categories.map((cat) => {
    const existingItem = existing.find((e) => e.categoryId === cat.id);
    if (existingItem) {
      return {
        ...existingItem,
        name: cat.name,
        groupType: toGroupType(cat.mode),
      };
    }
    return createDefaultCategoryLessonFee(cat);
  });
}

/** 判断 courseGroupFees 是否需要同步补全 */
export function isCourseGroupFeesChanged(next: CourseGroupFee[], prev: CourseGroupFee[]): boolean {
  return (
    next.length !== prev.length ||
    next.some((g, idx) => {
      const old = prev[idx];
      return (
        !old ||
        g.categoryId !== old.categoryId ||
        g.courses.length !== old.courses.length ||
        g.courses.some((c, cidx) => {
          const oldC = old.courses[cidx];
          return !oldC || c.courseId !== oldC.courseId;
        })
      );
    })
  );
}

/** 判断 categoryLessonFees 是否需要同步补全 */
export function isCategoryLessonFeesChanged(
  next: CategoryLessonFee[],
  prev: CategoryLessonFee[],
): boolean {
  return (
    next.length !== prev.length ||
    next.some((item, idx) => {
      const old = prev[idx];
      return !old || item.categoryId !== old.categoryId;
    })
  );
}
