/**
 * 开发者模式：版本号敲击解锁 + 入口可见性
 *
 * 解锁序列（1 分钟内完成）：
 * 版本号连点 7 次 → 停顿 ≥3 秒 → 再连点 7 次
 * 任一阶段连点超过 20 次则重置
 */
import Taro from '@tarojs/taro';

export const DEVELOPER_MODE_UNLOCKED_KEY = 'yunce:developer-mode-unlocked';
export const DEVELOPER_MODE_SESSION_KEY = 'yunce:developer-mode-session';

/** 硬编码入口密码（静默校验，不在 UI 展示） */
export const DEVELOPER_MODE_PASSWORD = '25';

const UNLOCK_WINDOW_MS = 60_000;
const PAUSE_MS = 3_000;
const PHASE_TARGETS = [7, 7] as const;
const MAX_CLICKS_PER_PHASE = 20;

export type VersionTapResult = 'progress' | 'unlocked' | 'reset';

interface UnlockSequenceState {
  startedAt: number;
  phaseIndex: number;
  countInPhase: number;
  waitingPause: boolean;
  pauseReadyAt: number;
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
 * 处理「当前版本」行点击，返回解锁进度
 * 已解锁时返回 unlocked；序列失败静默 reset
 */
export function handleVersionNumberTap(now: number = Date.now()): VersionTapResult {
  if (isDeveloperModeUnlocked()) {
    return 'unlocked';
  }

  if (!sequenceState || now - sequenceState.startedAt > UNLOCK_WINDOW_MS) {
    sequenceState = {
      startedAt: now,
      phaseIndex: 0,
      countInPhase: 1,
      waitingPause: false,
      pauseReadyAt: 0,
    };
    return 'progress';
  }

  if (sequenceState.waitingPause) {
    if (now < sequenceState.pauseReadyAt) {
      resetSequence();
      return 'reset';
    }
    sequenceState.waitingPause = false;
    sequenceState.phaseIndex += 1;
    sequenceState.countInPhase = 1;
    return 'progress';
  }

  sequenceState.countInPhase += 1;

  if (sequenceState.countInPhase >= MAX_CLICKS_PER_PHASE) {
    resetSequence();
    return 'reset';
  }

  const target = PHASE_TARGETS[sequenceState.phaseIndex];

  if (sequenceState.countInPhase < target) {
    return 'progress';
  }

  if (sequenceState.phaseIndex === PHASE_TARGETS.length - 1) {
    return unlockDeveloperMode();
  }

  sequenceState.waitingPause = true;
  sequenceState.pauseReadyAt = now + PAUSE_MS;
  return 'progress';
}
