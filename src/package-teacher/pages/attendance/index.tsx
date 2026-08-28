import { View, Text, Picker } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import LessonConsumptionList, {
  buildLessonConsumptionSections,
  navigateToLessonDetail,
} from '@/components/lesson/LessonConsumptionList';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import FilterBar from '@/components/teacher/FilterBar';
import { lessonRecordService, teacherService } from '@/services';
import type { LessonRecord } from '@/types/lesson-record';
import type { TeacherUIModel } from '@/types/teacher';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type QuickRange = 'week' | 'month' | 'all' | 'custom';

interface DateRange {
  start: string;
  end: string;
}

const DATE_OPTIONS: { label: string; value: QuickRange }[] = [
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '全部', value: 'all' },
  { label: '自定义', value: 'custom' },
];

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

/** 校长考勤记录页面 - 按日期/教师/班级维度查看全校上课情况 */
const AttendancePage: React.FC = () => {
  const router = useRouter();
  const presetClassId = String(router.params?.classId || '').trim();
  const presetClassName = decodeURIComponent(String(router.params?.className || '').trim());

  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [quickRange, setQuickRange] = useState<QuickRange>(presetClassId ? 'all' : 'month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('all');
  const [filterClassId, setFilterClassId] = useState(presetClassId || 'all');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [customDateVisible, setCustomDateVisible] = useState(false);
  const [tempCustomStart, setTempCustomStart] = useState('');
  const [tempCustomEnd, setTempCustomEnd] = useState('');

  useEffect(() => {
    if (presetClassName) {
      Taro.setNavigationBarTitle({ title: `${presetClassName} · 签到历史` });
    }
  }, [presetClassName]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allRecords, teacherList] = await Promise.all([
        lessonRecordService.getAll(),
        teacherService.getList(),
      ]);
      setRecords(allRecords);
      setTeachers(teacherList);
    } catch (err) {
      logError('load attendance', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 从记录中提取班级选项；课表深链带入的班级即使暂无记录也要出现在筛选项
  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      if (r.class_id && r.class_name) {
        map.set(r.class_id, r.class_name);
      }
    });
    if (presetClassId && !map.has(presetClassId)) {
      map.set(presetClassId, presetClassName || '当前班级');
    }
    return [
      { label: '全部班级', value: 'all' },
      ...Array.from(map).map(([id, name]) => ({ label: name, value: id })),
    ];
  }, [presetClassId, presetClassName, records]);

  const teacherOptions = useMemo(() => {
    return [
      { label: '全部教师', value: 'all' },
      ...teachers.map((t) => ({ label: t.name, value: t.id })),
    ];
  }, [teachers]);

  const teacherIndex = useMemo(
    () =>
      Math.max(
        0,
        teacherOptions.findIndex((o) => o.value === filterTeacherId),
      ),
    [teacherOptions, filterTeacherId],
  );

  const classIndex = useMemo(
    () =>
      Math.max(
        0,
        classOptions.findIndex((o) => o.value === filterClassId),
      ),
    [classOptions, filterClassId],
  );

  const dateRange = useMemo<DateRange>(() => {
    if (quickRange === 'week') return getWeekRange();
    if (quickRange === 'month') return getMonthRange();
    if (quickRange === 'all') return { start: '1970-01-01', end: '2099-12-31' };
    return { start: customStart || '1970-01-01', end: customEnd || '2099-12-31' };
  }, [quickRange, customStart, customEnd]);

  const dateLabel = useMemo(() => {
    const option = DATE_OPTIONS.find((o) => o.value === quickRange);
    if (quickRange === 'custom' && customStart && customEnd) {
      return `${customStart} ~ ${customEnd}`;
    }
    return option?.label ?? '本月';
  }, [quickRange, customStart, customEnd]);

  const attendanceFilterConfig = useMemo(
    () => [
      {
        id: 'date',
        label: dateLabel,
        value: quickRange,
        options: DATE_OPTIONS.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
      {
        id: 'teacher',
        label: teacherOptions[teacherIndex]?.label || '全部教师',
        value: filterTeacherId,
        options: teacherOptions,
      },
      {
        id: 'class',
        label: classOptions[classIndex]?.label || '全部班级',
        value: filterClassId,
        options: classOptions,
      },
    ],
    [
      classIndex,
      classOptions,
      dateLabel,
      filterClassId,
      filterTeacherId,
      quickRange,
      teacherIndex,
      teacherOptions,
    ],
  );

  const handleFilterToggle = useCallback((id: string) => {
    setActiveFilterId((prev) => (prev === id ? null : id));
  }, []);

  const handleFilterSelect = useCallback(
    (id: string, value: string) => {
      if (id === 'date') {
        setActiveFilterId(null);
        if (value === 'custom') {
          setTempCustomStart(customStart || '');
          setTempCustomEnd(customEnd || '');
          setCustomDateVisible(true);
          return;
        }
        setQuickRange(value as QuickRange);
        return;
      }

      if (id === 'teacher') {
        setFilterTeacherId(value);
      }

      if (id === 'class') {
        setFilterClassId(value);
      }

      setActiveFilterId(null);
    },
    [customEnd, customStart],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const inDate = r.lesson_date >= dateRange.start && r.lesson_date <= dateRange.end;
      const matchTeacher = filterTeacherId === 'all' || r.teacher_id === filterTeacherId;
      const matchClass = filterClassId === 'all' || r.class_id === filterClassId;
      return inDate && matchTeacher && matchClass;
    });
  }, [records, dateRange, filterTeacherId, filterClassId]);

  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
    const uniqueTeachers = new Set(filteredRecords.map((r) => r.teacher_id)).size;
    const uniqueStudents = new Set(filteredRecords.map((r) => r.student_id)).size;
    return { totalCount, totalHours, uniqueTeachers, uniqueStudents };
  }, [filteredRecords]);

  const teacherNameMap = useMemo(
    () =>
      teachers.reduce<Record<string, string>>((result, teacher) => {
        result[teacher.id] = teacher.name;
        return result;
      }, {}),
    [teachers],
  );

  const consumptionSections = useMemo(
    () => buildLessonConsumptionSections(filteredRecords, { teacherNameMap }),
    [filteredRecords, teacherNameMap],
  );

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-[200rpx]">
          <Loading text="加载考勤中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle pb-6">
        {/* ====== 渐变头部 ====== */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <Text className="text-3xl font-bold text-white">考勤记录</Text>
          <Text className="text-sm text-white/70 mt-2">按日期/教师/班级查看全校上课情况</Text>

          {/* 统计摘要 */}
          <View className="mt-5 rounded-[24rpx] px-4 py-4 flex items-center justify-around bg-white/20 backdrop-blur-sm">
            <View className="flex flex-col items-center gap-[4rpx]">
              <Text className="text-[40rpx] font-bold text-white">{stats.totalCount}</Text>
              <Text className="text-xs text-white/80">上课次数</Text>
            </View>
            <View className="w-px h-[48rpx] bg-white/25" />
            <View className="flex flex-col items-center gap-[4rpx]">
              <Text className="text-[40rpx] font-bold text-white">{stats.totalHours}</Text>
              <Text className="text-xs text-white/80">消耗课时</Text>
            </View>
            <View className="w-px h-[48rpx] bg-white/25" />
            <View className="flex flex-col items-center gap-[4rpx]">
              <Text className="text-[40rpx] font-bold text-white">{stats.uniqueTeachers}</Text>
              <Text className="text-xs text-white/80">教师数</Text>
            </View>
            <View className="w-px h-[48rpx] bg-white/25" />
            <View className="flex flex-col items-center gap-[4rpx]">
              <Text className="text-[40rpx] font-bold text-white">{stats.uniqueStudents}</Text>
              <Text className="text-xs text-white/80">学生数</Text>
            </View>
          </View>
        </View>

        {/* ====== 筛选栏：复用教师管理同款组件 ====== */}
        <View className="px-5 relative z-10 mt-[-24rpx]">
          <FilterBar
            filters={attendanceFilterConfig}
            activeId={activeFilterId}
            onToggle={handleFilterToggle}
            onSelect={handleFilterSelect}
          />
        </View>

        {/* ====== 考勤列表 ====== */}
        <View className="px-[32rpx] mt-[24rpx]" onClick={() => setActiveFilterId(null)}>
          <LessonConsumptionList
            sections={consumptionSections}
            emptyText="暂无考勤记录"
            onRecordClick={navigateToLessonDetail}
          />
        </View>

        {/* 自定义日期弹窗 */}
        <BottomSheet
          visible={customDateVisible}
          title="自定义时间范围"
          onClose={() => setCustomDateVisible(false)}
          maxHeight="55vh"
        >
          <View className="px-5 py-4">
            <View className="flex flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-sm text-muted-foreground mb-2">开始日期</Text>
                <Picker
                  mode="date"
                  value={tempCustomStart || ''}
                  onChange={(e) => setTempCustomStart(e.detail.value)}
                >
                  <View className="flex items-center justify-between px-4 py-3 bg-input rounded-2xl">
                    <Text className="text-sm font-medium text-foreground">
                      {tempCustomStart || '请选择'}
                    </Text>
                    <Icon name="mdi-calendar" size={18} className="text-muted-foreground" />
                  </View>
                </Picker>
              </View>
              <Text className="text-sm text-muted-foreground pt-6">~</Text>
              <View className="flex-1">
                <Text className="text-sm text-muted-foreground mb-2">结束日期</Text>
                <Picker
                  mode="date"
                  value={tempCustomEnd || ''}
                  onChange={(e) => setTempCustomEnd(e.detail.value)}
                >
                  <View className="flex items-center justify-between px-4 py-3 bg-input rounded-2xl">
                    <Text className="text-sm font-medium text-foreground">
                      {tempCustomEnd || '请选择'}
                    </Text>
                    <Icon name="mdi-calendar" size={18} className="text-muted-foreground" />
                  </View>
                </Picker>
              </View>
            </View>
            <View className="flex flex-row gap-3 mt-6">
              <View
                className="flex-1 py-3 rounded-full border border-input flex items-center justify-center"
                onClick={() => setCustomDateVisible(false)}
              >
                <Text className="text-sm font-medium text-foreground">取消</Text>
              </View>
              <View
                className="flex-1 py-3 rounded-full bg-primary flex items-center justify-center"
                onClick={() => {
                  if (tempCustomStart && tempCustomEnd) {
                    setCustomStart(tempCustomStart);
                    setCustomEnd(tempCustomEnd);
                    setQuickRange('custom');
                    setCustomDateVisible(false);
                  }
                }}
              >
                <Text className="text-sm font-medium text-white">确定</Text>
              </View>
            </View>
          </View>
        </BottomSheet>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(AttendancePage);
