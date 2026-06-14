import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Empty from '@/components/Empty';
import ChildSelector from '@/components/home/ChildSelector';
import HourProgress from '@/components/home/HourProgress';
import RecentRecordItem from '@/components/home/RecentRecordItem';
import ScheduleTimeline from '@/components/home/ScheduleTimeline';
import StatCard from '@/components/home/StatCard';
import StudentQuickList from '@/components/home/StudentQuickList';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { homeService } from '@/services/home';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Schedule } from '@/types/schedule';
import type { Student } from '@/types/student';
import type { Teacher } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 首页 - 使用 UnoCSS 原子化类名，1:1 对齐原版 */
const Home: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';

  // ---- 教师端状态 ----
  const [_teacher, setTeacher] = useState<Teacher | null>(null);
  const [teacherStudents, setTeacherStudents] = useState<Student[]>([]);
  const [teacherSchedules, setTeacherSchedules] = useState<Schedule[]>([]);
  const [teacherRecords, setTeacherRecords] = useState<LessonRecord[]>([]);
  const [todayRecordCount, setTodayRecordCount] = useState(0);
  const [totalRemaining, setTotalRemaining] = useState(0);

  // ---- 家长端状态 ----
  const [parentChildren, setParentChildren] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [parentPackages, setParentPackages] = useState<CoursePackage[]>([]);
  const [parentSchedules, setParentSchedules] = useState<Schedule[]>([]);
  const [parentRecords, setParentRecords] = useState<LessonRecord[]>([]);
  const [parentLoading, setParentLoading] = useState(false);

  // ---- 公共状态 ----
  const [unreadCount, setUnreadCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const activeChild = useMemo(
    () => parentChildren.find((c) => c.id === activeStudentId),
    [parentChildren, activeStudentId],
  );

  // ============================================
  // 教师端数据加载
  // ============================================
  const loadTeacherData = useCallback(async () => {
    if (!profile?.id) return;
    setErrorMsg('');

    try {
      const teacherData = await homeService.getTeacher(profile.id);
      if (!teacherData) {
        setErrorMsg('未找到教师信息');
        return;
      }
      setTeacher(teacherData);

      const [studentList, scheduleList, recordList, remaining, unread, todayCount] =
        await Promise.all([
          homeService.getStudents(teacherData.id),
          homeService.getTodaySchedules(teacherData.id),
          homeService.getRecentRecords(teacherData.id, 5),
          homeService.getTotalRemainingHours(teacherData.id),
          homeService.getUnreadCount(profile.id),
          homeService.getTodayRecordCount(teacherData.id),
        ]);

      setTeacherStudents(studentList);
      setTeacherSchedules(scheduleList);
      setTeacherRecords(recordList);
      setTotalRemaining(remaining);
      setUnreadCount(unread);
      setTodayRecordCount(todayCount);
    } catch (err) {
      logError('Home loadTeacherData', err);
      setErrorMsg('数据加载失败，请下拉刷新重试');
    }
  }, [profile]);

  // ============================================
  // 家长端数据加载
  // ============================================
  const loadParentChildData = useCallback(async (studentId: string) => {
    if (!studentId) return;
    setParentLoading(true);
    try {
      const [records, packages, schedules] = await Promise.all([
        homeService.getRecordsByStudent(studentId),
        homeService.getPackagesByStudent(studentId),
        homeService.getSchedulesByStudent(studentId),
      ]);
      setParentRecords(records);
      setParentPackages(packages);
      setParentSchedules(schedules);
    } catch (err) {
      logError('Home loadParentChildData', err);
    }
    setParentLoading(false);
  }, []);

  const loadParentData = useCallback(async () => {
    if (!profile?.id) return;
    setErrorMsg('');

    try {
      const children = await homeService.getStudentsByParent(profile.id);
      setParentChildren(children);

      const storedId = Taro.getStorageSync('activeStudentId') || '';
      const validId = children.find((c) => c.id === storedId)?.id || children[0]?.id || '';
      setActiveStudentId(validId);

      if (validId) {
        await loadParentChildData(validId);
      }

      const unread = await homeService.getUnreadCount(profile.id);
      setUnreadCount(unread);
    } catch (err) {
      logError('Home loadParentData', err);
      setErrorMsg('数据加载失败，请下拉刷新重试');
    }
  }, [profile, loadParentChildData]);

  const handleChildChange = useCallback(
    async (studentId: string) => {
      setActiveStudentId(studentId);
      Taro.setStorageSync('activeStudentId', studentId);
      await loadParentChildData(studentId);
    },
    [loadParentChildData],
  );

  // ============================================
  // 统一加载入口
  // ============================================
  const loadData = useCallback(() => {
    if (isTeacher) {
      loadTeacherData();
    } else {
      loadParentData();
    }
  }, [isTeacher, loadTeacherData, loadParentData]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useDidShow(() => {
    loadData();
  });

  // 家长端课时汇总
  const parentSummary = useMemo(() => {
    const all = parentPackages.reduce((s, p) => s + (p.total_hours || 0), 0);
    const remaining = parentPackages.reduce((s, p) => s + (p.remaining_hours || 0), 0);
    return { totalAll: all, totalUsed: all - remaining, totalRemaining: remaining };
  }, [parentPackages]);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-gradient-subtle pb-24">
        {/* ========== 顶部渐变区域 ========== */}
        <View className="bg-gradient-primary px-6 pt-8 pb-10 rounded-b-60rpx shadow-elegant relative overflow-hidden">
          {/* 装饰圆 */}
          <View className="absolute top-4 right-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
          <View className="absolute bottom-0 left-8 w-16 h-16 rounded-full bg-white/10 blur-lg" />

          {/* 通知铃铛 */}
          <View className="absolute top-6 right-6 z-20">
            <View
              className="relative w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}
            >
              <Icon name="mdi-bell" size="lg" color="white" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 min-w-18px h-18px rounded-full bg-badge text-white text-10px font-bold flex items-center justify-center px-1">
                  <Text>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <View className="relative z-10">
            {isTeacher ? (
              /* ---- 教师顶部 ---- */
              <>
                <Text className="text-white text-xl opacity-90">教师工作台</Text>
                <Text className="text-white text-3xl font-bold mt-1 block">
                  {profile?.name || '用户'}，您好
                </Text>
                <View className="flex gap-3 mt-5">
                  <StatCard label="今日消课" value={todayRecordCount} />
                  <StatCard label="学生人数" value={teacherStudents.length} />
                  <StatCard label="剩余课时" value={totalRemaining} />
                </View>
              </>
            ) : (
              /* ---- 家长顶部 ---- */
              <>
                <Text className="text-white/80 text-xl">家长看板</Text>
                <Text className="text-white text-3xl font-bold mt-1 block">
                  {activeChild
                    ? activeChild.name
                    : parentChildren.length === 0
                      ? '欢迎使用'
                      : '加载中…'}
                </Text>
                {activeChild?.invite_code && (
                  <View className="mt-1 flex items-center gap-2">
                    <Text className="text-white/60 text-sm">标识码</Text>
                    <Text className="text-white/90 text-sm font-mono">
                      {activeChild.invite_code}
                    </Text>
                  </View>
                )}
                {activeChild && (
                  <View className="flex gap-3 mt-5">
                    <StatCard label="总课时" value={parentSummary.totalAll} />
                    <StatCard label="已消课" value={parentSummary.totalUsed} />
                    <StatCard label="剩余" value={parentSummary.totalRemaining} />
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* ========== 错误提示 ========== */}
        {errorMsg && (
          <View className="px-6 mt-4">
            <View className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-3">
              <Icon name="mdi-alert-circle" size="xl" color="error" />
              <Text className="flex-1 text-destructive text-lg">{errorMsg}</Text>
              <View
                className="px-3 py-1 rounded-full bg-destructive text-white text-base font-medium flex items-center justify-center leading-none"
                onClick={loadData}
              >
                <Text>重试</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========== 教师视图 ========== */}
        {isTeacher && (
          <>
            {/* 快捷入口 */}
            <View className="px-6 -mt-4">
              <View className="bg-white rounded-2xl shadow-soft p-5">
                <Text className="text-xl font-semibold text-foreground mb-4 block">快捷入口</Text>
                <View className="grid grid-cols-4 gap-x-4 gap-y-5">
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/lesson-form/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-soft">
                      <Icon name="mdi-check-circle" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">课时消课</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/student-form/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-purple-soft flex items-center justify-center shadow-soft">
                      <Icon name="mdi-account-plus" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">添加学生</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/package-form/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-orange-soft flex items-center justify-center shadow-soft">
                      <Icon name="mdi-cash-plus" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">课时充值</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/students/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center shadow-soft">
                      <Icon name="mdi-account-group" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">学生管理</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/classes/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-info-soft flex items-center justify-center shadow-soft">
                      <Icon name="mdi-school" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">班级管理</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/course-packages/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft bg-purple-vivid">
                      <Icon name="mdi-package-variant" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">课包管理</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/teacher-list/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-teal-soft flex items-center justify-center shadow-soft">
                      <Icon name="mdi-account-supervisor" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">教师管理</Text>
                  </View>
                  <View
                    className="flex flex-col items-center gap-1 p-1 rounded-2xl"
                    onClick={() => Taro.navigateTo({ url: '/pages/campus/index' })}
                  >
                    <View className="w-12 h-12 rounded-2xl bg-rose-soft flex items-center justify-center shadow-soft">
                      <Icon name="mdi-map-marker" size="lg" color="white" />
                    </View>
                    <Text className="text-base text-foreground whitespace-nowrap">校区设置</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 周课表 */}
            <View className="px-6 mt-5">
              <View className="bg-white rounded-2xl shadow-soft p-5">
                <View className="flex items-center justify-between mb-1">
                  <Text className="text-xl font-semibold text-foreground">周课表</Text>
                  <View
                    className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft"
                    onClick={() => Taro.navigateTo({ url: '/pages/schedule-form/index' })}
                  >
                    <Icon name="mdi-plus" size="md" color="white" />
                  </View>
                </View>
                <Text className="text-sm text-muted-foreground mb-4 block">
                  （仅方便老师使用，家长端不展示）
                </Text>
                <ScheduleTimeline schedules={teacherSchedules} />
              </View>
            </View>

            {/* 学生快捷入口 */}
            <View className="px-6 mt-5">
              <StudentQuickList students={teacherStudents} />
            </View>

            {/* 最近消课 */}
            <View className="px-6 mt-6">
              <View className="flex items-center justify-between mb-3">
                <Text className="text-xl font-semibold text-foreground">最近核销</Text>
                <Text
                  className="text-primary text-base"
                  onClick={() => Taro.navigateTo({ url: '/pages/records/index' })}
                >
                  查看全部
                </Text>
              </View>
              <View className="space-y-3">
                {teacherRecords.length > 0 ? (
                  teacherRecords.map((r) => <RecentRecordItem key={r.id} record={r} />)
                ) : (
                  <View className="bg-white rounded-2xl p-8 shadow-soft text-center">
                    <Icon name="mdi-inbox" size="xxl" color="muted" />
                    <View className="text-muted-foreground text-lg">暂无记录</View>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* ========== 家长视图 ========== */}
        {!isTeacher && (
          <>
            {/* 未绑定学生 */}
            {parentChildren.length === 0 && !errorMsg && (
              <View className="px-6 mt-5">
                <View className="bg-white rounded-2xl p-6 shadow-soft flex flex-col items-center gap-4 mt-6">
                  <View className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon name="mdi-link-plus" size="xxl" color="primary" />
                  </View>
                  <View className="text-center">
                    <View className="text-xl font-semibold text-foreground mb-1">还未绑定学生</View>
                    <View className="text-base text-muted-foreground">
                      请前往「我的」页面，绑定孩子的学习账户
                    </View>
                  </View>
                  <View
                    className="w-full btn-primary bg-gradient-primary text-white text-xl font-medium shadow-elegant"
                    onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
                  >
                    <Text>前往绑定</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 已绑定学生 */}
            {parentChildren.length > 0 && (
              <View className="px-6 mt-5 space-y-5 pb-6">
                {/* 孩子选择器 */}
                <ChildSelector
                  children={parentChildren}
                  activeId={activeStudentId}
                  onChange={handleChildChange}
                />

                {/* 课时汇总 */}
                <HourProgress packages={parentPackages} />

                {/* 课时不足提醒 */}
                {parentSummary.totalRemaining < 3 && parentSummary.totalAll > 0 && (
                  <View className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-center gap-3">
                    <Icon name="mdi-alert-circle" size="xl" color="error" />
                    <View>
                      <View className="text-destructive font-medium text-lg">课时不足提醒</View>
                      <View className="text-destructive/80 text-base">
                        剩余课时仅 {parentSummary.totalRemaining} 课时，请联系教师充值
                      </View>
                    </View>
                  </View>
                )}

                {/* 今日课程 */}
                {parentSchedules.length > 0 && (
                  <View className="bg-white rounded-2xl shadow-soft p-4">
                    <View className="flex items-center justify-between mb-3">
                      <Text className="text-lg font-semibold text-foreground">上课安排</Text>
                    </View>
                    <ScheduleTimeline schedules={parentSchedules} />
                  </View>
                )}

                {/* 上课记录 / 课时充值 Tab */}
                <ParentRecordTab
                  records={parentRecords}
                  packages={parentPackages}
                  loading={parentLoading}
                />
              </View>
            )}
          </>
        )}
      </View>
    </PageContainer>
  );
};

// ============================================
// 家长端记录/套餐 Tab 子组件
// ============================================
type TabKey = 'records' | 'packages';

const ParentRecordTab: React.FC<{
  records: LessonRecord[];
  packages: CoursePackage[];
  loading: boolean;
}> = ({ records, packages, loading }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('records');

  return (
    <View className="bg-white rounded-2xl shadow-soft overflow-hidden">
      {/* Tab 头 */}
      <View className="flex border-b border-input">
        <View
          className={`flex-1 py-3 text-xl font-medium flex items-center justify-center leading-none ${activeTab === 'records' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('records')}
        >
          <Text>上课记录</Text>
        </View>
        <View
          className={`flex-1 py-3 text-xl font-medium flex items-center justify-center leading-none ${activeTab === 'packages' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
          onClick={() => setActiveTab('packages')}
        >
          <Text>课时充值</Text>
        </View>
      </View>

      {/* Tab 内容 */}
      <View className="p-4 space-y-3">
        {loading ? (
          <View className="text-center py-8 text-muted-foreground text-lg">加载中…</View>
        ) : activeTab === 'records' ? (
          records.length > 0 ? (
            records.map((r) => (
              <View key={r.id} className="bg-muted/40 rounded-2xl p-4">
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-3">
                    <View className="w-9 h-9 rounded-full bg-gradient-primary flex items-center justify-center">
                      <Icon name="mdi-book-open-variant" size="sm" color="white" />
                    </View>
                    <View>
                      <View className="text-lg font-medium text-foreground">
                        {r.course_package?.name || '课程'}
                      </View>
                      <View className="text-sm text-muted-foreground">
                        {formatDateCN(r.lesson_date)}
                      </View>
                    </View>
                  </View>
                  <Text className="text-lg font-semibold text-primary">-{r.hours_used}课时</Text>
                </View>
              </View>
            ))
          ) : (
            <Empty icon="mdi-calendar-blank" description="暂无上课记录" />
          )
        ) : packages.length > 0 ? (
          packages.map((pkg) => (
            <View key={pkg.id} className="bg-muted/40 rounded-2xl p-4">
              <View className="flex items-center justify-between mb-2">
                <View className="flex items-center gap-3">
                  <View className="w-9 h-9 rounded-full bg-gradient-accent flex items-center justify-center">
                    <Icon name="mdi-cash-multiple" size="sm" color="white" />
                  </View>
                  <View>
                    <View className="text-lg font-medium text-foreground">{pkg.name}</View>
                    <View className="text-sm text-muted-foreground">
                      {formatDateCN(pkg.created_at)}
                    </View>
                  </View>
                </View>
                <View className="text-right">
                  <View className="text-lg font-semibold text-primary">+{pkg.total_hours}课时</View>
                  {pkg.fee_amount != null && pkg.fee_amount > 0 && (
                    <View className="text-sm text-muted-foreground">¥{pkg.fee_amount}</View>
                  )}
                </View>
              </View>
              <View className="flex items-center justify-between text-sm text-muted-foreground">
                <Text>
                  剩余 {pkg.remaining_hours} / 共 {pkg.total_hours} 课时
                </Text>
                <Text
                  className={`px-2 py-0_d5 rounded-full text-xs ${pkg.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  {pkg.status === 'active'
                    ? '生效中'
                    : pkg.status === 'completed'
                      ? '已用完'
                      : '已过期'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Empty icon="mdi-package-variant" description="暂无充值记录" />
        )}
      </View>
    </View>
  );
};

/** 日期格式化 */
function formatDateCN(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default withRouteGuard(Home);
