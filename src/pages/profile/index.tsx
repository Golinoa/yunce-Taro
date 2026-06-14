/**
 * 个人中心页 pages/profile/index
 * 教师视图：用户信息 + 邀请码管理 + 功能菜单
 * 家长视图：用户信息 + 学生绑定/切换 + 课时概览 + 功能菜单
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo } from 'react';
import Avatar from '@/components/Avatar';
import PageContainer from '@/components/PageContainer';
import { studentService } from '@/services';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { withRouteGuard } from '@/utils/route-guard';

// ============================================
// 菜单项类型
// ============================================
interface MenuItem {
  label: string;
  action: () => void;
}

// ============================================
// 个人中心页
// ============================================
const Profile: React.FC = () => {
  const { profile, signOut } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  // 家长端：学生列表与当前选中
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 弹窗控制
  const [showBindModal, setShowBindModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
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
      // 恢复上次选中的学生，或默认选第一个
      const stored = Taro.getStorageSync('activeStudentId') || '';
      const valid = list.find((s) => s.id === stored)?.id || list[0]?.id || '';
      setActiveStudentId(valid);
    } catch {
      setErrorMsg('学生信息加载失败，请下拉刷新');
    } finally {
      setLoadingStudents(false);
    }
  }, [profile, isTeacher]);

  // 页面显示时刷新
  React.useEffect(() => {
    loadStudents();
  }, [loadStudents]);
  Taro.useDidShow(() => {
    loadStudents();
  });

  // 当前选中的学生
  const activeStudent = useMemo(
    () => students.find((s) => s.id === activeStudentId),
    [students, activeStudentId],
  );

  // 当前学生的课时统计
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
      setShowBindModal(false);
      setInviteCode('');
      await loadStudents();
      setActiveStudentId(student.id);
      Taro.setStorageSync('activeStudentId', student.id);
    } catch (err: any) {
      const msg = String(err?.message || '');
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
    setShowSwitchModal(false);
    Taro.showToast({ title: '已切换学生', icon: 'success' });
  }, []);

  // 教师菜单
  const teacherMenus: MenuItem[] = useMemo(
    () => [
      { label: '个人信息', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      { label: '消息设置', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      {
        label: '用户协议',
        action: () => Taro.navigateTo({ url: '/pages/agreement/index?type=user' }),
      },
      {
        label: '隐私政策',
        action: () => Taro.navigateTo({ url: '/pages/agreement/index?type=privacy' }),
      },
      { label: '使用帮助', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      { label: '意见反馈', action: () => Taro.navigateTo({ url: '/pages/feedback/index' }) },
    ],
    [],
  );

  // 家长菜单
  const parentMenus: MenuItem[] = useMemo(
    () => [
      { label: '个人信息', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      {
        label: '用户协议',
        action: () => Taro.navigateTo({ url: '/pages/agreement/index?type=user' }),
      },
      {
        label: '隐私政策',
        action: () => Taro.navigateTo({ url: '/pages/agreement/index?type=privacy' }),
      },
      { label: '使用帮助', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
    ],
    [],
  );

  const menus = isTeacher ? teacherMenus : parentMenus;

  // 用户名首字
  const avatarLetter = (profile?.name || '用')[0];

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-40">
        {/* ====== 顶部用户信息卡片 ====== */}
        <View className="bg-gradient-primary pt-10 px-6 pb-12 rounded-b-60rpx shadow-elegant relative overflow-hidden">
          <View className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
          <View className="relative z-1 flex items-center gap-4">
            <View className="w-[128rpx] h-[128rpx] rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border-2 border-white/40 flex-shrink-0">
              <Text className="text-white text-[48rpx] font-bold">{avatarLetter}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-[40rpx] font-bold block">
                {profile?.name || '用户'}
              </Text>
              <View className="flex items-center gap-2 mt-2">
                <View className="bg-white/20 backdrop-blur-sm px-3 py-[4rpx] rounded-round">
                  <Text className="text-white text-sm">{isTeacher ? '教师' : '家长'}</Text>
                </View>
                {!isTeacher && activeStudent?.name && (
                  <View className="bg-white/20 backdrop-blur-sm px-3 py-[4rpx] rounded-round">
                    <Text className="text-white text-sm">{activeStudent.name}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ====== 家长端：学生信息区域 ====== */}
        {!isTeacher && (
          <View className="px-6 -mt-4 relative z-2 flex flex-col gap-3 mb-3">
            {/* 错误提示 */}
            {errorMsg && (
              <View className="bg-destructive-10 border-2 border-destructive-20 rounded-lg p-3 flex items-center gap-2">
                <Text className="flex-1 text-destructive text-lg">{errorMsg}</Text>
                <View className="px-3 py-1 rounded-round bg-destructive" onClick={loadStudents}>
                  <Text className="text-white text-md font-medium">重试</Text>
                </View>
              </View>
            )}

            {/* 加载中 */}
            {loadingStudents && students.length === 0 && (
              <View className="bg-white rounded-lg p-6 shadow-soft flex flex-col items-center gap-2">
                <Text className="text-muted-foreground text-lg">加载学生信息…</Text>
              </View>
            )}

            {/* 未绑定学生 */}
            {!loadingStudents && !activeStudent?.name && (
              <View className="bg-white rounded-lg p-6 shadow-soft flex flex-col items-center gap-2">
                <View className="w-[128rpx] h-[128rpx] rounded-full bg-primary-10 flex items-center justify-center">
                  <Text className="text-primary text-[48rpx]">?</Text>
                </View>
                <Text className="text-xl font-semibold text-foreground">暂未绑定学生</Text>
                <Text className="text-md text-muted-foreground text-center">
                  绑定后可查看孩子的课时与学习动态
                </Text>
                <View
                  className="w-full rounded-lg p-3 bg-gradient-primary shadow-elegant flex items-center justify-center press-scale"
                  onClick={() => setShowBindModal(true)}
                >
                  <Text className="text-white text-xl font-medium">立即绑定</Text>
                </View>
              </View>
            )}

            {/* 已绑定学生：课时概览 */}
            {!loadingStudents && activeStudent?.name && (
              <View
                className="bg-white rounded-lg shadow-soft overflow-hidden press-scale"
                onClick={() => setShowSwitchModal(true)}
              >
                <View className="p-5 flex items-center gap-3">
                  <Avatar
                    name={activeStudent.name}
                    avatarUrl={activeStudent.avatar_url}
                    size="lg"
                    className="shadow-soft"
                  />
                  <View className="flex-1">
                    <View className="flex items-center gap-[12rpx]">
                      <Text className="text-xl font-semibold text-foreground">
                        {activeStudent.name}
                      </Text>
                      <View className="bg-muted px-2 py-[2rpx] rounded-round">
                        <Text className="text-sm text-muted-foreground">当前学生</Text>
                      </View>
                    </View>
                    {activeStudent.invite_code && (
                      <View className="flex items-center gap-1 mt-1">
                        <Text className="text-sm text-muted-foreground">标识码</Text>
                        <Text className="text-sm text-foreground font-mono">
                          {activeStudent.invite_code}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-muted-foreground text-xl flex-shrink-0">{'>'}</Text>
                </View>

                <View className="flex gap-2 px-5 pb-4">
                  <View className="flex-1 bg-primary-5 rounded-lg p-[20rpx] text-center">
                    <Text className="text-[40rpx] font-bold text-primary block">{totalHours}</Text>
                    <Text className="text-sm text-muted-foreground block mt-1">总课时</Text>
                  </View>
                  <View className="flex-1 bg-primary-5 rounded-lg p-[20rpx] text-center">
                    <Text className="text-[40rpx] font-bold text-foreground block">
                      {usedHours}
                    </Text>
                    <Text className="text-sm text-muted-foreground block mt-1">已消课</Text>
                  </View>
                  <View className="flex-1 bg-primary-5 rounded-lg p-[20rpx] text-center">
                    <Text className="text-[40rpx] font-bold text-primary block">
                      {remainingHours}
                    </Text>
                    <Text className="text-sm text-muted-foreground block mt-1">剩余</Text>
                  </View>
                </View>

                {remainingHours < 3 && totalHours > 0 && (
                  <View className="mx-5 mb-3 flex items-center gap-1">
                    <Text className="text-sm text-destructive">
                      剩余课时不足，请及时联系教师充值
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* 学生管理操作 */}
            {!loadingStudents && students.length > 0 && (
              <View className="bg-white rounded-lg shadow-soft overflow-hidden">
                <View className="py-[20rpx] px-5 border-b border-input">
                  <Text className="text-md text-muted-foreground font-medium">学生管理</Text>
                </View>
                <View
                  className="flex items-center gap-3 py-[28rpx] px-5 active:bg-muted"
                  onClick={() => setShowSwitchModal(true)}
                >
                  <Text className="text-primary text-xl w-[44rpx] text-center">⇄</Text>
                  <View className="flex-1">
                    <Text className="text-lg text-foreground">切换学生</Text>
                    <Text className="text-md text-muted-foreground ml-2">
                      共 {students.length} 名学生
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-xl flex-shrink-0">{'>'}</Text>
                </View>
                <View
                  className="flex items-center gap-3 py-[28rpx] px-5 border-t border-input active:bg-muted"
                  onClick={() => setShowBindModal(true)}
                >
                  <Text className="text-primary text-xl w-[44rpx] text-center">＋</Text>
                  <Text className="text-lg text-foreground">绑定学生</Text>
                  <Text className="text-muted-foreground text-xl flex-shrink-0 ml-auto">{'>'}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ====== 功能菜单 ====== */}
        <View className="mx-6 mt-2 bg-white rounded-lg shadow-soft overflow-hidden">
          {menus.map((item, idx) => (
            <View
              key={idx}
              className={`flex items-center px-5 py-[28rpx] active:bg-muted ${idx > 0 ? 'border-t border-input' : ''}`}
              onClick={item.action}
            >
              <Text className="flex-1 text-lg text-foreground">{item.label}</Text>
              <Text className="text-muted-foreground text-xl flex-shrink-0">{'>'}</Text>
            </View>
          ))}
        </View>

        {/* ====== 退出登录 ====== */}
        <View
          className="mx-6 mt-5 rounded-lg py-[28rpx] bg-white shadow-soft flex items-center justify-center press-scale"
          onClick={handleSignOut}
        >
          <Text className="text-destructive text-xl font-medium">退出登录</Text>
        </View>

        {/* ====== 绑定学生弹窗 ====== */}
        {showBindModal && (
          <View className="fixed top-0 left-0 right-0 bottom-0 z-200 flex items-end justify-center bg-black/30 backdrop-blur-sm">
            <View className="w-full bg-white rounded-t-32rpx p-5 pb-10 shadow-elegant">
              <View className="flex items-center justify-between mb-4">
                <Text className="text-xl font-semibold text-foreground">绑定学生</Text>
                <Text
                  className="text-muted-foreground text-[40rpx] p-1"
                  onClick={() => {
                    setShowBindModal(false);
                    setInviteCode('');
                  }}
                >
                  ✕
                </Text>
              </View>
              <Text className="text-md text-muted-foreground mb-3 block">
                请输入教师提供的学生邀请码
              </Text>
              <View
                className="rounded-lg py-[20rpx] px-[28rpx] shadow-soft mb-3 overflow-hidden"
                style={{ backgroundColor: '#f5faf8', border: '2rpx solid #D5E8E0' }}
              >
                <Input
                  className="w-full text-xl text-foreground bg-transparent"
                  placeholder="输入邀请码（如 ST001）"
                  value={inviteCode}
                  onInput={(e) => setInviteCode(e.detail.value || '')}
                />
              </View>
              <View className="flex gap-2_d5">
                <View
                  className="flex-1 rounded-lg p-3 bg-muted flex items-center justify-center press-scale"
                  onClick={() => {
                    setShowBindModal(false);
                    setInviteCode('');
                  }}
                >
                  <Text className="text-xl font-medium text-muted-foreground">取消</Text>
                </View>
                <View
                  className={`flex-1 rounded-lg p-3 shadow-elegant flex items-center justify-center press-scale ${binding ? 'bg-primary-50 shadow-none state-loading' : 'bg-gradient-primary'}`}
                  onClick={binding ? undefined : handleBind}
                >
                  <Text className="text-xl font-medium text-white">
                    {binding ? '绑定中…' : '确认绑定'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ====== 切换学生弹窗 ====== */}
        {showSwitchModal && (
          <View className="fixed top-0 left-0 right-0 bottom-0 z-200 flex items-end justify-center bg-black/30 backdrop-blur-sm">
            <View className="w-full bg-white rounded-t-32rpx p-5 pb-10 shadow-elegant">
              <View className="flex items-center justify-between mb-4">
                <Text className="text-xl font-semibold text-foreground">切换学生</Text>
                <Text
                  className="text-muted-foreground text-[40rpx] p-1"
                  onClick={() => setShowSwitchModal(false)}
                >
                  ✕
                </Text>
              </View>
              {students.length === 0 ? (
                <View className="py-8 text-center">
                  <Text className="text-lg text-muted-foreground block">暂未绑定任何学生</Text>
                  <Text className="text-md text-muted-foreground block mt-1">
                    请先使用邀请码绑定学生
                  </Text>
                </View>
              ) : (
                <View className="flex flex-col gap-2_d5 mb-3">
                  {students.map((s) => (
                    <View
                      key={s.id}
                      className={`flex items-center gap-3 p-[28rpx] rounded-lg border-2 press-scale ${activeStudentId === s.id ? 'bg-primary-10 border-primary' : 'bg-black-3 border-transparent'}`}
                      onClick={() => handleSwitchStudent(s.id)}
                    >
                      <Avatar
                        name={s.name}
                        avatarUrl={s.avatar_url}
                        size="lg"
                        className="shadow-soft"
                      />
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
                className="w-full rounded-lg p-3 border-2 border-primary flex items-center justify-center press-scale"
                onClick={() => {
                  setShowSwitchModal(false);
                  setShowBindModal(true);
                }}
              >
                <Text className="text-xl font-medium text-primary">＋ 绑定更多学生</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(Profile);
