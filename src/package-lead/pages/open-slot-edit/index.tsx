/**
 * 开放预约时段编辑页 package-lead/pages/open-slot-edit
 *
 * 从排课页「开放预约」Tab 左滑编辑进入，
 * 用于编辑单个开放预约时段的老师、教室、日期、时间、最大人数。
 * 底部保存/删除按钮与现有简约表单页风格保持一致。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DatePickerSheet from '@/components/DatePickerSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PickerSheet, { type PickerOption } from '@/components/PickerSheet';
import TimePickerSheet from '@/components/TimePickerSheet';
import { classBookingService, classService, teacherService } from '@/services';
import type { ClassBookingSlot } from '@/types/class';
import type { TeacherUIModel } from '@/types/teacher';
import { logError } from '@/utils/logger';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

interface PageParams {
  slotId?: string;
  classId?: string;
  date?: string;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 教室选项（示例数据，后续可替换为校区教室接口） */
const CLASSROOM_OPTIONS: PickerOption[] = [
  { label: '书法教室', value: '书法教室' },
  { label: '美术教室', value: '美术教室' },
  { label: '音乐教室', value: '音乐教室' },
  { label: '舞蹈教室', value: '舞蹈教室' },
  { label: '综合教室', value: '综合教室' },
];

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

const OpenSlotEditPage: React.FC = () => {
  const navSafeHeight = useNavSafeHeight();
  const [params, setParams] = useState<PageParams>({});
  const [slot, setSlot] = useState<ClassBookingSlot | null>(null);
  const [className, setClassName] = useState('');
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusBarHeight, setStatusBarHeight] = useState(44);

  // 表单字段
  const [lessonDate, setLessonDate] = useState(dayjs());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [teacherId, setTeacherId] = useState('');
  const [room, setRoom] = useState('');
  const [maxCount, setMaxCount] = useState('6');

  // 弹窗显隐
  const [teacherPickerVisible, setTeacherPickerVisible] = useState(false);
  const [roomPickerVisible, setRoomPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [startTimePickerVisible, setStartTimePickerVisible] = useState(false);
  const [endTimePickerVisible, setEndTimePickerVisible] = useState(false);

  useLoad((options) => {
    const opt = options as Record<string, string>;
    setParams({
      slotId: opt.slotId,
      classId: opt.classId,
      date: opt.date,
    });
  });

  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    setStatusBarHeight(windowInfo.statusBarHeight || 44);
  }, []);

  const loadData = useCallback(async () => {
    if (!params.slotId) return;
    setLoading(true);
    try {
      const [slotData, teacherList, classInfo] = await Promise.all([
        classBookingService.getSlotById(params.slotId),
        teacherService.getList(),
        params.classId ? classService.getById(params.classId) : Promise.resolve(null),
      ]);
      setSlot(slotData);
      setTeachers(teacherList);
      setClassName(classInfo?.name || slotData?.class_name || '');

      if (slotData) {
        setLessonDate(dayjs(slotData.lesson_date));
        setStartTime(slotData.start_time);
        setEndTime(slotData.end_time);
        setTeacherId(slotData.teacher_id);
        setRoom(slotData.room || '');
        setMaxCount(String(slotData.max_count));
      }
    } catch (err) {
      logError('load open slot', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [params.classId, params.slotId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const teacherOptions: PickerOption[] = useMemo(
    () => teachers.map((t) => ({ label: t.name, value: t.id })),
    [teachers],
  );

  const teacherName = useMemo(() => {
    return teachers.find((t) => t.id === teacherId)?.name || slot?.teacher_name || '请选择';
  }, [slot?.teacher_name, teacherId, teachers]);

  const duration = useMemo(() => {
    const start = dayjs(`2026-01-01 ${startTime}`);
    const end = dayjs(`2026-01-01 ${endTime}`);
    const minutes = end.diff(start, 'minute');
    return minutes > 0 ? minutes : 0;
  }, [startTime, endTime]);

  const handleSubmit = useCallback(async () => {
    if (!params.slotId) return;

    const maxCountNum = Number(maxCount);
    if (!Number.isFinite(maxCountNum) || maxCountNum <= 0) {
      Taro.showToast({ title: '请输入有效的最大人数', icon: 'none' });
      return;
    }
    if (endTime <= startTime) {
      Taro.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' });
      return;
    }

    setSubmitting(true);
    try {
      await classBookingService.updateSlot(params.slotId, {
        teacher_id: teacherId,
        room,
        lesson_date: lessonDate.format('YYYY-MM-DD'),
        start_time: startTime,
        end_time: endTime,
        max_count: maxCountNum,
      });
      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch (err) {
      logError('update open slot', err);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [endTime, lessonDate, maxCount, params.slotId, room, startTime, teacherId]);

  const handleDelete = useCallback(async () => {
    if (!params.slotId) return;

    const modal = await Taro.showModal({
      title: '删除时段',
      content: '确定删除该开放预约时段吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
    });
    if (!modal.confirm) return;

    setDeleting(true);
    try {
      await classBookingService.deleteSlot(params.slotId);
      Taro.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 600);
    } catch (err) {
      logError('delete open slot', err);
      Taro.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      setDeleting(false);
    }
  }, [params.slotId]);

  if (loading) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full">
          <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
        </View>
      </View>
    );
  }

  if (!slot) {
    return (
      <View className="h-screen bg-[#f6f7fb]">
        <View className="center h-full flex-col gap-3">
          <Icon name="mdi-alert-circle-outline" size={64} className="text-muted-foreground" />
          <Text className="text-[28rpx] text-muted-foreground">时段不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex h-screen flex-col overflow-hidden bg-[#f6f7fb]">
      {/* 顶部导航 */}
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
          {/* 课程信息 */}
          <View className="rounded-[24rpx] bg-white px-[28rpx] shadow-card">
            <FormRow label="课程名称" value={className || '-'} arrow={false} />
            <FormRow
              label="老师"
              value={teacherName}
              onClick={() => setTeacherPickerVisible(true)}
            />
            <FormRow
              label="上课教室"
              value={room}
              placeholder="请选择"
              onClick={() => setRoomPickerVisible(true)}
            />
            <FormRow label="课程时长（分）" value={duration} arrow={false} />
          </View>

          {/* 上课时间 */}
          <View className="mt-[24rpx] rounded-[24rpx] bg-white px-[28rpx] shadow-card">
            <FormRow
              label="日期"
              value={`${lessonDate.format('YYYY-MM-DD')} ${WEEKDAY_LABELS[lessonDate.day()]}`}
              onClick={() => setDatePickerVisible(true)}
            />
            <FormRow
              label="开始时间"
              value={startTime}
              onClick={() => setStartTimePickerVisible(true)}
            />
            <FormRow
              label="结束时间"
              value={endTime}
              onClick={() => setEndTimePickerVisible(true)}
            />
          </View>

          {/* 最大人数 */}
          <View className="mt-[24rpx] rounded-[24rpx] bg-white px-[28rpx] py-[24rpx] shadow-card">
            <FormInput
              label="最大可约人数"
              type="number"
              value={maxCount}
              onInput={(e) => setMaxCount(e.detail.value)}
              placeholder="请输入最大可约人数"
            />
          </View>
        </View>
      </ScrollView>

      {/* 底部按钮 */}
      <View className="flex-shrink-0 border-t border-[#eceff3] bg-white px-[24rpx] py-[24rpx] pb-[40rpx]">
        <View
          className={cn(
            'center h-[84rpx] rounded-full bg-primary active:opacity-80',
            submitting && 'opacity-60',
          )}
          onClick={() => !submitting && void handleSubmit()}
        >
          <Text className="text-[30rpx] font-semibold text-white">
            {submitting ? '保存中...' : '保存'}
          </Text>
        </View>
        <View
          className={cn(
            'center mt-[20rpx] h-[84rpx] rounded-full border border-border bg-white active:opacity-80',
            deleting && 'opacity-60',
          )}
          onClick={() => !deleting && void handleDelete()}
        >
          <Text className="text-[30rpx] font-medium text-foreground">
            {deleting ? '删除中...' : '删除'}
          </Text>
        </View>
      </View>

      <PickerSheet
        visible={teacherPickerVisible}
        title="选择老师"
        options={teacherOptions}
        value={teacherId}
        onClose={() => setTeacherPickerVisible(false)}
        onConfirm={(value) => {
          setTeacherId(value);
          setTeacherPickerVisible(false);
        }}
      />

      <PickerSheet
        visible={roomPickerVisible}
        title="选择教室"
        options={CLASSROOM_OPTIONS}
        value={room}
        onClose={() => setRoomPickerVisible(false)}
        onConfirm={(value) => {
          setRoom(value);
          setRoomPickerVisible(false);
        }}
      />

      <DatePickerSheet
        visible={datePickerVisible}
        value={lessonDate.format('YYYY-MM-DD')}
        onClose={() => setDatePickerVisible(false)}
        onConfirm={(date) => {
          setLessonDate(dayjs(date));
          setDatePickerVisible(false);
        }}
      />

      <TimePickerSheet
        visible={startTimePickerVisible}
        value={startTime}
        onClose={() => setStartTimePickerVisible(false)}
        onConfirm={(time) => {
          setStartTime(time);
          setStartTimePickerVisible(false);
        }}
      />

      <TimePickerSheet
        visible={endTimePickerVisible}
        value={endTime}
        onClose={() => setEndTimePickerVisible(false)}
        onConfirm={(time) => {
          setEndTime(time);
          setEndTimePickerVisible(false);
        }}
      />
    </View>
  );
};

export default OpenSlotEditPage;
