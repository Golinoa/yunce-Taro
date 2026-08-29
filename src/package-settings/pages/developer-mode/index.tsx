/**
 * 开发者模式 — 快捷联调入口
 * 默认隐藏；系统设置「当前版本」连续点击 7 次解锁后可见；进入需密码
 */
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import { APP_VERSION } from '@/constants/version';
import { SUBSCRIBE_GROUP_LABELS, SUBSCRIBE_TEMPLATE_GROUPS } from '@/constants/subscribe-presets';
import { subscribeMessageService } from '@/services/subscribe-message';
import { chooseImageTemp, uploadImage } from '@/utils/image-upload';
import type { SubscribeFlowId, SubscribeRenewPresetId } from '@/types/subscribe-message';
import { useAuth } from '@/utils/auth';
import { getApiBaseUrl, isUseMock } from '@/utils/build-env';
import {
  clearDeveloperModeSession,
  isDeveloperModeSessionValid,
  isDeveloperModeUnlocked,
  setDeveloperModeSessionValid,
  setDeveloperModeUnlocked,
  verifyDeveloperModePassword,
} from '@/utils/developer-mode';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { consumeSubscribeOnShow } from '@/utils/subscribe-on-show';
import {
  buildMockClassTrialInvitePath,
  buildMockGroupSlotInvitePath,
} from '@/utils/mock-share-demo';

const USE_MOCK = isUseMock();
const API_BASE = getApiBaseUrl();

interface DevAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

interface DevSection {
  title: string;
  actions: DevAction[];
}

const MOCK_CTX = {
  studentName: '测试学员',
  childName: '测试孩子',
  className: '测试班级',
  teacherName: '测试老师',
  bookingLabel: '测试预约',
  title: '测试待办',
  count: '3',
  studentId: 'student-demo-001',
  navigateUrl: '/package-course/pages/course-form/index?id=demo-class&type=class',
};

const DeveloperMode: React.FC = () => {
  useCardNavigationBar();
  const { profile, currentRole } = useAuth();
  const [passwordInput, setPasswordInput] = useState('');
  const [authed, setAuthed] = useState(isDeveloperModeSessionValid());
  const [runningId, setRunningId] = useState<string | null>(null);

  const meta = useMemo(
    () => ({
      role: currentRole ?? undefined,
      campusId: profile?.currentContext?.campusId,
    }),
    [currentRole, profile?.currentContext?.campusId],
  );

  const runAction = useCallback(async (action: DevAction) => {
    if (runningId) return;
    setRunningId(action.id);
    try {
      await action.run();
    } catch {
      Taro.showToast({ title: '执行失败', icon: 'none' });
    } finally {
      setRunningId(null);
    }
  }, [runningId]);

  const handlePasswordSubmit = useCallback(() => {
    if (!verifyDeveloperModePassword(passwordInput)) {
      setPasswordInput('');
      return;
    }
    setDeveloperModeSessionValid(true);
    setAuthed(true);
    setPasswordInput('');
  }, [passwordInput]);

  const sections: DevSection[] = useMemo(() => {
    const subscribeFlows: Array<{ id: SubscribeFlowId; label: string; ctx?: Record<string, string> }> = [
      { id: 'E01', label: 'E01 学员建档成功', ctx: { studentName: MOCK_CTX.studentName } },
      { id: 'E02A', label: 'E02A 学员入班（操作人）', ctx: { className: MOCK_CTX.className, navigateUrl: MOCK_CTX.navigateUrl } },
      { id: 'E03', label: 'E03 家长绑定孩子', ctx: { childName: MOCK_CTX.childName } },
      { id: 'E05', label: 'E05 点名后 Renew', ctx: {} },
      { id: 'E06', label: 'E06 新建班级', ctx: { className: MOCK_CTX.className } },
      { id: 'E07', label: 'E07 排课保存 Renew', ctx: {} },
      { id: 'E08', label: 'E08 续费成功', ctx: { studentName: MOCK_CTX.studentName, studentId: MOCK_CTX.studentId } },
      { id: 'E09', label: 'E09 开卡成功', ctx: { studentName: MOCK_CTX.studentName, studentId: MOCK_CTX.studentId } },
      { id: 'E10', label: 'E10 新建线索', ctx: { title: MOCK_CTX.title } },
      { id: 'E11', label: 'E11 新增教师', ctx: { teacherName: MOCK_CTX.teacherName } },
      { id: 'E12', label: 'E12 自定义待办（直调微信）', ctx: {} },
      { id: 'E19', label: 'E19 开启日历同步', ctx: {} },
      { id: 'E21', label: 'E21 团课预约成功', ctx: { bookingLabel: '团课 · 钢琴入门' } },
      { id: 'E22', label: 'E22 私教预约成功', ctx: { bookingLabel: '私教 · 一对一' } },
      { id: 'E23', label: 'E23 场地预约成功', ctx: { bookingLabel: '场地 · 舞蹈教室' } },
      { id: 'E24', label: 'E24 试听预约成功', ctx: { bookingLabel: '试听 · 体验课' } },
      { id: 'E25', label: 'E25 取消预约（无弹框）', ctx: {} },
    ];

    const renewPresets: Array<{ id: SubscribeRenewPresetId; label: string; scene: string }> = [
      { id: 'checkin_renew', label: 'Renew · 点名补充次数', scene: 'dev_checkin_renew' },
      { id: 'schedule_renew', label: 'Renew · 课表变动补充', scene: 'dev_schedule_renew' },
      { id: 'class_view_renew', label: 'Renew · 班级页补充', scene: 'dev_class_view_renew' },
      { id: 'post_class_renew', label: 'Renew · 课后补充', scene: 'dev_post_class_renew' },
      { id: 'lead_follow_renew', label: 'Renew · 线索跟进补充', scene: 'dev_lead_follow_renew' },
      { id: 'salary_confirm_renew', label: 'Renew · 薪资核对补充', scene: 'dev_salary_confirm_renew' },
    ];

    return [
      {
        title: '环境信息',
        actions: [
          {
            id: 'env-mock',
            label: `Mock 模式：${USE_MOCK ? '开启' : '关闭'}`,
            hint: API_BASE,
            run: () => {
              Taro.showModal({
                title: '运行环境',
                content: `Mock: ${USE_MOCK ? '是' : '否'}\nAPI: ${API_BASE}\n版本: v${APP_VERSION}`,
                showCancel: false,
              });
            },
          },
          {
            id: 'env-bootstrap',
            label: '刷新订阅 Bootstrap',
            run: async () => {
              await subscribeMessageService.bootstrap(meta.role, meta.campusId);
              Taro.showToast({ title: '已刷新', icon: 'success' });
            },
          },
        ],
      },
      {
        title: '订阅消息 · 业务流',
        actions: subscribeFlows.map((flow) => ({
          id: `flow-${flow.id}`,
          label: flow.label,
          run: async () => {
            if (flow.id === 'E25') {
              await subscribeMessageService.runFlow('E25');
              Taro.showToast({ title: 'E25 无弹框（预期）', icon: 'none' });
              return;
            }
            await subscribeMessageService.runFlow(flow.id, { ...flow.ctx, ...meta });
          },
        })),
      },
      {
        title: '订阅消息 · Renew 弹窗',
        actions: renewPresets.map((item) => ({
          id: `renew-${item.id}`,
          label: item.label,
          run: () => subscribeMessageService.runRenewFlow(item.id, item.scene, meta),
        })),
      },
      {
        title: '订阅消息 · 其他预设',
        actions: [
          {
            id: 'preset-salary-slip',
            label: '工资单发送后弹框',
            run: () => subscribeMessageService.runSalarySlipSendPrompt(3, meta),
          },
          {
            id: 'preset-quota-reactivate',
            label: 'E15 额度再激活弹框',
            run: async () => {
              await subscribeMessageService.openPrompt({
                presetId: 'quota_reactivate',
                variables: { groupLabel: SUBSCRIBE_GROUP_LABELS.class_remind },
              });
            },
          },
          {
            id: 'preset-quota-depleted',
            label: '额度耗尽引导',
            run: () =>
              subscribeMessageService.openPrompt({
                presetId: 'quota_depleted',
                variables: { groupLabel: SUBSCRIBE_GROUP_LABELS.todo_remind },
              }),
          },
          {
            id: 'on-show-consume',
            label: '模拟 App onShow 订阅检查',
            run: async () => {
              await consumeSubscribeOnShow({ role: meta.role, campusId: meta.campusId });
              Taro.showToast({ title: '已触发', icon: 'none' });
            },
          },
          ...SUBSCRIBE_TEMPLATE_GROUPS.map((group) => ({
            id: `auth-${group}`,
            label: `直调授权 · ${SUBSCRIBE_GROUP_LABELS[group]}`,
            run: () =>
              subscribeMessageService.requestAuthAndReport([group], `dev_auth_${group}`, meta),
          })),
        ],
      },
      {
        title: 'Mock · 分享落地体验',
        actions: [
          {
            id: 'mock-invite-class-guest',
            label: '班课分享 · 未注册填信息',
            hint: 'guest=1 强制访客表单 → 建线索 → 约试听',
            run: () => Taro.navigateTo({ url: buildMockClassTrialInvitePath(true) }),
          },
          {
            id: 'mock-invite-group-guest',
            label: '团课分享 · 未注册填信息',
            hint: 'guest=1 强制访客表单 → 建线索 → 约课',
            run: () => Taro.navigateTo({ url: buildMockGroupSlotInvitePath(true) }),
          },
          {
            id: 'mock-invite-class-logged',
            label: '班课分享 · 已登录约试听',
            run: () => Taro.navigateTo({ url: buildMockClassTrialInvitePath(false) }),
          },
          {
            id: 'mock-invite-group-logged',
            label: '团课分享 · 已登录约课',
            run: () => Taro.navigateTo({ url: buildMockGroupSlotInvitePath(false) }),
          },
        ],
      },
      {
        title: '登录 /  onboarding',
        actions: [
          {
            id: 'nav-profile-setup',
            label: '完善资料页',
            run: () => Taro.navigateTo({ url: '/package-auth/pages/profile-setup/index' }),
          },
          {
            id: 'nav-onboarding',
            label: '身份引导页',
            run: () => Taro.navigateTo({ url: '/package-auth/pages/onboarding/index' }),
          },
          {
            id: 'nav-parent-onboarding',
            label: '家长绑定页',
            run: () => Taro.navigateTo({ url: '/package-auth/pages/parent-onboarding/index' }),
          },
          {
            id: 'nav-login',
            label: '登录页',
            run: () => Taro.navigateTo({ url: '/package-auth/pages/login/index' }),
          },
          {
            id: 'nav-message-auth',
            label: '订阅授权管理页',
            run: () => Taro.navigateTo({ url: subscribeMessageService.messageAuthPageUrl }),
          },
        ],
      },
      {
        title: '上传 / 七牛',
        actions: [
          {
            id: 'upload-avatar',
            label: '测试上传 avatar',
            run: async () => {
              const path = await chooseImageTemp({ maxSizeMB: 5, cropScale: '1:1' });
              const url = await uploadImage(path, 'avatar');
              Taro.showModal({ title: '上传结果', content: url, showCancel: false });
            },
          },
          {
            id: 'upload-course',
            label: '测试上传 course',
            run: async () => {
              const path = await chooseImageTemp({ maxSizeMB: 5, cropScale: '16:9' });
              const url = await uploadImage(path, 'course');
              Taro.showModal({ title: '上传结果', content: url, showCancel: false });
            },
          },
        ],
      },
      {
        title: '开发者',
        actions: [
          {
            id: 'hide-dev-mode',
            label: '隐藏开发者模式入口',
            hint: '清除解锁状态，需重新连点版本号',
            run: () => {
              Taro.showModal({
                title: '隐藏入口',
                content: '确定隐藏开发者模式？',
                success: (res) => {
                  if (res.confirm) {
                    setDeveloperModeUnlocked(false);
                    clearDeveloperModeSession();
                    Taro.navigateBack();
                  }
                },
              });
            },
          },
          {
            id: 'lock-session',
            label: '锁定本页（清除会话密码）',
            run: () => {
              clearDeveloperModeSession();
              setAuthed(false);
              setPasswordInput('');
            },
          },
        ],
      },
    ];
  }, [meta]);

  if (!isDeveloperModeUnlocked()) {
    return (
      <PageContainer safeBottom>
        <View className="flex-1 flex items-center justify-center px-[64rpx]">
          <Text className="text-[28rpx] text-muted-foreground text-center">无权访问</Text>
        </View>
      </PageContainer>
    );
  }

  if (!authed) {
    return (
      <PageContainer safeBottom>
        <View className="flex-1 flex flex-col items-center justify-center px-[64rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground mb-[48rpx]">开发者模式</Text>
          <View className="w-full bg-card rounded-[28rpx] px-[32rpx] py-[24rpx] border border-border mb-[32rpx]">
            <Input
              className="w-full text-[32rpx] text-foreground text-center"
              type="number"
              password
              placeholder="请输入密码"
              value={passwordInput}
              onInput={(e) => setPasswordInput(e.detail.value)}
              onConfirm={handlePasswordSubmit}
            />
          </View>
          <View
            className="w-full h-[88rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
            onClick={handlePasswordSubmit}
          >
            <Text className="text-[30rpx] font-semibold text-white">进入</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <ScrollView scrollY className="h-full">
        <View className="px-[32rpx] pt-[24rpx] pb-[48rpx]">
          <Text className="text-[24rpx] text-muted-foreground block mb-[32rpx]">
            快捷触发联调链路；订阅弹框需 App 内 SubscribeAuthHost 渲染。
          </Text>

          {sections.map((section) => (
            <View key={section.title} className="mb-[32rpx]">
              <Text className="text-[26rpx] font-semibold text-muted-foreground mb-[16rpx] block px-[8rpx]">
                {section.title}
              </Text>
              <View className="bg-card rounded-[28rpx] shadow-soft overflow-hidden border border-border">
                {section.actions.map((action, index) => (
                  <View
                    key={action.id}
                    className={cn(
                      'px-[28rpx] py-[24rpx] active:opacity-70 press-bg',
                      index !== section.actions.length - 1 && 'border-b border-border',
                      runningId === action.id && 'opacity-50',
                    )}
                    onClick={() => void runAction(action)}
                  >
                    <Text className="text-[28rpx] text-foreground block">{action.label}</Text>
                    {action.hint ? (
                      <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block break-all">
                        {action.hint}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </PageContainer>
  );
};

export default DeveloperMode;
