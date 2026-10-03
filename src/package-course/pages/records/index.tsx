import { View, Text, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  navigateToLessonDetail,
  type StudentHoursOverride,
} from '@/components/lesson/LessonConsumptionList';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { studentService, lessonRecordService } from '@/services';
import { useStudentStore } from '@/stores';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 快捷日期范围 */
type QuickRange = 'week' | 'month' | 'all' | 'custom';

/** 快捷日期筛选标签（导航栏下方标签条，参考「我的预约」） */
const QUICK_RANGE_OPTIONS: { key: QuickRange; label: string }[] = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
];

/** 筛选胶囊样式（与「我的预约」状态标签一致：激活 bg-primary，未激活 bg-card） */
const filterPillClass = (active: boolean) =>
  cn('rounded-full px-[28rpx] py-[12rpx]', active ? 'bg-primary' : 'bg-card');
const filterPillTextClass = (active: boolean) =>
  cn('text-[24rpx]', active ? 'font-semibold text-primary-foreground' : 'text-muted-foreground');

interface DateRange {
  start: string;
  end: string;
}

function getWeekRange(): DateRange {
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day + 1);
  const end = new Date(now);
  end.setDate(now.getDate() + (7 - day));
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function getMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

const RecordsPage: React.FC = () => {
  const { profile } = useAuth();
  const isTeacher = isStaffRole(profile?.currentContext?.role);
  const fetchStudentsByTeacher = useStudentStore((state) => state.fetchByTeacher);

  const routeStudentId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.studentId || '');
  }, []);

  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const { loading, setLoading } = useDelayedLoading();
  const [loadError, setLoadError] = useState('');

  const [quickRange, setQuickRange] = useState<QuickRange>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [datePickerField, setDatePickerField] = useState<'start' | 'end' | null>(null);
  /** 学员搜索关键词（教师名下学员多，用搜索定位而不是一排标签） */
  const [studentKeyword, setStudentKeyword] = useState('');
  /** 下拉联想是否展开（输入/聚焦时展开，选中或清空时收起） */
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  /**
   * 学员级课时（学员 id → 总/已用/剩余）。
   * 消课记录本身**不带剩余课时**，没有它「共 Y 课时」只能退化成「已用 = 共」（曾显示成 1/1）。
   */
  const [studentHoursMap, setStudentHoursMap] = useState<Record<string, StudentHoursOverride>>({});

  const dateRange = useMemo<DateRange>(() => {
    if (quickRange === 'week') return getWeekRange();
    if (quickRange === 'month') return getMonthRange();
    if (quickRange === 'all') return { start: '1970-01-01', end: '2099-12-31' };
    return {
      start: customStart || '1970-01-01',
      end: customEnd || '2099-12-31',
    };
  }, [quickRange, customStart, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    if (!profile?.id) {
      setRecords([]);
      setStudents([]);
      setLoadError('未获取到登录信息，请重新进入页面');
      setLoading(false);
      return;
    }

    try {
      let allRecords: LessonRecord[] = [];
      let relatedStudents: Student[] = [];

      if (isTeacher) {
        relatedStudents = await fetchStudentsByTeacher(profile.id);
        const recordGroups = await Promise.all(
          relatedStudents.map((student) => lessonRecordService.getByStudent(student.id)),
        );
        allRecords = recordGroups.flat();
      } else {
        relatedStudents = await studentService.getByParent(profile.id);
        if (
          routeStudentId &&
          relatedStudents.length > 0 &&
          !relatedStudents.some((student) => student.id === routeStudentId)
        ) {
          setRecords([]);
          setStudents(relatedStudents);
          setLoadError('未找到对应学员的上课记录');
          return;
        }
        if (routeStudentId) {
          allRecords = await lessonRecordService.getByStudent(routeStudentId);
        } else if (relatedStudents.length > 0) {
          const recordGroups = await Promise.all(
            relatedStudents.map((student) => lessonRecordService.getByStudent(student.id)),
          );
          allRecords = recordGroups.flat();
        }
      }

      allRecords.sort(
        (a, b) => new Date(b.lesson_date).getTime() - new Date(a.lesson_date).getTime(),
      );
      setRecords(allRecords);
      setStudents(relatedStudents);
    } catch (err) {
      logError('load records', err);
      setRecords([]);
      setStudents([]);
      setLoadError('上课记录加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [profile, isTeacher, routeStudentId, fetchStudentsByTeacher]);

  /**
   * 学员课时：按当前记录涉及到的学员去重后取汇总。
   * 口径与后端 `utils/lesson-hours` 一致（卡上快照 totalCount 优先、含赠送）。
   *
   * ⚠️ 2026-10-03：原来失败是 `catch { return null }` **静默吞掉**，
   * 拿不到汇总时组件会退化成「已用 = 共」（显示成「已用1 / 共1」），用户完全看不出出了错。
   * 现在：失败只记日志（不打断页面），但**不把失败当成 0**——
   * 汇总缺失时让组件走「按记录自身口径」的诚实回退，而不是伪造等值。
   */
  useEffect(() => {
    const studentIds = Array.from(
      new Set(records.map((record) => record.student_id).filter((id): id is string => Boolean(id))),
    );
    if (studentIds.length === 0) {
      setStudentHoursMap((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }
    let cancelled = false;
    void Promise.all(
      studentIds.map(async (studentId) => {
        try {
          return [studentId, await studentService.getHours(studentId)] as const;
        } catch (error) {
          // 单个学员失败不影响其他学员，也不打断页面；但必须留痕，便于定位「共1」这类问题
          logError(`records.loadStudentHours(${studentId})`, error);
          return null;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, StudentHoursOverride> = {};
      pairs.forEach((pair) => {
        if (pair) next[pair[0]] = pair[1];
      });
      setStudentHoursMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [records]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    let result = records;
    result = result.filter(
      (r) => r.lesson_date >= dateRange.start && r.lesson_date <= dateRange.end,
    );
    const kw = studentKeyword.trim();
    if (kw) {
      const matchedIds = new Set(
        students.filter((student) => student.name?.includes(kw)).map((student) => student.id),
      );
      result = result.filter((r) => matchedIds.has(r.student_id));
    }
    return result;
  }, [records, dateRange, studentKeyword, students]);

  /** 搜索候选：按姓名模糊匹配；点选其中一个即精确筛选到人（避免同名混在一起） */
  const studentCandidates = useMemo(() => {
    const keyword = studentKeyword.trim();
    if (!keyword) return [];
    return students.filter((student) => student.name?.includes(keyword));
  }, [students, studentKeyword]);

  const consumptionSections = useMemo(
    () => buildLessonConsumptionSections(filteredRecords, { studentHours: studentHoursMap }),
    [filteredRecords, studentHoursMap],
  );

  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
    const uniqueStudents = new Set(filteredRecords.map((r) => r.student_id)).size;
    return { totalCount, totalHours, uniqueStudents };
  }, [filteredRecords]);

  const handleQuickChange = useCallback((range: QuickRange) => {
    setQuickRange(range);
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载记录中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle px-4 flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={loadData}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-muted">
      {/* 筛选标签条：吸附在导航栏正下方（参考「我的预约」状态标签条） */}
      <View className="sticky top-0 z-10 bg-muted px-[24rpx] pt-[16rpx] pb-[8rpx]">
        <ScrollView scrollX showScrollbar={false} className="whitespace-nowrap">
          <View className="inline-flex flex-row items-center gap-[12rpx] pr-[24rpx]">
            {QUICK_RANGE_OPTIONS.map((item) => (
              <View
                key={item.key}
                className={filterPillClass(quickRange === item.key)}
                onClick={() => handleQuickChange(item.key)}
              >
                <Text className={filterPillTextClass(quickRange === item.key)}>{item.label}</Text>
              </View>
            ))}
            <View
              className={filterPillClass(quickRange === 'custom')}
              onClick={() => setDatePickerField('start')}
            >
              <Text className={filterPillTextClass(quickRange === 'custom')}>
                {customStart || '开始'}
              </Text>
            </View>
            <Text className="px-[4rpx] text-[24rpx] text-muted-foreground">~</Text>
            <View
              className={filterPillClass(quickRange === 'custom')}
              onClick={() => setDatePickerField('end')}
            >
              <Text className={filterPillTextClass(quickRange === 'custom')}>
                {customEnd || '结束'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* 学员搜索（多学员：教师名下学员多，用搜索定位到人） */}
        {students.length > 1 && (
          <View className="mt-[12rpx]">
            <View className="flex flex-row items-center gap-[12rpx] rounded-full bg-card px-[24rpx] py-[14rpx]">
              <Icon name="mdi-magnify" size={20} color="mutedForeground" />
              <Input
                className="h-[44rpx] flex-1 text-[24rpx]"
                value={studentKeyword}
                placeholder="搜索学员"
                placeholderClass="text-muted-foreground"
                onInput={(event) => {
                  setStudentKeyword(event.detail.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => {
                  setTimeout(() => setSuggestionsOpen(false), 200);
                }}
              />
              {studentKeyword && (
                <View
                  className="shrink-0"
                  onClick={() => {
                    setStudentKeyword('');
                    setSuggestionsOpen(false);
                  }}
                >
                  <Icon name="mdi-close" size={20} color="mutedForeground" />
                </View>
              )}
            </View>

            {/* 下拉联想：一行一行文字，选中即把姓名植入搜索框并直接过滤数据 */}
            {suggestionsOpen && studentKeyword.trim() && (
              <View className="mt-[10rpx] rounded-card bg-card shadow-soft overflow-hidden">
                {studentCandidates.length > 0 ? (
                  studentCandidates.map((student, idx) => (
                    <View
                      key={student.id}
                      className={cn(
                        'flex flex-row items-center gap-[16rpx] px-[24rpx] py-[20rpx] active:bg-muted',
                        idx < studentCandidates.length - 1 && 'border-b border-input',
                      )}
                      onClick={() => {
                        setStudentKeyword(student.name);
                        setSuggestionsOpen(false);
                      }}
                    >
                      <Icon name="mdi-magnify" size={18} color="mutedForeground" />
                      <Text className="text-[26rpx] text-foreground">{student.name}</Text>
                    </View>
                  ))
                ) : (
                  <View className="px-[24rpx] py-[20rpx]">
                    <Text className="text-[24rpx] text-muted-foreground">没有匹配的学员</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 统计摘要 */}
      {filteredRecords.length > 0 && (
        <View className="mx-[24rpx] mb-[12rpx] flex items-center justify-around rounded-card bg-card px-[28rpx] py-[24rpx] shadow-soft">
          <View className="flex flex-col items-center gap-[4rpx]">
            <Text className="text-[40rpx] font-bold text-primary">{stats.totalCount}</Text>
            <Text className="text-sm text-muted-foreground">消课次数</Text>
          </View>
          <View className="w-[2rpx] h-[48rpx] bg-input" />
          <View className="flex flex-col items-center gap-[4rpx]">
            <Text className="text-[40rpx] font-bold text-primary">{stats.totalHours}</Text>
            <Text className="text-sm text-muted-foreground">消耗课时</Text>
          </View>
          <View className="w-[2rpx] h-[48rpx] bg-input" />
          <View className="flex flex-col items-center gap-[4rpx]">
            <Text className="text-[40rpx] font-bold text-primary">{stats.uniqueStudents}</Text>
            <Text className="text-sm text-muted-foreground">涉及学生</Text>
          </View>
        </View>
      )}

      {/* 记录列表 */}
      {filteredRecords.length === 0 ? (
        <Empty icon="mdi-history" description="暂无上课记录" />
      ) : (
        <View className="px-[24rpx] pb-[24rpx]">
          <LessonConsumptionList
            sections={consumptionSections}
            onRecordClick={navigateToLessonDetail}
          />
        </View>
      )}

      <DatePickerSheet
        visible={Boolean(datePickerField)}
        title={datePickerField === 'end' ? '选择结束日期' : '选择开始日期'}
        value={
          datePickerField === 'end'
            ? customEnd || new Date().toISOString().split('T')[0]
            : customStart || new Date().toISOString().split('T')[0]
        }
        onClose={() => setDatePickerField(null)}
        onConfirm={(date) => {
          if (datePickerField === 'end') setCustomEnd(date);
          else setCustomStart(date);
          setQuickRange('custom');
          setDatePickerField(null);
        }}
      />
    </PageContainer>
  );
};

export default withRouteGuard(RecordsPage);
