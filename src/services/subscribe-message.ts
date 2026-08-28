/**
 * 订阅消息 Service — 业务页唯一入口 subscribeMessageService.runFlow()
 */
import Taro from '@tarojs/taro';
import {
  formatPresetText,
  getBookingFlowScene,
  getFlowPresetId,
  getPromptPreset,
  getRenewPreset,
  MOCK_TMPL_IDS,
} from '@/constants/subscribe-presets';
import { loadSubscribeMessageMock } from '@/utils/mock-loaders';
import { isUseMock } from '@/utils/build-env';
import { useSubscribeAuthStore } from '@/stores/subscribe-auth';
import type {
  OpenPromptInput,
  OpenRenewSheetInput,
  SubscribeAuthReportBody,
  SubscribeBootstrapDto,
  SubscribeFlowContext,
  SubscribeFlowId,
  SubscribePendingPromptDto,
  SubscribePromptAction,
  SubscribePromptPresetId,
  SubscribeQuotaDto,
  SubscribeSheetAction,
  SubscribeTemplateGroup,
} from '@/types/subscribe-message';
import { getSession } from '@/services/auth';
import { get, post } from '@/utils/request';
import { createClientRequestId, requestSubscribeMessageAuth } from '@/utils/subscribe-message';
import type { SubscribeAuthEntry } from '@/utils/subscribe-message';
import {
  canRunClassViewRenew,
  markClassAssignPromptConsumed,
  markClassViewRenewShown,
} from '@/utils/subscribe-class-view';
import { copyParentInviteLink } from '@/utils/invite-parent-link';
import { logError } from '@/utils/logger';

const MESSAGE_AUTH_PAGE = '/package-settings/pages/message-auth/index';

let bootstrapCache: SubscribeBootstrapDto | null = null;

async function resolveUserId(): Promise<string | null> {
  const { profile } = await getSession();
  return profile?.id ?? null;
}

function mergeVariables(
  ctx: SubscribeFlowContext,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    studentName: ctx.studentName ?? '',
    childName: ctx.childName ?? ctx.studentName ?? '',
    className: ctx.className ?? '',
    title: ctx.title ?? '',
    groupLabel: ctx.groupLabel ?? '',
    bookingLabel: ctx.bookingLabel ?? ctx.className ?? '',
    teacherName: ctx.teacherName ?? '',
    count: ctx.count ?? '',
    ...extra,
  };
}

const INVITE_PARENT_PRESET_IDS = new Set<SubscribePromptPresetId>([
  'recharge_success',
  'card_issue_success',
]);

const CLASS_JOIN_PRESET_IDS = new Set<string>([
  'student_join_class_op',
  'student_join_class_teacher',
]);

async function markClassAssignIfNeeded(
  flowId: string | undefined,
  presetId: string,
  ctx: SubscribeFlowContext,
  action: SubscribePromptAction,
): Promise<void> {
  if (action !== 'primary' && action !== 'tertiary') return;
  const classId = ctx.classId ?? '';
  if (!classId) return;
  const userId = await resolveUserId();
  if (!userId) return;
  if (flowId === 'E02A' || CLASS_JOIN_PRESET_IDS.has(presetId)) {
    markClassAssignPromptConsumed(userId, classId);
  }
}

/** 从 bootstrap 解析可授权的模板（enabled + 非空 tmplId） */
function resolveAuthEntries(groups: SubscribeTemplateGroup[]): SubscribeAuthEntry[] {
  if (!bootstrapCache) return [];

  const seen = new Set<SubscribeTemplateGroup>();
  const entries: SubscribeAuthEntry[] = [];

  for (const group of groups) {
    if (seen.has(group)) continue;
    seen.add(group);

    const template = bootstrapCache.templates.find((t) => t.group === group);
    const quota = bootstrapCache.quotas.find((q) => q.group === group);
    const tmplId = (template?.tmplId || quota?.tmplId || '').trim();
    const enabled = template?.enabled ?? Boolean(tmplId);

    if (enabled && tmplId) {
      entries.push({ group, tmplId });
    }
  }

  return entries.slice(0, 5);
}

function resolveMockAuthEntries(groups: SubscribeTemplateGroup[]): SubscribeAuthEntry[] {
  return Array.from(new Set(groups))
    .slice(0, 5)
    .map((group) => ({ group, tmplId: MOCK_TMPL_IDS[group] }));
}

export const subscribeMessageService = {
  async bootstrap(role?: string, campusId?: string): Promise<SubscribeBootstrapDto> {
    const userId = await resolveUserId();
    if (!userId) {
      return { templates: [], quotas: [], pendingPrompts: [], lowQuotaGroups: [] };
    }

    if (isUseMock()) {
      bootstrapCache = await (await loadSubscribeMessageMock()).mockGetBootstrap(userId);
      return bootstrapCache;
    }

    try {
      bootstrapCache = await get<SubscribeBootstrapDto>('/subscribe-message/bootstrap', {
        role,
        campusId,
      });
      return bootstrapCache;
    } catch (error) {
      logError('subscribe.bootstrap', error);
      return { templates: [], quotas: [], pendingPrompts: [], lowQuotaGroups: [] };
    }
  },

  async authReport(body: Omit<SubscribeAuthReportBody, 'userId'>): Promise<SubscribeQuotaDto[]> {
    const userId = await resolveUserId();
    if (!userId) return [];

    const payload: SubscribeAuthReportBody = { ...body, userId };

    if (isUseMock()) {
      const result = await (await loadSubscribeMessageMock()).mockReportAuth(userId, payload);
      bootstrapCache = bootstrapCache
        ? { ...bootstrapCache, quotas: result.quotas }
        : await (await loadSubscribeMessageMock()).mockGetBootstrap(userId);
      return result.quotas;
    }

    try {
      const result = await post<{ quotas: SubscribeQuotaDto[] }>(
        '/subscribe-message/auth-report',
        {
          scene: body.scene,
          campusId: body.campusId,
          items: body.items,
          clientRequestId: body.clientRequestId,
        },
      );
      if (bootstrapCache) {
        bootstrapCache = { ...bootstrapCache, quotas: result.quotas };
      }
      return result.quotas;
    } catch (error) {
      logError('subscribe.authReport', error);
      return bootstrapCache?.quotas ?? [];
    }
  },

  async consumePending(promptId: string): Promise<void> {
    const userId = await resolveUserId();
    if (!userId) return;

    if (isUseMock()) return;

    try {
      await post(`/subscribe-message/prompts/${encodeURIComponent(promptId)}/consume`);
    } catch (error) {
      logError('subscribe.consumePending', error);
    }
  },

  async dismissPending(promptId: string): Promise<void> {
    const userId = await resolveUserId();
    if (!userId) return;

    if (isUseMock()) {
      await (await loadSubscribeMessageMock()).mockDismissPending(userId, promptId);
      if (bootstrapCache) {
        bootstrapCache = {
          ...bootstrapCache,
          pendingPrompts: bootstrapCache.pendingPrompts.filter((p) => p.id !== promptId),
        };
      }
      return;
    }

    try {
      await post(`/subscribe-message/prompts/${encodeURIComponent(promptId)}/dismiss`);
    } catch (error) {
      logError('subscribe.dismissPending', error);
    }
  },

  openPrompt(input: OpenPromptInput): Promise<SubscribePromptAction> {
    return useSubscribeAuthStore.getState().openPrompt(input);
  },

  openRenewSheet(input: OpenRenewSheetInput): Promise<SubscribeSheetAction> {
    return useSubscribeAuthStore.getState().openRenewSheet(input);
  },

  async requestAuthAndReport(
    groups: SubscribeTemplateGroup[],
    scene: string,
    meta?: { role?: string; campusId?: string },
  ): Promise<SubscribeQuotaDto[]> {
    if (!isUseMock() && !bootstrapCache) {
      await this.bootstrap(meta?.role, meta?.campusId);
    }

    const entries = isUseMock()
      ? resolveMockAuthEntries(groups)
      : resolveAuthEntries(groups);

    if (entries.length === 0) {
      if (!isUseMock()) {
        logError('subscribe.requestAuth', new Error('无可授权模板（tmplId 未配置或未 enabled）'));
      }
      return bootstrapCache?.quotas ?? [];
    }

    const items = await requestSubscribeMessageAuth(entries);
    if (items.length === 0) return bootstrapCache?.quotas ?? [];

    return this.authReport({
      scene,
      campusId: meta?.campusId,
      items,
      clientRequestId: createClientRequestId(),
    });
  },

  async openPromptFromPending(prompt: SubscribePendingPromptDto): Promise<void> {
    await this.consumePending(prompt.id);

    const variables = prompt.payload ?? {};
    const classNavigateUrl =
      typeof variables.classId === 'string' && variables.classId
        ? `/package-course/pages/course-form/index?id=${encodeURIComponent(variables.classId)}&type=class`
        : undefined;
    const navigateUrl =
      typeof variables.navigateUrl === 'string' ? variables.navigateUrl : classNavigateUrl;
    const action = await this.openPrompt({
      presetId: prompt.presetId,
      variables,
      showTertiary: Boolean(navigateUrl || variables.tertiaryText),
      tertiaryText: variables.tertiaryText,
    });

    if (action === 'primary') {
      const preset = getPromptPreset(prompt.presetId);
      if (preset.primaryAction === 'requestAuth' && preset.groups.length > 0) {
        await this.requestAuthAndReport([...preset.groups], preset.scene);
      } else if (preset.primaryAction === 'navigate' && variables.navigateUrl) {
        Taro.navigateTo({ url: variables.navigateUrl });
      } else if (preset.primaryAction === 'navigate' && navigateUrl) {
        Taro.navigateTo({ url: navigateUrl });
      }
      await markClassAssignIfNeeded(undefined, prompt.presetId, {
        classId: variables.classId,
        navigateUrl,
      }, action);
      await this.dismissPending(prompt.id);
      return;
    }

    if (action === 'tertiary') {
      if (navigateUrl) {
        Taro.navigateTo({ url: navigateUrl });
      }
      await markClassAssignIfNeeded(undefined, prompt.presetId, {
        classId: variables.classId,
        navigateUrl,
      }, action);
      await this.dismissPending(prompt.id);
      return;
    }

    if (action === 'secondary' || action === 'dismiss') {
      await this.dismissPending(prompt.id);
    }
  },

  async runFlow(flowId: SubscribeFlowId, ctx: SubscribeFlowContext = {}): Promise<void> {
    // E12：保存前直接调起微信面板（无弹框），失败不阻断业务
    if (flowId === 'E12') {
      try {
        await this.requestAuthAndReport(['todo_remind', 'class_remind'], 'custom_todo_save', {
          role: ctx.role,
          campusId: ctx.campusId,
        });
      } catch (error) {
        logError('subscribe.runFlow.E12', error);
      }
      return;
    }

    // E05：点名成功后底部弹窗补充次数
    if (flowId === 'E05') {
      try {
        await this.runRenewFlow('checkin_renew', 'checkin_submit', {
          role: ctx.role,
          campusId: ctx.campusId,
        });
      } catch (error) {
        logError('subscribe.runFlow.E05', error);
      }
      return;
    }

    // E07：排课/调班成功后底部弹窗补充次数
    if (flowId === 'E07') {
      try {
        await this.runRenewFlow('schedule_renew', 'schedule_submit', {
          role: ctx.role,
          campusId: ctx.campusId,
        });
      } catch (error) {
        logError('subscribe.runFlow.E07', error);
      }
      return;
    }

    // E25：用户自助取消 — 仅站内，不 auth、不 send
    if (flowId === 'E25') {
      return;
    }

    // E19：首次开启日历同步 — 订阅授权（写入由 calendarSyncService 负责）
    if (flowId === 'E19') {
      try {
        const preset = getPromptPreset('calendar_sync_enable');
        const action = await this.openPrompt({
          presetId: 'calendar_sync_enable',
          variables: mergeVariables(ctx),
        });
        if (action === 'primary') {
          await this.requestAuthAndReport([...preset.groups], preset.scene, {
            role: ctx.role,
            campusId: ctx.campusId,
          });
        }
      } catch (error) {
        logError('subscribe.runFlow.E19', error);
      }
      return;
    }

    // E20：排课保存后更新日历 — 无弹框，由 calendarSyncService 处理
    if (flowId === 'E20') {
      return;
    }

    // E21–E24：预约成功 — 弹框可选 auth class_remind（不立刻 send）
    if (flowId === 'E21' || flowId === 'E22' || flowId === 'E23' || flowId === 'E24') {
      try {
        const preset = getPromptPreset('booking_success_remind_auth');
        const variables = mergeVariables(ctx);
        const action = await this.openPrompt({
          presetId: 'booking_success_remind_auth',
          variables,
        });
        if (action === 'primary') {
          await this.requestAuthAndReport([...preset.groups], getBookingFlowScene(flowId), {
            role: ctx.role,
            campusId: ctx.campusId,
          });
          Taro.showToast({ title: '已开启开始前提醒', icon: 'none' });
        }
      } catch (error) {
        logError(`subscribe.runFlow.${flowId}`, error);
      }
      return;
    }

    const presetId = getFlowPresetId(flowId);
    if (!presetId) return;

    const preset = getPromptPreset(presetId);
    const variables = mergeVariables(ctx);
    const action = await this.openPrompt({
      presetId,
      variables,
      showTertiary: Boolean(preset.tertiaryText || ctx.navigateUrl),
      tertiaryText: preset.tertiaryText,
    });

    if (action === 'primary') {
      if (preset.primaryAction === 'requestAuth' && preset.groups.length > 0) {
        await this.requestAuthAndReport([...preset.groups], preset.scene, {
          role: ctx.role,
          campusId: ctx.campusId,
        });
      } else if (preset.primaryAction === 'navigate' && ctx.navigateUrl) {
        Taro.navigateTo({ url: ctx.navigateUrl });
      }
      await markClassAssignIfNeeded(flowId, presetId, ctx, action);
      return;
    }

    if (action === 'tertiary') {
      if (INVITE_PARENT_PRESET_IDS.has(presetId) && ctx.studentId) {
        try {
          await copyParentInviteLink(ctx.studentId);
        } catch (error) {
          logError('subscribe.inviteParent', error);
          Taro.showToast({ title: '复制失败，请重试', icon: 'none' });
        }
        return;
      }
      if (ctx.navigateUrl) {
        Taro.navigateTo({ url: ctx.navigateUrl });
      }
      await markClassAssignIfNeeded(flowId, presetId, ctx, action);
    }
  },

  /** E02-D：班级页 onShow，5 分钟内且当日未弹过则补充 class_remind */
  async maybeRunClassViewRenew(
    classId: string,
    meta?: { role?: string; campusId?: string },
  ): Promise<void> {
    const userId = await resolveUserId();
    if (!userId || !classId || !canRunClassViewRenew(userId, classId)) return;

    try {
      markClassViewRenewShown(userId, classId);
      await this.runRenewFlow('class_view_renew', 'class_view_renew', meta);
    } catch (error) {
      logError('subscribe.maybeRunClassViewRenew', error);
    }
  },

  /** E11-C：发送工资单后可选订阅 */
  async runSalarySlipSendPrompt(count: number, meta?: { role?: string; campusId?: string }): Promise<void> {
    try {
      const action = await this.openPrompt({
        presetId: 'salary_slip_send',
        variables: { count: String(count) },
      });
      if (action === 'primary') {
        const preset = getPromptPreset('salary_slip_send');
        await this.requestAuthAndReport([...preset.groups], preset.scene, meta);
      }
    } catch (error) {
      logError('subscribe.runSalarySlipSendPrompt', error);
    }
  },

  async runRenewFlow(
    presetId: OpenRenewSheetInput['presetId'],
    scene: string,
    meta?: { role?: string; campusId?: string },
  ): Promise<void> {
    const preset = getRenewPreset(presetId);
    const action = await this.openRenewSheet({
      presetId,
      scene,
      groups: [...preset.groups],
      role: meta?.role,
      campusId: meta?.campusId,
    });

    if (action === 'primary') {
      await this.requestAuthAndReport([...preset.groups], scene, meta);
    }
  },

  getCachedBootstrap(): SubscribeBootstrapDto | null {
    return bootstrapCache;
  },

  formatPresetBody(presetId: OpenPromptInput['presetId'], variables: Record<string, string>): {
    title: string;
    body: string;
    primaryText: string;
    secondaryText: string;
    tertiaryText?: string;
  } {
    const preset = getPromptPreset(presetId);
    return {
      title: preset.title,
      body: formatPresetText(preset.body, variables),
      primaryText: preset.primaryText,
      secondaryText: preset.secondaryText,
      tertiaryText: preset.tertiaryText
        ? formatPresetText(preset.tertiaryText, variables)
        : undefined,
    };
  },

  formatRenewBody(presetId: OpenRenewSheetInput['presetId']): {
    title: string;
    body: string;
    primaryText: string;
    secondaryText: string;
  } {
    const preset = getRenewPreset(presetId);
    return {
      title: preset.title,
      body: preset.body,
      primaryText: preset.primaryText,
      secondaryText: preset.secondaryText,
    };
  },

  messageAuthPageUrl: MESSAGE_AUTH_PAGE,
};

/** 单测重置模块内 bootstrap 缓存 */
export function __resetSubscribeServiceForTest(): void {
  bootstrapCache = null;
}
