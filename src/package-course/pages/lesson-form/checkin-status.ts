/** 签到状态：签到/请假/未到 */
export type CheckinStatus = 'checked' | 'leave' | 'absent';

/** 已点名班级的交互模式 */
export type ClassAttendanceMode = 'normal' | 'view' | 'edit' | 'supplement';

export function buildCheckinBaseline(
  studentIds: string[],
  checkedIds: Set<string>,
  leaveIds: Set<string>,
): Map<string, CheckinStatus> {
  const baseline = new Map<string, CheckinStatus>();
  studentIds.forEach((id) => {
    if (leaveIds.has(id)) {
      baseline.set(id, 'leave');
    } else if (checkedIds.has(id)) {
      baseline.set(id, 'checked');
    } else {
      baseline.set(id, 'absent');
    }
  });
  return baseline;
}

/** 状态对应样式 */
export const CHECKIN_OPTION_STYLES: Record<
  CheckinStatus,
  { label: string; activeBg: string; activeText: string; activeBorder?: string }
> = {
  checked: { label: '签到', activeBg: 'bg-success', activeText: 'text-white' },
  leave: { label: '请假', activeBg: 'bg-destructive', activeText: 'text-white' },
  absent: { label: '未到', activeBg: 'bg-warning', activeText: 'text-white' },
};
