/**
 * 订阅消息 Mock 数据层
 */
import Taro from '@tarojs/taro';
import { MOCK_TMPL_IDS, SUBSCRIBE_GROUP_LABELS } from '@/constants/subscribe-presets';
import type {
  SubscribeAuthReportBody,
  SubscribeAuthReportResult,
  SubscribeBootstrapDto,
  SubscribePendingPromptDto,
  SubscribeQuotaDto,
  SubscribeTemplateGroup,
} from '@/types/subscribe-message';

const STORAGE_KEY = 'yunce:subscribe-message-mock';

interface MockState {
  quotas: Record<string, SubscribeQuotaDto[]>;
  pending: Record<string, SubscribePendingPromptDto[]>;
  dismissed: Record<string, string[]>;
}

function readState(): MockState {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw && typeof raw === 'object') {
      return raw as MockState;
    }
  } catch {
    // ignore
  }
  return { quotas: {}, pending: {}, dismissed: {} };
}

function writeState(state: MockState): void {
  Taro.setStorageSync(STORAGE_KEY, state);
}

function defaultQuotas(): SubscribeQuotaDto[] {
  return (Object.keys(MOCK_TMPL_IDS) as SubscribeTemplateGroup[]).map((group) => ({
    group,
    tmplId: MOCK_TMPL_IDS[group],
    remain: 3,
    lowThreshold: 3,
    notifyEnabled: true,
  }));
}

function getUserQuotas(userId: string): SubscribeQuotaDto[] {
  const state = readState();
  if (!state.quotas[userId]) {
    state.quotas[userId] = defaultQuotas();
    writeState(state);
  }
  return state.quotas[userId];
}

function saveUserQuotas(userId: string, quotas: SubscribeQuotaDto[]): void {
  const state = readState();
  state.quotas[userId] = quotas;
  writeState(state);
}

export async function mockGetBootstrap(userId: string): Promise<SubscribeBootstrapDto> {
  const quotas = getUserQuotas(userId);
  const state = readState();
  const pending = (state.pending[userId] ?? []).filter(
    (item) => !(state.dismissed[userId] ?? []).includes(item.id),
  );

  return {
    templates: (Object.keys(MOCK_TMPL_IDS) as SubscribeTemplateGroup[]).map((group) => ({
      group,
      tmplId: MOCK_TMPL_IDS[group],
      title: SUBSCRIBE_GROUP_LABELS[group],
      enabled: true,
    })),
    quotas,
    pendingPrompts: pending,
    lowQuotaGroups: quotas
      .filter((q) => q.remain > 0 && q.remain <= q.lowThreshold)
      .map((q) => q.group),
  };
}

export async function mockReportAuth(
  userId: string,
  body: SubscribeAuthReportBody,
): Promise<SubscribeAuthReportResult> {
  const quotas = [...getUserQuotas(userId)];

  body.items.forEach((item) => {
    const idx = quotas.findIndex((q) => q.group === item.group);
    if (idx < 0) return;
    if (item.status === 'accept') {
      quotas[idx] = { ...quotas[idx], remain: quotas[idx].remain + 1 };
    }
  });

  saveUserQuotas(userId, quotas);
  return { quotas };
}

export async function mockDismissPending(userId: string, promptId: string): Promise<void> {
  const state = readState();
  if (!state.dismissed[userId]) {
    state.dismissed[userId] = [];
  }
  if (!state.dismissed[userId].includes(promptId)) {
    state.dismissed[userId].push(promptId);
  }
  state.pending[userId] = (state.pending[userId] ?? []).filter((p) => p.id !== promptId);
  writeState(state);
}

export async function mockConsumeQuota(
  userId: string,
  group: SubscribeTemplateGroup,
): Promise<SubscribeQuotaDto | null> {
  const quotas = [...getUserQuotas(userId)];
  const idx = quotas.findIndex((q) => q.group === group);
  if (idx < 0 || quotas[idx].remain <= 0) return null;
  quotas[idx] = { ...quotas[idx], remain: quotas[idx].remain - 1 };
  saveUserQuotas(userId, quotas);
  return quotas[idx];
}

/** 测试用：注入 pending prompt */
export async function mockEnqueuePending(
  userId: string,
  prompt: SubscribePendingPromptDto,
): Promise<void> {
  const state = readState();
  if (!state.pending[userId]) {
    state.pending[userId] = [];
  }
  state.pending[userId].push(prompt);
  writeState(state);
}

export function mockResetState(userId?: string): void {
  if (!userId) {
    Taro.removeStorageSync(STORAGE_KEY);
    return;
  }
  const state = readState();
  delete state.quotas[userId];
  delete state.pending[userId];
  delete state.dismissed[userId];
  writeState(state);
}
