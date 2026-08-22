/**
 * 课时不足预警「触发与去重」记录（用户口径 2026-08-22）
 *
 * 提醒时机：下课后扣完课时，学员剩余课时降到阈值（≤ 阈值 或 =0）→ 立即提醒一次。
 * 去重规则：同一学员的同一轮预警只推送一次；当剩余课时回升（撤销消课回补 / 充值加课时）
 * 后清除记录，再次降到阈值时可重新触发新一轮提醒。
 *
 * 存储：本地 storage（mock 阶段）；联调后迁移到后端推送/去重逻辑。
 */
import Taro from '@tarojs/taro';
import { getAlertThreshold } from '@/utils/alert-config';

const STORAGE_KEY = 'yunce-op-alert-sent';

/** 已提醒记录：studentId → 提醒时信息 */
export interface OperationAlertRecord {
  /** 触发提醒时的剩余课时 */
  remainingAtAlert: number;
  /** 提醒时间（ISO） */
  alertedAt: string;
}

let _records: Record<string, OperationAlertRecord> | null = null;

function load(): Record<string, OperationAlertRecord> {
  if (_records) return _records;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    _records = raw && typeof raw === 'object' ? (raw as Record<string, OperationAlertRecord>) : {};
  } catch {
    _records = {};
  }
  return _records;
}

function persist(): void {
  try {
    Taro.setStorageSync(STORAGE_KEY, _records || {});
  } catch {
    // storage 不可用时仅保留内存态（mock 阶段可接受）
  }
}

/**
 * 检查是否应触发「课时不足」提醒（触发即记录，保证不重复推送）
 * @returns 'triggered' 本轮首次触发（应立即提醒一次）
 *          'duplicate' 该学员本轮已提醒过（不重复推送）
 *          'none'      剩余课时未降到阈值（无需提醒）
 */
export function checkThresholdAlert(
  studentId: string,
  remainingHours: number,
): 'triggered' | 'duplicate' | 'none' {
  const records = load();
  const threshold = getAlertThreshold();
  // 未触发条件：剩余课时 > 阈值 且 > 0（剩余 0 为强制提醒，即使阈值也为 0）
  const shouldAlert = remainingHours <= threshold || remainingHours <= 0;
  if (!shouldAlert) {
    return 'none';
  }
  if (records[studentId]) {
    return 'duplicate';
  }
  records[studentId] = {
    remainingAtAlert: remainingHours,
    alertedAt: new Date().toISOString(),
  };
  persist();
  return 'triggered';
}

/**
 * 剩余课时回升（撤销消课回补 / 充值加课时）后清除提醒记录，
 * 使该学员下次再降到阈值时可重新触发新一轮预警。
 */
export function resetStudentAlert(studentId: string): void {
  const records = load();
  if (records[studentId]) {
    delete records[studentId];
    persist();
  }
}

/** 查询某学员当前是否已处于"已提醒"状态 */
export function isStudentAlerted(studentId: string): boolean {
  return !!load()[studentId];
}

/** 仅测试用：重置记录 */
export function __resetOperationAlertsForTest(): void {
  _records = {};
}
