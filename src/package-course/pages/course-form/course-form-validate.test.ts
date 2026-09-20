import { describe, expect, it } from 'vitest';
import { validateCourseForm } from './course-form-validate';

const base = {
  name: '钢琴启蒙',
  categoryId: '11111111-1111-4111-8111-111111111111',
  subjectId: 'sub-1',
  duration: '60',
  capacity: '',
  endClassEnabled: false,
  maxLessons: '',
  isClassMode: true,
  experiencePrice: '',
  price: '',
};

describe('validateCourseForm', () => {
  it('passes for a valid class-mode form', () => {
    expect(validateCourseForm(base)).toEqual({});
  });

  it('requires name and category', () => {
    expect(validateCourseForm({ ...base, name: '  ', categoryId: '' })).toEqual({
      name: '请输入课程名称',
      categoryId: '请选择所属分类',
    });
  });

  it('blocks UI-only fallback category IDs from being submitted', () => {
    expect(validateCourseForm({ ...base, categoryId: 'cat-class' }).categoryId).toBe(
      '课程分类加载失败，请返回重试',
    );
  });

  it('requires subject only in class mode', () => {
    expect(validateCourseForm({ ...base, subjectId: '' }).subjectId).toBe('请选择所属科目');
    expect(
      validateCourseForm({
        ...base,
        isClassMode: false,
        subjectId: '',
        experiencePrice: '1',
        price: '2',
      }).subjectId,
    ).toBeUndefined();
  });

  it('validates duration and optional capacity', () => {
    expect(validateCourseForm({ ...base, duration: '0' }).duration).toBe('请输入正确的课程时长');
    expect(validateCourseForm({ ...base, capacity: '-1' }).capacity).toBe('请输入正确的容纳人数');
    expect(validateCourseForm({ ...base, capacity: '' }).capacity).toBeUndefined();
  });

  it('requires maxLessons when endClassEnabled in class mode', () => {
    expect(validateCourseForm({ ...base, endClassEnabled: true, maxLessons: '' }).maxLessons).toBe(
      '请输入上限课时',
    );
  });

  it('requires prices in non-class mode', () => {
    const errors = validateCourseForm({
      ...base,
      isClassMode: false,
      experiencePrice: '',
      price: 'abc',
    });
    expect(errors.experiencePrice).toBe('请输入新客体验价');
    expect(errors.price).toBe('请输入正确的价格');
  });
});
