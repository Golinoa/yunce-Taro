/**
 * 开发者模式：版本号连续点击解锁 + 入口密码
 *
 * 解锁：在 5 秒内连续点击「当前版本」7 次 → 出现开发者模式入口（有效 10 分钟）
 * 进入：点入口 → 弹框输入密码（默认 25）
 */
import Taro from '@tarojs/taro';

export const DEVELOPER_MODE_UNLOCKED_KEY = 'yunce:developer-mode-unlocked';
export const DEVELOPER_MODE_EXPIRES_AT_KEY = 'yunce:developer-mode-expires-at';
export const DEVELOPER_MODE_SESSION_KEY = 'yunce:developer-mode-session';

/** 硬编码入口密码（静默校验，不在 UI 展示） */
export const DEVELOPER_MODE_PASSWORD = '25';

/** 入口可见时长：每次解锁后 10 分钟自动关闭 */
export const DEVELOPER_MODE_TTL_MS = 10 * 60 * 1000;

/** 连续点击次数 */
const TAP_TARGET = 7;
/** 连点有效窗口（超时从头计） */
const TAP_WINDOW_MS = 5_000;

export type VersionTapResult = 'progress' | 'unlocked' | 'reset';

interface UnlockSequenceState {
  startedAt: number;
  count: number;
}

let sequenceState: UnlockSequenceState | null = null;

function resetSequence(): void {
  sequenceState = null;
}

function readExpiresAt(): number {
  try {
    const raw = Taro.getStorageSync(DEVELOPER_MODE_EXPIRES_AT_KEY);
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** 若已过期则清理并返回 true */
export function expireDeveloperModeIfNeeded(now: number = Date.now()): boolean {
  if (!isDeveloperModeUnlockedRaw()) {
    return false;
  }
  const expiresAt = readExpiresAt();
  if (!expiresAt || now >= expiresAt) {
    setDeveloperModeUnlocked(false);
    return true;
  }
  return false;
}

function isDeveloperModeUnlockedRaw(): boolean {
  try {
    return Taro.getStorageSync(DEVELOPER_MODE_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

function unlockDeveloperMode(): VersionTapResult {
  resetSequence();
  setDeveloperModeUnlocked(true);
  return 'unlocked';
}

export function isDeveloperModeUnlocked(now: number = Date.now()): boolean {
  expireDeveloperModeIfNeeded(now);
  return isDeveloperModeUnlockedRaw();
}

/** 剩余可见毫秒；未解锁或已过期为 0 */
export function getDeveloperModeRemainingMs(now: number = Date.now()): number {
  if (!isDeveloperModeUnlocked(now)) return 0;
  return Math.max(0, readExpiresAt() - now);
}

export function setDeveloperModeUnlocked(unlocked: boolean, now: number = Date.now()): void {
  try {
    if (unlocked) {
      Taro.setStorageSync(DEVELOPER_MODE_UNLOCKED_KEY, '1');
      Taro.setStorageSync(DEVELOPER_MODE_EXPIRES_AT_KEY, now + DEVELOPER_MODE_TTL_MS);
    } else {
      Taro.removeStorageSync(DEVELOPER_MODE_UNLOCKED_KEY);
      Taro.removeStorageSync(DEVELOPER_MODE_EXPIRES_AT_KEY);
      clearDeveloperModeSession();
      resetSequence();
    }
  } catch {
    /* 静默 */
  }
}

export function isDeveloperModeSessionValid(): boolean {
  if (!isDeveloperModeUnlocked()) {
    clearDeveloperModeSession();
    return false;
  }
  try {
    return Taro.getStorageSync(DEVELOPER_MODE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDeveloperModeSessionValid(valid: boolean): void {
  try {
    if (valid) {
      Taro.setStorageSync(DEVELOPER_MODE_SESSION_KEY, '1');
    } else {
      Taro.removeStorageSync(DEVELOPER_MODE_SESSION_KEY);
    }
  } catch {
    /* 静默 */
  }
}

export function clearDeveloperModeSession(): void {
  setDeveloperModeSessionValid(false);
}

export function verifyDeveloperModePassword(input: string): boolean {
  return input.trim() === DEVELOPER_MODE_PASSWORD;
}

/** 重置进行中的敲击序列（测试用） */
export function __resetUnlockSequenceForTest(): void {
  resetSequence();
}

/**
 * 处理「当前版本」行点击
 * 5 秒内连续点满 7 次即解锁入口（10 分钟后自动关闭）
 */
export function handleVersionNumberTap(now: number = Date.now()): VersionTapResult {
  expireDeveloperModeIfNeeded(now);

  if (isDeveloperModeUnlockedRaw()) {
    return 'unlocked';
  }

  if (!sequenceState || now - sequenceState.startedAt > TAP_WINDOW_MS) {
    sequenceState = { startedAt: now, count: 1 };
    return 'progress';
  }

  sequenceState.count += 1;

  if (sequenceState.count >= TAP_TARGET) {
    return unlockDeveloperMode();
  }

  return 'progress';
}
