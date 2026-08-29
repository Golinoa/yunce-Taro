/**
 * 开发者模式：版本号连续点击解锁 + 入口密码
 *
 * 解锁：在 5 秒内连续点击「当前版本」7 次 → 出现开发者模式入口
 * 进入：点入口 → 输入密码（默认 25）
 */
import Taro from '@tarojs/taro';

export const DEVELOPER_MODE_UNLOCKED_KEY = 'yunce:developer-mode-unlocked';
export const DEVELOPER_MODE_SESSION_KEY = 'yunce:developer-mode-session';

/** 硬编码入口密码（静默校验，不在 UI 展示） */
export const DEVELOPER_MODE_PASSWORD = '25';

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

function unlockDeveloperMode(): VersionTapResult {
  resetSequence();
  setDeveloperModeUnlocked(true);
  return 'unlocked';
}

export function isDeveloperModeUnlocked(): boolean {
  try {
    return Taro.getStorageSync(DEVELOPER_MODE_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDeveloperModeUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      Taro.setStorageSync(DEVELOPER_MODE_UNLOCKED_KEY, '1');
    } else {
      Taro.removeStorageSync(DEVELOPER_MODE_UNLOCKED_KEY);
      clearDeveloperModeSession();
      resetSequence();
    }
  } catch {
    /* 静默 */
  }
}

export function isDeveloperModeSessionValid(): boolean {
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
 * 5 秒内连续点满 7 次即解锁入口
 */
export function handleVersionNumberTap(now: number = Date.now()): VersionTapResult {
  if (isDeveloperModeUnlocked()) {
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
