/**
 * 个人中心页 pages/profile/index
 *
 *  redesign 后遵循"卡片分类 + 避免入口重复"原则：
 *  - 高频教务操作（消课、学员、班级等）集中在首页金刚区与 Tab，本页不再堆砌
 *  - 教师视图：常用工具（工资/请假/通知/统计）+ 系统服务（设置/协议/帮助）
 *  - 家长视图：孩子课时卡片 + 孩子学习 + 我的服务
 *  - 底部统一提供客服咨询、服务中心入口
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
import ProfileGrid from '@/components/profile/ProfileGrid';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileMenu from '@/components/profile/ProfileMenu';
import ProfileStats from '@/components/profile/ProfileStats';
import ProfileSupport from '@/components/profile/ProfileSupport';
import RoleSwitchSheet from '@/components/RoleSwitchSheet';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

// ============================================
// 教师视图：常用工具配置
// 注意：学员/班级/课包/消课等高频入口已在首页金刚区，此处不再重复
// ============================================
const TEACHER_TOOLS = [
  {
    label: '工资查询',
    icon: 'mdi-cash-multiple' as const,
    color: 'warning' as const,
    url: '/package-teacher/pages/salary-detail/index',
  },
  {
    label: '请假审批',
    icon: 'mdi-calendar-heart' as const,
    color: 'accent' as const,
    url: '/package-course/pages/leave-request/index',
  },
  {
    label: '消息通知',
    icon: 'mdi-bell-outline' as const,
    color: 'primary' as const,
    url: '/pages/notifications/index',
  },
  {
    label: '数据统计',
    icon: 'mdi-chart-bar' as const,
    color: 'info' as const,
    url: '/pages/statistics/index',
  },
];

// ============================================
// 家长视图：孩子学习配置
// ============================================
const PARENT_CHILD_TOOLS = [
  {
    label: '学习记录',
    icon: 'mdi-history' as const,
    color: 'primary' as const,
    url: '/package-course/pages/records/index',
  },
  {
    label: '孩子课表',
    icon: 'mdi-calendar-blank' as const,
    color: 'info' as const,
    url: '/package-course/pages/records/index',
  },
  {
    label: '请假申请',
    icon: 'mdi-calendar-heart' as const,
    color: 'accent' as const,
    url: '/package-course/pages/leave-request/index',
  },
];

const ROLE_LABEL: Record<string, string> = {
  principal: '校长',
  teacher: '教师',
  parent: '家长',
};

const BIND_STATUS_LABEL: Record<string, string> = {
  BOUND: '已绑定',
  PENDING: '待确认',
  UNBOUND: '未绑定',
};

const Profile: React.FC = () => {
  const { profile, currentRole, currentIdentity, signOut } = useAuth();
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

  React.useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useDidShow(() => {
    loadStudents();
  });

  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId),
    [students, activeStudentId],
  );

  const profileDetailItems = useMemo(() => {
    if (currentRole === 'teacher' && profile?.teacher_profile) {
      return [
        {
          label: '机构名称',
          value: profile.teacher_profile.institution || currentIdentity?.organizationName || '未设置',
        },
        {
          label: '教师邀请码',
          value: profile.teacher_profile.invite_code || '未生成',
        },
        {
          label: '学员数量',
          value: `${profile.teacher_profile.student_count ?? 0} 名`,
        },
        {
          label: '班级数量',
          value: `${profile.teacher_profile.class_count ?? 0} 个`,
        },
      ];
    }

    if (currentRole === 'parent' && profile?.parent_profile) {
      return [
        {
          label: '绑定学生',
          value: profile.parent_profile.student_name || '暂未绑定',
        },
        {
          label: '家长关系',
          value: profile.parent_profile.relation || '未设置',
        },
        {
          label: '绑定状态',
          value: BIND_STATUS_LABEL[profile.parent_profile.bind_status || ''] || '未知',
        },
        {
          label: '手机号',
          value: profile.phone || '未设置',
        },
      ];
    }

    const commonItems = [
      {
        label: '手机号',
        value: profile?.phone || '未设置',
      },
      {
        label: '邮箱',
        value: profile?.email || '未设置',
      },
    ].filter((item) => item.value !== '未设置');

    return commonItems;
  }, [currentIdentity?.organizationName, currentRole, profile]);

  const totalHours = useMemo(
    () => (activeStudent?.course_packages || []).reduce((s, p) => s + (p.total_hours || 0), 0),
    [activeStudent],
  );
  const remainingHours = useMemo(
    () => (activeStudent?.course_packages || []).reduce((s, p) => s + (p.remaining_hours || 0), 0),
    [activeStudent],
  );
  const usedHours = totalHours - remainingHours;

  // 退出登录
  const handleSignOut = useCallback(async () => {
    const { confirm } = await Taro.showModal({
      title: '确认退出',
      content: '退出后需要重新登录，确认退出吗？',
      confirmColor: '#D94040',
    });
    if (!confirm) return;
    await signOut();
    Taro.reLaunch({ url: '/pages/login/index' });
  }, [signOut]);

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
      Taro.showToast({ title: '页面入口未配置', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url });
  }, []);

  // 教师：常用工具
  const teacherToolItems = useMemo(
    () =>
      TEACHER_TOOLS.map(({ url, ...item }) => ({
        ...item,
        onClick: () => handleNavigate(url),
      })),
    [handleNavigate],
  );

  // 教师：系统服务菜单
  const teacherServiceItems = useMemo(
    () => [
      {
        label: '校区设置',
        icon: 'mdi-office-building' as const,
        color: 'primary' as const,
        onClick: () => handleNavigate('/package-settings/pages/campus-settings/index'),
      },
      {
        label: '帮助中心',
        icon: 'mdi-help-circle' as const,
        color: 'info' as const,
        onClick: () => handleNavigate('/package-settings/pages/feedback/index'),
      },
      {
        label: '意见反馈',
        icon: 'mdi-message-text' as const,
        color: 'warning' as const,
        onClick: () => handleNavigate('/package-settings/pages/feedback/index'),
      },
      {
        label: '用户协议',
        icon: 'mdi-file-document-outline' as const,
        color: 'accent' as const,
        onClick: () => handleNavigate('/pages/agreement/index?type=user'),
      },
      {
        label: '隐私政策',
        icon: 'mdi-shield-check' as const,
        color: 'success' as const,
        onClick: () => handleNavigate('/pages/agreement/index?type=privacy'),
      },
    ],
    [handleNavigate],
  );

  // 家长：孩子学习
  const parentChildItems = useMemo(
    () =>
      PARENT_CHILD_TOOLS.map(({ url, ...item }) => ({
        ...item,
        onClick: () => handleNavigate(url),
      })),
    [handleNavigate],
  );

  // 家长：我的服务菜单
  const parentServiceItems = useMemo(
    () => [
      {
        label: '消息通知',
        icon: 'mdi-bell-outline' as const,
        color: 'primary' as const,
        onClick: () => handleNavigate('/pages/notifications/index'),
      },
      {
        label: '我的孩子',
        icon: 'mdi-account-child' as const,
        color: 'accent' as const,
        extra: students.length > 0 ? `共 ${students.length} 名` : undefined,
        onClick: () => setShowSwitchSheet(true),
      },
      {
        label: '帮助中心',
        icon: 'mdi-help-circle' as const,
        color: 'info' as const,
        onClick: () => handleNavigate('/package-settings/pages/feedback/index'),
      },
      {
        label: '用户协议',
        icon: 'mdi-file-document-outline' as const,
        color: 'warning' as const,
        onClick: () => handleNavigate('/pages/agreement/index?type=user'),
      },
      {
        label: '隐私政策',
        icon: 'mdi-shield-check' as const,
        color: 'success' as const,
        onClick: () => handleNavigate('/pages/agreement/index?type=privacy'),
      },
    ],
    [handleNavigate, students.length],
  );

  const handleSettings = useCallback(() => {
    if (isTeacher) {
      Taro.navigateTo({ url: '/package-settings/pages/campus-settings/index' });
    } else {
      // 家长端暂无独立设置页，引导至帮助中心
      Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
    }
  }, [isTeacher]);

  const handleCustomerService = useCallback(() => {
    // 客服功能暂未接入，引导至意见反馈页
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  const handleServiceCenter = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background pb-[40rpx]">
        {/* ====== 顶部用户信息 ====== */}
        <ProfileHeader
          avatarUrl={profile?.avatar_url}
          name={profile?.name || '用户'}
          role={ROLE_LABEL[currentRole || 'teacher']}
          orgName={currentIdentity?.organizationName || '云策教务'}
          onSettings={handleSettings}
        />

        {/* ====== 当前身份卡片 ====== */}
        <View
          className="mx-[32rpx] mt-[24rpx] mb-[24rpx] rounded-[32rpx] bg-card shadow-soft p-[28rpx] flex items-center justify-between active:bg-primary-5 transition-colors"
          onClick={() => setShowRoleSheet(true)}
        >
          <View>
            <Text className="text-[24rpx] text-muted-foreground mb-[6rpx]">当前身份</Text>
            <Text className="text-[32rpx] font-bold text-foreground">
              {currentIdentity?.organizationName || '云策教务'}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[4rpx]">
              {ROLE_LABEL[currentRole || 'teacher']} · 点击切换身份
            </Text>
          </View>
          <Icon name="arrow-right" size={32} className="text-muted-foreground" />
        </View>

        {profileDetailItems.length > 0 && (
          <View className="mx-[32rpx] mb-[24rpx] rounded-[32rpx] bg-card shadow-soft p-[28rpx]">
            <Text className="text-[24rpx] text-muted-foreground mb-[16rpx] block">资料概览</Text>
            <View className="flex flex-col gap-[18rpx]">
              {profileDetailItems.map((item) => (
                <View key={item.label} className="flex items-center justify-between gap-4">
                  <Text className="text-[26rpx] text-muted-foreground">{item.label}</Text>
                  <Text className="text-[28rpx] text-foreground font-medium text-right">
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ====== 教师视图 ====== */}
        {isTeacher && (
          <>
            <ProfileGrid title="常用工具" items={teacherToolItems} />
            <ProfileMenu title="系统服务" items={teacherServiceItems} />
          </>
        )}

        {/* ====== 家长视图 ====== */}
        {!isTeacher && (
          <>
            {/* 错误提示 */}
            {errorMsg && (
              <View className="mx-[32rpx] mb-[24rpx] bg-destructive-10 border-2 border-destructive-20 rounded-[32rpx] p-5 flex items-center gap-3">
                <Text className="flex-1 text-destructive text-lg">{errorMsg}</Text>
                <View className="px-4 py-2 rounded-full bg-destructive" onClick={loadStudents}>
                  <Text className="text-white text-md font-medium">重试</Text>
                </View>
              </View>
            )}

            {/* 加载中 */}
            {loadingStudents && students.length === 0 && (
              <View className="mx-[32rpx] mb-[24rpx] bg-white rounded-[32rpx] shadow-soft p-10 flex flex-col items-center gap-2">
                <Text className="text-muted-foreground text-lg">加载学生信息…</Text>
              </View>
            )}

            {/* 未绑定学生 */}
            {!loadingStudents && !activeStudent?.name && (
              <View className="mx-[32rpx] mb-[24rpx] bg-white rounded-[32rpx] shadow-soft p-10 flex flex-col items-center gap-4">
                <View className="w-[128rpx] h-[128rpx] rounded-full bg-primary-10 flex items-center justify-center">
                  <Text className="text-primary text-[48rpx]">?</Text>
                </View>
                <Text className="text-xl font-semibold text-foreground">暂未绑定学生</Text>
                <Text className="text-md text-muted-foreground text-center">
                  绑定后可查看孩子的课时与学习动态
                </Text>
                <View
                  className="w-full rounded-lg p-3 bg-gradient-primary shadow-elegant flex items-center justify-center active:opacity-90"
                  onClick={() => setShowBindSheet(true)}
                >
                  <Text className="text-white text-xl font-medium">立即绑定</Text>
                </View>
              </View>
            )}

            {/* 已绑定学生：课时概览 */}
            {!loadingStudents && activeStudent?.name && (
              <ProfileStats
                items={[
                  { value: totalHours, label: '总课时' },
                  { value: usedHours, label: '已消课' },
                  { value: remainingHours, label: '剩余课时' },
                ]}
                onClick={() => setShowSwitchSheet(true)}
              />
            )}

            <ProfileGrid title="孩子学习" items={parentChildItems} />
            <ProfileMenu title="我的服务" items={parentServiceItems} />
          </>
        )}

        {/* ====== 底部服务入口 ====== */}
        <ProfileSupport
          onCustomerService={handleCustomerService}
          onServiceCenter={handleServiceCenter}
        />

        {/* ====== 退出登录 ====== */}
        <View
          className="mx-[32rpx] rounded-[32rpx] py-[28rpx] bg-white shadow-soft flex items-center justify-center active:bg-muted"
          onClick={handleSignOut}
        >
          <Text className="text-destructive text-xl font-medium">退出登录</Text>
        </View>

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
                <Text className="text-xl font-medium text-white">
                  {binding ? '绑定中…' : '确认绑定'}
                </Text>
              </View>
            </View>
          </View>
        </BottomSheet>

        {/* ====== 切换学生弹窗 ====== */}
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
