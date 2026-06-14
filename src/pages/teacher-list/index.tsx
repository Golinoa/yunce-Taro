import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import AddTeacherSheet from '@/components/teacher/AddTeacherSheet';
import ConfirmSalarySheet from '@/components/teacher/ConfirmSalarySheet';
import FilterBar from '@/components/teacher/FilterBar';
import MonthPicker from '@/components/teacher/MonthPicker';
import SalaryItem from '@/components/teacher/SalaryItem';
import TeacherCard from '@/components/teacher/TeacherCard';
import PayConfirmSheet from '@/components/teacher/PayConfirmSheet';
import PaymentSettingsSheet from '@/components/teacher/PaymentSettingsSheet';
import SalaryModelSheet from '@/components/teacher/SalaryModelSheet';
import { ROLE_OPTIONS, SUBJECT_OPTIONS, STATUS_OPTIONS, CAMPUS_OPTIONS } from '@/data/teacher';
import { teacherScheduleService } from '@/services/teacher';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import type { SalaryModel } from '@/types/teacher';

/** 主Tab类型 */
type MainTab = 'teacher' | 'salary' | 'schedule';
/** 薪资子Tab类型 */
type SalarySubTab = 'current' | 'history' | 'settings';

/** 排课周数据 */
interface WeekDay {
  date: string;
  day: string;
  weekday: string;
  isToday: boolean;
  hasCourse: boolean;
}

/** 排课项 */
interface ScheduleItem {
  time: string;
  title: string;
  desc: string;
  teachers: Array<{ name: string; role: 'lead' | 'assist' }>;
  rate: string;
  campus: string;
  subject: string;
}

/** 排课数据 - 按日期分组 */
type ScheduleDataMap = Record<string, ScheduleItem[]>;

const TAB_CONFIG: { key: MainTab; label: string; icon: string }[] = [
  { key: 'teacher', label: '教师', icon: '👤' },
  { key: 'salary', label: '薪资', icon: '💰' },
  { key: 'schedule', label: '排课', icon: '📅' },
];

const TeacherListPage: React.FC = () => {
  // ===== Store =====
  const {
    filter,
    setFilter,
    getFilteredTeachers,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    confirmSalary,
    batchConfirm,
    setPendingPayAction,
    executePay,
    getPendingCount,
    getTotalHours,
    getTotalSalary,
    teachers,
    settings,
    updateSettings,
    salaryModels,
    createSalaryModel,
    updateSalaryModel,
    fetchAll,
    loading,
  } = useTeacherStore();

  // ===== 本地状态 =====
  const [mainTab, setMainTab] = useState<MainTab>('teacher');
  const [salarySubTab, setSalarySubTab] = useState<SalarySubTab>('current');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [paySheetVisible, setPaySheetVisible] = useState(false);
  const [addTeacherVisible, setAddTeacherVisible] = useState(false);
  const [paymentSettingsVisible, setPaymentSettingsVisible] = useState(false);
  const [salaryModelSheetVisible, setSalaryModelSheetVisible] = useState(false);
  const [editingModel, setEditingModel] = useState<SalaryModel | null>(null);
  const [confirmSalaryVisible, setConfirmSalaryVisible] = useState(false);
  const [confirmSalaryTarget, setConfirmSalaryTarget] = useState<string | null>(null);
  const [historyYear, setHistoryYear] = useState(dayjs().year());
  const [historyMonth, setHistoryMonth] = useState(dayjs().month() + 1);

  // 排课状态
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [scheduleDataMap, setScheduleDataMap] = useState<ScheduleDataMap>({});
  const [scheduleCampusFilter, setScheduleCampusFilter] = useState('all');
  const [scheduleSubjectFilter, setScheduleSubjectFilter] = useState('all');
  const [scheduleTeacherFilter, setScheduleTeacherFilter] = useState('all');
  const [scheduleFilterId, setScheduleFilterId] = useState<string | null>(null);

  // 设置页开关
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);

  // ===== 初始化数据 =====
  useDidShow(() => {
    fetchAll();
  });

  useEffect(() => {
    setPushEnabled(settings.pushEnabled);
  }, [settings.pushEnabled]);

  // 加载排课数据
  useEffect(() => {
    teacherScheduleService.getList().then(setScheduleDataMap);
  }, []);

  // ===== 计算属性 =====
  const filteredTeachers = useMemo(
    () => getFilteredTeachers(),
    [getFilteredTeachers, filter, teachers],
  );

  // 薪资Tab可见教师（在职或未结清）
  const salaryTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'active' || t.salaryStatus !== 'paid'),
    [teachers],
  );

  const pendingCount = useMemo(() => getPendingCount(), [getPendingCount, teachers]);
  const totalHours = useMemo(() => getTotalHours(), [getTotalHours, teachers]);
  const totalSalary = useMemo(() => getTotalSalary(), [getTotalSalary, teachers]);
  const activeCount = useMemo(
    () => teachers.filter((t) => t.status === 'active').length,
    [teachers],
  );

  // 发放确认相关
  const pendingPayAction = useTeacherStore((s) => s.pendingPayAction);
  const payTargetTeacher = useMemo(() => {
    if (!pendingPayAction || pendingPayAction.type !== 'single') return null;
    return teachers.find((t) => t.id === pendingPayAction.ids[0]);
  }, [pendingPayAction, teachers]);

  // 批量发放总额
  const batchPayTotal = useMemo(() => {
    if (!pendingPayAction || pendingPayAction.type !== 'batch') return 0;
    return pendingPayAction.ids.reduce((sum, id) => {
      const t = teachers.find((t) => t.id === id);
      return sum + (t ? calcTotal(t) : 0);
    }, 0);
  }, [pendingPayAction, teachers]);

  // 历史记录
  const historyRecords = useMemo(() => {
    const monthKey = `${historyYear}-${String(historyMonth).padStart(2, '0')}`;
    const records: Array<{
      teacherId: string;
      name: string;
      subject: string;
      amount: number;
      status: string;
      remark?: string;
      paidAt?: string;
    }> = [];
    teachers.forEach((t) => {
      const rec = t.payHistory?.find((h) => h.month === monthKey);
      if (rec) {
        records.push({
          teacherId: t.id,
          name: t.name,
          subject: t.subject,
          amount: rec.amount,
          status: rec.status,
          remark: rec.remark,
          paidAt: rec.paidAt,
        });
      }
    });
    return records;
  }, [teachers, historyYear, historyMonth]);

  // 历史汇总
  const historyTotalAmount = useMemo(
    () => historyRecords.reduce((s, r) => s + r.amount, 0),
    [historyRecords],
  );
  const historyTotalHours = useMemo(() => {
    const monthKey = `${historyYear}-${String(historyMonth).padStart(2, '0')}`;
    return teachers.reduce((sum, t) => {
      const rec = t.payHistory?.find((h) => h.month === monthKey);
      return sum + (rec ? t.hours : 0);
    }, 0);
  }, [teachers, historyYear, historyMonth]);

  // 排课周数据
  const weekDays = useMemo((): WeekDay[] => {
    const startOfWeek = dayjs().add(weekOffset, 'week').startOf('week');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = startOfWeek.add(i, 'day');
      const dateKey = d.format('YYYY-MM-DD');
      return {
        date: dateKey,
        day: d.format('D'),
        weekday: weekdays[d.day()],
        isToday: d.isSame(dayjs(), 'day'),
        hasCourse: (scheduleDataMap[dateKey]?.length ?? 0) > 0,
      };
    });
  }, [weekOffset, scheduleDataMap]);

  const weekTitle = useMemo(() => {
    const start = dayjs().add(weekOffset, 'week').startOf('week');
    const end = start.add(6, 'day');
    return `${start.format('M月D日')} - ${end.format('M月D日')}`;
  }, [weekOffset]);

  // 当日课表
  const daySchedule = useMemo(() => {
    const dayOfWeek = dayjs(selectedDate).day();
    // 周末无课
    if (dayOfWeek === 0 || dayOfWeek === 6) return [];
    const items = scheduleDataMap[selectedDate] || [];
    // 应用校区、科目和教师筛选
    return items.filter((item) => {
      if (scheduleCampusFilter !== 'all' && item.campus !== scheduleCampusFilter) return false;
      if (scheduleSubjectFilter !== 'all' && item.subject !== scheduleSubjectFilter) return false;
      if (
        scheduleTeacherFilter !== 'all' &&
        !item.teachers.some(
          (t) => t.name === teachers.find((tt) => tt.id === scheduleTeacherFilter)?.name,
        )
      )
        return false;
      return true;
    });
  }, [
    selectedDate,
    scheduleDataMap,
    scheduleCampusFilter,
    scheduleSubjectFilter,
    scheduleTeacherFilter,
    teachers,
  ]);

  // ===== 筛选配置 =====
  const teacherFilterConfig = useMemo(
    () => [
      {
        id: 'role',
        label: ROLE_OPTIONS.find((o) => o.value === filter.role)?.label || '全部岗位',
        value: filter.role,
        options: ROLE_OPTIONS.map((o) => ({
          ...o,
          dotColor:
            o.value === 'lead'
              ? '#5EC8A8'
              : o.value === 'assist'
                ? '#6BA3D6'
                : o.value === 'parttime'
                  ? '#D4A24E'
                  : undefined,
        })),
      },
      {
        id: 'subject',
        label: SUBJECT_OPTIONS.find((o) => o.value === filter.subject)?.label || '全部科目',
        value: filter.subject,
        options: SUBJECT_OPTIONS,
      },
      {
        id: 'status',
        label: STATUS_OPTIONS.find((o) => o.value === filter.status)?.label || '在职',
        value: filter.status,
        options: STATUS_OPTIONS.map((o) => ({
          ...o,
          dotColor:
            o.value === 'active' ? '#34C759' : o.value === 'resigned' ? '#8E8E93' : undefined,
        })),
      },
    ],
    [filter],
  );

  // ===== 事件处理 =====
  const handleFilterToggle = useCallback((id: string) => {
    setActiveFilterId((prev) => (prev === id ? null : id));
  }, []);

  const handleFilterSelect = useCallback(
    (id: string, value: string, _label: string) => {
      setFilter({ [id]: value });
      setActiveFilterId(null);
    },
    [setFilter],
  );

  const handleTeacherClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/teacher-detail/index?id=${id}` });
  }, []);

  const handleSalaryAction = useCallback(
    async (teacherId: string) => {
      const t = teachers.find((t) => t.id === teacherId);
      if (!t) return;
      if (t.salaryStatus === 'pending') {
        // 弹框二次确认
        setConfirmSalaryTarget(teacherId);
        setConfirmSalaryVisible(true);
      } else if (t.salaryStatus === 'confirmed') {
        setPendingPayAction({ type: 'single', ids: [teacherId] });
        setPaySheetVisible(true);
      }
    },
    [teachers, setPendingPayAction],
  );

  const handleConfirmSalary = useCallback(async () => {
    if (!confirmSalaryTarget) return;
    await confirmSalary(confirmSalaryTarget);
    setConfirmSalaryVisible(false);
    setConfirmSalaryTarget(null);
    Taro.showToast({ title: '工资已确认', icon: 'success' });
  }, [confirmSalaryTarget, confirmSalary]);

  const handleBatchAction = useCallback(
    async (action: 'confirm' | 'pay') => {
      if (selectedIds.length === 0) {
        Taro.showToast({ title: '请先选择教师', icon: 'none' });
        return;
      }
      if (action === 'confirm') {
        await batchConfirm(selectedIds);
        Taro.showToast({ title: '批量确认成功', icon: 'success' });
      } else {
        setPendingPayAction({ type: 'batch', ids: selectedIds });
        setPaySheetVisible(true);
      }
    },
    [selectedIds, batchConfirm, setPendingPayAction],
  );

  const handlePayConfirm = useCallback(
    async (remark: string) => {
      await executePay(remark);
      setPaySheetVisible(false);
      Taro.showToast({ title: '发放成功', icon: 'success' });
    },
    [executePay],
  );

  const handleMonthSelect = useCallback((year: number, month: number) => {
    setHistoryYear(year);
    setHistoryMonth(month);
    setMonthPickerVisible(false);
  }, []);

  const handleSalaryDetail = useCallback((teacherId: string) => {
    Taro.navigateTo({ url: `/pages/salary-detail/index?id=${teacherId}` });
  }, []);

  // ===== 渲染 =====
  return (
    <View className="flex flex-col h-screen bg-background">
      {/* ===== 渐变头部 ===== */}
      <View className="bg-gradient-primary pt-[96rpx] px-[40rpx] sticky top-0 z-10">
        <View className="flex items-center justify-between">
          <Text className="text-[40rpx] font-bold text-white">教师管理</Text>
          <View className="header-glass-btn" onClick={() => setAddTeacherVisible(true)}>
            <Text className="text-[32rpx] mr-[4rpx]">+</Text>
            <Text className="text-[26rpx]">添加教师</Text>
          </View>
        </View>

        {/* 统计Chips */}
        <View className="flex gap-[16rpx] py-[28rpx] pb-[24rpx]">
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-white block">{activeCount}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">在职教师</Text>
          </View>
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-white block">{totalHours}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">本月课时</Text>
          </View>
          <View className="stat-chip">
            <Text className="text-[32rpx] font-bold text-amber-200 block">{pendingCount}</Text>
            <Text className="text-[20rpx] text-white/80 mt-[2rpx] block">待处理</Text>
          </View>
        </View>

        {/* 胶囊式三Tab */}
        <View className="pb-[16rpx]">
          <View className="flex gap-[8rpx] bg-white/15 backdrop-blur rounded-[28rpx] p-[8rpx]">
            {TAB_CONFIG.map((tab) => (
              <View
                key={tab.key}
                className={cn('capsule-tab', mainTab === tab.key && 'capsule-tab-active')}
                onClick={() => setMainTab(tab.key)}
              >
                <Text className="text-[32rpx]">{tab.icon}</Text>
                <Text className="text-[26rpx]">{tab.label}</Text>
                {tab.key === 'salary' && pendingCount > 0 && (
                  <View className="min-w-[32rpx] h-[32rpx] px-[8rpx] rounded-[16rpx] bg-amber text-[18rpx] font-bold inline-flex items-center justify-center ml-[4rpx]">
                    <Text className="text-white text-[18rpx]">{pendingCount}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ===== 教师Tab ===== */}
      {mainTab === 'teacher' && (
        <View className="flex-1 flex flex-col overflow-hidden h-0">
          <FilterBar
            filters={teacherFilterConfig}
            activeId={activeFilterId}
            onToggle={handleFilterToggle}
            onSelect={handleFilterSelect}
          />
          <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
            {filteredTeachers.length === 0 ? (
              <View className="flex items-center justify-center py-[120rpx]">
                <Text className="text-[28rpx] text-muted-foreground">暂无教师数据</Text>
              </View>
            ) : (
              filteredTeachers.map((t) => (
                <TeacherCard key={t.id} teacher={t} onClick={() => handleTeacherClick(t.id)} />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ===== 薪资Tab ===== */}
      {mainTab === 'salary' && (
        <View className="flex-1 flex flex-col overflow-hidden h-0">
          {/* 薪资子Tab */}
          <View className="flex bg-card border-b border-border px-[32rpx]">
            {(['current', 'history', 'settings'] as SalarySubTab[]).map((tab) => (
              <View
                key={tab}
                className={cn(
                  'flex-1 text-center py-[22rpx] text-[26rpx] font-medium text-muted-foreground relative',
                  salarySubTab === tab && 'text-primary font-semibold',
                )}
                onClick={() => setSalarySubTab(tab)}
              >
                {tab === 'current' ? '本月' : tab === 'history' ? '历史' : '设置'}
                {salarySubTab === tab && <View className="sub-tab-indicator" />}
              </View>
            ))}
          </View>

          {/* 本月 */}
          {salarySubTab === 'current' && (
            <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
              {/* 发薪提醒 */}
              <View className="reminder-card">
                <Text className="text-[40rpx] flex-shrink-0">⚠️</Text>
                <Text className="text-[24rpx] text-amber flex-1 leading-[1.5]">
                  每月 <Text className="font-bold">{settings.payDay}号</Text> 发放工资，提前
                  {settings.pushDaysBefore}天推送薪资报表
                </Text>
                <View
                  className="py-[12rpx] px-[24rpx] rounded-[16rpx] bg-amber flex-shrink-0"
                  onClick={() => setPaymentSettingsVisible(true)}
                >
                  <Text className="text-[22rpx] font-semibold text-white">设置</Text>
                </View>
              </View>

              {/* 快捷发薪入口 */}
              <View className="quick-pay-card">
                {/* 装饰圆 - 替代SCSS伪元素 */}
                <View className="absolute top-[-40rpx] right-[-40rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/10" />
                <View className="absolute bottom-[-30rpx] left-[60rpx] w-[100rpx] h-[100rpx] rounded-full bg-white/6" />

                <View className="flex items-center justify-between relative z-1">
                  <View className="flex items-center gap-[24rpx] flex-1 min-w-0">
                    <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Text className="text-[40rpx]">💰</Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[30rpx] font-bold text-white block">
                        {dayjs().month() + 1}月工资待处理
                      </Text>
                      <Text className="text-[24rpx] text-white/85 mt-[4rpx] block">
                        <Text className="font-extrabold">{pendingCount}</Text> 位教师待确认/发放
                      </Text>
                    </View>
                  </View>
                </View>
                <View className="mt-[20rpx] relative z-1">
                  <Text className="text-[24rpx] text-white/90">
                    距发薪日还有{' '}
                    <Text className="font-bold">
                      {Math.max(0, settings.payDay - dayjs().date())}
                    </Text>{' '}
                    天
                  </Text>
                </View>
                {salaryTeachers.filter((t) => t.salaryStatus !== 'paid').length > 0 && (
                  <View className="flex gap-[8rpx] mt-[16rpx] flex-wrap relative z-1">
                    {salaryTeachers
                      .filter((t) => t.salaryStatus !== 'paid')
                      .slice(0, 4)
                      .map((t) => (
                        <View
                          key={t.id}
                          className="py-[4rpx] px-[16rpx] rounded-[12rpx] bg-white/20"
                        >
                          <Text className="text-[22rpx] text-white">{t.name}</Text>
                        </View>
                      ))}
                    {salaryTeachers.filter((t) => t.salaryStatus !== 'paid').length > 4 && (
                      <View className="py-[4rpx] px-[16rpx] rounded-[12rpx] bg-white/20">
                        <Text className="text-[22rpx] text-white">
                          +{salaryTeachers.filter((t) => t.salaryStatus !== 'paid').length - 4}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* 汇总 */}
              <View className="salary-summary">
                <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx] first:ml-0 last:mr-0">
                  <Text className="text-[36rpx] font-extrabold text-primary block">
                    {totalSalary.toLocaleString()}
                  </Text>
                  <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">
                    应发总额
                  </Text>
                </View>
                <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx]">
                  <Text className="text-[36rpx] font-extrabold text-foreground block">
                    {totalHours}
                  </Text>
                  <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">总课时</Text>
                </View>
                <View className="flex-1 text-center py-[20rpx] bg-background rounded-[20rpx] mx-[8rpx]">
                  <Text className="text-[36rpx] font-extrabold text-amber block">
                    {pendingCount}
                  </Text>
                  <Text className="text-[20rpx] text-muted-foreground block mt-[4rpx]">待确认</Text>
                </View>
              </View>

              {/* 批量操作栏 */}
              {salaryTeachers.some((t) => t.salaryStatus !== 'paid') && (
                <View className="batch-bar">
                  <View className="flex items-center gap-[16rpx]" onClick={toggleSelectAll}>
                    <View
                      className={cn(
                        'w-[44rpx] h-[44rpx] rounded-xl border-[4rpx] border-solid border-border flex items-center justify-center',
                        selectedIds.length ===
                          salaryTeachers.filter((t) => t.salaryStatus !== 'paid').length &&
                          'bg-amber border-amber',
                      )}
                    >
                      {selectedIds.length ===
                        salaryTeachers.filter((t) => t.salaryStatus !== 'paid').length && (
                        <Text className="text-white text-[24rpx] font-bold">✓</Text>
                      )}
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground">
                      全选 · 已选 {selectedIds.length} 人
                    </Text>
                  </View>
                  <View className="flex gap-[16rpx]">
                    <View
                      className="py-[12rpx] px-[28rpx] rounded-xl text-[24rpx] font-semibold bg-amber-10 text-amber press-scale"
                      onClick={() => handleBatchAction('confirm')}
                    >
                      批量确认
                    </View>
                    <View
                      className="py-[12rpx] px-[28rpx] rounded-xl text-[24rpx] font-semibold bg-class-amber text-white press-scale"
                      onClick={() => handleBatchAction('pay')}
                    >
                      批量发放
                    </View>
                  </View>
                </View>
              )}

              {/* 薪资明细 */}
              <Text className="text-[28rpx] font-bold text-foreground mb-[20rpx] block">
                {dayjs().month() + 1}月薪资明细
              </Text>
              {salaryTeachers.map((t) => (
                <SalaryItem
                  key={t.id}
                  teacher={t}
                  selected={selectedIds.includes(t.id)}
                  selectable
                  onToggleSelect={() => toggleSelect(t.id)}
                  onAction={() => handleSalaryAction(t.id)}
                  onViewDetail={() => handleSalaryDetail(t.id)}
                  onClick={() => handleSalaryDetail(t.id)}
                />
              ))}
            </ScrollView>
          )}

          {/* 历史 */}
          {salarySubTab === 'history' && (
            <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
              {historyRecords.length === 0 ? (
                /* 无数据 - 美化空状态 */
                <View className="flex flex-col items-center justify-center py-[160rpx] px-[80rpx]">
                  <View className="w-[160rpx] h-[160rpx] rounded-full bg-muted flex items-center justify-center mb-[32rpx]">
                    <Text className="text-[72rpx]">📋</Text>
                  </View>
                  <Text className="text-[32rpx] font-semibold text-foreground mb-[12rpx]">
                    暂无历史记录
                  </Text>
                  <Text className="text-[26rpx] text-muted-foreground text-center leading-[1.5]">
                    确认发放薪资后，记录将在此展示
                  </Text>
                </View>
              ) : (
                <>
                  {/* 月份导航 - 有数据才显示 */}
                  <View className="flex items-center justify-center gap-[24rpx] py-[28rpx]">
                    <View
                      className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                      onClick={() => {
                        const d = dayjs(`${historyYear}-${historyMonth}-01`).subtract(1, 'month');
                        setHistoryYear(d.year());
                        setHistoryMonth(d.month() + 1);
                      }}
                    >
                      <Text className="text-[36rpx] text-muted-foreground">‹</Text>
                    </View>
                    <View
                      className="flex items-center gap-[8rpx] py-[8rpx] px-[20rpx] rounded-[16rpx]"
                      onClick={() => setMonthPickerVisible(true)}
                    >
                      <Text className="text-[30rpx] font-semibold text-foreground">
                        {historyYear}年{historyMonth}月
                      </Text>
                      <Text className="text-[20rpx] text-muted-foreground">▼</Text>
                    </View>
                    <View
                      className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                      onClick={() => {
                        const d = dayjs(`${historyYear}-${historyMonth}-01`).add(1, 'month');
                        setHistoryYear(d.year());
                        setHistoryMonth(d.month() + 1);
                      }}
                    >
                      <Text className="text-[36rpx] text-muted-foreground">›</Text>
                    </View>
                  </View>

                  {/* 历史汇总 */}
                  <View className="mb-[28rpx]">
                    <View className="flex bg-card rounded-xl py-[28rpx]">
                      <View className="flex-1 text-center border-r border-border/50">
                        <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                          ¥{historyTotalAmount.toLocaleString()}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground block">实发总额</Text>
                      </View>
                      <View className="flex-1 text-center border-r border-border/50">
                        <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                          {historyRecords.length}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground block">发薪人数</Text>
                      </View>
                      <View className="flex-1 text-center">
                        <Text className="text-[32rpx] font-bold text-foreground block mb-[4rpx]">
                          {historyTotalHours}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground block">总课时</Text>
                      </View>
                    </View>
                    <View className="flex items-center justify-between py-[20rpx] px-[28rpx] bg-success-10 rounded-[20rpx] mt-[16rpx]">
                      <View className="flex items-center gap-[8rpx]">
                        <Text className="text-[28rpx] text-success">✓</Text>
                        <Text className="text-[24rpx] font-semibold text-success">已发放</Text>
                      </View>
                      <Text className="text-[24rpx] text-muted-foreground">
                        发放日期：{historyYear}-{String(historyMonth).padStart(2, '0')}-
                        {settings.payDay}
                      </Text>
                    </View>
                  </View>

                  {/* 历史列表 */}
                  {historyRecords.map((rec) => (
                    <View
                      key={`${rec.teacherId}-${rec.amount}`}
                      className="bg-card rounded-xl py-[24rpx] px-[28rpx] mb-[16rpx]"
                      onClick={() => handleSalaryDetail(rec.teacherId)}
                    >
                      <View className="flex items-center justify-between">
                        <View className="flex-1">
                          <View className="flex items-center gap-[8rpx]">
                            <Text className="text-[26rpx] font-semibold text-foreground">
                              {rec.name}
                            </Text>
                            {rec.remark && (
                              <Text className="text-[22rpx] text-amber font-medium">
                                {rec.remark}
                              </Text>
                            )}
                          </View>
                          <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">
                            {rec.subject}
                          </Text>
                        </View>
                        <View className="flex items-center gap-[8rpx] flex-shrink-0">
                          <Text className="text-[30rpx] font-bold text-success">
                            ¥{rec.amount.toLocaleString()}
                          </Text>
                          <Text className="text-[32rpx] text-muted-foreground opacity-50">›</Text>
                        </View>
                      </View>
                      {rec.paidAt && (
                        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                          发放日期：{rec.paidAt}
                        </Text>
                      )}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {/* 设置 */}
          {salarySubTab === 'settings' && (
            <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
              {/* 发薪设置 */}
              <View className="mb-[32rpx]">
                <Text className="text-[28rpx] font-semibold text-foreground mb-[28rpx] block">
                  发薪设置
                </Text>
                <View className="bg-card rounded-xl overflow-hidden">
                  <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx] border-b border-border/50">
                    <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                      发薪日
                    </Text>
                    <Text className="flex-1 text-[26rpx] text-muted-foreground">
                      每月{' '}
                      <Text className="text-foreground font-semibold">{settings.payDay}号</Text>
                    </Text>
                    <Text
                      className="text-[24rpx] text-primary font-medium py-[8rpx] px-[16rpx] rounded-[12rpx]"
                      onClick={() => setPaymentSettingsVisible(true)}
                    >
                      修改
                    </Text>
                  </View>
                  <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx] border-b border-border/50">
                    <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                      薪资报表推送
                    </Text>
                    <Text className="flex-1 text-[26rpx] text-muted-foreground">
                      发薪前{' '}
                      <Text className="text-foreground font-semibold">
                        {settings.pushDaysBefore}天
                      </Text>
                    </Text>
                    <Text
                      className="text-[24rpx] text-primary font-medium py-[8rpx] px-[16rpx] rounded-[12rpx]"
                      onClick={() => setPaymentSettingsVisible(true)}
                    >
                      修改
                    </Text>
                  </View>
                  <View className="flex items-center py-[28rpx] px-[28rpx] gap-[16rpx]">
                    <Text className="text-[26rpx] text-foreground font-medium min-w-[160rpx]">
                      推送提醒
                    </Text>
                    <Text className="flex-1 text-[26rpx] text-muted-foreground">
                      发薪前推送薪资报表
                    </Text>
                    <View
                      className={cn(
                        'w-[88rpx] h-[52rpx] rounded-[26rpx] relative flex-shrink-0 transition-colors',
                        pushEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
                      )}
                      onClick={() => {
                        setPushEnabled(!pushEnabled);
                        updateSettings({ pushEnabled: !pushEnabled });
                      }}
                    >
                      <View
                        className={cn(
                          'absolute top-[6rpx] w-[40rpx] h-[40rpx] rounded-full bg-white shadow-sm transition-transform',
                          pushEnabled ? 'left-[42rpx]' : 'left-[6rpx]',
                        )}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* 工资模型 */}
              <View className="mb-[32rpx]">
                <View className="flex items-center justify-between mb-[20rpx]">
                  <Text className="text-[28rpx] font-semibold text-foreground">工资模型</Text>
                  <Text
                    className="text-[24rpx] text-primary font-medium"
                    onClick={() => {
                      setEditingModel(null);
                      setSalaryModelSheetVisible(true);
                    }}
                  >
                    + 新建薪资模板
                  </Text>
                </View>
                {salaryModels.map((model, idx) => (
                  <View
                    key={model.id}
                    className={cn('salary-model-card', idx !== 0 && 'border-l-info')}
                    onClick={() => {
                      setEditingModel(model);
                      setSalaryModelSheetVisible(true);
                    }}
                  >
                    <View className="flex items-center gap-[12rpx]">
                      <Text className="text-[28rpx] font-bold text-foreground">{model.name}</Text>
                      {model.isDefault && (
                        <View className="py-[4rpx] px-[12rpx] rounded-[8rpx] bg-secondary text-primary text-[20rpx] font-medium">
                          默认
                        </View>
                      )}
                      {!model.isDefault && idx === 1 && (
                        <View className="py-[4rpx] px-[12rpx] rounded-[8rpx] bg-info-10 text-info text-[20rpx] font-medium">
                          助教
                        </View>
                      )}
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] leading-[1.6] block">
                      {model.type === 'standard'
                        ? '底薪 + 课时费(统一/按班级) + 全勤奖 + 绩效奖金'
                        : model.type === 'hourly'
                          ? '课时费(统一/按班级)，无底薪无奖金'
                          : '自定义参数'}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                      {teachers.filter((t) => t.modelIdx === idx).length}位教师使用
                    </Text>
                  </View>
                ))}
                <View
                  className="flex items-center justify-center gap-[12rpx] py-[20rpx] rounded-xl border-[3rpx] border-dashed border-border text-muted-foreground text-[26rpx] font-medium mb-[16rpx] press-scale"
                  onClick={() => {
                    setEditingModel(null);
                    setSalaryModelSheetVisible(true);
                  }}
                >
                  <Text className="text-[32rpx] text-primary">+</Text>
                  <Text className="text-[26rpx]">新建薪资模板</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ===== 排课Tab ===== */}
      {mainTab === 'schedule' && (
        <View className="flex-1 flex flex-col overflow-hidden h-0">
          {/* 排课筛选栏 */}
          <FilterBar
            filters={[
              {
                id: 'campus',
                label:
                  CAMPUS_OPTIONS.find((o) => o.value === scheduleCampusFilter)?.label || '全部校区',
                value: scheduleCampusFilter,
                options: CAMPUS_OPTIONS.map((o) => ({
                  ...o,
                  dotColor:
                    o.value === 'center'
                      ? '#5EC8A8'
                      : o.value === 'south'
                        ? '#9B7ED8'
                        : o.value === 'east'
                          ? '#6BA3D6'
                          : undefined,
                })),
              },
              {
                id: 'subject',
                label:
                  SUBJECT_OPTIONS.find((o) => o.value === scheduleSubjectFilter)?.label ||
                  '全部科目',
                value: scheduleSubjectFilter,
                options: SUBJECT_OPTIONS,
              },
              {
                id: 'teacher',
                label:
                  scheduleTeacherFilter === 'all'
                    ? '全部教师'
                    : teachers.find((t) => t.id === scheduleTeacherFilter)?.name || '全部教师',
                value: scheduleTeacherFilter,
                options: [
                  { label: '全部教师', value: 'all' },
                  ...teachers
                    .filter((t) => t.status === 'active')
                    .map((t) => ({
                      label: t.name,
                      value: t.id,
                    })),
                ],
              },
            ]}
            activeId={scheduleFilterId}
            onToggle={(id) => setScheduleFilterId((prev) => (prev === id ? null : id))}
            onSelect={(id, value) => {
              if (id === 'campus') setScheduleCampusFilter(value);
              if (id === 'subject') setScheduleSubjectFilter(value);
              if (id === 'teacher') setScheduleTeacherFilter(value);
              setScheduleFilterId(null);
            }}
          />

          <ScrollView className="flex-1 h-0 px-[32rpx] py-[24rpx] pb-[48rpx]" scrollY>
            {/* 周导航 */}
            <View className="flex items-center justify-between mb-[28rpx]">
              <View
                className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                onClick={() => setWeekOffset((w) => w - 1)}
              >
                <Text className="text-[36rpx] text-muted-foreground">‹</Text>
              </View>
              <View className="text-center flex-1">
                <Text className="text-[32rpx] font-bold text-foreground block">{weekTitle}</Text>
                <Text className="text-[22rpx] text-muted-foreground mt-[2rpx] block">
                  本周 {Object.values(scheduleDataMap).reduce((s, v) => s + v.length, 0)} 节课
                </Text>
              </View>
              <View
                className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-card shadow-card flex items-center justify-center press-scale"
                onClick={() => setWeekOffset((w) => w + 1)}
              >
                <Text className="text-[36rpx] text-muted-foreground">›</Text>
              </View>
            </View>

            {/* 周视图 */}
            <View className="flex gap-[8rpx] mb-[28rpx] bg-card rounded-xl py-[16rpx] px-[12rpx] shadow-card">
              {weekDays.map((d) => (
                <View
                  key={d.date}
                  className={cn(
                    'flex-1 text-center py-[12rpx] rounded-xl transition',
                    d.isToday && !selectedDate?.includes(d.date) && 'bg-info-10',
                    selectedDate === d.date && 'bg-info',
                  )}
                  onClick={() => setSelectedDate(d.date)}
                >
                  <Text
                    className={cn(
                      'text-[20rpx] block',
                      selectedDate === d.date ? 'text-white/80' : 'text-muted-foreground',
                    )}
                  >
                    {d.weekday}
                  </Text>
                  <Text
                    className={cn(
                      'text-[28rpx] font-semibold mt-[4rpx] block',
                      selectedDate === d.date
                        ? 'text-white'
                        : d.isToday
                          ? 'text-info font-bold'
                          : 'text-foreground',
                    )}
                  >
                    {d.day}
                  </Text>
                  {d.hasCourse && (
                    <View
                      className={cn(
                        'w-[8rpx] h-[8rpx] rounded-full mx-auto mt-[6rpx]',
                        selectedDate === d.date ? 'bg-white' : 'bg-info',
                      )}
                    />
                  )}
                </View>
              ))}
            </View>

            {/* 当日课表 */}
            <View className="text-[28rpx] font-bold text-foreground mb-[24rpx] flex items-center gap-[16rpx]">
              <Text>{dayjs(selectedDate).format('M月D日')} 课表</Text>
              {dayjs(selectedDate).isSame(dayjs(), 'day') && (
                <View className="py-[4rpx] px-[16rpx] rounded-[8rpx] bg-info-10 text-info text-[22rpx] font-semibold">
                  今天
                </View>
              )}
            </View>

            {daySchedule.length === 0 ? (
              <View className="flex items-center justify-center py-[120rpx]">
                <Text className="text-[28rpx] text-muted-foreground">当日无排课</Text>
              </View>
            ) : (
              daySchedule.map((item, idx) => (
                <View
                  className="flex gap-[24rpx] py-[24rpx] border-b border-border/50 last:border-b-0"
                  key={idx}
                >
                  <Text className="w-[100rpx] text-[26rpx] font-semibold text-foreground flex-shrink-0 text-right pt-[4rpx]">
                    {item.time}
                  </Text>
                  <View className="w-[20rpx] flex flex-col items-center flex-shrink-0 pt-[8rpx]">
                    <View className="w-[16rpx] h-[16rpx] rounded-full bg-info" />
                    {idx < daySchedule.length - 1 && (
                      <View className="w-[4rpx] flex-1 bg-border mt-[8rpx]" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      {item.title}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[4rpx] block">
                      {item.desc}
                    </Text>
                    <View className="flex gap-[8rpx] mt-[12rpx] flex-wrap">
                      {item.teachers.map((t, ti) => (
                        <View
                          key={ti}
                          className={cn(
                            'py-[6rpx] px-[16rpx] rounded-[12rpx] text-[22rpx] font-medium press-scale',
                            t.role === 'lead'
                              ? 'bg-secondary text-primary'
                              : 'bg-info-10 text-info',
                          )}
                          onClick={() => {
                            const teacher = teachers.find((tt) => tt.name === t.name);
                            if (teacher) handleTeacherClick(teacher.id);
                          }}
                        >
                          {t.name}
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* 年月选择器 */}
      <MonthPicker
        visible={monthPickerVisible}
        currentYear={historyYear}
        currentMonth={historyMonth}
        onSelect={handleMonthSelect}
        onClose={() => setMonthPickerVisible(false)}
      />

      {/* 发放确认弹窗 */}
      <PayConfirmSheet
        visible={paySheetVisible}
        action={pendingPayAction}
        teacherName={payTargetTeacher?.name}
        amount={payTargetTeacher ? calcTotal(payTargetTeacher) : batchPayTotal}
        onConfirm={handlePayConfirm}
        onClose={() => {
          setPaySheetVisible(false);
          setPendingPayAction(null);
        }}
      />

      {/* 添加教师弹窗 */}
      <AddTeacherSheet
        visible={addTeacherVisible}
        onClose={() => setAddTeacherVisible(false)}
        onSubmit={async (data) => {
          const { addTeacher } = useTeacherStore.getState();
          const AVATAR_COLORS = [
            '#5EC8A8',
            '#E89BB8',
            '#6BA3D6',
            '#D4A24E',
            '#9B7ED8',
            '#F0A0A0',
            '#7BC8E8',
            '#B8D45E',
          ];
          const colorIdx = Math.floor(Math.random() * AVATAR_COLORS.length);
          const roleTextMap = { lead: '主讲', assist: '助教', parttime: '兼职' };
          const modelMap: Record<
            string,
            { base: number; rate: number; attend: number; perf: number }
          > = {
            standard: { base: 3000, rate: 100, attend: 500, perf: 700 },
            hourly: { base: 0, rate: 80, attend: 0, perf: 0 },
            custom: { base: 0, rate: 0, attend: 0, perf: 0 },
          };
          const m = modelMap[data.modelType] || modelMap.standard;
          await addTeacher({
            id: `t${Date.now()}`,
            name: data.name,
            role: data.role,
            roleText: roleTextMap[data.role],
            subject: data.subject,
            phone: data.phone || '未填写',
            hours: 0,
            students: 0,
            classes: 0,
            base: m.base,
            rate: m.rate,
            attend: m.attend,
            perf: m.perf,
            salaryStatus: 'pending',
            modelIdx: data.modelType === 'standard' ? 0 : 1,
            color: AVATAR_COLORS[colorIdx],
            initial: data.name[0],
            deductions: [],
            status: 'active',
          });
          setAddTeacherVisible(false);
          Taro.showToast({ title: '添加成功', icon: 'success' });
        }}
      />

      {/* 发放设置弹窗 */}
      <PaymentSettingsSheet
        visible={paymentSettingsVisible}
        settings={settings}
        onClose={() => setPaymentSettingsVisible(false)}
        onSubmit={async (updates) => {
          await updateSettings(updates);
          if (updates.pushEnabled !== undefined) setPushEnabled(updates.pushEnabled);
          setPaymentSettingsVisible(false);
          Taro.showToast({ title: '设置已保存', icon: 'success' });
        }}
      />

      {/* 工资模型弹窗 */}
      <SalaryModelSheet
        visible={salaryModelSheetVisible}
        model={editingModel}
        onClose={() => {
          setSalaryModelSheetVisible(false);
          setEditingModel(null);
        }}
        onSubmit={async (data) => {
          if (editingModel) {
            await updateSalaryModel(editingModel.id, {
              name: data.name,
              type: data.type,
              base: data.base,
              rate: data.rate,
              attend: data.attend,
              perf: data.perf,
            });
          } else {
            const newModel: SalaryModel = {
              id: `m${Date.now()}`,
              name: data.name,
              type: data.type,
              base: data.base,
              rate: data.rate,
              attend: data.attend,
              perf: data.perf,
              teacherCount: 0,
            };
            await createSalaryModel(newModel);
          }
          setSalaryModelSheetVisible(false);
          setEditingModel(null);
          Taro.showToast({ title: editingModel ? '修改成功' : '创建成功', icon: 'success' });
        }}
      />

      {/* 确认工资弹窗 */}
      <ConfirmSalarySheet
        visible={confirmSalaryVisible}
        teacherName={
          confirmSalaryTarget ? teachers.find((t) => t.id === confirmSalaryTarget)?.name || '' : ''
        }
        amount={
          confirmSalaryTarget ? calcTotal(teachers.find((t) => t.id === confirmSalaryTarget)!) : 0
        }
        onConfirm={handleConfirmSalary}
        onClose={() => {
          setConfirmSalaryVisible(false);
          setConfirmSalaryTarget(null);
        }}
      />
    </View>
  );
};

export default TeacherListPage;
