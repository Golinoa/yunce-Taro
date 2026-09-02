/**
 * L1 试听邀约落地页（invite-landing）路由参数解析与展示派生（纯函数）
 */
import dayjs from 'dayjs';

export type InviteLandingSourceType = 'share_link' | 'qr';
export type InviteLandingLessonType = 'class_lesson' | 'group_slot';
export type InviteLandingChildGender = 'male' | 'female';

export interface InviteLandingParams {
  t: string;
  c: string;
  course?: string;
  st?: InviteLandingSourceType;
  type?: InviteLandingLessonType;
  classId?: string;
  className?: string;
  scheduleId?: string;
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
  guest?: boolean;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** decodeURIComponent 容错：非法编码原样返回 */
export function decodeInviteLandingParam(raw?: string): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 从 useLoad / 启动 options 解析落地页参数（含 guest / type 归一化） */
export function parseInviteLandingParams(
  options: Record<string, string | undefined>,
): InviteLandingParams {
  const typeRaw = options.type || '';
  return {
    t: decodeInviteLandingParam(options.t),
    c: decodeInviteLandingParam(options.c),
    course: decodeInviteLandingParam(options.course || options.classId),
    st: options.st === 'qr' ? 'qr' : 'share_link',
    type:
      typeRaw === 'group_slot'
        ? 'group_slot'
        : typeRaw === 'class_lesson'
          ? 'class_lesson'
          : undefined,
    classId: decodeInviteLandingParam(options.classId || options.course),
    className: decodeInviteLandingParam(options.className),
    scheduleId: decodeInviteLandingParam(options.scheduleId),
    slotId: decodeInviteLandingParam(options.slotId),
    date: decodeInviteLandingParam(options.date),
    start: decodeInviteLandingParam(options.start),
    end: decodeInviteLandingParam(options.end),
    guest: options.guest === '1' || options.guest === 'true',
  };
}

export function formatInviteLandingDateLabel(date?: string): string {
  if (!date) return '';
  const d = dayjs(date);
  if (!d.isValid()) return date;
  return `${d.format('M月D日')} ${WEEKDAY_LABELS[d.day()]}`;
}

export function formatInviteLandingTimeLabel(start?: string, end?: string): string {
  return start && end ? `${start}–${end}` : '';
}

export function resolveInviteLandingCourseTitle(params: {
  className?: string;
  type?: InviteLandingLessonType;
}): string {
  return params.className || (params.type === 'group_slot' ? '团课' : '班课试听');
}

export function isInviteLandingGroupBook(type?: InviteLandingLessonType): boolean {
  return type === 'group_slot';
}

export function hasInviteLandingLessonContext(params: {
  classId?: string;
  date?: string;
  start?: string;
  end?: string;
}): boolean {
  return Boolean(params.classId && params.date && params.start && params.end);
}

export function genderLabelOf(gender: InviteLandingChildGender | ''): string {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '';
}
