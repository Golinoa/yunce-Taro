/**
 * 课程表单校验（W2 拆页）
 */
import type { FormErrors } from './course-form-constants';

export type CourseFormValidateInput = {
  name: string;
  categoryId: string;
  subjectId: string;
  duration: string;
  capacity: string;
  endClassEnabled: boolean;
  maxLessons: string;
  isClassMode: boolean;
  experiencePrice: string;
  price: string;
};

/** 校验表单，返回错误对象（空对象表示通过） */
export function validateCourseForm(input: CourseFormValidateInput): FormErrors {
  const nextErrors: FormErrors = {};
  if (!input.name.trim()) {
    nextErrors.name = '请输入课程名称';
  }
  if (!input.categoryId) {
    nextErrors.categoryId = '请选择所属分类';
  }
  if (input.isClassMode && !input.subjectId) {
    nextErrors.subjectId = '请选择所属科目';
  }
  const durationNum = Number(input.duration);
  if (!input.duration || Number.isNaN(durationNum) || durationNum <= 0) {
    nextErrors.duration = '请输入正确的课程时长';
  }
  // 容纳人数非必填，填写时必须是正整数
  const capacityNum = Number(input.capacity);
  if (input.capacity && (Number.isNaN(capacityNum) || capacityNum <= 0)) {
    nextErrors.capacity = '请输入正确的容纳人数';
  }
  if (input.isClassMode && input.endClassEnabled) {
    const maxNum = Number(input.maxLessons);
    if (!input.maxLessons || Number.isNaN(maxNum) || maxNum < 1) {
      nextErrors.maxLessons = '请输入上限课时';
    }
  }
  // 非班课模式的价格字段校验（必填且需为有效数字）
  if (!input.isClassMode) {
    if (!input.experiencePrice) {
      nextErrors.experiencePrice = '请输入新客体验价';
    } else if (Number.isNaN(Number(input.experiencePrice)) || Number(input.experiencePrice) < 0) {
      nextErrors.experiencePrice = '请输入正确的价格';
    }
    if (!input.price) {
      nextErrors.price = '请输入单价';
    } else if (Number.isNaN(Number(input.price)) || Number(input.price) < 0) {
      nextErrors.price = '请输入正确的价格';
    }
  }
  return nextErrors;
}
