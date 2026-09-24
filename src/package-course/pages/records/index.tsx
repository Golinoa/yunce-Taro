import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import Empty from '@/components/Empty';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  navigateToLessonDetail,
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
  const [filterStudentId, setFilterStudentId] = useState('all');

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
      setFilterStudentId((currentId) =>
        currentId === 'all' || relatedStudents.some((student) => student.id === currentId)
          ? currentId
          : 'all',
      );
    } catch (err) {
      logError('load records', err);
      setRecords([]);
      setStudents([]);
      setLoadError('上课记录加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [profile, isTeacher, routeStudentId, fetchStudentsByTeacher]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRecords = useMemo(() => {
    let result = records;
    result = result.filter(
      (r) => r.lesson_date >= dateRange.start && r.lesson_date <= dateRange.end,
    );
    if (filterStudentId !== 'all') {
      result = result.filter((r) => r.student_id === filterStudentId);
    }
    return result;
  }, [records, dateRange, filterStudentId]);

  const consumptionSections = useMemo(
    () => buildLessonConsumptionSections(filteredRecords),
    [filteredRecords],
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

        {/* 多孩筛选（教师 / 家长） */}
        {students.length > 1 && (
          <ScrollView scrollX showScrollbar={false} className="mt-[12rpx] whitespace-nowrap">
            <View className="inline-flex flex-row gap-[12rpx] pr-[24rpx]">
              <View
                className={filterPillClass(filterStudentId === 'all')}
                onClick={() => setFilterStudentId('all')}
              >
                <Text className={filterPillTextClass(filterStudentId === 'all')}>全部</Text>
              </View>
              {students.map((s) => (
                <View
                  key={s.id}
                  className={cn(filterPillClass(filterStudentId === s.id), 'shrink-0')}
                  onClick={() => setFilterStudentId(s.id)}
                >
                  <Text className={filterPillTextClass(filterStudentId === s.id)}>{s.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
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
