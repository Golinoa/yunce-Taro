import Taro from '@tarojs/taro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_TMPL_IDS } from '@/constants/subscribe-presets';
import { getSession } from '@/services/auth';
import {
  __resetSubscribeServiceForTest,
  subscribeMessageService,
} from '@/services/subscribe-message';
import { useSubscribeAuthStore } from '@/stores/subscribe-auth';
import type { SubscribeBootstrapDto, SubscribeTemplateGroup } from '@/types/subscribe-message';
import { copyParentInviteLink } from '@/utils/invite-parent-link';
import {
  __resetSubscribeClassViewForTest,
  canRunClassViewRenew,
  markClassAssignPromptConsumed,
} from '@/utils/subscribe-class-view';
import { requestSubscribeMessageAuth } from '@/utils/subscribe-message';

vi.mock('@/utils/invite-parent-link', () => ({
  copyParentInviteLink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/utils/subscribe-message', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/subscribe-message')>();
  return {
    ...actual,
    requestSubscribeMessageAuth: vi.fn(),
  };
});

const GROUPS = Object.keys(MOCK_TMPL_IDS) as SubscribeTemplateGroup[];

function mockBootstrap(remain = 0): SubscribeBootstrapDto {
  return {
    templates: GROUPS.map((group) => ({
      group,
      tmplId: MOCK_TMPL_IDS[group],
      enabled: true,
      title: group,
    })),
    quotas: GROUPS.map((group) => ({
      group,
      tmplId: MOCK_TMPL_IDS[group],
      remain,
      lowThreshold: 1,
      notifyEnabled: true,
    })),
    pendingPrompts: [],
    lowQuotaGroups: [],
  };
}

const getMock = vi.fn(async (..._args: unknown[]) => mockBootstrap(0));
const postMock = vi.fn(
  async (_url: string, body?: { items?: Array<{ group: string; status: string }> }) => {
    const boot = mockBootstrap(0);
    const accepted = new Set(
      (body?.items || []).filter((i) => i.status === 'accept').map((i) => i.group),
    );
    return {
      quotas: boot.quotas.map((q) => ({
        ...q,
        remain: accepted.has(q.group) ? q.remain + 1 : q.remain,
      })),
    };
  },
);

vi.mock('@/utils/request', () => ({
  get: (...args: unknown[]) => getMock(...args),
  post: (...args: [string, { items?: { group: string; status: string }[] }?]) => postMock(...args),
  put: vi.fn(),
  del: vi.fn(),
}));

const USER = 'service-test-user';

const MOCK_SUBSCRIBE_PROFILE = {
  id: USER,
  name: '测试用户',
  nickname: '测试用户',
  currentContext: { organizationId: 'org-yunce' },
} as const;

function resetStore() {
  useSubscribeAuthStore.setState({
    prompt: { visible: false, presetId: 'student_created' },
    sheet: { visible: false, presetId: 'checkin_renew', scene: '', groups: [] },
    banner: { visible: false, message: '' },
  });
}

describe('subscribeMessageService', () => {
  beforeEach(() => {
    __resetSubscribeServiceForTest();
    __resetSubscribeClassViewForTest();
    resetStore();
    getMock.mockReset();
    getMock.mockImplementation(async () => mockBootstrap(0));
    postMock.mockClear();
    vi.mocked(getSession).mockResolvedValue({
      profile: MOCK_SUBSCRIBE_PROFILE as never,
      session: null,
    });
    vi.mocked(requestSubscribeMessageAuth).mockReset();
  });

  it('T-F-01: runFlow(E01) 用户点暂不需要 — 不调 requestSubscribeMessage', async () => {
    const flowPromise = subscribeMessageService.runFlow('E01', { studentName: '小明' });
    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(true);

    useSubscribeAuthStore.getState().closePrompt('secondary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).not.toHaveBeenCalled();
  });

  it('T-F-02: runFlow(E01) 用户点开启提醒 accept — 调 auth-report 且含 todo_remind', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' },
      { tmplId: MOCK_TMPL_IDS.package_alert, group: 'package_alert', status: 'accept' },
    ]);

    const before = await subscribeMessageService.bootstrap();
    const todoBefore = before.quotas.find((q) => q.group === 'todo_remind')!.remain;

    const flowPromise = subscribeMessageService.runFlow('E01', {
      studentName: '小明',
      campusId: 'campus-1',
      role: 'teacher',
    });
    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledOnce();
    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ group: 'todo_remind' }),
        expect.objectContaining({ group: 'package_alert' }),
      ]),
    );

    const after = subscribeMessageService.getCachedBootstrap();
    const todoAfter = after!.quotas.find((q) => q.group === 'todo_remind')!.remain;
    expect(todoAfter).toBe(todoBefore + 1);
  });

  it('E12: remind 开启时直接 requestAuth，不弹框', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' },
    ]);

    await subscribeMessageService.runFlow('E12');

    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(false);
    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ group: 'todo_remind' }),
        expect.objectContaining({ group: 'class_remind' }),
      ]),
    );
  });

  it('E05: 打开 renew 弹窗，点稍后不调微信', async () => {
    const flowPromise = subscribeMessageService.runFlow('E05');
    expect(useSubscribeAuthStore.getState().sheet.visible).toBe(true);
    useSubscribeAuthStore.getState().closeSheet('secondary');
    await flowPromise;
    expect(requestSubscribeMessageAuth).not.toHaveBeenCalled();
  });

  it('E23: 预约成功弹框，点开启提醒 auth class_remind', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.class_remind, group: 'class_remind', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runFlow('E23', {
      bookingLabel: '场地·羽毛球场A',
    });
    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(true);

    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith([
      expect.objectContaining({ group: 'class_remind' }),
    ]);
  });

  it('E25: 取消成功不弹框', async () => {
    await subscribeMessageService.runFlow('E25');
    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(false);
    expect(requestSubscribeMessageAuth).not.toHaveBeenCalled();
  });

  it('E03: 家长绑定学员弹框，订阅 lesson_result + class_remind + package_alert', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.lesson_result, group: 'lesson_result', status: 'accept' },
      { tmplId: MOCK_TMPL_IDS.class_remind, group: 'class_remind', status: 'accept' },
      { tmplId: MOCK_TMPL_IDS.package_alert, group: 'package_alert', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runFlow('E03', {
      childName: '张小明',
      campusId: 'campus-1',
    });
    expect(useSubscribeAuthStore.getState().prompt.visible).toBe(true);

    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ group: 'lesson_result' }),
        expect.objectContaining({ group: 'class_remind' }),
        expect.objectContaining({ group: 'package_alert' }),
      ]),
    );
  });

  it('E07: 排课保存后 renew sheet，补充 schedule_change + class_remind', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.schedule_change, group: 'schedule_change', status: 'accept' },
      { tmplId: MOCK_TMPL_IDS.class_remind, group: 'class_remind', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runFlow('E07', { role: 'teacher' });
    expect(useSubscribeAuthStore.getState().sheet.visible).toBe(true);

    useSubscribeAuthStore.getState().closeSheet('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ group: 'schedule_change' }),
        expect.objectContaining({ group: 'class_remind' }),
      ]),
    );
  });

  it('E10: 新建线索弹框，订阅 todo_remind', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runFlow('E10', {
      studentName: '李小红',
      role: 'teacher',
    });
    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith([
      expect.objectContaining({ group: 'todo_remind' }),
    ]);
  });

  it('E02A: 第三按钮 navigateUrl 跳转', async () => {
    const navigateSpy = vi.spyOn(Taro, 'navigateTo').mockResolvedValue({} as never);

    const flowPromise = subscribeMessageService.runFlow('E02A', {
      className: '少儿游泳班',
      navigateUrl: '/package-course/pages/course-form/index?id=cls-1&type=class',
    });
    useSubscribeAuthStore.getState().closePrompt('tertiary');
    await flowPromise;

    expect(navigateSpy).toHaveBeenCalledWith({
      url: '/package-course/pages/course-form/index?id=cls-1&type=class',
    });
    expect(requestSubscribeMessageAuth).not.toHaveBeenCalled();

    navigateSpy.mockRestore();
  });

  it('E11: 新增教师弹框订阅 todo_remind', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runFlow('E11', { teacherName: '王老师' });
    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith([
      expect.objectContaining({ group: 'todo_remind' }),
    ]);
  });

  it('E02-D: maybeRunClassViewRenew 在窗口内弹出 class_view_renew', async () => {
    await subscribeMessageService.bootstrap();
    markClassAssignPromptConsumed(USER, 'class-1');
    expect(canRunClassViewRenew(USER, 'class-1')).toBe(true);

    const renewSpy = vi.spyOn(subscribeMessageService, 'runRenewFlow').mockResolvedValue(undefined);
    await subscribeMessageService.maybeRunClassViewRenew('class-1');
    expect(renewSpy).toHaveBeenCalledWith('class_view_renew', 'class_view_renew', undefined);
    renewSpy.mockRestore();
  });

  it('runSalarySlipSendPrompt: 发送工资单后可选订阅', async () => {
    vi.mocked(requestSubscribeMessageAuth).mockResolvedValue([
      { tmplId: MOCK_TMPL_IDS.todo_remind, group: 'todo_remind', status: 'accept' },
    ]);

    const flowPromise = subscribeMessageService.runSalarySlipSendPrompt(3);
    useSubscribeAuthStore.getState().closePrompt('primary');
    await flowPromise;

    expect(requestSubscribeMessageAuth).toHaveBeenCalledWith([
      expect.objectContaining({ group: 'todo_remind' }),
    ]);
  });

  it('E08: 第三按钮邀请家长 — 复制链接不调微信', async () => {
    const flowPromise = subscribeMessageService.runFlow('E08', {
      studentId: 'student-001',
      studentName: '张小明',
    });
    useSubscribeAuthStore.getState().closePrompt('tertiary');
    await flowPromise;

    expect(copyParentInviteLink).toHaveBeenCalledWith('student-001');
    expect(requestSubscribeMessageAuth).not.toHaveBeenCalled();
  });
});
