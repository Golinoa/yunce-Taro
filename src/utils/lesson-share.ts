/**
 * 课表分享 → 家长邀约落地
 * 班课：约试听；团课开放时段：约课
 */
export type LessonShareType = 'class_lesson' | 'group_slot';

export interface LessonSharePayload {
  type: LessonShareType;
  teacherId: string;
  campusId: string;
  classId: string;
  className?: string;
  /** 班课排课 ID */
  scheduleId?: string;
  /** 团课时段 ID */
  slotId?: string;
  date: string;
  start: string;
  end: string;
}

const LANDING = '/package-lead/pages/invite-landing/index';

function enc(v: string): string {
  return encodeURIComponent(v || '');
}

/** 构建小程序分享 path（invite-landing） */
export function buildLessonSharePath(payload: LessonSharePayload): string {
  const parts = [
    `t=${enc(payload.teacherId)}`,
    `c=${enc(payload.campusId)}`,
    `st=share_link`,
    `type=${payload.type}`,
    `classId=${enc(payload.classId)}`,
    `date=${enc(payload.date)}`,
    `start=${enc(payload.start)}`,
    `end=${enc(payload.end)}`,
  ];
  if (payload.className) parts.push(`className=${enc(payload.className)}`);
  if (payload.scheduleId) parts.push(`scheduleId=${enc(payload.scheduleId)}`);
  if (payload.slotId) parts.push(`slotId=${enc(payload.slotId)}`);
  if (payload.classId) parts.push(`course=${enc(payload.classId)}`);
  return `${LANDING}?${parts.join('&')}`;
}

export function buildLessonShareTitle(payload: LessonSharePayload): string {
  const name = payload.className || '课程';
  if (payload.type === 'group_slot') {
    return `邀你预约「${name}」${payload.date} ${payload.start}`;
  }
  return `邀你试听「${name}」${payload.date} ${payload.start}`;
}

/** 落地页解析后跳转约课/试听 */
export function buildPostInviteBookingUrl(params: {
  type?: string;
  teacherId: string;
  campusId: string;
  classId?: string;
  className?: string;
  scheduleId?: string;
  slotId?: string;
  date?: string;
  start?: string;
  end?: string;
}): string {
  const base = '/package-lead/pages/trial-booking/index';
  const q = [`teacherId=${enc(params.teacherId)}`, `campusId=${enc(params.campusId)}`];
  if (params.classId) q.push(`classId=${enc(params.classId)}`);
  if (params.className) q.push(`className=${enc(params.className)}`);
  if (params.date) q.push(`date=${enc(params.date)}`);
  if (params.start) q.push(`start=${enc(params.start)}`);
  if (params.end) q.push(`end=${enc(params.end)}`);

  if (params.type === 'group_slot') {
    q.push('mode=group');
    if (params.slotId) q.push(`slotId=${enc(params.slotId)}`);
    return `${base}?${q.join('&')}`;
  }

  // 班课试听：走私教/试听约课页（带班级上下文）
  q.push('mode=private');
  if (params.scheduleId) q.push(`scheduleId=${enc(params.scheduleId)}`);
  return `${base}?${q.join('&')}`;
}
