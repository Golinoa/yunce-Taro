/**
 * 试听预约编辑页 package-lead/pages/lead-booking-edit
 *
 * 对齐设计稿：白色卡片分组表单 + 顶部白色导航 + 底部橙色保存按钮。
 * 可修改预约日期、开始/结束时间、课程名称；底部「删除」执行取消预约。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad, useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import Icon from '@/components/Icon';
import PickerSheet, { type PickerOption } from '@/components/PickerSheet';
import TimePickerSheet from '@/components/TimePickerSheet';
import { leadService, teacherService } from '@/services';
import { useCampusStore } from '@/stores/campus';
import type { LeadBooking, LeadBookingDifficulty } from '@/types/lead';
import type { TeacherUIModel } from '@/types/teacher';
import { isPrincipalOrAbove, useAuth } from '@/utils/auth';
import { resolveTeachingActorId } from '@/utils/trial-booking-scope';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  bookingId?: string;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

const TRIAL_MODE_TEXT: Record<LeadBooking['trial_mode'], string> = {
  private: '一对一',
  group: '一对多',
};

// 可选数据源（示例数据，后续可替换为接口返回）
const COURSE_TYPE_OPTIONS: PickerOption[] = [
  { label: '一对一', value: 'private' },
  { label: '一对多', value: 'group' },
];
const COURSE_OPTIONS: PickerOption[] = [
  { label: '体验课', value: '体验课' },
  { label: '钢琴启蒙', value: '钢琴启蒙' },
  { label: '书法基础', value: '书法基础' },
  { label: '美术创意', value: '美术创意' },
];
const CLASSROOM_OPTIONS: PickerOption[] = [
  { label: '书法教室', value: '书法教室' },
  { label: '美术教室', value: '美术教室' },
  { label: '音乐教室', value: '音乐教室' },
];

const DIFFICULTY_META: Record<LeadBookingDifficulty, { label: string; className: string }> = {
  all: { label: '所有人', className: 'bg-info/10 text-info' },
  basic: { label: '基础', className: 'bg-success/10 text-success' },
  intermediate: { label: '进阶', className: 'bg-warning/10 text-warning' },
  advanced: { label: '高级', className: 'bg-destructive/10 text-destructive' },
};

const DIFFICULTY_OPTIONS: PickerOption[] = Object.entries(DIFFICULTY_META).map(([key, meta]) => ({
  label: meta.label,
  value: key,
}));

/** 计算结束时间：startTime + 90分钟 */
function computeEndTime(startTime: string): string {
  const [hour, minute] = startTime.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + 90;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}

/** 课程难度标签 */
const DifficultyBadge: React.FC<{ difficulty?: LeadBookingDifficulty }> = ({ difficulty }) => {
  const meta = DIFFICULTY_META[difficulty || 'all'];
  return (
    <View className={cn('center rounded-[8rpx] px-[12rpx] py-[4rpx]', meta.className)}>
      <Text className="text-center text-[24rpx] font-medium leading-none">{meta.label}</Text>
    </View>
  );
};

/** 表单行：左侧标签 + 右侧值/占位 + 可选箭头 */
const FormRow: React.FC<{
  label: string;
  value?: React.ReactNode;
  placeholder?: string;
  arrow?: boolean;
  border?: boolean;
  onClick?: () => void;
}> = ({ label, value, placeholder, arrow = true, border = true, onClick }) => {
  return (
    <View
      className={cn(
        'flex items-center justify-between py-[26rpx]',
        border && 'border-b border-border',
      )}
      onClick={onClick}
    >
      <Text className="text-[30rpx] text-foreground">{label}</Text>
      <View className="flex items-center gap-[10rpx]">
        {value !== undefined && value !== null && value !== '' ? (
          typeof value === 'string' || typeof value === 'number' ? (
            <Text className="text-[28rpx] text-foreground-secondary">{value}</Text>
          ) : (
            value
          )
        ) : (
          <Text className="text-[28rpx] text-muted-foreground">{placeholder || '请选择'}</Text>
        )}
        {arrow && <Icon name="mdi-chevron-right" size={20} className="text-muted-foreground" />}
      </View>
    </View>
  );
};

const LeadBookingEditPage: React.FC = () => {
  const { profile } = useAuth();
  const currentCampusId = useCampusStore((s) => s.currentCampusId);
  const teachingActorId = resolveTeachingActorId(profile);
  const role = profile?.currentContext?.role;
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});
  const [booking, setBooking] = useState<LeadBooking | null>(null);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBarHeight, setStatusBarHeight] = useState(44);

  // 表单字段
  const [lessonDate, setLessonDate] = useState(dayjs());
  const [startTime, setStartTime] = useState('14:00');
  const [courseName, setCourseName] = useState('体验课');
  const [trialMode, setTrialMode] = useState<LeadBooking['trial_mode']>('private');
  const [teacherId, setTeacherId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [difficulty, setDifficulty] = useState<LeadBookingDifficulty>('all');
  const [classroomName, setClassroomName] = useState('');

  // 各选择弹窗显隐
  const [courseTypePickerVisible, setCourseTypePickerVisible] = useState(false);
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const [teacherPickerVisible, setTeacherPickerVisible] = useState(false);
  const [assistantPickerVisible, setAssistantPickerVisible] = useState(false);
  const [difficultyPickerVisible, setDifficultyPickerVisible] = useState(false);
  const [classroomPickerVisible, setClassroomPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({ bookingId: opt.bookingId });
  });

  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    setStatusBarHeight(windowInfo.statusBarHeight || 44);
  }, []);

  const loadBooking = useCallback(async () => {
    if (!params.bookingId) return;
    setLoading(true);
    try {
      const dateRange = {
        startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      };
      const [list, teacherList] = await Promise.all([
        isPrincipalOrAbove(role)
          ? leadService.getLeadBookingsByCampus(currentCampusId, dateRange)
          : leadService.getLeadBookingsByTeacher(teachingActorId, dateRange),
        teacherService.getList(),
      ]);
      const found = list.find((b) => b.id === params.bookingId) || null;
      setBooking(found);
      setTeachers(teacherList);
      if (found) {
        setLessonDate(dayjs(found.lesson_date));
        setStartTime(found.start_time);
        setCourseName(found.course_name || '体验课');
        setTrialMode(found.trial_mode || 'private');
        setTeacherId(found.teacher_id || '');
        setAssistantId((found as LeadBooking & { assistant_id?: string }).assistant_id || '');
        setDifficulty((found.difficulty as LeadBookingDifficulty) || 'all');
        setClassroomName(found.room || '');
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentCampusId, params.bookingId, role, teachingActorId]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  useDidShow(() => {
    void loadBooking();
  });

  const endTime = useMemo(() => computeEndTime(startTime), [startTime]);

  const duration = useMemo(() => {
    const start = dayjs(`2026-01-01 ${startTime}`);
    const end = dayjs(`2026-01-01 ${endTime}`);
    return end.diff(start, 'minute');
  }, [startTime, endTime]);

  // 老师/助教名称展示
  const teacherName = useMemo(() => {
    return teachers.find((t) => t.id === teacherId)?.name || booking?.teacher_name || '未分配老师';
  }, [booking?.teacher_name, teacherId, teachers]);

  const assistantName = useMemo(() => {
    if (!assistantId) return '';
    return teachers.find((t) => t.id === assistantId)?.name || '';
  }, [assistantId, teachers]);

  const teacherOptions: PickerOption[] = useMemo(
    () => teachers.map((t) => ({ label: t.name, value: t.id })),
    [teachers],
  );

  const handleChangeDate = useCallback((date: string) => {
    setLessonDate(dayjs(date));
  }, []);

  const handleChangeTime = useCallback((time: string) => {
    setStartTime(time);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!booking || !params.bookingId) return;
    if (!courseName.trim()) {
      Taro.showToast({ title: '请输入课程名称', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await leadService.updateLeadBooking(params.bookingId, {
        lessonDate: lessonDate.format('YYYY-MM-DD'),
        startTime,
        endTime,
        courseName: courseName.trim(),
        trialMode,
        teacherId,
        difficulty,
        room: classroomName,
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [
    booking,
    classroomName,
    courseName,
    difficulty,
    endTime,
    lessonDate,
    params.bookingId,
    startTime,
    teacherId,
    trialMode,
  ]);

  /** 底部「删除」按钮：执行取消预约（软删除），状态变为 cancelled 后可恢复 */
  const handleDelete = useCallback(async () => {
    if (!booking || !params.bookingId) return;
    setDeleting(true);
    try {
      await leadService.cancelLeadBooking(params.bookingId);
      Taro.showToast({ title: '已取消预约', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch {
      Taro.showToast({ title: '取消失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [booking, params.bookingId]);

  if (loading) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full">
          <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
        </View>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full flex-col gap-3">
          <Icon name="mdi-alert-circle-outline" size={64} className="text-muted-foreground" />
          <Text className="text-[28rpx] text-muted-foreground">预约记录不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex h-screen flex-col overflow-hidden bg-[#f6f7fb]">
      {/* 顶部导航：白色背景 + 黑色标题 */}
      <View className="relative flex-shrink-0 bg-white">
        <View
          className="flex items-end justify-between px-[24rpx] pb-[20rpx]"
          style={{ paddingTop: `${statusBarHeight}px`, height: `${navSafeHeight}px` }}
        >
          <View
            className="center h-[72rpx] w-[72rpx] active:opacity-80"
            onClick={() => Taro.navigateBack()}
          >
            <Icon name="mdi-chevron-left" size={36} className="text-foreground" />
          </View>
          <Text className="text-[34rpx] font-semibold text-foreground">修改排课</Text>
          <View className="h-[72rpx] w-[72rpx]" />
        </View>
      </View>

      <ScrollView scrollY enhanced showScrollbar={false} className="min-h-0 flex-1">
        <View className="px-[24rpx] pb-[40rpx] pt-[24rpx]">
          {/* 课程信息卡片 */}
          <View className="rounded-[24rpx] bg-white px-[28rpx] shadow-card">
            <FormRow
              label="课程类型"
              value={TRIAL_MODE_TEXT[trialMode]}
              onClick={() => setCourseTypePickerVisible(true)}
            />
            <FormRow
              label="课程名称"
              value={courseName}
              onClick={() => setCoursePickerVisible(true)}
            />
            <FormRow
              label="老师"
              value={teacherName}
              onClick={() => setTeacherPickerVisible(true)}
            />
            <FormRow
              label="助教"
              value={assistantName}
              placeholder="请选择"
              onClick={() => setAssistantPickerVisible(true)}
            />
            <FormRow label="课程时长（分）" value={duration} arrow={false} />
            <FormRow
              label="课程难度"
              value={<DifficultyBadge difficulty={difficulty} />}
              arrow={false}
              border={false}
              onClick={() => setDifficultyPickerVisible(true)}
            />
          </View>

          {/* 上课教室 */}
          <View className="mt-[24rpx] rounded-[24rpx] bg-white px-[28rpx] shadow-card">
            <FormRow
              label="上课教室"
              value={classroomName}
              placeholder="请选择"
              border={false}
              onClick={() => setClassroomPickerVisible(true)}
            />
          </View>

          {/* 上课时间 */}
          <View className="mt-[24rpx] rounded-[24rpx] bg-white px-[28rpx] py-[28rpx] shadow-card">
            <Text className="mb-[12rpx] text-[30rpx] font-semibold text-foreground">上课时间</Text>
            <View
              className="flex items-center justify-between py-[16rpx]"
              onClick={() => setDatePickerVisible(true)}
            >
              <View className="flex items-center gap-[12rpx]">
                <Icon name="mdi-calendar-blank" size={24} className="text-muted-foreground" />
                <Text className="text-[28rpx] text-foreground-secondary">日期</Text>
              </View>
              <View className="rounded-[16rpx] border border-border bg-white px-[24rpx] py-[14rpx]">
                <Text className="text-[28rpx] text-foreground">
                  {lessonDate.format('YYYY-MM-DD')} {WEEKDAY_LABELS[lessonDate.day()]}
                </Text>
              </View>
            </View>
            <View
              className="flex items-center justify-between py-[16rpx]"
              onClick={() => setTimePickerVisible(true)}
            >
              <View className="flex items-center gap-[12rpx]">
                <Icon name="mdi-clock-outline" size={24} className="text-muted-foreground" />
                <Text className="text-[28rpx] text-foreground-secondary">时间</Text>
              </View>
              <View className="rounded-[16rpx] border border-border bg-white px-[24rpx] py-[14rpx]">
                <Text className="text-[28rpx] text-foreground">
                  {startTime}-{endTime}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 底部按钮：橙色保存 + 白色删除 */}
      <View className="flex-shrink-0 bg-white px-[32rpx] pt-[20rpx] pb-safe-bar">
        <View
          className={cn(
            'center h-[92rpx] w-full rounded-full text-[32rpx] font-medium text-white transition-opacity active:opacity-90',
            submitting || !courseName.trim()
              ? 'bg-muted text-muted-foreground'
              : 'bg-schedule-attend',
          )}
          onClick={!submitting && courseName.trim() ? handleSubmit : undefined}
        >
          {submitting ? '保存中...' : '保存'}
        </View>
        <View
          className={cn(
            'mt-[20rpx] center h-[92rpx] w-full rounded-full border border-border bg-white text-[32rpx] text-foreground-secondary transition-colors active:bg-muted',
            deleting && 'opacity-60',
          )}
          onClick={!deleting ? handleDelete : undefined}
        >
          {deleting ? '取消中...' : '删除'}
        </View>
      </View>

      {/* 选择弹窗 */}
      <PickerSheet
        visible={courseTypePickerVisible}
        title="请选择课程类型"
        options={COURSE_TYPE_OPTIONS}
        value={trialMode}
        onClose={() => setCourseTypePickerVisible(false)}
        onConfirm={(value) => setTrialMode(value as LeadBooking['trial_mode'])}
      />
      <PickerSheet
        visible={coursePickerVisible}
        title="请选择课程名称"
        options={COURSE_OPTIONS}
        value={courseName}
        onClose={() => setCoursePickerVisible(false)}
        onConfirm={(value) => setCourseName(value)}
      />
      <PickerSheet
        visible={teacherPickerVisible}
        title="请选择上课老师"
        options={teacherOptions}
        value={teacherId}
        onClose={() => setTeacherPickerVisible(false)}
        onConfirm={(value) => setTeacherId(value)}
      />
      <PickerSheet
        visible={assistantPickerVisible}
        title="请选择助教老师"
        options={teacherOptions}
        value={assistantId}
        onClose={() => setAssistantPickerVisible(false)}
        onConfirm={(value) => setAssistantId(value)}
      />
      <PickerSheet
        visible={difficultyPickerVisible}
        title="请选择课程难度"
        options={DIFFICULTY_OPTIONS}
        value={difficulty}
        onClose={() => setDifficultyPickerVisible(false)}
        onConfirm={(value) => setDifficulty(value as LeadBookingDifficulty)}
      />
      <PickerSheet
        visible={classroomPickerVisible}
        title="请选择上课教室"
        options={CLASSROOM_OPTIONS}
        value={classroomName}
        onClose={() => setClassroomPickerVisible(false)}
        onConfirm={(value) => setClassroomName(value)}
      />
      <DatePickerSheet
        visible={datePickerVisible}
        title="选择日期"
        value={lessonDate.format('YYYY-MM-DD')}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={handleChangeDate}
      />
      <TimePickerSheet
        visible={timePickerVisible}
        title="选择时间"
        value={startTime}
        onClose={() => setTimePickerVisible(false)}
        onConfirm={handleChangeTime}
      />
    </View>
  );
};

export default LeadBookingEditPage;
