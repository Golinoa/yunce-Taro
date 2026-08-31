/**
 * 运营预警阈值（课时 / 天数 / 金额）
 * 真源：校区字段；本地 storage 作缓存。系统设置入口已合并到「续费提醒」。
 */
import Taro from '@tarojs/taro';

const STORAGE_KEY = 'yunce-op-alert-thresholds';

export const DEFAULT_ALERT_THRESHOLD_HOURS = 5;
export const DEFAULT_ALERT_THRESHOLD_DAYS = 7;
export const DEFAULT_ALERT_THRESHOLD_AMOUNT = 200;

export interface AlertThresholdConfig {
  hours: number;
  days: number;
  /** 元 */
  amount: number;
}

let _config: AlertThresholdConfig | null = null;

function normalizeHours(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_ALERT_THRESHOLD_HOURS;
}

function normalizeDays(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_ALERT_THRESHOLD_DAYS;
}

function normalizeAmount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_ALERT_THRESHOLD_AMOUNT;
}

function readStorage(): AlertThresholdConfig {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'object') {
      return {
        hours: normalizeHours((raw as AlertThresholdConfig).hours),
        days: normalizeDays((raw as AlertThresholdConfig).days),
        amount: normalizeAmount((raw as AlertThresholdConfig).amount),
      };
    }
    // 兼容旧版仅存课时数字
    if (raw !== '' && raw !== undefined && raw !== null) {
      return {
        hours: normalizeHours(raw),
        days: DEFAULT_ALERT_THRESHOLD_DAYS,
        amount: DEFAULT_ALERT_THRESHOLD_AMOUNT,
      };
    }
  } catch {
    // ignore
  }
  return {
    hours: DEFAULT_ALERT_THRESHOLD_HOURS,
    days: DEFAULT_ALERT_THRESHOLD_DAYS,
    amount: DEFAULT_ALERT_THRESHOLD_AMOUNT,
  };
}

export function getAlertThresholdConfig(): AlertThresholdConfig {
  if (_config) return _config;
  _config = readStorage();
  return _config;
}

/** 读取课时阈值（兼容旧调用方） */
export function getAlertThreshold(): number {
  return getAlertThresholdConfig().hours;
}

export function setAlertThresholdConfig(next: Partial<AlertThresholdConfig>): AlertThresholdConfig {
  const cur = getAlertThresholdConfig();
  _config = {
    hours: next.hours !== undefined ? normalizeHours(next.hours) : cur.hours,
    days: next.days !== undefined ? normalizeDays(next.days) : cur.days,
    amount: next.amount !== undefined ? normalizeAmount(next.amount) : cur.amount,
  };
  try {
    Taro.setStorageSync(STORAGE_KEY, _config);
  } catch {
    // ignore
  }
  return _config;
}

/** 兼容旧 API：只写课时 */
export function setAlertThreshold(hours: number): void {
  setAlertThresholdConfig({ hours });
}

/** 用校区字段同步（进入续费提醒 / 学员列表前调用） */
export function syncAlertThresholdFromCampus(
  input?:
    | {
        hoursAlertThreshold?: number | null;
        daysAlertThreshold?: number | null;
        amountAlertThreshold?: number | null;
      }
    | number
    | null,
): AlertThresholdConfig {
  if (input === undefined || input === null) return getAlertThresholdConfig();
  if (typeof input === 'number') {
    setAlertThreshold(input);
    return getAlertThresholdConfig();
  }
  return setAlertThresholdConfig({
    hours: input.hoursAlertThreshold ?? undefined,
    days: input.daysAlertThreshold ?? undefined,
    amount: input.amountAlertThreshold ?? undefined,
  });
}
