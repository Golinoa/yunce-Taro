/**
 * 邀约落地页：预约成功态本地持久化
 *
 * 按「具体场次/时段」区分，不是按老师或课程笼统记住。
 * 例：老师分享两个时间段，预约 A 后再打开 B → B 仍走正常预约流程。
 * 仅当再次打开「已预约的同一场次」时，才直接展示成功页。
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce_invite_landing_success_v2';

export type InviteLandingSuccessGender = 'male' | 'female' | '';

export interface InviteLandingSuccessRecord {
  lessonKey: string;
  visitorKey: string;
  parentUserId?: string;
  childName: string;
  childAge: string;
  childGender: InviteLandingSuccessGender;
  parentPhone: string;
  courseTitle?: string;
  date?: string;
  start?: string;
  end?: string;
  type?: 'class_lesson' | 'group_slot';
  campusId?: string;
  teacherId?: string;
  bookedAt: string;
  /** 过期场次仅留意向，无本场预约 */
  intentOnly?: boolean;
}

/** 场次身份：老师 + 校区 + 班级 + 排课/时段 + 日期时段 */
export function buildInviteLessonKey(parts: {
  type?: string;
  teacherId?: string;
  campusId?: string;
  classId?: string;
  scheduleId?: string;
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
}): string {
  const sessionId = parts.slotId || parts.scheduleId || '';
  return [
    parts.type || 'class_lesson',
    parts.teacherId || '',
    parts.campusId || '',
    parts.classId || '',
    sessionId,
    parts.date || '',
    parts.start || '',
    parts.end || '',
  ].join('|');
}

/** 缺日期/开始时间则不足以标识场次，禁止据此恢复成功页 */
export function isInviteLessonKeyComplete(lessonKey: string): boolean {
  const parts = lessonKey.split('|');
  if (parts.length < 8) return false;
  const date = parts[5] || '';
  const start = parts[6] || '';
  const classId = parts[3] || '';
  const sessionId = parts[4] || '';
  return Boolean(date && start && (classId || sessionId));
}

function readAll(): InviteLandingSuccessRecord[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    return Array.isArray(raw) ? (raw as InviteLandingSuccessRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: InviteLandingSuccessRecord[]): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, items.slice(0, 40));
  } catch {
    // ignore
  }
}

export function saveInviteLandingSuccess(record: InviteLandingSuccessRecord): void {
  if (!isInviteLessonKeyComplete(record.lessonKey)) return;

  const all = readAll().filter((item) => {
    const sameLesson = item.lessonKey === record.lessonKey;
    const sameVisitor = item.visitorKey === record.visitorKey;
    const sameParent = Boolean(record.parentUserId) && item.parentUserId === record.parentUserId;
    return !(sameLesson && (sameVisitor || sameParent));
  });
  all.unshift(record);
  writeAll(all);
}

export function findInviteLandingSuccess(params: {
  lessonKey: string;
  visitorKey: string;
  parentUserId?: string;
}): InviteLandingSuccessRecord | null {
  if (!isInviteLessonKeyComplete(params.lessonKey)) return null;

  const all = readAll();
  return (
    all.find((item) => {
      // 必须同一场次（含具体日期时段），才算已预约
      if (item.lessonKey !== params.lessonKey) return false;
      if (item.visitorKey === params.visitorKey) return true;
      if (params.parentUserId && item.parentUserId === params.parentUserId) return true;
      return false;
    }) || null
  );
}
