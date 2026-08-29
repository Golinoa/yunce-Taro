/**
 * Mock 体验：课表分享落地页预设 path
 * 开发者模式一键打开；也可手动设为编译模式启动页
 */
import dayjs from 'dayjs';
import { buildLessonSharePath } from '@/utils/lesson-share';

/** 班课试听分享落地（未注册填信息 → 建线索 → 约试听） */
export function buildMockClassTrialInvitePath(guest = true): string {
  const path = buildLessonSharePath({
    type: 'class_lesson',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    classId: 'cls-001',
    className: '钢琴入门A班',
    scheduleId: 'sch-mock-share-class',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    start: '14:00',
    end: '15:30',
  });
  return guest ? `${path}&guest=1` : path;
}

/** 团课约课分享落地（未注册填信息 → 建线索 → 约课） */
export function buildMockGroupSlotInvitePath(guest = true): string {
  const tomorrowHour = Math.min(dayjs().hour() + 3, 20);
  const start = `${String(tomorrowHour).padStart(2, '0')}:00`;
  const end = `${String(Math.min(tomorrowHour + 1, 21)).padStart(2, '0')}:00`;
  const path = buildLessonSharePath({
    type: 'group_slot',
    teacherId: 'teacher-001',
    campusId: 'campus-center',
    classId: 'cls-group-tag-book',
    className: '团课演示·可预约',
    slotId: 'cbs-group-demo-book',
    date: dayjs().format('YYYY-MM-DD'),
    start,
    end,
  });
  return guest ? `${path}&guest=1` : path;
}
