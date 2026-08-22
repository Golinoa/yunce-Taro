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
import React, { useState, useCallback, useMemo } from 'react';
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
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { BRAND_FALLBACK_ORG_NAME } from '@/constants/brand';
import { markStepVisited } from '@/data/onboarding';
import { onboardingService, studentService } from '@/services';
import type { StoreOnboardingProgress, StoreOnboardingStep } from '@/types/onboarding';
import type { Student } from '@/types/student';
import { isStaffRole, STORE_ONBOARDING_HIDDEN_KEY, useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

// ============================================
// 角色标签映射
// ============================================
const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  principal: '校长',
  teacher: '教师',
  assistant: '助教',
  parent: '家长',
};

// ============================================
// 占位提示：未实现入口统一提示
// ============================================
const PLACEHOLDER_TIP = '功能开发中，敬请期待';

const Profile: React.FC = () => {
  const { profile, currentRole, currentIdentity } = useAuth();
  const isTeacher = isStaffRole(currentRole);

  // 家长端：学生列表与当前选中
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 弹窗控制
  const [showBindSheet, setShowBindSheet] = useState(false);
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [binding, setBinding] = useState(false);

  // 店铺管理 onboarding 进度
  const [storeProgress, setStoreProgress] = useState<StoreOnboardingProgress | null>(null);
  const [loadingStoreProgress, setLoadingStoreProgress] = useState(false);
  const [storeOnboardingHidden, setStoreOnboardingHidden] = useState<boolean | null>(null);

  // 会员开通状态（TODO: 后续接入接口）
  const [isMembershipActive] = useState(true);

  // 加载家长绑定的学生
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
    } catch {
      setErrorMsg('学生信息加载失败，请下拉刷新');
    } finally {
      setLoadingStudents(false);
    }
  }, [profile, isTeacher]);

  // 读取本地存储的 onboarding 隐藏状态
  const loadStoreOnboardingHidden = useCallback(() => {
    try {
      const raw = Taro.getStorageSync(STORE_ONBOARDING_HIDDEN_KEY);
      setStoreOnboardingHidden(raw === true ? true : raw === false ? false : null);
    } catch {
      setStoreOnboardingHidden(null);
    }
  }, []);

  // 加载店铺管理 onboarding 进度
  const loadStoreProgress = useCallback(async () => {
    if (!isTeacher) return;
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
  }, [isTeacher, storeOnboardingHidden]);

  React.useEffect(() => {
    loadStudents();
    loadStoreOnboardingHidden();
    loadStoreProgress();
  }, [loadStudents, loadStoreOnboardingHidden, loadStoreProgress]);

  useDidShow(() => {
    loadStudents();
    loadStoreOnboardingHidden();
    loadStoreProgress();
  });

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId),
    [students, activeStudentId],
  );

  // 绑定学生
  const handleBind = useCallback(async () => {
    const code = inviteCode.trim();
    if (!code) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (!profile?.id) return;
    setBinding(true);
    try {
      const student = await studentService.findByInviteCode(code.toUpperCase());
      if (!student) {
        Taro.showToast({ title: '邀请码无效，请确认后重试', icon: 'none' });
        return;
      }
      await studentService.bindParent(student.id, profile.id);
      Taro.showToast({ title: '绑定成功', icon: 'success' });
      setShowBindSheet(false);
      setInviteCode('');
      await loadStudents();
      setActiveStudentId(student.id);
      Taro.setStorageSync('activeStudentId', student.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('已绑定') || msg.includes('重复')) {
        Taro.showToast({ title: '该学生已绑定，无需重复操作', icon: 'none' });
      } else {
        Taro.showToast({ title: '绑定失败，请重试', icon: 'none' });
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

  // 店铺管理 onboarding 非步骤入口点击
  const handleStoreExtraClick = useCallback(() => {
    handlePlaceholder();
  }, [handlePlaceholder]);

  // 跳转到个人资料编辑页
  const handleProfile = useCallback(() => {
    Taro.navigateTo({ url: '/pages/profile-edit/index' });
  }, []);

  // 跳转到子女档案页
  const handleMyChildren = useCallback(() => {
    if (students.length === 0) {
      // 0 个孩子时引导去绑定
      setShowBindSheet(true);
    } else {
      Taro.navigateTo({ url: '/pages/children/index' });
    }
  }, [students.length]);

  // 公众号关注（暂无接入）
  const handleFollow = useCallback(() => {
    Taro.showToast({ title: '请关注对应服务号以接收消息', icon: 'none' });
  }, []);

  // 关于品牌
  const handleAbout = useCallback(() => {
    Taro.navigateTo({ url: '/pages/about/index' });
  }, []);

  // ============================================
  // 教师视图：店铺管理
  // ============================================
  const teacherStoreItems = useMemo(
    () => [
      {
        label: '门店管理',
        icon: 'mdi-office-building-outline' as const,
        onClick: handlePlaceholder,
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
        label: '学员信箱',
        icon: 'mdi-email-outline' as const,
        onClick: handlePlaceholder,
      },
    ],
    [
      handleNavigate,
      handlePlaceholder,
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
        onClick: () => handleNavigate('/package-settings/pages/feedback/index'),
      },
      {
        label: '消息通知',
        icon: 'mdi-message-text-outline',
        onClick: () => handleNavigate('/pages/notifications/index'),
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

  // 教师视图：4 列核心数据
  const teacherStats = useMemo(
    () => [
      { label: '累计出勤', value: 0, unit: '次' },
      { label: '剩余次数', value: 0, unit: '次' },
      { label: '剩余时长', value: 0, unit: '天' },
      { label: '剩余储值', value: 0, unit: '元' },
    ],
    [],
  );

  // ============================================
  // 家长视图：我的约课
  // ============================================
  const parentBookingItems = useMemo(
    () => [
      {
        label: '已预约',
        icon: 'mdi-calendar-check-outline' as const,
        onClick: () => handleNavigate('/pages/my-course/index?tab=booked'),
      },
      {
        label: '排队中',
        icon: 'mdi-account-group-outline' as const,
        onClick: () => handleNavigate('/pages/my-course/index?tab=waiting'),
      },
      {
        label: '待评价',
        icon: 'mdi-star-outline' as const,
        onClick: () => handleNavigate('/pages/my-course/index?tab=pending_evaluate'),
      },
      {
        label: '已取消',
        icon: 'mdi-calendar-blank-outline' as const,
        onClick: () => handleNavigate('/pages/my-course/index?tab=cancelled'),
      },
    ],
    [handleNavigate],
  );

  // 家长视图：我的服务
  const parentServiceItems = useMemo(
    () => [
      {
        label: '我的卡包',
        icon: 'mdi-package' as const,
        onClick: () => handleNavigate('/package-course/pages/course-packages/index'),
      },
      {
        label: '我的合同',
        icon: 'mdi-file-document-outline' as const,
        onClick: handlePlaceholder,
      },
      {
        label: '排行榜',
        icon: 'mdi-trophy-outline' as const,
        onClick: handlePlaceholder,
      },
      {
        label: '课程足迹',
        icon: 'mdi-calendar-outline' as const,
        onClick: () => handleNavigate('/package-course/pages/records/index'),
      },
      {
        label: '积分中心',
        icon: 'mdi-star-outline' as const,
        onClick: handlePlaceholder,
      },
    ],
    [handleNavigate, handlePlaceholder],
  );

  // 家长视图：系统管理
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
        onClick: () => handleNavigate('/package-settings/pages/feedback/index'),
      },
      {
        label: '消息通知',
        icon: 'mdi-message-text-outline' as const,
        onClick: () => handleNavigate('/pages/notifications/index'),
      },
      {
        label: '系统设置',
        icon: 'mdi-cog-outline' as const,
        onClick: () => handleNavigate('/package-settings/pages/system-settings/index'),
      },
    ],
    [handleNavigate],
  );

  // 家长视图：4 列核心数据
  const parentStats = useMemo(
    () => [
      { label: '累计出勤', value: 0, unit: '次' },
      { label: '剩余次数', value: 0, unit: '次' },
      { label: '剩余时长', value: 0, unit: '天' },
      { label: '剩余储值', value: 0, unit: '元' },
    ],
    [],
  );

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background pb-[40rpx]">
        {/* ====== 顶部渐变头部 ====== */}
        <ProfileHeader
          variant="gradient"
          avatarUrl={profile?.avatar_url}
          name={profile?.name || '用户'}
          role={isTeacher ? ROLE_LABEL[currentRole || 'teacher'] : undefined}
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

        {/* ====== 会员权益卡片 ====== */}
        <View className="mx-[32rpx] mt-[24rpx] h-[160rpx] rounded-[28rpx] bg-card-gradient overflow-hidden shadow-soft flex relative">
          {/* 左侧信息区 */}
          <View className="flex-1 px-[32rpx] py-[28rpx] flex flex-col justify-center relative z-10">
            <View className="flex items-baseline">
              <Text className="text-[48rpx] font-black text-primary leading-none italic">V</Text>
              <Text className="text-[32rpx] font-bold text-primary ml-[6rpx]">会员卡</Text>
            </View>
            <Text className="text-[24rpx] text-muted-foreground mt-[14rpx]">
              {isMembershipActive ? '已开通会员，尊享全部教务特权' : '开通会员，尊享全部教务特权'}
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
              {isMembershipActive ? '立即查看' : '立即开通'}
            </Text>
            <Text className="text-[20rpx] mt-[10rpx] text-primary-foreground/75">
              {isMembershipActive ? '有效期至 2030-12-31' : '已有 2,333 人开通'}
            </Text>
          </View>
        </View>

        {/* ====== 公众号关注卡片（暂时隐藏） ====== */}
        {false && <ProfileFollowCard className="mt-[24rpx]" onClick={handleFollow} />}

        {/* ====== 我的约课 ====== */}
        <ProfileGrid className="mt-[24rpx]" title="我的约课" items={parentBookingItems} />

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
            {storeProgress &&
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
            )}
            <ProfileGrid className="mt-[24rpx]" title="营销活动" items={marketingItems} />
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

        {/* ====== 切换身份 Sheet ====== */}
        <RoleSwitchSheet visible={showRoleSheet} onClose={() => setShowRoleSheet(false)} />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Profile);
