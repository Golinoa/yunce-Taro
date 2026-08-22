/**
 * 运营预警「课时不足」阈值配置（用户口径 2026-08-22：做成可配置项）
 *
 * 使用场景：系统设置页可配置预警阈值，统计页运营预警按此阈值过滤学员。
 * 预警规则（用户确认）：
 * - 常规提醒：剩余课时 ≤ 阈值（默认 5）→ 提醒续费
 * - 强制提醒：剩余 0 课时（最后一节课用完）→ 无论阈值多少，始终提醒一次
 * 存储：本地 storage（mock 阶段）；联调后迁移到后端设置接口。
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce-op-alert-threshold';
/** 默认阈值（用户测试口径 2026-08-22：5 课时） */
export const DEFAULT_ALERT_THRESHOLD_HOURS = 5;

/** 内存态：storage 不可用（如 Node 测试环境）时回退，保证读写一致 */
let _threshold: number | null = null;

/** 读取阈值：非法值回退默认 */
export function getAlertThreshold(): number {
  if (_threshold !== null) return _threshold;
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    const v = typeof raw === 'number' ? raw : Number(raw);
    _threshold = Number.isFinite(v) && v >= 0 ? v : DEFAULT_ALERT_THRESHOLD_HOURS;
  } catch {
    _threshold = DEFAULT_ALERT_THRESHOLD_HOURS;
  }
  return _threshold;
}

/** 写入阈值 */
export function setAlertThreshold(hours: number): void {
  _threshold = Number.isFinite(hours) && hours >= 0 ? hours : 0;
  try {
    Taro.setStorageSync(STORAGE_KEY, _threshold);
  } catch {
    // storage 不可用时仅保留内存态（mock 阶段可接受）
  }
}
