import { describe, expect, it } from 'vitest';
import { buildCourseFormDirtyKey, type CourseFormDirtySnapshot } from './course-form-constants';

const baseSnapshot = (): CourseFormDirtySnapshot => ({
  name: '启蒙班',
  categoryId: 'cat-1',
  duration: '60',
  capacity: '',
  endClassEnabled: false,
  maxLessons: '',
  color: '#5EC8A8',
  subjectId: 'sub-1',
  ageGroup: 'mix',
  customAgeGroups: [],
  experiencePrice: '',
  price: '',
  minOpenCount: '',
  bookingDeadline: '60',
  cancelQueueTime: '60',
  nonCancelTime: '120',
  autoCheckin: 'follow_category',
  studentSelfCheckin: 'follow_category',
  allowCheckinRoles: ['teacher'],
  level: 'all',
  customLevels: [],
  description: '',
  backgroundImage: '',
  homeImage: '',
  teacherId: '',
  assistantId: '',
  studentIds: [],
  hoursPerLesson: '1',
  feePerLesson: '',
});

describe('buildCourseFormDirtyKey', () => {
  it('changes when only endClassEnabled differs', () => {
    const a = buildCourseFormDirtyKey(baseSnapshot());
    const b = buildCourseFormDirtyKey({ ...baseSnapshot(), endClassEnabled: true });
    expect(a).not.toBe(b);
  });

  it('changes when only maxLessons differs', () => {
    const a = buildCourseFormDirtyKey(baseSnapshot());
    const b = buildCourseFormDirtyKey({ ...baseSnapshot(), maxLessons: '24' });
    expect(a).not.toBe(b);
  });

  it('stays equal when endClassEnabled and maxLessons are unchanged', () => {
    expect(buildCourseFormDirtyKey(baseSnapshot())).toBe(buildCourseFormDirtyKey(baseSnapshot()));
  });
});
