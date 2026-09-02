import { describe, expect, it } from 'vitest';
import type { CourseCategoryConfig } from '@/types/course-category';
import type { CourseTemplate } from '@/types/course-template';
import type { CategoryLessonFee, CourseGroupFee } from '@/types/teacher';
import {
  buildCategoryLessonFees,
  buildCourseGroupFees,
  isCategoryLessonFeesChanged,
  isCourseGroupFeesChanged,
  toGroupType,
} from './builders';

describe('toGroupType', () => {
  it('映射已知 mode', () => {
    expect(toGroupType('class')).toBe('class');
    expect(toGroupType('group')).toBe('group');
    expect(toGroupType('private')).toBe('private');
  });

  it('未知 mode 回落 custom', () => {
    expect(toGroupType('other')).toBe('custom');
    expect(toGroupType('')).toBe('custom');
  });
});

describe('buildCourseGroupFees', () => {
  const categories = [
    { id: 'c1', name: '团课', mode: 'group' },
    { id: 'c2', name: '私教', mode: 'private' },
  ] as CourseCategoryConfig[];

  const templates = [
    { id: 't1', name: '瑜伽', categoryId: 'c1' },
    { id: 't2', name: '一对一', categoryId: 'c2' },
  ] as CourseTemplate[];

  it('按分类补全课程并保留已有费率', () => {
    const existing: CourseGroupFee[] = [
      {
        categoryId: 'c1',
        groupType: 'group',
        groupName: '旧名',
        useRevenueShare: true,
        courses: [
          {
            id: 'keep',
            courseId: 't1',
            courseName: '旧瑜伽',
            useRevenueShare: true,
            rate: 12,
          },
        ],
      },
    ];

    const next = buildCourseGroupFees(categories, templates, existing);
    expect(next).toHaveLength(2);
    expect(next[0].groupName).toBe('团课');
    expect(next[0].useRevenueShare).toBe(true);
    expect(next[0].courses[0]).toMatchObject({
      id: 'keep',
      courseId: 't1',
      courseName: '瑜伽',
      useRevenueShare: true,
      rate: 12,
    });
    expect(next[1].courses[0].courseId).toBe('t2');
    expect(next[1].courses[0].rate).toBe('');
  });
});

describe('buildCategoryLessonFees', () => {
  const categories = [
    { id: 'c1', name: '新团课名', mode: 'group' },
  ] as CourseCategoryConfig[];

  it('已有项保留并刷新 name/groupType', () => {
    const existing: CategoryLessonFee[] = [
      {
        id: 'cl1',
        categoryId: 'c1',
        name: '旧名',
        groupType: 'custom',
        algorithm: 'fixed',
        fixedRate: 80,
        tiers: [],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [],
        perfPayoutMode: 'revenue_share',
      },
    ];
    const next = buildCategoryLessonFees(categories, existing);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: 'cl1',
      name: '新团课名',
      groupType: 'group',
      algorithm: 'fixed',
      fixedRate: 80,
    });
  });

  it('缺失分类生成默认项', () => {
    const next = buildCategoryLessonFees(categories, []);
    expect(next).toHaveLength(1);
    expect(next[0].categoryId).toBe('c1');
    expect(next[0].algorithm).toBe('default');
    expect(next[0].tiers).toHaveLength(1);
  });
});

describe('change detectors', () => {
  it('isCourseGroupFeesChanged 检测课程 id 变化', () => {
    const a: CourseGroupFee[] = [
      {
        categoryId: 'c1',
        groupType: 'group',
        groupName: '团课',
        useRevenueShare: false,
        courses: [{ id: '1', courseId: 't1', courseName: 'A', useRevenueShare: false, rate: '' }],
      },
    ];
    const b: CourseGroupFee[] = [
      {
        ...a[0],
        courses: [{ id: '1', courseId: 't2', courseName: 'B', useRevenueShare: false, rate: '' }],
      },
    ];
    expect(isCourseGroupFeesChanged(b, a)).toBe(true);
    expect(isCourseGroupFeesChanged(a, a)).toBe(false);
  });

  it('isCategoryLessonFeesChanged 检测 categoryId 变化', () => {
    const a: CategoryLessonFee[] = [
      {
        id: '1',
        categoryId: 'c1',
        name: 'x',
        groupType: 'group',
        algorithm: 'default',
        fixedRate: '',
        tiers: [],
        feeBasis: 'hours',
        calcMethod: 'tier_unified',
        perfTiers: [],
        perfPayoutMode: 'revenue_share',
      },
    ];
    const b = [{ ...a[0], categoryId: 'c2' }];
    expect(isCategoryLessonFeesChanged(b, a)).toBe(true);
    expect(isCategoryLessonFeesChanged(a, a)).toBe(false);
  });
});
