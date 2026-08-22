/**
 * 课时不足预警「触发即提醒一次」Service 辅助
 * 页面在扣课时/消课成功后调用，统计本轮新触发的预警数（内部自动去重记录）。
 */
import { checkThresholdAlert, resetStudentAlert } from '@/data/operation-alert';

export interface AlertCheckItem {
  studentId: string;
  /** 扣课时后的剩余课时 */
  remainingHours: number;
}

/**
 * 批量检查并返回【本轮新触发】的预警数量（触发即记录，重复进入不计数）。
 * 页面拿到 >0 时提示"已提醒 N 名课时不足学员"。
 */
export function countTriggeredAlerts(items: AlertCheckItem[]): number {
  return items.reduce(
    (n, it) => (checkThresholdAlert(it.studentId, it.remainingHours) === 'triggered' ? n + 1 : n),
    0,
  );
}

/** 剩余课时回升时清除提醒记录（撤销消课回补 / 充值加课时后调用） */
export function clearStudentAlert(studentId: string): void {
  resetStudentAlert(studentId);
}
