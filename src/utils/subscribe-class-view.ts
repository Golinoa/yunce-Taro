/**
 * E02-D：入班弹框消费后，5 分钟内进入班级页可触发 class_view_renew
 */
import Taro from '@tarojs/taro';

const PROMPT_KEY = 'yunce:subscribe-class-assign-prompt';
const RENEW_KEY = 'yunce:subscribe-class-view-renew';

interface ClassAssignPromptRecord {
  userId: string;
  classId: string;
  at: number;
}

interface ClassViewRenewRecord {
  atByKey: Record<string, number>;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(userId: string, classId: string): string {
  return `${userId}:${classId}`;
}

function readPrompt(): ClassAssignPromptRecord | null {
  try {
    const raw = Taro.getStorageSync(PROMPT_KEY);
    if (raw && typeof raw === 'object') return raw as ClassAssignPromptRecord;
  } catch {
    // ignore
  }
  return null;
}

function readRenew(): ClassViewRenewRecord {
  try {
    const raw = Taro.getStorageSync(RENEW_KEY);
    if (raw && typeof raw === 'object') return raw as ClassViewRenewRecord;
  } catch {
    // ignore
  }
  return { atByKey: {} };
}

function writeRenew(record: ClassViewRenewRecord): void {
  Taro.setStorageSync(RENEW_KEY, record);
}

/** E02-A/B 用户点「订阅提醒」或「查看班级」后标记 */
export function markClassAssignPromptConsumed(userId: string, classId: string): void {
  if (!userId || !classId) return;
  Taro.setStorageSync(PROMPT_KEY, { userId, classId, at: Date.now() } satisfies ClassAssignPromptRecord);
}

export function clearClassAssignPromptConsumed(): void {
  try {
    Taro.removeStorageSync(PROMPT_KEY);
  } catch {
    // ignore
  }
}

/** 班级页 onShow：是否在 5 分钟窗口内且今日未弹过 renew */
export function canRunClassViewRenew(userId: string, classId: string): boolean {
  const prompt = readPrompt();
  if (!prompt || prompt.userId !== userId || prompt.classId !== classId) return false;
  if (Date.now() - prompt.at > FIVE_MINUTES_MS) return false;

  const renew = readRenew();
  const at = renew.atByKey[dayKey(userId, classId)];
  if (at && Date.now() - at < ONE_DAY_MS) return false;

  return true;
}

export function markClassViewRenewShown(userId: string, classId: string): void {
  const renew = readRenew();
  renew.atByKey[dayKey(userId, classId)] = Date.now();
  writeRenew(renew);
  clearClassAssignPromptConsumed();
}

/** 单测重置 */
export function __resetSubscribeClassViewForTest(): void {
  try {
    Taro.removeStorageSync(PROMPT_KEY);
    Taro.removeStorageSync(RENEW_KEY);
  } catch {
    // ignore
  }
}
