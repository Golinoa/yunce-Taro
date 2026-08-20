import { View, Text, Picker } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { studentService, lessonRecordService } from '@/services';
import { useStudentStore } from '@/stores';
import type { LessonRecord } from '@/types/lesson-record';
import type { Student } from '@/types/student';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 快捷日期范围 */
type QuickRange = 'week' | 'month' | 'all' | 'custom';

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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const ds = d.toISOString().split('T')[0];
  if (ds === today.toISOString().split('T')[0]) return '今天';
  if (ds === yesterday.toISOString().split('T')[0]) return '昨天';

  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekDays[d.getDay()]}`;
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
          allRecords = await lessonRecordService.getByStudent(relatedStudents[0].id);
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
    if (isTeacher && filterStudentId !== 'all') {
      result = result.filter((r) => r.student_id === filterStudentId);
    }
    return result;
  }, [records, dateRange, isTeacher, filterStudentId]);

  const grouped = useMemo(() => {
    const map: Record<string, LessonRecord[]> = {};
    for (const r of filteredRecords) {
      const key = r.lesson_date;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filteredRecords]);

  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.hours_used || 0), 0);
    const uniqueStudents = new Set(filteredRecords.map((r) => r.student_id)).size;
    return { totalCount, totalHours, uniqueStudents };
  }, [filteredRecords]);

  const handleQuickChange = useCallback((range: QuickRange) => {
    setQuickRange(range);
  }, []);

  const goDetail = useCallback((id: string) => {
    Taro.navigateTo({
      url: `/package-course/pages/lesson-detail/index?id=${encodeURIComponent(id)}`,
    });
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
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle pb-6">
        {/* 渐变头部 */}
        <View className="bg-gradient-primary px-5 pt-10 pb-5">
          <View className="flex items-center justify-between">
            <Text className="text-2xl font-bold text-white">上课记录</Text>
          </View>
          {/* 快捷日期标签 */}
          <View className="flex items-center gap-[12rpx] mt-3 flex-wrap">
            {(
              [
                { key: 'week', label: '本周' },
                { key: 'month', label: '本月' },
                { key: 'all', label: '全部' },
              ] as { key: QuickRange; label: string }[]
            ).map((item) => (
              <View
                key={item.key}
                className={`py-[12rpx] px-3 rounded-round border transition-all ${quickRange === item.key ? 'bg-white/30 border-transparent' : 'bg-white/15 border-white/20'}`}
                onClick={() => handleQuickChange(item.key)}
              >
                <Text
                  className={`text-sm font-medium ${quickRange === item.key ? 'text-white' : 'text-white/80'}`}
                >
                  {item.label}
                </Text>
              </View>
            ))}
            <Picker
              mode="date"
              value={customStart || ''}
              onChange={(e) => {
                setCustomStart(e.detail.value);
                setQuickRange('custom' as QuickRange);
              }}
            >
              <View
                className={`py-[12rpx] px-3 rounded-round border transition-all ${quickRange === 'custom' ? 'bg-white/30 border-transparent' : 'bg-white/15 border-white/20'}`}
              >
                <Text
                  className={`text-sm font-medium ${quickRange === 'custom' ? 'text-white' : 'text-white/80'}`}
                >
                  {customStart || '开始'}
                </Text>
              </View>
            </Picker>
            <Text className="text-sm text-white/60 px-[4rpx]">~</Text>
            <Picker
              mode="date"
              value={customEnd || ''}
              onChange={(e) => {
                setCustomEnd(e.detail.value);
                setQuickRange('custom' as QuickRange);
              }}
            >
              <View
                className={`py-[12rpx] px-3 rounded-round border transition-all ${quickRange === 'custom' ? 'bg-white/30 border-transparent' : 'bg-white/15 border-white/20'}`}
              >
                <Text
                  className={`text-sm font-medium ${quickRange === 'custom' ? 'text-white' : 'text-white/80'}`}
                >
                  {customEnd || '结束'}
                </Text>
              </View>
            </Picker>
          </View>
        </View>

        {/* 教师视图：学生筛选 */}
        {isTeacher && students.length > 0 && (
          <View className="flex gap-[12rpx] px-4 pb-[20rpx] overflow-x-auto flex-nowrap">
            <View
              className={`py-[10rpx] px-3 rounded-round border flex-shrink-0 transition-all ${filterStudentId === 'all' ? 'bg-white/30 border-transparent' : 'bg-white/15 border-white/20'}`}
              onClick={() => setFilterStudentId('all')}
            >
              <Text
                className={`text-sm font-medium ${filterStudentId === 'all' ? 'text-white' : 'text-white/80'}`}
              >
                全部
              </Text>
            </View>
            {students.map((s) => (
              <View
                key={s.id}
                className={`py-[10rpx] px-3 rounded-round border flex-shrink-0 transition-all ${filterStudentId === s.id ? 'bg-white/30 border-transparent' : 'bg-white/15 border-white/20'}`}
                onClick={() => setFilterStudentId(s.id)}
              >
                <Text
                  className={`text-sm font-medium ${filterStudentId === s.id ? 'text-white' : 'text-white/80'}`}
                >
                  {s.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 统计摘要 */}
        {filteredRecords.length > 0 && (
          <View className="mx-4 mb-3 bg-white rounded-[24rpx] py-3 px-4 shadow-soft flex items-center justify-around">
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
          <View className="px-4">
            {Object.entries(grouped).map(([date, items]) => (
              <View key={date} className="mb-3">
                <View className="flex items-baseline gap-[12rpx] mb-2 px-1">
                  <Text className="text-lg font-semibold text-foreground">
                    {formatDateLabel(date)}
                  </Text>
                  <Text className="text-sm text-muted-foreground">{date}</Text>
                </View>

                <View className="flex flex-col">
                  {items.map((record, idx) => (
                    <View
                      key={record.id}
                      className="flex gap-[20rpx]"
                      onClick={() => goDetail(record.id)}
                    >
                      {/* 时间轴节点 */}
                      <View className="flex flex-col items-center w-[32rpx] flex-shrink-0 pt-3">
                        <View className="w-[16rpx] h-[16rpx] rounded-full bg-gradient-primary border-[4rpx] border-white shadow-[0_0_0_2rpx_hsl(var(--primary))]" />
                        {idx < items.length - 1 && (
                          <View className="flex-1 w-[2rpx] bg-input mt-[4rpx]" />
                        )}
                      </View>

                      {/* 记录卡片 */}
                      <View className="flex-1 bg-white rounded-[24rpx] p-3 shadow-soft mb-2 press-scale">
                        <View className="flex items-center justify-between">
                          <View className="flex items-center gap-2">
                            <View className="w-[72rpx] h-[72rpx] rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                              <Text className="text-white text-[32rpx] font-bold">
                                {(record.student?.name || '学')[0]}
                              </Text>
                            </View>
                            <View className="flex flex-col gap-[4rpx]">
                              <Text className="text-lg font-semibold text-foreground">
                                {record.student?.name || '学生'}
                              </Text>
                              <Text className="text-sm text-muted-foreground">
                                {record.course_package?.name || '课程'}
                              </Text>
                            </View>
                          </View>
                          <View className="flex flex-col items-end gap-[4rpx]">
                            <Text className="text-lg font-semibold text-primary">
                              -{record.hours_used} 课时
                            </Text>
                            {record.performance && (
                              <Text className="text-sm text-muted-foreground bg-muted py-[2rpx] px-2 rounded-round">
                                {record.performance}
                              </Text>
                            )}
                          </View>
                        </View>

                        {record.content && (
                          <View className="mt-2 py-2 px-[20rpx] bg-muted rounded-2">
                            <Text className="text-md text-muted-foreground leading-normal line-clamp-2">
                              {record.content}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(RecordsPage);
