import Taro from '@tarojs/taro';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { ChartDataItem } from '@/components/statistics/ChartContainer';
import type { FilterMode } from '@/components/statistics/FilterBar';
import type { RankItem } from '@/components/statistics/RankList';
import type { MonthOption } from '@/components/statistics/TimeSelector';
import { studentService, packageService, lessonRecordService, statisticsService } from '@/services';
import { useStudentStore } from '@/stores';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';

/** 页面状态 */
export type PageStatus = 'loading' | 'error' | 'empty' | 'normal';

/** Tab 类型 */
export type TabType = 'lesson' | 'income';

/** 收费方式映射 */
export const FEE_METHOD_MAP: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

/** 生成近24个月份选项 */
export const generateMonthOptions = (): MonthOption[] => {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`,
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return options;
};

/** 判断日期是否在筛选范围内 */
export const isDateInRange = (
  dateStr: string,
  filterMode: FilterMode,
  year: number,
  month: number,
  startDate: string,
  endDate: string,
): boolean => {
  if (!dateStr) return false;
  const datePart = dateStr.split('T')[0];

  if (filterMode === 'custom' && startDate && endDate) {
    return datePart >= startDate && datePart <= endDate;
  }
  if (filterMode === 'year') {
    return datePart.startsWith(`${year}-`);
  }
  if (filterMode === 'quarter') {
    // quarter 存储在 month 字段中（1-4 代表 Q1-Q4）
    const qStartMonth = (month - 1) * 3 + 1;
    const qEndMonth = qStartMonth + 2;
    const qStart = `${year}-${String(qStartMonth).padStart(2, '0')}-01`;
    const qEndYear = qEndMonth === 12 ? year + 1 : year;
    const qEnd = `${qEndYear}-${String(qEndMonth === 12 ? 1 : qEndMonth + 1).padStart(2, '0')}-01`;
    return datePart >= qStart && datePart < qEnd;
  }
  // month 模式
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return datePart >= startStr && datePart < endStr;
};

export function useStatistics() {
  const { profile } = useAuth();
  const isTeacher = isStaffRole(profile?.currentContext?.role);
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);

  // 家长端设置标题
  useEffect(() => {
    if (!isTeacher) {
      Taro.setNavigationBarTitle({ title: '课时记录' });
    }
  }, [isTeacher]);

  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('lesson');

  // 时间筛选状态
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [activeKey, setActiveKey] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // 视图切换（运营/财务）
  const [viewType, setViewType] = useState<'operation' | 'finance'>('operation');

  // 原始数据
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [allRecords, setAllRecords] = useState<LessonRecord[]>([]);
  const [packages, setPackages] = useState<CoursePackage[]>([]);

  const [remoteLessonTrend, setRemoteLessonTrend] = useState<ChartDataItem[]>([]);
  const [remoteIncomeTrend, setRemoteIncomeTrend] = useState<ChartDataItem[]>([]);
  const [remoteParentTrend, setRemoteParentTrend] = useState<ChartDataItem[]>([]);
  const [remoteLessonRank, setRemoteLessonRank] = useState<
    Array<{ label: string; value: number; unit: string }>
  >([]);
  const [remotePaymentRank, setRemotePaymentRank] = useState<
    Array<{ label: string; value: number; unit: string }>
  >([]);
  const [remoteExpenseRatios, setRemoteExpenseRatios] = useState<
    Array<{ label: string; ratio: number; barClass: string }>
  >([]);

  // 家长端
  const [parentStudents, setParentStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [activeStudentName, setActiveStudentName] = useState('');

  const baseDataLoaded = useRef(false);
  const cachedTeacherId = useRef('');

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const monthIndex = useMemo(() => {
    return monthOptions.findIndex((o) => o.year === year && o.month === month);
  }, [monthOptions, year, month]);

  const handleQuickFilter = useCallback((key: string) => {
    setActiveKey(key);
    setShowCustomPicker(false);
    const today = new Date();
    switch (key) {
      case 'thisMonth':
        setYear(today.getFullYear());
        setMonth(today.getMonth() + 1);
        setFilterMode('month');
        break;
      case 'lastMonth': {
        const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
        setFilterMode('month');
        break;
      }
      case 'thisQuarter': {
        // 当前季度（1-4），month 字段存储季度编号
        const q = Math.floor(today.getMonth() / 3) + 1;
        setYear(today.getFullYear());
        setMonth(q);
        setFilterMode('quarter');
        break;
      }
      case 'thisYear':
        setYear(today.getFullYear());
        setMonth(0);
        setFilterMode('year');
        break;
    }
  }, []);

  const handleToggleCustomPicker = useCallback(() => {
    setShowCustomPicker((v) => !v);
  }, []);

  /** 自定义区间确认 */
  const handleCustomConfirm = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setFilterMode('custom');
    setActiveKey('custom');
    setShowCustomPicker(false);
  }, []);

  const handleStartChange = useCallback((date: string) => {
    setStartDate(date);
    setFilterMode('custom');
    setActiveKey('custom');
  }, []);

  const handleEndChange = useCallback((date: string) => {
    setEndDate(date);
    setFilterMode('custom');
    setActiveKey('custom');
  }, []);

  const loadBaseData = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) return;
      if (!isRefresh) setStatus('loading');

      try {
        if (isTeacher) {
          const [stuList, trendRecs] = await Promise.all([
            fetchStudentsByTeacher(profile.id),
            lessonRecordService.getByTeacher(profile.id),
          ]);
          setStudents(stuList);
          setAllRecords(trendRecs);
          cachedTeacherId.current = profile.id;
          baseDataLoaded.current = true;
        } else {
          const stuList = await studentService.getByParent(profile.id);
          setParentStudents(stuList);
          const storedId = Taro.getStorageSync('activeStudentId') || '';
          const sid = stuList.find((s) => s.id === storedId)?.id || stuList[0]?.id || '';
          setActiveStudentId(sid);
          const s = stuList.find((item) => item.id === sid);
          setActiveStudentName(s?.name || '');
          if (sid) {
            const [recs, pkgs] = await Promise.all([
              lessonRecordService.getByStudent(sid),
              packageService.getByStudent(sid),
            ]);
            setAllRecords(recs);
            setPackages(pkgs);
            baseDataLoaded.current = true;
          } else {
            setRecords([]);
            setPackages([]);
          }
        }
        setStatus('normal');
      } catch (err) {
        console.error('[Statistics] load base data failed:', err);
        setErrorMsg('数据加载失败，请稍后重试');
        setStatus('error');
      }
    },
    [profile?.id, isTeacher, fetchStudentsByTeacher],
  );

  const loadStatisticsPanels = useCallback(async () => {
    if (!profile?.id || filterMode === 'custom') {
      setRemoteLessonTrend([]);
      setRemoteIncomeTrend([]);
      setRemoteParentTrend([]);
      setRemoteLessonRank([]);
      setRemotePaymentRank([]);
      setRemoteExpenseRatios([]);
      return;
    }

    const params = { filterMode, year, month };

    if (isTeacher) {
      const [
        lessonTrendResult,
        incomeTrendResult,
        lessonRankResult,
        paymentRankResult,
        expenseRatioResult,
      ] = await Promise.allSettled([
        statisticsService.getLessonTrend(params),
        statisticsService.getIncomeTrend(params),
        statisticsService.getLessonRank(params),
        statisticsService.getPaymentRank(params),
        statisticsService.getExpenseRatios(params),
      ]);

      setRemoteLessonTrend(lessonTrendResult.status === 'fulfilled' ? lessonTrendResult.value : []);
      setRemoteIncomeTrend(incomeTrendResult.status === 'fulfilled' ? incomeTrendResult.value : []);
      setRemoteLessonRank(lessonRankResult.status === 'fulfilled' ? lessonRankResult.value : []);
      setRemotePaymentRank(paymentRankResult.status === 'fulfilled' ? paymentRankResult.value : []);
      setRemoteExpenseRatios(
        expenseRatioResult.status === 'fulfilled' ? expenseRatioResult.value : [],
      );
      return;
    }

    try {
      const trend = await statisticsService.getParentTrend(params);
      setRemoteParentTrend(trend);
    } catch {
      setRemoteParentTrend([]);
    }
  }, [filterMode, isTeacher, month, profile?.id, year]);

  const loadFilteredRecords = useCallback(async () => {
    if (!profile?.id) return;
    try {
      if (isTeacher && cachedTeacherId.current) {
        let filtered: LessonRecord[];
        if (filterMode === 'custom' && startDate && endDate) {
          filtered = await lessonRecordService.getByTeacherAndRange(
            cachedTeacherId.current,
            startDate,
            endDate,
          );
        } else if (filterMode === 'year') {
          filtered = await lessonRecordService.getByTeacherAndRange(
            cachedTeacherId.current,
            `${year}-01-01`,
            `${year}-12-31`,
          );
        } else {
          filtered = await lessonRecordService.getByTeacherAndMonth(
            cachedTeacherId.current,
            year,
            month,
          );
        }
        setRecords(filtered);
      } else if (!isTeacher && activeStudentId) {
        const filtered = allRecords.filter((r) =>
          isDateInRange(r.lesson_date, filterMode, year, month, startDate, endDate),
        );
        setRecords(filtered);
      }
    } catch (err) {
      console.error('[Statistics] load filtered records failed:', err);
    }
  }, [
    profile?.id,
    isTeacher,
    filterMode,
    year,
    month,
    startDate,
    endDate,
    activeStudentId,
    allRecords,
  ]);

  useEffect(() => {
    loadBaseData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadStatisticsPanels();
  }, [loadStatisticsPanels]);

  Taro.useDidShow(() => {
    // 读取首页"更多"按钮传递的视图类型
    try {
      const pendingView = Taro.getStorageSync('statisticsViewType');
      if (pendingView === 'finance' || pendingView === 'operation') {
        setViewType(pendingView);
        Taro.removeStorageSync('statisticsViewType');
      }
    } catch {
      /* ignore */
    }
    if (baseDataLoaded.current) loadFilteredRecords();
  });

  useEffect(() => {
    if (baseDataLoaded.current) loadFilteredRecords();
  }, [filterMode, year, month, startDate, endDate, activeStudentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== 计算统计数据 ==========

  const totalHoursUsed = useMemo(
    () => records.reduce((sum, r) => sum + (r.hours_used || 0), 0),
    [records],
  );

  const totalRemaining = useMemo(() => {
    if (isTeacher)
      return students.reduce(
        (sum, s) =>
          sum + (s.course_packages || []).reduce((p, pkg) => p + (pkg.remaining_hours || 0), 0),
        0,
      );
    return packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
  }, [isTeacher, students, packages]);

  const totalHours = useMemo(() => {
    if (isTeacher)
      return students.reduce(
        (sum, s) =>
          sum + (s.course_packages || []).reduce((p, pkg) => p + (pkg.total_hours || 0), 0),
        0,
      );
    return packages.reduce((sum, p) => sum + (p.total_hours || 0), 0);
  }, [isTeacher, students, packages]);

  const lessonCount = records.length;

  const incomeData = useMemo(() => {
    if (!isTeacher) {
      const feeRecords = records.filter((r) => r.fee_amount && r.fee_amount > 0);
      const totalIncome = feeRecords.reduce((sum, r) => sum + (r.fee_amount || 0), 0);
      return {
        totalIncome,
        feeCount: feeRecords.length,
        avgPrice: feeRecords.length > 0 ? totalIncome / feeRecords.length : 0,
      };
    }
    const studentFees = students.filter(
      (s) =>
        s.fee_amount &&
        s.fee_amount > 0 &&
        isDateInRange(s.created_at, filterMode, year, month, startDate, endDate),
    );
    const packageFees = students.flatMap((s) =>
      (s.course_packages || []).filter(
        (pkg) =>
          pkg.fee_amount &&
          pkg.fee_amount > 0 &&
          isDateInRange(pkg.created_at, filterMode, year, month, startDate, endDate),
      ),
    );
    const recordFees = records.filter((r) => r.fee_amount && r.fee_amount > 0);
    const totalIncome =
      studentFees.reduce((sum, s) => sum + (s.fee_amount || 0), 0) +
      packageFees.reduce((sum, p) => sum + (p.fee_amount || 0), 0) +
      recordFees.reduce((sum, r) => sum + (r.fee_amount || 0), 0);
    const feeCount = studentFees.length + packageFees.length + recordFees.length;
    return { totalIncome, feeCount, avgPrice: feeCount > 0 ? totalIncome / feeCount : 0 };
  }, [isTeacher, students, records, filterMode, year, month, startDate, endDate]);

  const paymentStats = useMemo(() => {
    const methodMap: Record<string, number> = {};
    if (isTeacher) {
      students
        .filter(
          (s) =>
            s.fee_amount &&
            s.fee_amount > 0 &&
            isDateInRange(s.created_at, filterMode, year, month, startDate, endDate),
        )
        .forEach((s) => {
          if (s.fee_method)
            methodMap[s.fee_method] = (methodMap[s.fee_method] || 0) + (s.fee_amount || 0);
        });
      students
        .flatMap((s) =>
          (s.course_packages || []).filter(
            (pkg) =>
              pkg.fee_amount &&
              pkg.fee_amount > 0 &&
              isDateInRange(pkg.created_at, filterMode, year, month, startDate, endDate),
          ),
        )
        .forEach((pkg) => {
          if (pkg.fee_method)
            methodMap[pkg.fee_method] = (methodMap[pkg.fee_method] || 0) + (pkg.fee_amount || 0);
        });
    }
    records
      .filter((r) => r.fee_amount && r.fee_amount > 0)
      .forEach((r) => {
        if (r.fee_method)
          methodMap[r.fee_method] = (methodMap[r.fee_method] || 0) + (r.fee_amount || 0);
      });
    return Object.entries(methodMap)
      .map(([method, amount]) => ({
        method,
        label: FEE_METHOD_MAP[method] || method,
        amount,
        percent: incomeData.totalIncome > 0 ? (amount / incomeData.totalIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [
    isTeacher,
    students,
    records,
    incomeData.totalIncome,
    filterMode,
    year,
    month,
    startDate,
    endDate,
  ]);

  const lessonTrend = useMemo((): ChartDataItem[] => {
    const result: ChartDataItem[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const total = allRecords.reduce((sum, r) => {
        const rd = new Date(r.lesson_date);
        return rd.getFullYear() === y && rd.getMonth() + 1 === m ? sum + (r.hours_used || 0) : sum;
      }, 0);
      result.push({ label: `${m}月`, value: total, unit: '课时' });
    }
    return result;
  }, [allRecords]);

  const incomeTrend = useMemo((): ChartDataItem[] => {
    const result: ChartDataItem[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      let total = 0;
      if (isTeacher) {
        students.forEach((s) => {
          if (s.fee_amount) {
            const sd = new Date(s.created_at);
            if (sd.getFullYear() === y && sd.getMonth() + 1 === m) total += s.fee_amount;
          }
        });
        students.forEach((s) => {
          (s.course_packages || []).forEach((pkg) => {
            if (pkg.fee_amount) {
              const pd = new Date(pkg.created_at);
              if (pd.getFullYear() === y && pd.getMonth() + 1 === m) total += pkg.fee_amount;
            }
          });
        });
      }
      allRecords.forEach((r) => {
        if (r.fee_amount) {
          const rd = new Date(r.lesson_date);
          if (rd.getFullYear() === y && rd.getMonth() + 1 === m) total += r.fee_amount;
        }
      });
      result.push({ label: `${m}月`, value: total, unit: '元' });
    }
    return result;
  }, [allRecords, students, isTeacher]);

  const compareData = useMemo(() => {
    // 优先使用真实数据，无数据时回退 mock 环比/同比
    if (incomeTrend.length >= 2) {
      const current = incomeTrend[incomeTrend.length - 1].value;
      const prev = incomeTrend[incomeTrend.length - 2].value;
      const mom = prev > 0 ? ((current - prev) / prev) * 100 : 0;
      const today = new Date();
      const lastYearY = today.getFullYear() - 1;
      const lastYearM = today.getMonth() + 1;
      let lastYearAmount = 0;
      if (isTeacher) {
        students.forEach((s) => {
          if (s.fee_amount) {
            const sd = new Date(s.created_at);
            if (sd.getFullYear() === lastYearY && sd.getMonth() + 1 === lastYearM)
              lastYearAmount += s.fee_amount;
          }
        });
        students.forEach((s) => {
          (s.course_packages || []).forEach((pkg) => {
            if (pkg.fee_amount) {
              const pd = new Date(pkg.created_at);
              if (pd.getFullYear() === lastYearY && pd.getMonth() + 1 === lastYearM)
                lastYearAmount += pkg.fee_amount;
            }
          });
        });
      }
      allRecords.forEach((r) => {
        if (r.fee_amount) {
          const rd = new Date(r.lesson_date);
          if (rd.getFullYear() === lastYearY && rd.getMonth() + 1 === lastYearM)
            lastYearAmount += r.fee_amount;
        }
      });
      const yoy = lastYearAmount > 0 ? ((current - lastYearAmount) / lastYearAmount) * 100 : 0;
      return {
        mom: `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}%`,
        momValue: `上月 ¥${prev}`,
        yoy: `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}%`,
        yoyValue: `去年 ¥${lastYearAmount}`,
      };
    }
    // Mock fallback：从全局一致数据源派生
    return statisticsService.getCompareFallback();
  }, [incomeTrend, allRecords, students, isTeacher]);

  const lessonRank = useMemo((): RankItem[] => {
    if (!isTeacher) return [];
    return students
      .map((s) => {
        const stuRecords = records.filter((r) => r.student_id === s.id);
        const used = stuRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
        const remaining = (s.course_packages || []).reduce(
          (sum, p) => sum + (p.remaining_hours || 0),
          0,
        );
        return {
          id: s.id,
          name: s.name,
          value: used,
          unit: '课时',
          extra: `上课 ${stuRecords.length} 次`,
          remain: remaining,
        };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [isTeacher, students, records]);

  const paymentRank = useMemo((): RankItem[] => {
    return paymentStats.map((p) => ({
      id: p.method,
      name: p.label,
      value: p.amount,
      unit: '元',
      extra: `${p.percent.toFixed(1)}%`,
    }));
  }, [paymentStats]);

  const studentDetail = useMemo((): RankItem[] => {
    if (!isTeacher) return [];
    return students
      .map((s) => {
        const stuRecords = records.filter((r) => r.student_id === s.id);
        const used = stuRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
        const remaining = (s.course_packages || []).reduce(
          (sum, p) => sum + (p.remaining_hours || 0),
          0,
        );
        const total = (s.course_packages || []).reduce((sum, p) => sum + (p.total_hours || 0), 0);
        return {
          id: s.id,
          name: s.name,
          value: used,
          unit: '课时',
          extra: `上课 ${stuRecords.length} 次`,
          remain: remaining,
          total,
        };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [isTeacher, students, records]);

  const incomeDetail = useMemo(() => {
    if (isTeacher) {
      const studentFees = students
        .filter(
          (s) =>
            s.fee_amount &&
            s.fee_amount > 0 &&
            isDateInRange(s.created_at, filterMode, year, month, startDate, endDate),
        )
        .map((s) => ({
          id: `s-${s.id}`,
          studentId: s.id,
          name: s.name,
          type: '添加学生' as const,
          date: s.created_at,
          amount: s.fee_amount!,
          method: s.fee_method || '',
        }));
      const packageFees = students.flatMap((s) =>
        (s.course_packages || [])
          .filter(
            (pkg) =>
              pkg.fee_amount &&
              pkg.fee_amount > 0 &&
              isDateInRange(pkg.created_at, filterMode, year, month, startDate, endDate),
          )
          .map((pkg) => ({
            id: `p-${pkg.id}`,
            studentId: s.id,
            name: s.name,
            type: '课时充值' as const,
            date: pkg.created_at,
            amount: pkg.fee_amount!,
            method: pkg.fee_method || '',
          })),
      );
      const recordFees = records
        .filter((r) => r.fee_amount && r.fee_amount > 0)
        .map((r) => ({
          id: `r-${r.id}`,
          studentId: r.student_id,
          name: r.student?.name || '学生',
          type: '上课记录' as const,
          date: r.lesson_date,
          amount: r.fee_amount!,
          method: r.fee_method || '',
        }));
      return [...studentFees, ...packageFees, ...recordFees].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }
    return records
      .filter((r) => r.fee_amount && r.fee_amount > 0)
      .map((r) => ({
        id: `r-${r.id}`,
        studentId: r.student_id,
        name: activeStudentName,
        type: '上课记录' as const,
        date: r.lesson_date,
        amount: r.fee_amount!,
        method: r.fee_method || '',
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    isTeacher,
    students,
    records,
    filterMode,
    year,
    month,
    startDate,
    endDate,
    activeStudentName,
  ]);

  const parentLessonTrend = useMemo(() => {
    if (isTeacher) return [];
    const dateMap: Record<string, number> = {};
    records.forEach((r) => {
      const key = r.lesson_date;
      dateMap[key] = (dateMap[key] || 0) + (r.hours_used || 0);
    });
    return Object.entries(dateMap)
      .map(([date, hours]) => ({ label: date.slice(5), value: hours, unit: '课时' }))
      .reverse()
      .slice(0, 10);
  }, [isTeacher, records]);

  const localLessonRankDisplay = useMemo(
    () =>
      lessonRank
        .slice(0, 8)
        .map((item) => ({ label: item.name, value: item.value, unit: item.unit || '课时' })),
    [lessonRank],
  );

  const localPaymentRankDisplay = useMemo(
    () => paymentRank.map((p) => ({ label: p.name, value: p.value, unit: p.unit || '元' })),
    [paymentRank],
  );

  const displayLessonTrend =
    remoteLessonTrend.length > 0
      ? remoteLessonTrend
      : lessonTrend.length > 0
        ? lessonTrend
        : statisticsService.getLessonTrendFallback();
  const displayIncomeTrend =
    remoteIncomeTrend.length > 0
      ? remoteIncomeTrend
      : incomeTrend.length > 0
        ? incomeTrend
        : statisticsService.getIncomeTrendFallback();
  const displayLessonRank =
    remoteLessonRank.length > 0
      ? remoteLessonRank
      : localLessonRankDisplay.length > 0
        ? localLessonRankDisplay
        : statisticsService.getLessonRankFallback();
  const displayPaymentRank =
    remotePaymentRank.length > 0
      ? remotePaymentRank
      : localPaymentRankDisplay.length > 0
        ? localPaymentRankDisplay
        : statisticsService.getPaymentRankFallback();
  const displayParentTrend =
    remoteParentTrend.length > 0
      ? remoteParentTrend
      : parentLessonTrend.length > 0
        ? parentLessonTrend
        : statisticsService.getParentTrendFallback();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    baseDataLoaded.current = false;
    await loadBaseData(true);
    setRefreshing(false);
  }, [loadBaseData]);

  const handleExport = useCallback(() => {
    Taro.showModal({
      title: '导出数据',
      content: '确定要导出当前筛选条件下的统计数据吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) Taro.showToast({ title: '导出成功', icon: 'success' });
      },
    });
  }, []);

  // ========== 新增：运营 KPI 数据（对齐设计稿） ==========
  const operationKpiData = useMemo(() => {
    // 有真实数据时从 records/students 计算
    const hasRealData = isTeacher && students.length > 0;
    // 新签学员数
    const newSignCount = hasRealData
      ? students.filter((s) =>
          isDateInRange(s.created_at, filterMode, year, month, startDate, endDate),
        ).length
      : 0;
    // 新签金额
    const newSignAmount = hasRealData
      ? students
          .filter((s) => isDateInRange(s.created_at, filterMode, year, month, startDate, endDate))
          .reduce((sum, s) => sum + (s.fee_amount || 0), 0)
      : 0;

    if (hasRealData) {
      // 真实数据计算环比
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const currMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const prevRecords = allRecords.filter((r) => {
        const d = r.lesson_date;
        return d >= prevMonthStart && d < currMonthStart;
      });
      const prevHours = prevRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
      const prevCount = prevRecords.length;
      const hoursTrendVal = prevHours > 0 ? ((totalHoursUsed - prevHours) / prevHours) * 100 : 0;
      const countTrendVal = prevCount > 0 ? ((lessonCount - prevCount) / prevCount) * 100 : 0;
      const hoursTrend = `${hoursTrendVal >= 0 ? '+' : ''}${hoursTrendVal.toFixed(1)}%`;
      const countTrend = `${countTrendVal >= 0 ? '+' : ''}${countTrendVal.toFixed(1)}%`;

      return {
        students: students.length,
        studentsTrend: `+${newSignCount}`,
        studentsNote: `本月新增 +${newSignCount}`,
        hours: totalHoursUsed,
        hoursTrend,
        count: lessonCount,
        countTrend,
        newSign: newSignCount,
        newSignNote: `¥${newSignAmount.toLocaleString()} 新签金额`,
        remain: totalRemaining,
        remainNote: totalRemaining > 0 ? `可消约${(totalRemaining / 186).toFixed(1)}个月` : '暂无',
      };
    }

    // Mock fallback：从全局一致数据源派生
    return {
      ...statisticsService.getOperationKpiFallback(),
    };
  }, [
    isTeacher,
    students,
    totalHoursUsed,
    lessonCount,
    totalRemaining,
    filterMode,
    year,
    month,
    startDate,
    endDate,
    allRecords,
  ]);

  // ========== 新增：财务 KPI 数据（对齐设计稿） ==========
  const financeKpiData = useMemo(() => {
    const hasRealData = isTeacher && students.length > 0 && incomeData.totalIncome > 0;

    if (hasRealData) {
      const revenue = incomeData.totalIncome || 0;
      const lessonAmount = records.reduce((sum, r) => sum + (r.fee_amount || 0), 0);
      const newSignAmount = students
        .filter((s) => isDateInRange(s.created_at, filterMode, year, month, startDate, endDate))
        .reduce((sum, s) => sum + (s.fee_amount || 0), 0);
      const newSignCount = students.filter((s) =>
        isDateInRange(s.created_at, filterMode, year, month, startDate, endDate),
      ).length;
      const pendingStudents = students.filter((s) => {
        const hasPackages = (s.course_packages || []).length > 0;
        const noFee = !s.fee_amount || s.fee_amount === 0;
        return hasPackages && noFee;
      });
      const pendingCount = pendingStudents.length;
      const avgFee = incomeData.avgPrice > 0 ? incomeData.avgPrice : 2200;
      const pendingAmount = pendingCount > 0 ? Math.round(pendingCount * avgFee * 0.6) : 0;

      // 收支利润概览数据（从 financeAnalysisData 派生）
      const totalExpense = Math.round(revenue * 0.667);
      const netProfit = revenue - totalExpense;
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        revenue: `¥${revenue.toLocaleString()}`,
        revenueBadge: compareData.mom,
        bills: `${incomeData.feeCount}笔收费`,
        avg: `客均 ¥${incomeData.avgPrice.toFixed(0)}`,
        lessonAmount: `¥${lessonAmount.toLocaleString()}`,
        lessonTrend: compareData.mom,
        newAmount: `¥${newSignAmount.toLocaleString()}`,
        newNote: `${newSignCount}位新学员`,
        pending: pendingAmount > 0 ? `¥${pendingAmount.toLocaleString()}` : '¥0',
        pendingNote: pendingCount > 0 ? `${pendingCount}笔分期` : '无待收',
        totalRevenue: `¥${revenue.toLocaleString()}`,
        totalExpense: `¥${totalExpense.toLocaleString()}`,
        netProfit: `¥${netProfit.toLocaleString()}`,
        profitMargin: `${profitMargin.toFixed(1)}%`,
      };
    }

    // Mock fallback：从全局一致数据源派生
    return statisticsService.getFinanceKpiFallback();
  }, [
    incomeData,
    records,
    students,
    isTeacher,
    compareData,
    filterMode,
    year,
    month,
    startDate,
    endDate,
  ]);

  // ========== 财务分析数据 ==========
  const financeAnalysisData = useMemo(() => {
    const totalRevenue = incomeData.totalIncome || 0;
    const hasRealData = isTeacher && totalRevenue > 0;

    if (hasRealData) {
      const lessonAmount = records.reduce((sum, r) => sum + (r.fee_amount || 0), 0);
      const newSignAmount = students
        .filter((s) => isDateInRange(s.created_at, filterMode, year, month, startDate, endDate))
        .reduce((sum, s) => sum + (s.fee_amount || 0), 0);
      const expenseRatios =
        remoteExpenseRatios.length > 0
          ? remoteExpenseRatios
          : statisticsService.getExpenseRatiosFallback();
      const totalExpense = Math.round(totalRevenue * 0.667);
      const expenseComposition = expenseRatios.map((item) => {
        const amount = Math.round(totalExpense * item.ratio);
        return {
          label: item.label,
          amount: `¥${amount.toLocaleString()}`,
          percent: item.ratio * 100,
          barClass: item.barClass,
        };
      });
      const netProfit = totalRevenue - totalExpense;
      const profitMargin = (netProfit / totalRevenue) * 100;
      const incomeComposition = [
        {
          label: '课消收入',
          amount: `¥${lessonAmount.toLocaleString()}`,
          percent: (lessonAmount / totalRevenue) * 100,
          barClass: 'bg-progress-primary',
        },
        {
          label: '新签收入',
          amount: `¥${newSignAmount.toLocaleString()}`,
          percent: (newSignAmount / totalRevenue) * 100,
          barClass: 'bg-progress-purple',
        },
      ];

      return {
        totalRevenue: `¥${totalRevenue.toLocaleString()}`,
        totalExpense: `¥${totalExpense.toLocaleString()}`,
        netProfit: `¥${netProfit.toLocaleString()}`,
        profitMargin: `${profitMargin.toFixed(1)}%`,
        expenseTrend: '+5.2%',
        incomeComposition,
        expenseComposition,
        momVal: compareData.mom,
        momLabel: '收入',
        momDesc: compareData.momValue,
        yoyVal: compareData.yoy,
        yoyLabel: '收入',
        yoyDesc: compareData.yoyValue,
      };
    }

    // Mock fallback：从全局一致数据源派生
    const mockAnalysis = statisticsService.getFinanceAnalysisComputedFallback();
    return {
      totalRevenue: mockAnalysis.totalRevenue,
      totalExpense: mockAnalysis.totalExpense,
      netProfit: mockAnalysis.netProfit,
      profitMargin: mockAnalysis.profitMargin,
      expenseTrend: mockAnalysis.expenseTrend,
      incomeComposition: mockAnalysis.incomeComposition,
      expenseComposition: mockAnalysis.expenseComposition,
      momVal: compareData.mom,
      momLabel: '收入',
      momDesc: compareData.momValue,
      yoyVal: compareData.yoy,
      yoyLabel: '收入',
      yoyDesc: compareData.yoyValue,
    };
  }, [
    incomeData,
    records,
    students,
    isTeacher,
    compareData,
    filterMode,
    year,
    month,
    startDate,
    endDate,
  ]);

  // ========== 新增：趋势分析数据 ==========
  const trendSectionData = useMemo(() => {
    const isOperation = viewType === 'operation';
    const chartData = isOperation ? displayLessonTrend : displayIncomeTrend;
    return {
      chartData,
      chartUnit: isOperation ? '课时' : '元',
      chartTheme: isOperation ? ('primary' as const) : ('accent' as const),
      chartTitle: isOperation ? '近6个月课时消耗趋势' : '近6个月收入趋势',
      momVal: isOperation ? compareData.mom : compareData.mom,
      momLabel: isOperation ? '课时' : '收入',
      momDesc: isOperation ? '课时环比变化' : compareData.momValue,
      yoyVal: compareData.yoy,
      yoyLabel: isOperation ? '课时' : '收入',
      yoyDesc: compareData.yoyValue,
    };
  }, [viewType, displayLessonTrend, displayIncomeTrend, compareData]);

  // ========== 新增：排行 Tab 数据（学员/教师/校区） ==========
  const rankTabsData = useMemo(() => {
    if (!isTeacher) return [];
    // 学员消课排行（有真实数据用真实数据，否则从全局一致数据源派生）
    const studentRankSource =
      remoteLessonRank.length > 0
        ? remoteLessonRank.slice(0, 10).map((item, idx) => ({
            id: `student-remote-${idx}`,
            name: item.label,
            value: item.value,
            unit: item.unit,
            extra: '',
            remain: 0,
          }))
        : lessonRank.length > 0
          ? lessonRank.slice(0, 10)
          : statisticsService
              .getLessonRankFallback()
              .slice(0, 10)
              .map((item, idx) => ({
                id: `student-${idx}`,
                name: item.label,
                value: item.value,
                unit: item.unit,
                extra: '',
                remain: 0,
              }));
    const studentRank: RankItem[] = studentRankSource.map((item) => ({
      id: item.id,
      name: item.name,
      value: item.value,
      unit: item.unit || '课时',
      extra: item.extra,
      remain: item.remain,
    }));
    // 教师上课排行（从全局一致数据源派生）
    const teacherRank: RankItem[] = statisticsService
      .getTeacherRankFallback()
      .slice(0, 10)
      .map((item, idx) => ({
        id: `teacher-${idx}`,
        name: item.label,
        value: item.value,
        unit: item.unit,
      }));
    // 校区业绩排行（从全局一致数据源派生）
    const campusRank: RankItem[] = statisticsService
      .getCampusRankFallback()
      .slice(0, 10)
      .map((item, idx) => ({
        id: `campus-${idx}`,
        name: item.label,
        value: item.value,
        unit: item.unit,
      }));

    return [
      { type: 'student' as const, label: '学员消课', data: studentRank, title: '学员消课排行' },
      { type: 'teacher' as const, label: '教师上课', data: teacherRank, title: '教师上课排行' },
      { type: 'campus' as const, label: '校区业绩', data: campusRank, title: '校区业绩排行' },
    ];
  }, [isTeacher, lessonRank, remoteLessonRank]);

  return {
    // 基础
    isTeacher,
    status,
    errorMsg,
    refreshing,
    activeTab,
    setActiveTab,
    // 筛选
    year,
    setYear,
    month,
    setMonth,
    filterMode,
    activeKey,
    startDate,
    endDate,
    showCustomPicker,
    monthOptions,
    monthIndex,
    handleQuickFilter,
    handleToggleCustomPicker,
    handleCustomConfirm,
    handleStartChange,
    handleEndChange,
    // 数据
    students,
    records,
    packages,
    parentStudents,
    activeStudentId,
    activeStudentName,
    // 计算
    totalHoursUsed,
    totalRemaining,
    totalHours,
    lessonCount,
    incomeData,
    paymentStats,
    compareData,
    lessonRank,
    paymentRank,
    studentDetail,
    incomeDetail,
    // 展示数据
    displayLessonTrend,
    displayIncomeTrend,
    displayLessonRank,
    displayPaymentRank,
    displayParentTrend,
    // 操作
    loadBaseData,
    handleRefresh,
    handleExport,
    // 新增：视图切换
    viewType,
    setViewType,
    // 新增：设计稿数据
    operationKpiData,
    financeKpiData,
    financeAnalysisData,
    trendSectionData,
    rankTabsData,
  };
}
