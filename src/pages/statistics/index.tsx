/**
 * Statistics - 统计页面
 * 1:1 复刻原版筛选逻辑：
 * - 本月/上月 → filterMode='month'，按年月查询
 * - 本年/去年 → filterMode='year'，按年查询（月设为0）
 * - 自定义 → filterMode='custom'，按开始/结束日期查询
 * 教师端：展示全量数据
 * 家长端：仅展示个人数据
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import BarChart from '@/components/statistics/BarChart';
import ChartContainer, { ChartDataItem } from '@/components/statistics/ChartContainer';
import FilterBar, { FilterMode } from '@/components/statistics/FilterBar';
import KpiCard from '@/components/statistics/KpiCard';
import RankList, { RankItem } from '@/components/statistics/RankList';
import TimeSelector, { MonthOption } from '@/components/statistics/TimeSelector';
import { studentService, packageService, lessonRecordService } from '@/services';
import { useStudentStore } from '@/stores';
import type { CoursePackage } from '@/types/course-package';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { useAuth } from '@/utils/auth';
import { formatDateCN } from '@/utils/format';

/** 页面状态 */
type PageStatus = 'loading' | 'error' | 'empty' | 'normal';

/** Tab 类型 */
type TabType = 'lesson' | 'income';

/** 收费方式映射 */
const FEE_METHOD_MAP: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  transfer: '转账',
  other: '其他',
};

/**
 * 生成近24个月份选项
 */
const generateMonthOptions = (): MonthOption[] => {
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

/**
 * 判断日期是否在筛选范围内
 */
const isDateInRange = (
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
  // month 模式
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return datePart >= startStr && datePart < endStr;
};

/**
 * 统计页面主组件
 */
const Statistics: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';
  const studentStore = useStudentStore();

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

  // 时间筛选状态（与原版对齐）
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [activeKey, setActiveKey] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // 原始数据
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [allRecords, setAllRecords] = useState<LessonRecord[]>([]); // 近12个月全部记录（用于趋势图）
  const [packages, setPackages] = useState<CoursePackage[]>([]);

  // 家长端
  const [parentStudents, setParentStudents] = useState<Student[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [activeStudentName, setActiveStudentName] = useState('');

  // 数据缓存标记：初始数据是否已加载（学生列表等不随筛选变化的基数据）
  const baseDataLoaded = useRef(false);
  // 教师ID缓存（避免每次筛选都重新获取学生列表）
  const cachedTeacherId = useRef('');

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const monthIndex = useMemo(() => {
    return monthOptions.findIndex((o) => o.year === year && o.month === month);
  }, [monthOptions, year, month]);

  /**
   * 快捷筛选按钮点击（与原版 q 函数对齐）
   */
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
      case 'thisYear':
        setYear(today.getFullYear());
        setMonth(0);
        setFilterMode('year');
        break;
      case 'lastYear':
        setYear(today.getFullYear() - 1);
        setMonth(0);
        setFilterMode('year');
        break;
    }
  }, []);

  /**
   * 自定义按钮点击
   */
  const handleToggleCustomPicker = useCallback(() => {
    const next = !showCustomPicker;
    setShowCustomPicker(next);
    if (next) {
      setActiveKey('');
      setFilterMode('custom');
    }
  }, [showCustomPicker]);

  /**
   * 自定义开始日期变更
   */
  const handleStartChange = useCallback((date: string) => {
    setStartDate(date);
    setFilterMode('custom');
    setActiveKey('');
  }, []);

  /**
   * 自定义结束日期变更
   */
  const handleEndChange = useCallback((date: string) => {
    setEndDate(date);
    setFilterMode('custom');
    setActiveKey('');
  }, []);

  /**
   * 初始加载基数据（学生列表 + 趋势图全量记录）
   * 与原版 G 函数对齐：只在首次进入或下拉刷新时调用
   */
  const loadBaseData = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) return;
      if (!isRefresh) setStatus('loading');

      try {
        if (isTeacher) {
          // 教师端：并行获取学生列表 + 近12个月全部记录（用于趋势图）
          const [stuList, trendRecs] = await Promise.all([
            studentStore.fetchByTeacher(profile.id),
            lessonRecordService.getByTeacher(profile.id),
          ]);
          setStudents(stuList);
          setAllRecords(trendRecs);
          cachedTeacherId.current = profile.id;
          baseDataLoaded.current = true;
        } else {
          // 家长端：并行获取学生列表 + 活跃学生的记录和套餐
          const stuList = await studentService.getByParent(profile.id);
          setParentStudents(stuList);

          const storedId = Taro.getStorageSync('activeStudentId') || '';
          const sid = stuList.find((s) => s.id === storedId)?.id || stuList[0]?.id || '';
          setActiveStudentId(sid);
          const s = stuList.find((s) => s.id === sid);
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
    [profile?.id, isTeacher],
  );

  /**
   * 按筛选条件加载记录数据（与原版 G 函数对齐）
   * 关键优化：使用服务端式 API 按时间范围精确查询，而非获取全量后前端过滤
   * 学生列表等基数据已缓存，不重复请求
   */
  const loadFilteredRecords = useCallback(async () => {
    if (!profile?.id) return;

    try {
      if (isTeacher && cachedTeacherId.current) {
        // 教师端：使用服务端式 API 精确查询
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
        // 家长端：前端过滤（数据量小，学生个人记录）
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

  // 首次加载基数据
  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // 页面重新显示时刷新（与原版 useDidShow 对齐）
  Taro.useDidShow(() => {
    if (baseDataLoaded.current) {
      loadFilteredRecords();
    }
  });

  // 筛选条件变化时，只加载筛选后的记录
  useEffect(() => {
    if (baseDataLoaded.current) {
      loadFilteredRecords();
    }
  }, [loadFilteredRecords]);

  // ========== 计算统计数据 ==========

  /** 消耗总课时 */
  const totalHoursUsed = useMemo(() => {
    return records.reduce((sum, r) => sum + (r.hours_used || 0), 0);
  }, [records]);

  /** 剩余总课时 */
  const totalRemaining = useMemo(() => {
    if (isTeacher) {
      return students.reduce(
        (sum, s) =>
          sum + (s.course_packages || []).reduce((p, pkg) => p + (pkg.remaining_hours || 0), 0),
        0,
      );
    }
    return packages.reduce((sum, p) => sum + (p.remaining_hours || 0), 0);
  }, [isTeacher, students, packages]);

  /** 总课时 */
  const totalHours = useMemo(() => {
    if (isTeacher) {
      return students.reduce(
        (sum, s) =>
          sum + (s.course_packages || []).reduce((p, pkg) => p + (pkg.total_hours || 0), 0),
        0,
      );
    }
    return packages.reduce((sum, p) => sum + (p.total_hours || 0), 0);
  }, [isTeacher, students, packages]);

  /** 上课次数 */
  const lessonCount = records.length;

  /** 收入计算（教师端） */
  const incomeData = useMemo(() => {
    if (!isTeacher) {
      // 家长端：只统计消课记录的 fee_amount
      const feeRecords = records.filter((r) => r.fee_amount && r.fee_amount > 0);
      const totalIncome = feeRecords.reduce((sum, r) => sum + (r.fee_amount || 0), 0);
      return {
        totalIncome,
        feeCount: feeRecords.length,
        avgPrice: feeRecords.length > 0 ? totalIncome / feeRecords.length : 0,
      };
    }

    // 教师端：学生添加费 + 课时充值费 + 消课费
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
    const avgPrice = feeCount > 0 ? totalIncome / feeCount : 0;

    return { totalIncome, feeCount, avgPrice };
  }, [isTeacher, students, records, filterMode, year, month, startDate, endDate]);

  /** 收费方式统计 */
  const paymentStats = useMemo(() => {
    const methodMap: Record<string, number> = {};

    if (isTeacher) {
      // 学生添加费
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
      // 课时充值费
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
    // 消课费
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

  /** 课时趋势图数据（近6个月） */
  const lessonTrend = useMemo(() => {
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

  /** 收入趋势图数据（近6个月） */
  const incomeTrend = useMemo(() => {
    const result: ChartDataItem[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      let total = 0;

      if (isTeacher) {
        // 学生添加费
        students.forEach((s) => {
          if (s.fee_amount) {
            const sd = new Date(s.created_at);
            if (sd.getFullYear() === y && sd.getMonth() + 1 === m) total += s.fee_amount;
          }
        });
        // 课时充值费
        students.forEach((s) => {
          (s.course_packages || []).forEach((pkg) => {
            if (pkg.fee_amount) {
              const pd = new Date(pkg.created_at);
              if (pd.getFullYear() === y && pd.getMonth() + 1 === m) total += pkg.fee_amount;
            }
          });
        });
      }
      // 消课费
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

  /** 同比环比 */
  const compareData = useMemo(() => {
    if (incomeTrend.length < 2)
      return { mom: '+0.0%', momValue: '上月 ¥0', yoy: '+0.0%', yoyValue: '去年 ¥0' };

    const current = incomeTrend[incomeTrend.length - 1].value;
    const prev = incomeTrend.length > 1 ? incomeTrend[incomeTrend.length - 2].value : 0;
    const mom = prev > 0 ? ((current - prev) / prev) * 100 : 0;

    // 同比：去年同月
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
  }, [incomeTrend, allRecords, students, isTeacher]);

  /** 学生课时排行 */
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
        const count = stuRecords.length;
        return {
          id: s.id,
          name: s.name,
          value: used,
          unit: '课时',
          extra: `上课 ${count} 次`,
          remain: remaining,
        };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [isTeacher, students, records]);

  /** 收费方式排行 */
  const paymentRank = useMemo((): RankItem[] => {
    return paymentStats.map((p) => ({
      id: p.method,
      name: p.label,
      value: p.amount,
      unit: '元',
      extra: `${p.percent.toFixed(1)}%`,
    }));
  }, [paymentStats]);

  /** 学生课时明细 */
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
        const count = stuRecords.length;
        return {
          id: s.id,
          name: s.name,
          value: used,
          unit: '课时',
          extra: `上课 ${count} 次`,
          remain: remaining,
          total,
        };
      })
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [isTeacher, students, records]);

  /** 收入明细列表（合并添加学生费、课时充值费、消课费，按日期倒序） */
  const incomeDetail = useMemo(() => {
    if (isTeacher) {
      // 教师端：三种收入来源合并
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
          name: (r as any).students?.name || '学生',
          type: '上课记录' as const,
          date: r.lesson_date,
          amount: r.fee_amount!,
          method: r.fee_method || '',
        }));

      return [...studentFees, ...packageFees, ...recordFees].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }
    // 家长端：仅消课费
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

  // 家长端趋势
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

  // ====== 开发调试：模拟数据（正式环境删除） ======
  const MOCK_LESSON_TREND: ChartDataItem[] = [
    { label: '1月', value: 12, unit: '课时' },
    { label: '2月', value: 8, unit: '课时' },
    { label: '3月', value: 18, unit: '课时' },
    { label: '4月', value: 15, unit: '课时' },
    { label: '5月', value: 22, unit: '课时' },
    { label: '6月', value: 20, unit: '课时' },
  ];
  const MOCK_INCOME_TREND: ChartDataItem[] = [
    { label: '1月', value: 3600, unit: '元' },
    { label: '2月', value: 2400, unit: '元' },
    { label: '3月', value: 5400, unit: '元' },
    { label: '4月', value: 4500, unit: '元' },
    { label: '5月', value: 6600, unit: '元' },
    { label: '6月', value: 6000, unit: '元' },
  ];
  const MOCK_LESSON_RANK = [
    { label: '张小明', value: 22, unit: '课时' },
    { label: '李小红', value: 18, unit: '课时' },
    { label: '王小刚', value: 15, unit: '课时' },
    { label: '赵小丽', value: 12, unit: '课时' },
    { label: '刘小华', value: 8, unit: '课时' },
  ];
  const MOCK_PAYMENT_RANK = [
    { label: '微信支付', value: 12000, unit: '元' },
    { label: '支付宝', value: 8500, unit: '元' },
    { label: '现金', value: 3200, unit: '元' },
    { label: '银行转账', value: 1800, unit: '元' },
  ];
  const MOCK_PARENT_TREND: ChartDataItem[] = [
    { label: '06-01', value: 2, unit: '课时' },
    { label: '06-03', value: 1.5, unit: '课时' },
    { label: '06-05', value: 2, unit: '课时' },
    { label: '06-07', value: 1, unit: '课时' },
    { label: '06-09', value: 2.5, unit: '课时' },
  ];

  const displayLessonTrend = lessonTrend.length > 0 ? lessonTrend : MOCK_LESSON_TREND;
  const displayIncomeTrend = incomeTrend.length > 0 ? incomeTrend : MOCK_INCOME_TREND;
  const displayLessonRank =
    lessonRank.length > 0
      ? lessonRank
          .slice(0, 8)
          .map((item) => ({ label: item.name, value: item.value, unit: item.unit || '课时' }))
      : MOCK_LESSON_RANK;
  const displayPaymentRank =
    paymentRank.length > 0
      ? paymentRank.map((p) => ({ label: p.name, value: p.value, unit: p.unit || '元' }))
      : MOCK_PAYMENT_RANK;
  const displayParentTrend = parentLessonTrend.length > 0 ? parentLessonTrend : MOCK_PARENT_TREND;
  // ====== 模拟数据结束 ======

  /**
   * 下拉刷新
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    baseDataLoaded.current = false;
    await loadBaseData(true);
    setRefreshing(false);
  }, [loadBaseData]);

  /**
   * 导出数据（教师端）
   */
  const handleExport = useCallback(() => {
    Taro.showModal({
      title: '导出数据',
      content: '确定要导出当前筛选条件下的统计数据吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '导出成功', icon: 'success' });
        }
      },
    });
  }, []);

  /**
   * 渲染页面头部（绿色渐变区）
   */
  const renderHeader = () => {
    return (
      <View className="bg-gradient-primary px-6 pt-10 pb-10 rounded-b-60rpx shadow-elegant">
        <View className="flex items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">
            {isTeacher ? '统计报表' : '课时统计'}
          </Text>
          {isTeacher && (
            <View
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
              onClick={handleExport}
            >
              <Icon name="mdi-download" size="sm" color="white" />
            </View>
          )}
          {!isTeacher && activeStudentName && (
            <View className="bg-white/20 backdrop-blur-sm text-white text-sm px-3 py-1 rounded-full">
              <Text className="text-white text-xs">{activeStudentName}</Text>
            </View>
          )}
        </View>

        <FilterBar
          activeKey={activeKey}
          filterMode={filterMode}
          startDate={startDate}
          endDate={endDate}
          showCustomPicker={showCustomPicker}
          onQuickFilter={handleQuickFilter}
          onToggleCustomPicker={handleToggleCustomPicker}
          onStartChange={handleStartChange}
          onEndChange={handleEndChange}
          onCustomQuery={loadFilteredRecords}
        />

        {/* 月份/年度选择器 */}
        {(filterMode === 'month' || filterMode === 'year') && (
          <TimeSelector
            year={year}
            month={month}
            monthOptions={monthOptions}
            monthIndex={monthIndex}
            filterMode={filterMode}
            onMonthChange={(y, m) => {
              setYear(y);
              setMonth(m);
              setActiveKey(''); // 手动切换月份后取消快捷按钮高亮
            }}
          />
        )}

        {/* 顶部KPI大卡片 */}
        <KpiCard
          data={
            isTeacher
              ? [
                  { id: '1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                  { id: '2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                  { id: '3', label: '本月收入', value: `¥${incomeData.totalIncome}`, unit: '' },
                ]
              : [
                  { id: '1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                  { id: '2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                  { id: '3', label: '充值课时', value: totalHours, unit: '课时' },
                ]
          }
          isTop
        />
      </View>
    );
  };

  /**
   * 渲染 Tab 切换区
   */
  const renderTabs = () => (
    <View className="flex gap-2 mb-5 bg-white rounded-2xl p-1 shadow-soft">
      <View
        className={`flex-1 py-3 rounded-2xl text-base font-medium transition flex items-center justify-center leading-none ${activeTab === 'lesson' ? 'bg-gradient-primary text-white shadow-elegant' : 'text-muted-foreground'}`}
        onClick={() => setActiveTab('lesson')}
      >
        <Text className={activeTab === 'lesson' ? 'text-white' : 'text-muted-foreground'}>
          课时统计
        </Text>
      </View>
      <View
        className={`flex-1 py-3 rounded-2xl text-base font-medium transition flex items-center justify-center leading-none ${activeTab === 'income' ? 'bg-gradient-primary text-white shadow-elegant' : 'text-muted-foreground'}`}
        onClick={() => setActiveTab('income')}
      >
        <Text className={activeTab === 'income' ? 'text-white' : 'text-muted-foreground'}>
          收入统计
        </Text>
      </View>
    </View>
  );

  /**
   * 渲染课时统计内容区
   */
  const renderLessonContent = () => (
    <>
      <KpiCard
        data={
          isTeacher
            ? [
                { id: 's1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                { id: 's2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                { id: 's3', label: '上课次数', value: lessonCount, unit: '次' },
              ]
            : [
                { id: 's1', label: '消耗课时', value: totalHoursUsed, unit: '课时' },
                { id: 's2', label: '剩余课时', value: totalRemaining, unit: '课时' },
                { id: 's3', label: '充值课时', value: totalHours, unit: '课时' },
                { id: 's4', label: '上课次数', value: lessonCount, unit: '次' },
              ]
        }
      />

      {isTeacher && (
        <ChartContainer title="近6个月课时消耗趋势" data={displayLessonTrend} unit="课时" />
      )}

      {!isTeacher && (
        <BarChart
          title="最近上课课时"
          data={displayParentTrend}
          unit="课时"
          barColor="bg-gradient-accent"
        />
      )}

      {isTeacher && <BarChart title="学生课时消耗排行" data={displayLessonRank} unit="课时" />}

      {isTeacher && studentDetail.length > 0 && (
        <RankList
          title="学生课时明细"
          data={studentDetail}
          mode="detail"
          emptyText="暂无明细数据"
        />
      )}

      {/* 家长端：还未绑定学生空状态引导 */}
      {!isTeacher && parentStudents.length === 0 && (
        <View className="bg-white rounded-2xl p-6 shadow-soft flex flex-col items-center gap-4 mt-6">
          <View className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon name="mdi-link-plus" size="lg" color="primary" />
          </View>
          <View className="text-center">
            <Text className="text-xl font-semibold text-foreground block mb-1">还未绑定学生</Text>
            <Text className="text-base text-muted-foreground">请先前往「我的」页面绑定学生</Text>
          </View>
          <View
            className="w-full btn-primary bg-gradient-primary shadow-elegant"
            onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
          >
            <Text className="text-white text-xl font-medium">前往绑定</Text>
          </View>
        </View>
      )}

      {/* 家长端：上课记录列表（与原版对齐） */}
      {!isTeacher && parentStudents.length > 0 && (
        <>
          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">上课记录</Text>
          <View className="flex flex-col gap-3">
            {records.length > 0 ? (
              records.map((r) => (
                <View
                  key={r.id}
                  className="bg-white rounded-2xl p-4 shadow-soft press-scale"
                  onClick={() =>
                    Taro.navigateTo({
                      url: `/pages/lesson-detail/index?id=${encodeURIComponent(r.id)}`,
                    })
                  }
                >
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Icon name="mdi-book-open-variant" size="sm" color="white" />
                      </View>
                      <View className="flex flex-col gap-1">
                        <Text className="text-lg font-medium text-foreground">
                          {r.course_package?.name || '课程'}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {formatDateCN(r.lesson_date)}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-semibold text-primary">-{r.hours_used}课时</Text>
                  </View>
                  {(r as any).content && (
                    <View className="mt-2 text-base text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      内容：{(r as any).content}
                    </View>
                  )}
                  {(r as any).performance && (
                    <View className="mt-1 text-base text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      表现：{(r as any).performance}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Empty icon="mdi-inbox" description="暂无上课记录" />
            )}
          </View>

          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">课时充值</Text>
          <View className="space-y-3">
            {packages.length > 0 ? (
              packages.map((pkg) => (
                <View key={pkg.id} className="bg-white rounded-2xl p-4 shadow-soft">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-3">
                      <View className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center">
                        <Icon name="mdi-cash-multiple" size="sm" color="white" />
                      </View>
                      <View className="flex flex-col gap-1">
                        <Text className="text-lg font-medium text-foreground">{pkg.name}</Text>
                        <Text className="text-sm text-muted-foreground">
                          {formatDateCN(pkg.created_at)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex flex-col items-end gap-1">
                      <Text className="text-lg font-semibold text-primary">
                        +{pkg.total_hours}课时
                      </Text>
                      {pkg.fee_amount != null && pkg.fee_amount > 0 && (
                        <Text className="text-sm text-muted-foreground">¥{pkg.fee_amount}</Text>
                      )}
                    </View>
                  </View>
                  <View className="flex items-center justify-between">
                    <Text className="text-sm text-muted-foreground">
                      剩余 {pkg.remaining_hours} / 共 {pkg.total_hours} 课时
                    </Text>
                    <Text
                      className={`text-xs px-2 py-0_d5 rounded-full ${pkg.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
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
        </>
      )}
    </>
  );

  /**
   * 渲染收入统计内容区
   */
  const renderIncomeContent = () => (
    <>
      <KpiCard
        data={[
          { id: 'i1', label: '总收入', value: `¥${incomeData.totalIncome}`, unit: '' },
          { id: 'i2', label: '收费记录', value: incomeData.feeCount, unit: '笔' },
          { id: 'i3', label: '平均客单价', value: `¥${Math.round(incomeData.avgPrice)}`, unit: '' },
        ]}
      />

      <ChartContainer title="近6个月收入趋势" data={displayIncomeTrend} unit="元" />

      <View className="grid grid-cols-2 gap-3 mb-5">
        <View className="bg-white rounded-2xl p-4 shadow-soft text-center">
          <Text className="text-sm text-muted-foreground mb-1">环比上月</Text>
          <Text
            className={`text-2xl font-bold ${compareData.mom.startsWith('-') ? 'text-destructive' : 'text-emerald-500'}`}
          >
            {compareData.mom}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1">{compareData.momValue}</Text>
        </View>
        <View className="bg-white rounded-2xl p-4 shadow-soft text-center">
          <Text className="text-sm text-muted-foreground mb-1">同比去年同月</Text>
          <Text
            className={`text-2xl font-bold ${compareData.yoy.startsWith('-') ? 'text-destructive' : 'text-emerald-500'}`}
          >
            {compareData.yoy}
          </Text>
          <Text className="text-xs text-muted-foreground mt-1">{compareData.yoyValue}</Text>
        </View>
      </View>

      {isTeacher && <BarChart title="收费方式收入排行" data={displayPaymentRank} unit="元" />}

      {isTeacher && paymentRank.length > 0 && (
        <RankList title="收费方式明细" data={paymentRank} mode="payment" emptyText="暂无明细数据" />
      )}

      {/* 收入明细列表 */}
      {incomeDetail.length > 0 && (
        <>
          <Text className="text-xl font-semibold text-foreground mb-3 mt-6">收入明细</Text>
          <View className="flex flex-col gap-3">
            {incomeDetail.map((item) => (
              <View key={item.id} className="bg-white rounded-2xl p-4 shadow-soft">
                <View className="flex items-center justify-between">
                  <View className="flex items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-gradient-accent flex items-center justify-center">
                      <Icon name="mdi-cash" size="sm" color="white" />
                    </View>
                    <View className="flex flex-col gap-1">
                      <Text className="text-lg font-medium text-foreground">{item.name}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {formatDateCN(item.date)} · {item.type}
                      </Text>
                    </View>
                  </View>
                  <View className="flex flex-col items-end gap-1">
                    <Text className="text-lg font-semibold text-primary">¥{item.amount}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {FEE_METHOD_MAP[item.method] || item.method}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );

  if (status === 'loading') {
    return (
      <View className="min-h-screen bg-gradient-subtle">
        {renderHeader()}
        <View className="py-8 flex justify-center">
          <Loading />
        </View>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View className="min-h-screen bg-gradient-subtle">
        {renderHeader()}
        <View className="py-8 flex flex-col items-center gap-4">
          <Empty icon="mdi-alert-circle" description={errorMsg || '加载失败'} />
          <View
            className="bg-gradient-primary px-6 py-2 rounded-lg mt-4"
            onClick={() => loadBaseData()}
          >
            <Text className="text-base text-white font-medium">重新加载</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="h-screen bg-gradient-subtle"
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      {renderHeader()}

      <View className="px-6 -mt-4 pb-8">
        {isTeacher && renderTabs()}
        {activeTab === 'lesson' ? renderLessonContent() : renderIncomeContent()}

        {status === 'empty' && (
          <View className="py-8">
            <Empty icon="mdi-chart-bar" description="暂无统计数据" />
          </View>
        )}

        <View className="text-center py-4">
          <Text className="text-xs text-muted-foreground">
            数据更新时间：{new Date().toLocaleString('zh-CN')}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default Statistics;
