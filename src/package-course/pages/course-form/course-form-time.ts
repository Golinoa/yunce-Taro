/**
 * 课程时长 ↔ 起止时间换算（W2 拆页）
 */

/** 从 HH:mm 起止时间推算课程时长（分钟） */
export function parseDurationMinutes(start?: string, end?: string): string {
  if (!start || !end) return '';
  const [sh, sm] = start.split(':').map((v) => Number(v) || 0);
  const [eh, em] = end.split(':').map((v) => Number(v) || 0);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? String(minutes) : '';
}

/** 课程时长 → 默认时段（仅用于落库 start/end，表单以分钟为准） */
export function durationToTimeRange(minutes: number): { start: string; end: string } {
  const startMinutes = 9 * 60;
  const endMinutes = startMinutes + Math.max(1, minutes);
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return { start: fmt(startMinutes), end: fmt(endMinutes) };
}
