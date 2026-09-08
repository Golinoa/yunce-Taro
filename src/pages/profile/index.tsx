/**
 * 个人中心页 pages/profile/index
 *
 * 按参考设计稿重构：
 * - 顶部沉浸式渐变头部 +「个人中心」标题 + 头像/手机号/我的资料
 * - 4 列核心数据卡片（累计出勤/剩余次数/剩余时长/剩余储值）
 * - 公众号关注引导卡片
 * - 「我的约课」「我的服务」「系统管理」图标网格
 * - 底部品牌关于入口
 *
 * 未实现入口统一使用 Toast「功能开发中」占位。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo, useRef } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import ProfileAbout from '@/components/profile/ProfileAbout';
import ProfileFollowCard from '@/components/profile/ProfileFollowCard';
import ProfileGrid from '@/components/profile/ProfileGrid';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileStats from '@/components/profile/ProfileStats';
import StoreOnboarding from '@/components/profile/StoreOnboarding';
import SupportQrDialog from '@/components/SupportQrDialog';
import { BRAND_FALLBACK_ORG_NAME } from '@/constants/brand';
import { resolveLifecycle } from '@/constants/membership-tips';
import { displayUserRoleLabel } from '@/constants/role-glossary';
import EmailBindReminder from '@/package-auth/components/EmailBindReminder';
import WechatBindReminder from '@/package-auth/components/WechatBindReminder';
import { onboardingService, packageService, studentService, lessonRecordService } from '@/services';
import {
  prefetchMembershipBootstrap,
  writeMembershipQuotaCache,
} from '@/services/membership-cache';
import {
  organizationService,
  isOrgMembershipEntitled,
  type OrganizationQuotaUsage,
} from '@/services/organization';
import { subscribeMessageService } from '@/services/subscribe-message';
import { teacherService } from '@/services/teacher';
import { useRoleGlossaryStore } from '@/stores/role-glossary';
import type { StoreOnboardingProgress, StoreOnboardingStep } from '@/types/onboarding';
import type { Student } from '@/types/student';
import { isStaffRole, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { logError } from '@/utils/logger';
import { markStepVisited } from '@/utils/onboarding-storage';
import { consumeRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';
import { syncTabBarByProfile } from '@/utils/tab-bar';

// ============================================
// 占位提示：未实现入口统一提示
// ============================================
const PLACEHOLDER_TIP = '功能开发中，敬请期待';

function formatMembershipExpire(iso?: string | null): string {
  if (!iso) return '未开通';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未开通';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const Profile: React.FC = () => {
  const { profile, currentRole, currentIdentity } = useAuth();
  const isTeacher = isStaffRole(currentRole);
  const roleTitles = useRoleGlossaryStore((s) => s.titles);
  const loadRoleTitles = useRoleGlossaryStore((s) => s.load);

  // 家长端：学生列表与当前选中
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [teacherStatValues, setTeacherStatValues] = useState({
    hours: 0,
    lessonCount: 0,
    students: 0,
    classes: 0,
  });
  const [parentStatValues, setParentStatValues] = useState({
    attendance: 0,
    remainingTimes: 0,
    remainingHours: 0,
    remainingBalance: 0,
  });

  // 弹窗控制
  const [showBindSheet, setShowBindSheet] = useState(false);
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);
  const [supportQrVisible, setSupportQrVisible] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [binding, setBinding] = useState(false);

  // 店铺管理 onboarding 进度
  const [storeProgress, setStoreProgress] = useState<StoreOnboardingProgress | null>(null);
  const [loadingStoreProgress, setLoadingStoreProgress] = useState(false);
  const [storeOnboardingHidden, setStoreOnboardingHidden] = useState<boolean | null>(null);

  // 机构配额（用于会员卡到期展示；详情页展示完整配额）
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';
  const [quotaUsage, setQuotaUsage] = useState<OrganizationQuotaUsage | null>(null);

  // 已有可用权益（含未到期试用）才算「已开通态」
  const isMembershipEntitled = useMemo(() => isOrgMembershipEntitled(quotaUsage), [quotaUsage]);
  const membershipLifecycle = useMemo(() => resolveLifecycle(quotaUsage), [quotaUsage]);
  const membershipExpired = membershipLifecycle === 'expired';
  const isTrialEntitled = quotaUsage?.versionCode === 'TRIAL' && isMembershipEntitled;

  const membershipExpireLabel = useMemo(
    () => formatMembershipExpire(quotaUsage?.expireAt),
    [quotaUsage?.expireAt],
  );

  const handleOpenMembership = useCallback(() => {
    const action = isOrgMembershipEntitled(quotaUsage) ? 'view' : 'redeem';
    // 点击瞬间预热，导航与请求并行 → 会员页首帧尽量已有卡面/货架
    void prefetchMembershipBootstrap();
    Taro.navigateTo({
      url: `/package-settings/pages/membership/index?action=${action}`,
    });
  }, [quotaUsage]);

  // 加载机构配额使用率
  const loadQuotaUsage = useCallback(async () => {
    if (!isManagerRole) return;
    try {
      // entitlements 与 quota-usage 同源，多带 features 全量 map，便于藏入口
      const data = await organizationService.getEntitlements();
      setQuotaUsage(data);
      writeMembershipQuotaCache(data);
      void prefetchMembershipBootstrap();
    } catch {
      try {
        const data = await organizationService.getQuotaUsage();
        setQuotaUsage(data);
        writeMembershipQuotaCache(data);
        void prefetchMembershipBootstrap();
      } catch {
        /* 非阻塞：会员到期信息加载失败不影响页面 */
      }
    }
  }, [isManagerRole]);

  // 加载家长绑定的学生 + 四格聚合
  const loadStudents = useCallback(async () => {
    if (!profile?.id || isTeacher) return;
    setLoadingStudents(true);
    setErrorMsg('');
    try {
      const list = await studentService.getByParent(profile.id);
      setStudents(list);
      const stored = Taro.getStorageSync('activeStudentId') || '';
      const valid = list.find((s) => s.id === stored)?.id || list[0]?.id || '';
      setActiveStudentId(valid);

      if (list.length === 0) {
        setParentStatValues({
          attendance: 0,
          remainingTimes: 0,
          remainingHours: 0,
          remainingBalance: 0,
        });
      } else {
        const [pkgGroups, recordGroups] = await Promise.all([
          Promise.all(list.map((s) => packageService.getByStudent(s.id).catch(() => []))),
          Promise.all(list.map((s) => lessonRecordService.getByStudent(s.id).catch(() => []))),
        ]);
        const packages = pkgGroups.flat();
        const records = recordGroups.flat();
        const remainingHours = packages.reduce(
          (sum, pkg) => sum + Math.max(Number(pkg.remaining_hours ?? 0), 0),
          0,
        );
        const remainingBalance = packages.reduce((sum, pkg) => {
          const fee = Number((pkg as { fee_amount?: number }).fee_amount ?? 0);
          const total = Math.max(Number(pkg.total_hours ?? 0), 0);
          const remain = Math.max(Number(pkg.remaining_hours ?? 0), 0);
          if (!fee || !total) return sum;
          return sum + (fee * remain) / total;
        }, 0);
        setParentStatValues({
          attendance: records.filter((r) => r.status !== 'cancelled').length,
          remainingTimes: Math.round(remainingHours),
          remainingHours: Math.round(remainingHours * 10) / 10,
          remainingBalance: Math.round(remainingBalance),
        });
      }
    } catch {
      setErrorMsg('学生信息加载失败，请下拉刷新');
    } finally {
      setLoadingStudents(false);
    }
  }, [profile, isTeacher]);

  // 教师四格：本月课时 / 消课次数 / 学员 / 班级
  const loadTeacherStats = useCallback(async () => {
    if (!profile?.id || !isTeacher) return;
    try {
      const teacher = await teacherService.getMe();
      setTeacherStatValues({
        hours: Number(teacher?.hours ?? 0),
        lessonCount: Number(teacher?.lessonCount ?? 0),
        students: Number(teacher?.students ?? 0),
        classes: Number(teacher?.classes ?? 0),
      });
    } catch (error) {
      logError('profile.loadTeacherStats', error);
    }
  }, [profile?.id, isTeacher]);

  // 读取本地存储的 onboarding 隐藏状态
  const loadStoreOnboardingHidden = useCallback(() => {
    try {
      const raw = Taro.getStorageSync(STORE_ONBOARDING_HIDDEN_KEY);
      setStoreOnboardingHidden(raw === true ? true : raw === false ? false : null);
    } catch {
      setStoreOnboardingHidden(null);
    }
  }, []);

  // 加载店铺管理 onboarding 进度（仅管理员/校长）
  const loadStoreProgress = useCallback(async () => {
    if (!isManagerRole) return;
    setLoadingStoreProgress(true);
    try {
      const progress = await onboardingService.getStoreProgress();
      setStoreProgress(progress);
      // 首次完成全部步骤后，自动标记为已隐藏
      if (progress.completed === progress.total && storeOnboardingHidden === null) {
        Taro.setStorageSync(STORE_ONBOARDING_HIDDEN_KEY, true);
        setStoreOnboardingHidden(true);
      }
    } catch {
      // 异常时降级为正常态（不阻断用户）
      setStoreProgress(null);
    } finally {
      setLoadingStoreProgress(false);
    }
  }, [isManagerRole, storeOnboardingHidden]);

  const isFirstMount = useRef(true);
  const lastProfileFetchAtRef = useRef<number | null>(null);
  const lastQuotaFetchAtRef = useRef<number | null>(null);

  React.useEffect(() => {
    void (async () => {
      await Promise.all([
        loadStudents(),
        loadTeacherStats(),
        loadStoreProgress(),
        loadQuotaUsage(),
      ]);
      loadStoreOnboardingHidden();
      markFetched(lastProfileFetchAtRef);
      markFetched(lastQuotaFetchAtRef);
    })();
  }, [
    loadStudents,
    loadTeacherStats,
    loadStoreOnboardingHidden,
    loadStoreProgress,
    loadQuotaUsage,
  ]);

  useDidShow(() => {
    syncTabBarByProfile(profile);
    void loadRoleTitles();
    loadStoreOnboardingHidden();
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const forceQuota =
      consumeRefreshSignal(REFRESH_SIGNAL.membership) ||
      consumeRefreshSignal(REFRESH_SIGNAL.profileQuota);
    if (forceQuota || shouldRefetch(lastQuotaFetchAtRef.current, TTL.quota)) {
      void loadQuotaUsage().then(() => markFetched(lastQuotaFetchAtRef));
    }
    if (shouldRefetch(lastProfileFetchAtRef.current, TTL.tab)) {
      void Promise.all([loadStudents(), loadTeacherStats(), loadStoreProgress()]).then(() =>
        markFetched(lastProfileFetchAtRef),
      );
    }
  });

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId),
    [students, activeStudentId],
  );

  // 绑定学生（与 onboarding 同一真相源：organization/bind）
  const handleBind = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (!profile?.id) return;
    setBinding(true);
    try {
      const result = await organizationService.bind(code.toUpperCase());
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      setShowBindSheet(false);
      setInviteCode('');
      await loadStudents();
      if (result.studentId) {
        setActiveStudentId(result.studentId);
        Taro.setStorageSync('activeStudentId', result.studentId);
      }
      try {
        Taro.hideToast();
        await subscribeMessageService.runFlow('E03', {
          childName: result.studentName,
          studentName: result.studentName,
          role: profile.currentContext?.role,
          campusId: profile.currentContext?.campusId,
        });
      } catch (error) {
        logError('subscribe E03 after bind child', error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('已绑定') || msg.includes('重复')) {
        Taro.showToast({ title: '该学生已绑定，无需重复操作', icon: 'none' });
      } else if (msg.includes('邀请码') || msg.includes('不存在') || msg.includes('无效')) {
        Taro.showToast({ title: '邀请码无效，请确认后重试', icon: 'none' });
      } else {
        Taro.showToast({ title: msg || '绑定失败，请重试', icon: 'none' });
      }
    } finally {
      setBinding(false);
    }
  }, [inviteCode, profile, loadStudents]);

  // 切换学生
  const handleSwitchStudent = useCallback((id: string) => {
    setActiveStudentId(id);
    Taro.setStorageSync('activeStudentId', id);
    setShowSwitchSheet(false);
    Taro.showToast({ title: '已切换学生', icon: 'success' });
  }, []);

  // 统一跳转：有 url 则跳转，否则提示入口未配置
  const handleNavigate = useCallback((url: string) => {
    if (!url) {
      Taro.showToast({ title: PLACEHOLDER_TIP, icon: 'none' });
      return;
    }
    Taro.navigateTo({ url });
  }, []);

  // 占位提示
  const handlePlaceholder = useCallback(() => {
    Taro.showToast({ title: PLACEHOLDER_TIP, icon: 'none' });
  }, []);

  // 进入场地管理页
  const handleVenueManage = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/venue-list/index' });
  }, []);

  // 进入员工管理页
  const handleTeacherManage = useCallback(() => {
    Taro.navigateTo({ url: '/package-teacher/pages/teacher-list/index' });
  }, []);

  // 进入课程管理页
  const handleCourseManage = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/course-management/index' });
  }, []);

  // 进入科目管理页
  const handleSubjectManage = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/subject-management/index' });
  }, []);

  // 进入卡种管理页
  const handleCardManage = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/card-management/index' });
  }, []);

  // 店铺管理 onboarding 步骤点击
  const handleStoreStepClick = useCallback(
    (step: StoreOnboardingStep) => {
      // 点击即视为"已访问"该配置页面，引导目的达成
      markStepVisited(step.key);
      if (!step.route) {
        handlePlaceholder();
        return;
      }
      Taro.navigateTo({ url: step.route });
    },
    [handlePlaceholder],
  );

  // 店铺管理 onboarding：停课放假 → 节假日设置
  const handleStoreExtraClick = useCallback(() => {
    handleNavigate('/package-settings/pages/campus-settings/holidays');
  }, [handleNavigate]);

  // 跳转到个人资料编辑页
  const handleProfile = useCallback(() => {
    Taro.navigateTo({ url: '/package-student/pages/profile-edit/index' });
  }, []);

  // 跳转到子女档案页
  const handleMyChildren = useCallback(() => {
    if (students.length === 0) {
      // 0 个孩子时引导去绑定
      setShowBindSheet(true);
    } else {
      Taro.navigateTo({ url: '/package-student/pages/children/index' });
    }
  }, [students.length]);

  // 公众号关注（暂无接入）
  const handleFollow = useCallback(() => {
    Taro.showToast({ title: '请关注对应服务号以接收消息', icon: 'none' });
  }, []);

  // 关于品牌
  const handleAbout = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/about/index' });
  }, []);

  // ============================================
  // 教师视图：店铺管理
  // ============================================
  const teacherStoreItems = useMemo(
    () => [
      {
        label: '门店管理',
        icon: 'mdi-office-building-outline' as const,
        onClick: () => handleNavigate('/package-settings/pages/campus-settings/index'),
      },
      {
        label: '场地管理',
        icon: 'mdi-map-marker-outline' as const,
        onClick: handleVenueManage,
      },
      {
        label: '员工管理',
        icon: 'mdi-account-group-outline' as const,
        onClick: handleTeacherManage,
      },
      {
        label: '课程管理',
        icon: 'mdi-book-open-variant-outline' as const,
        onClick: handleCourseManage,
      },
      {
        label: '科目管理',
        icon: 'mdi-book-education-outline' as const,
        onClick: handleSubjectManage,
      },
      {
        label: '卡种管理',
        icon: 'mdi-credit-card-outline' as const,
        onClick: handleCardManage,
      },
      {
        label: '薪资管理',
        icon: 'mdi-wallet-outline' as const,
        onClick: () => handleNavigate('/package-teacher/pages/salary-home/index'),
      },
      {
        label: '停课放假',
        icon: 'mdi-calendar-remove' as const,
        onClick: () => handleNavigate('/package-settings/pages/campus-settings/holidays'),
      },
    ],
    [
      handleNavigate,
      handleVenueManage,
      handleTeacherManage,
      handleCourseManage,
      handleSubjectManage,
      handleCardManage,
    ],
  );

  // 营销活动占位提示
  const handleMarketingPlaceholder = useCallback(() => {
    Taro.showToast({ title: '努力开发中，下个版本见', icon: 'none' });
  }, []);

  // 教师视图：营销活动（秒杀/拼团/优惠券/邀请有礼）
  const marketingItems = useMemo(
    () => [
      {
        label: '秒杀',
        icon: 'mdi-flash-outline' as const,
        onClick: handleMarketingPlaceholder,
      },
      {
        label: '拼团',
        icon: 'mdi-account-multiple-outline' as const,
        onClick: handleMarketingPlaceholder,
      },
      {
        label: '优惠券',
        icon: 'mdi-ticket-outline' as const,
        onClick: handleMarketingPlaceholder,
      },
      {
        label: '邀请有礼',
        icon: 'mdi-gift-outline' as const,
        onClick: handleMarketingPlaceholder,
      },
    ],
    [handleMarketingPlaceholder],
  );

  // 教师视图：系统管理
  const teacherSystemItems = useMemo(() => {
    type SystemItem = {
      label: string;
      icon: string;
      onClick: () => void;
    };
    const items: SystemItem[] = [
      {
        label: '使用帮助',
        icon: 'mdi-help-circle-outline',
        onClick: () => handleNavigate('/package-settings/pages/help/index'),
      },
      {
        label: '平台客服',
        icon: 'mdi-headset',
        onClick: () => setSupportQrVisible(true),
      },
      {
        label: '消息通知',
        icon: 'mdi-message-text-outline',
        onClick: () => handleNavigate('/package-settings/pages/notifications/index'),
      },
    ];
    // 系统设置：所有角色可见，内部设置项按权限过滤
    items.push({
      label: '系统设置',
      icon: 'mdi-cog-outline',
      onClick: () => handleNavigate('/package-settings/pages/system-settings/index'),
    });
    return items;
  }, [handleNavigate]);

  // 教师视图：教学台账（课时流水 / 工资记录 / 我的预约）
  // 上下班签到考勤 → 下个版本；课消请走「上课记录」
  const teacherMonthlyFlowItems = useMemo(
    () => [
      {
        label: '课时流水',
        icon: 'mdi-clock-outline' as const,
        onClick: () => handleNavigate('/package-teacher/pages/monthly-flow/index?tab=lessons'),
      },
      {
        label: '工资记录',
        icon: 'mdi-cash' as const,
        onClick: () => handleNavigate('/package-teacher/pages/monthly-flow/index?tab=salary'),
      },
      {
        label: '我的预约',
        icon: 'mdi-calendar-clock-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/booking/index'),
      },
      {
        label: '上课记录',
        icon: 'mdi-clipboard-text-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/records/index'),
      },
    ],
    [handleNavigate],
  );

  // 教师视图：4 列核心数据（本月真实聚合）
  const teacherStats = useMemo(
    () => [
      { label: '本月课时', value: teacherStatValues.hours, unit: '节' },
      { label: '本月消课', value: teacherStatValues.lessonCount, unit: '次' },
      { label: '在读学员', value: teacherStatValues.students, unit: '人' },
      { label: '授课班级', value: teacherStatValues.classes, unit: '个' },
    ],
    [teacherStatValues],
  );

  // ============================================
  // 家长视图：我的约课
  // ============================================
  const parentBookingItems = useMemo(
    () => [
      {
        label: '已预约',
        icon: 'mdi-calendar-check-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/my-course/index?tab=booked'),
      },
      {
        label: '排队中',
        icon: 'mdi-account-group-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/my-course/index?tab=waiting'),
      },
      {
        label: '待评价',
        icon: 'mdi-star-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/my-course/index?tab=pending_evaluate'),
      },
      {
        label: '已取消',
        icon: 'mdi-calendar-blank-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/my-course/index?tab=cancelled'),
      },
    ],
    [handleNavigate],
  );

  // 家长视图：我的服务（卡包进子女详情；未上线入口不下发）
  const parentServiceItems = useMemo(
    () => [
      {
        label: '我的卡包',
        icon: 'mdi-package' as const,
        onClick: () => {
          const childId = activeStudentId || students[0]?.id;
          if (!childId) {
            Taro.showToast({ title: '请先绑定孩子', icon: 'none' });
            return;
          }
          handleNavigate(
            `/package-student/pages/child-detail/index?id=${encodeURIComponent(childId)}&tab=packages`,
          );
        },
      },
      {
        label: '课程足迹',
        icon: 'mdi-calendar-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/records/index'),
      },
    ],
    [activeStudentId, handleNavigate, students],
  );

  // 家长视图：系统管理（不含机构配置 / 用户协议入口）
  const parentSystemItems = useMemo(
    () => [
      {
        label: '使用帮助',
        icon: 'mdi-help-circle-outline' as const,
        onClick: () => handleNavigate('/package-student/pages/help/index'),
      },
      {
        label: '平台客服',
        icon: 'mdi-headset' as const,
        onClick: () => setSupportQrVisible(true),
      },
      {
        label: '消息通知',
        icon: 'mdi-message-text-outline' as const,
        onClick: () => handleNavigate('/package-settings/pages/notifications/index'),
      },
      {
        label: '账号设置',
        icon: 'mdi-cog-outline' as const,
        onClick: () => handleNavigate('/package-settings/pages/system-settings/index'),
      },
    ],
    [handleNavigate],
  );

  // 家长视图：4 列核心数据（绑定孩子聚合）
  const parentStats = useMemo(
    () => [
      { label: '累计出勤', value: parentStatValues.attendance, unit: '次' },
      { label: '剩余次数', value: parentStatValues.remainingTimes, unit: '次' },
      { label: '剩余课时', value: parentStatValues.remainingHours, unit: '节' },
      { label: '剩余储值', value: parentStatValues.remainingBalance, unit: '元' },
    ],
    [parentStatValues],
  );

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background pb-[40rpx]">
        {/* ====== 顶部渐变头部 ====== */}
        <ProfileHeader
          variant="gradient"
          avatarUrl={profile?.avatar_url}
          name={profile?.name || '用户'}
          role={isTeacher ? displayUserRoleLabel(currentRole || 'teacher', roleTitles) : undefined}
          phone={profile?.phone}
          orgName={currentIdentity?.organizationName || BRAND_FALLBACK_ORG_NAME}
          onSettings={handleProfile}
        />

        {/* ====== 核心数据卡片（负边距叠在头部下方） ====== */}
        <ProfileStats
          className="relative z-10 mt-[-80rpx]"
          items={isTeacher ? teacherStats : parentStats}
          layout="label-top"
        />

        <WechatBindReminder className="mx-[32rpx] mt-[16rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-primary/8 flex items-center gap-[16rpx]" />
        <EmailBindReminder className="mx-[32rpx] mt-[16rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-primary/8 flex items-center gap-[16rpx]" />

        {/* ====== 会员权益卡片（仅管理员/校长） ====== */}
        {isManagerRole && (
          <View
            className="mx-[32rpx] mt-[24rpx] h-[160rpx] rounded-[28rpx] bg-card-gradient overflow-hidden shadow-soft flex relative"
            onClick={handleOpenMembership}
          >
            {/* 左侧信息区 */}
            <View className="flex-1 px-[32rpx] py-[28rpx] flex flex-col justify-center relative z-10">
              <View className="flex items-baseline">
                <Text className="text-[48rpx] font-black text-primary leading-none italic">V</Text>
                <Text className="text-[32rpx] font-bold text-primary ml-[6rpx]">会员卡</Text>
              </View>
              <Text className="text-[24rpx] text-muted-foreground mt-[14rpx]">
                {isMembershipEntitled
                  ? isTrialEntitled
                    ? `试用中 · 有效期至 ${membershipExpireLabel}`
                    : `${quotaUsage?.versionName || '会员'} · 有效期至 ${membershipExpireLabel}`
                  : membershipExpired
                    ? '会员已到期，兑换激活码续费'
                    : '兑换激活码，开通机构会员权益'}
              </Text>
            </View>

            {/* 右侧斜切按钮区：开通/已开通统一主色样式 */}
            <View
              className="w-[220rpx] h-full relative flex flex-col items-center justify-center press-opacity bg-primary"
              style={{
                clipPath: 'polygon(24rpx 0, 100% 0, 100% 100%, 0 100%)',
              }}
            >
              <Text className="text-[30rpx] font-bold text-primary-foreground">
                {isMembershipEntitled ? '立即查看' : membershipExpired ? '立即续费' : '立即开通'}
              </Text>
              <Text className="text-[20rpx] mt-[10rpx] text-primary-foreground/75">
                {isMembershipEntitled
                  ? `至 ${membershipExpireLabel}`
                  : membershipExpired
                    ? '激活码一键续费'
                    : '激活码一键开通'}
              </Text>
            </View>
          </View>
        )}

        {/* ====== 公众号关注卡片（暂时隐藏） ====== */}
        {false && <ProfileFollowCard className="mt-[24rpx]" onClick={handleFollow} />}

        {/* ====== 错误提示 ====== */}
        {errorMsg && (
          <View className="mx-[32rpx] mt-[24rpx] bg-destructive-10 border-2 border-destructive-20 rounded-[24rpx] p-5 flex items-center gap-3">
            <Text className="flex-1 text-destructive text-lg">{errorMsg}</Text>
            <View className="px-4 py-2 rounded-full bg-destructive" onClick={loadStudents}>
              <Text className="text-destructive-foreground text-md font-medium">重试</Text>
            </View>
          </View>
        )}

        {/* ====== 教师视图 ====== */}
        {isTeacher && (
          <>
            <ProfileGrid className="mt-[24rpx]" title="教学台账" items={teacherMonthlyFlowItems} />
            {/* 店铺管理：仅管理员/校长 */}
            {isManagerRole &&
              (storeProgress &&
              (storeProgress.completed < storeProgress.total || storeOnboardingHidden === false) ? (
                <StoreOnboarding
                  className="mt-[24rpx]"
                  data={storeProgress}
                  loading={loadingStoreProgress}
                  onStepClick={handleStoreStepClick}
                  onExtraClick={handleStoreExtraClick}
                />
              ) : (
                <ProfileGrid className="mt-[24rpx]" title="店铺管理" items={teacherStoreItems} />
              ))}
            {isManagerRole && quotaUsage?.features?.marketing === true ? (
              <ProfileGrid className="mt-[24rpx]" title="营销活动" items={marketingItems} />
            ) : null}
            <ProfileGrid className="mt-[24rpx]" title="系统管理" items={teacherSystemItems} />
          </>
        )}

        {/* ====== 家长视图 ====== */}
        {!isTeacher && (
          <>
            {/* 当前学生卡片 */}
            <View
              className="mx-[32rpx] mt-[24rpx] px-[28rpx] py-[24rpx] rounded-[32rpx] bg-card shadow-soft flex items-center justify-between active:bg-muted"
              onClick={handleMyChildren}
            >
              <View className="flex items-center gap-[20rpx]">
                {activeStudent?.name ? (
                  <Avatar
                    name={activeStudent.name}
                    avatarUrl={activeStudent.avatar_url}
                    size="md"
                  />
                ) : (
                  <View className="w-[68rpx] h-[68rpx] rounded-full bg-primary-10 flex items-center justify-center">
                    <Icon name="mdi-account-child" size="sm" color="primary" />
                  </View>
                )}
                <View>
                  <Text className="text-[30rpx] font-bold text-foreground">
                    {activeStudent?.name || '暂未绑定学生'}
                  </Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[4rpx]">
                    {loadingStudents
                      ? '加载中…'
                      : students.length > 0
                        ? `共 ${students.length} 名孩子 · 点击切换`
                        : '绑定后查看课时与约课'}
                  </Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size="xs" color="mutedForeground" />
            </View>

            <ProfileGrid className="mt-[24rpx]" title="我的约课" items={parentBookingItems} />
            <ProfileGrid className="mt-[24rpx]" title="我的服务" items={parentServiceItems} />
            <ProfileGrid className="mt-[24rpx]" title="系统管理" items={parentSystemItems} />
          </>
        )}

        {/* ====== 底部品牌关于 ====== */}
        <ProfileAbout onClick={handleAbout} className="mb-[32rpx]" />

        {/* ====== 绑定学生弹窗 ====== */}
        <BottomSheet
          visible={showBindSheet}
          title="绑定学生"
          onClose={() => {
            setShowBindSheet(false);
            setInviteCode('');
          }}
        >
          <View className="px-5 pb-10">
            <Text className="text-md text-muted-foreground mb-4 block">
              请输入教师提供的学生邀请码
            </Text>
            <FormInput
              placeholder="输入邀请码（如 ST001）"
              value={inviteCode}
              onInput={(e) => setInviteCode(e.detail.value || '')}
              className="mb-0"
              inputClassName="text-xl"
            />
            <View className="flex gap-3 mt-4">
              <View
                className="flex-1 rounded-lg p-3 bg-muted flex items-center justify-center active:bg-black-3"
                onClick={() => {
                  setShowBindSheet(false);
                  setInviteCode('');
                }}
              >
                <Text className="text-xl font-medium text-muted-foreground">取消</Text>
              </View>
              <View
                className={cn(
                  'flex-1 rounded-lg p-3 shadow-elegant flex items-center justify-center',
                  binding ? 'bg-primary-50' : 'bg-gradient-primary',
                )}
                onClick={binding ? undefined : handleBind}
              >
                <Text className="text-xl font-medium text-primary-foreground">
                  {binding ? '绑定中…' : '确认绑定'}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>

        {/* ====== 切换学生弹窗（保留兼容，已不再主动触发） ====== */}
        <BottomSheet
          visible={showSwitchSheet}
          title="切换学生"
          onClose={() => setShowSwitchSheet(false)}
        >
          <View className="px-5 pb-10">
            {students.length === 0 ? (
              <View className="py-8 text-center">
                <Text className="text-lg text-muted-foreground block">暂未绑定任何学生</Text>
                <Text className="text-md text-muted-foreground block mt-1">
                  请先使用邀请码绑定学生
                </Text>
              </View>
            ) : (
              <View className="flex flex-col gap-3 mb-4">
                {students.map((s) => (
                  <View
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 p-[28rpx] rounded-lg border-2 active:opacity-80',
                      activeStudentId === s.id
                        ? 'bg-primary-10 border-primary'
                        : 'bg-black-3 border-transparent',
                    )}
                    onClick={() => handleSwitchStudent(s.id)}
                  >
                    <Avatar name={s.name} avatarUrl={s.avatar_url} size="lg" />
                    <View className="flex-1">
                      <Text className="text-lg font-medium text-foreground block">{s.name}</Text>
                      {s.nickname && (
                        <Text className="text-sm text-muted-foreground block mt-1">
                          {s.nickname}
                        </Text>
                      )}
                    </View>
                    {activeStudentId === s.id && (
                      <Text className="text-primary text-[40rpx] font-bold">✓</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
            <View
              className="w-full rounded-lg p-3 border-2 border-primary flex items-center justify-center active:bg-primary-10"
              onClick={() => {
                setShowSwitchSheet(false);
                setShowBindSheet(true);
              }}
            >
              <Text className="text-xl font-medium text-primary">＋ 绑定更多学生</Text>
            </View>
          </View>
        </BottomSheet>

        <SupportQrDialog visible={supportQrVisible} onClose={() => setSupportQrVisible(false)} />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Profile);
