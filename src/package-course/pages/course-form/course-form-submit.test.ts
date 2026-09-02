import { describe, expect, it } from 'vitest';
import {
  buildClassSavePayload,
  buildTemplateFormData,
  getCategoryModeSwitchLosingFields,
} from './course-form-submit';

describe('getCategoryModeSwitchLosingFields', () => {
  it('flags class fields when leaving class mode data', () => {
    expect(
      getCategoryModeSwitchLosingFields({
        isClassMode: true,
        teacherId: 't1',
        assistantId: '',
        studentIds: [],
        experiencePrice: '',
        price: '',
        minOpenCount: '',
      }),
    ).toEqual(['授课老师/助教/上课学员']);
  });

  it('flags price fields when leaving non-class data', () => {
    expect(
      getCategoryModeSwitchLosingFields({
        isClassMode: false,
        teacherId: '',
        assistantId: '',
        studentIds: [],
        experiencePrice: '99',
        price: '',
        minOpenCount: '',
      }),
    ).toEqual(['价格/开课人数设置']);
  });

  it('returns empty when nothing would be ignored', () => {
    expect(
      getCategoryModeSwitchLosingFields({
        isClassMode: true,
        teacherId: '',
        assistantId: '',
        studentIds: [],
        experiencePrice: '',
        price: '',
        minOpenCount: '',
      }),
    ).toEqual([]);
  });
});

describe('buildTemplateFormData', () => {
  it('strips price fields in class mode and converts yuan to fen', () => {
    const classData = buildTemplateFormData({
      name: ' 班课 ',
      categoryId: 'c1',
      category: 'class',
      duration: '60',
      capacity: '',
      color: '#5EC8A8',
      subjectId: 's1',
      subjectName: '钢琴',
      ageGroup: 'mix',
      experiencePrice: '10',
      price: '20',
      minOpenCount: '3',
      bookingDeadline: '60',
      cancelQueueTime: '60',
      nonCancelTime: '120',
      autoCheckin: 'follow_category',
      studentSelfCheckin: 'follow_category',
      allowCheckinRoles: ['teacher'],
      level: 'all',
      description: '',
      isClassMode: true,
      teacherId: 't1',
      teacherName: '张老师',
      assistantId: '',
      studentIds: ['stu-1'],
    });
    expect(classData.experiencePrice).toBeUndefined();
    expect(classData.price).toBeUndefined();
    expect(classData.teacherId).toBe('t1');
    expect(classData.studentIds).toEqual(['stu-1']);
    expect(classData.capacity).toBe(0);

    const groupData = buildTemplateFormData({
      ...classData,
      name: '团课',
      category: 'group',
      isClassMode: false,
      experiencePrice: '10.5',
      price: '20',
      minOpenCount: '2',
      teacherId: 't1',
      teacherName: '张老师',
      studentIds: ['stu-1'],
      ageGroup: 'custom:中老年',
      level: 'custom:入门',
      bookingDeadline: '60',
      cancelQueueTime: '60',
      nonCancelTime: '120',
      autoCheckin: 'follow_category',
      studentSelfCheckin: 'follow_category',
      allowCheckinRoles: ['teacher'],
      description: ' 简介 ',
      categoryId: 'c1',
      duration: '45',
      capacity: '8',
      color: '#5EC8A8',
      subjectId: '',
      assistantId: '',
    });
    expect(groupData.experiencePrice).toBe(1050);
    expect(groupData.price).toBe(2000);
    expect(groupData.teacherId).toBeUndefined();
    expect(groupData.studentIds).toBeUndefined();
    expect(groupData.ageGroup).toBe('mix');
    expect(groupData.customAgeGroup).toBe('中老年');
    expect(groupData.level).toBe('all');
    expect(groupData.customLevel).toBe('入门');
    expect(groupData.description).toBe('简介');
    expect(groupData.capacity).toBe(8);
  });
});

describe('buildClassSavePayload', () => {
  it('maps color / duration / limited lessons', () => {
    const payload = buildClassSavePayload({
      name: ' 启蒙班 ',
      color: '#E57373',
      teacherId: 't1',
      assistantId: 't2',
      categoryId: 'c1',
      subjectId: 's1',
      level: 'basic',
      description: '备注',
      minOpenCount: '',
      hoursPerLesson: '2',
      feePerLesson: '50',
      endClassEnabled: true,
      maxLessons: '24',
      capacity: '10',
      duration: '90',
      studentIds: ['a', 'b'],
      campusId: 'camp-1',
      homeImageUrl: 'https://img/home',
      backgroundImageUrl: undefined,
    });
    expect(payload.color).toBe('red');
    expect(payload.type).toBe('limited');
    expect(payload.total_lessons).toBe(24);
    expect(payload.start_time).toBe('09:00');
    expect(payload.end_time).toBe('10:30');
    expect(payload.teachers).toEqual(['t1', 't2']);
    expect(payload.student_count).toBe(2);
    expect(payload.homeImage).toBe('https://img/home');
    expect(payload.backgroundImage).toBeNull();
  });
});
