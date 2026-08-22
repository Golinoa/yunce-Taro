import Taro from '@tarojs/taro';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { auditLogService } from '@/services/audit-log';
import { useTeacherStore, calcTotal } from '@/stores/teacher';
import type { SalaryModel } from '@/types/teacher';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';

/** 主Tab类型 */
export type MainTab = 'teacher' | 'salary' | 'schedule';

/** 薪资子Tab类型 */
export type SalarySubTab = 'current' | 'history' | 'settings';

/** 排课周数据 */
export interface WeekDay {
  date: string;
  day: string;
  weekday: string;
  isToday: boolean;
  hasCourse: boolean;
}

/** 排课项 */
export interface ScheduleItem {
  time: string;
  title: string;
  desc: string;
  teachers: Array<{ name: string; role: 'lead' | 'assist' }>;
  rate: string;
  campus: string;
  subject: string;
}

/** 排课数据 - 按日期分组 */
export type ScheduleDataMap = Record<string, ScheduleItem[]>;

/** Tab配置常量 */
export const TAB_CONFIG: { key: MainTab; label: string; icon: string }[] = [
  { key: 'teacher', label: '教师', icon: '👤' },
  { key: 'salary', label: '薪资', icon: '💰' },
  { key: 'schedule', label: '排课', icon: '📅' },
];

/**
 * 教师管理页面共享状态和逻辑的 Hook
 * 管理 Tab 切换、薪资操作、排课数据等
 */
export function useTeacherList() {
  // ===== Store =====
  const { profile } = useAuth();
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
    error,
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

  // ===== 计算属性 =====
  const filteredTeachers = useMemo(() => getFilteredTeachers(), [getFilteredTeachers]);

  const salaryTeachers = useMemo(
    () => teachers.filter((t) => t.status === 'active' || t.salaryStatus !== 'archived'),
    [teachers],
  );

  const pendingCount = useMemo(() => getPendingCount(), [getPendingCount]);
  const totalHours = useMemo(() => getTotalHours(), [getTotalHours]);
  const totalSalary = useMemo(() => getTotalSalary(), [getTotalSalary]);
  const activeCount = useMemo(
    () => teachers.filter((t) => t.status === 'active').length,
    [teachers],
  );

  const pendingPayAction = useTeacherStore((s) => s.pendingPayAction);
  const payTargetTeacher = useMemo(() => {
    if (!pendingPayAction || pendingPayAction.type !== 'single') return null;
    return teachers.find((t) => t.id === pendingPayAction.ids[0]);
  }, [pendingPayAction, teachers]);

  const batchPayTotal = useMemo(() => {
    if (!pendingPayAction || pendingPayAction.type !== 'batch') return 0;
    return pendingPayAction.ids.reduce((sum, id) => {
      const t = teachers.find((item) => item.id === id);
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

  const daySchedule = useMemo(() => {
    const dayOfWeek = dayjs(selectedDate).day();
    if (dayOfWeek === 0 || dayOfWeek === 6) return [];
    const items = scheduleDataMap[selectedDate] || [];
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

  // ===== 事件处理 =====
  const handleTeacherClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-teacher/pages/teacher-form/index?id=${id}` });
  }, []);

  const handleSalaryAction = useCallback(
    async (teacherId: string) => {
      const t = teachers.find((item) => item.id === teacherId);
      if (!t) return;
      if (t.salaryStatus === 'pending') {
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
        // 批量确认前弹出确认提示
        const { confirm } = await Taro.showModal({
          title: '批量确认',
          content: `确认 ${selectedIds.length} 位教师的薪资？`,
          confirmText: '确认',
          cancelText: '取消',
        });
        if (!confirm) return;
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
      // 审计日志（用户口径 2026-08-22）：薪资发放属关键财务操作
      try {
        await auditLogService.record({
          action: 'salary.pay',
          operatorId: profile?.id || '',
          operatorName: profile?.name || '未知',
          operatorRole: profile?.currentContext?.role || 'unknown',
          targetType: 'salary_batch',
          detail: `薪资发放：发放所选员工薪资${remark ? `（备注：${remark}）` : ''}`,
          meta: { remark: remark || undefined },
        });
      } catch (e) {
        logError('audit salary.pay', e);
      }
      setPaySheetVisible(false);
      Taro.showToast({ title: '发放成功', icon: 'success' });
    },
    [executePay, profile],
  );

  const handleMonthSelect = useCallback((year: number, month: number) => {
    setHistoryYear(year);
    setHistoryMonth(month);
    setMonthPickerVisible(false);
  }, []);

  const handleSalaryDetail = useCallback((teacherId: string) => {
    Taro.navigateTo({ url: `/package-teacher/pages/salary-detail/index?id=${teacherId}` });
  }, []);

  return {
    // Store 数据
    filter,
    setFilter,
    teachers,
    filteredTeachers,
    salaryTeachers,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    settings,
    updateSettings,
    salaryModels,
    createSalaryModel,
    updateSalaryModel,
    fetchAll,
    loading,
    error,
    reload: fetchAll,

    // Tab 状态
    mainTab,
    setMainTab,
    salarySubTab,
    setSalarySubTab,

    // 筛选
    activeFilterId,
    setActiveFilterId,

    // 统计
    pendingCount,
    totalHours,
    totalSalary,
    activeCount,

    // 薪资操作
    paySheetVisible,
    setPaySheetVisible,
    pendingPayAction,
    setPendingPayAction,
    payTargetTeacher,
    batchPayTotal,
    confirmSalaryVisible,
    setConfirmSalaryVisible,
    confirmSalaryTarget,
    setConfirmSalaryTarget,
    handleSalaryAction,
    handleConfirmSalary,
    handleBatchAction,
    handlePayConfirm,
    handleSalaryDetail,

    // 添加教师
    addTeacherVisible,
    setAddTeacherVisible,

    // 发放设置
    paymentSettingsVisible,
    setPaymentSettingsVisible,

    // 工资模型
    salaryModelSheetVisible,
    setSalaryModelSheetVisible,
    editingModel,
    setEditingModel,

    // 月份选择
    monthPickerVisible,
    setMonthPickerVisible,
    historyYear,
    historyMonth,
    historyRecords,
    historyTotalAmount,
    historyTotalHours,
    handleMonthSelect,

    // 排课
    weekOffset,
    setWeekOffset,
    selectedDate,
    setSelectedDate,
    scheduleDataMap,
    setScheduleDataMap,
    scheduleCampusFilter,
    setScheduleCampusFilter,
    scheduleSubjectFilter,
    setScheduleSubjectFilter,
    scheduleTeacherFilter,
    setScheduleTeacherFilter,
    scheduleFilterId,
    setScheduleFilterId,
    weekDays,
    weekTitle,
    daySchedule,

    // 导航
    handleTeacherClick,

    // 设置
    pushEnabled,
    setPushEnabled,
  };
}
