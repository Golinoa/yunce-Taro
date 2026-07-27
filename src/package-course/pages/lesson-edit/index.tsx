/**
 * 点名编辑课节
 *
 * 从 lesson-form 头部「编辑」进入，用于编辑单次课节信息：
 * 日期、时间、授课老师、助教、教室、上课内容、备注等。
 */
import { View, Text, Picker, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { scheduleService } from '@/services';
import { teacherService } from '@/services/teacher';
import type { DayOfWeek } from '@/types/schedule';
import type { TeacherUIModel } from '@/types/teacher';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

const LESSON_EDIT_RESULT_KEY = 'yunce:lesson-form:edit-result';

const ROOM_OPTIONS = [
  '101',
  '102',
  '201',
  '202',
  '301',
  '舞蹈教室1',
  '声乐教室1',
  '美术教室1',
  '书法教室1',
];

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, required, children }) => (
  <View className="mb-5">
    <View className="mb-[12rpx] flex items-center gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      {required && <Text className="text-base text-destructive">*</Text>}
    </View>
    {children}
  </View>
);

const LessonEdit: React.FC = () => {
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<TeacherUIModel[]>([]);

  const [scheduleId, setScheduleId] = useState('');
  const [className, setClassName] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [assistantTeacherId, setAssistantTeacherId] = useState('');
  const [teacherHours, setTeacherHours] = useState('0');
  const [room, setRoom] = useState('');
  const [content, setContent] = useState('');
  const [remark, setRemark] = useState('');

  // 初始化表单（从 URL 参数读取）
  useEffect(() => {
    const params = Taro.getCurrentInstance()?.router?.params || {};
    setScheduleId(decodeURIComponent(params.scheduleId || ''));
    setClassName(decodeURIComponent(params.className || ''));
    setSelectedDate(decodeURIComponent(params.lessonDate || ''));
    setStartTime(decodeURIComponent(params.startTime || ''));
    setEndTime(decodeURIComponent(params.endTime || ''));
    setTeacherId(decodeURIComponent(params.leadTeacherId || ''));
    setAssistantTeacherId(decodeURIComponent(params.assistantTeacherId || ''));
    setRoom(decodeURIComponent(params.room || ''));
    setContent(decodeURIComponent(params.content || ''));
    setRemark(decodeURIComponent(params.homework || ''));
    const hoursParam = decodeURIComponent(params.teacherHours || '');
    setTeacherHours(hoursParam || '0');
  }, []);

  // 加载教师列表
  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const list = await teacherService.getActiveList();
        setTeachers(list);
      } catch (err) {
        logError('lesson-edit load teachers', err);
      }
    };
    loadTeachers();
  }, []);

  const teacherOptions = useMemo(
    () => [{ id: '', name: '请选择' }, ...teachers.map((t) => ({ id: t.id, name: t.name }))],
    [teachers],
  );

  const teacherIndex = useMemo(
    () =>
      Math.max(
        0,
        teacherOptions.findIndex((t) => t.id === teacherId),
      ),
    [teacherOptions, teacherId],
  );

  const assistantTeacherOptions = useMemo(
    () => [{ id: '', name: '不安排助教' }, ...teachers.map((t) => ({ id: t.id, name: t.name }))],
    [teachers],
  );

  const assistantTeacherIndex = useMemo(
    () =>
      Math.max(
        0,
        assistantTeacherOptions.findIndex((t) => t.id === assistantTeacherId),
      ),
    [assistantTeacherOptions, assistantTeacherId],
  );

  const roomOptions = useMemo(() => {
    const options = [...ROOM_OPTIONS];
    if (room && !options.includes(room)) {
      options.unshift(room);
    }
    return ['请选择', ...options];
  }, [room]);

  const roomIndex = useMemo(
    () => Math.max(0, roomOptions.indexOf(room || '请选择')),
    [roomOptions, room],
  );

  const validate = useCallback((): string => {
    if (!selectedDate) return '请选择开始日期';
    if (!startTime || !endTime) return '请选择上课时间';
    if (startTime >= endTime) return '结束时间必须晚于开始时间';
    if (!teacherId) return '请选择上课老师';
    return '';
  }, [selectedDate, startTime, endTime, teacherId]);

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    if (!scheduleId) {
      Taro.showToast({ title: '缺少课节信息', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      const dayOfWeek = (dayjs(selectedDate).day() || 7) as DayOfWeek;
      await scheduleService.update(scheduleId, {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        teacher_id: teacherId,
        assistant_teacher_id: assistantTeacherId || undefined,
        room: room || undefined,
        note: content || undefined,
      });

      Taro.setStorageSync(
        LESSON_EDIT_RESULT_KEY,
        JSON.stringify({
          lessonDate: selectedDate,
          startTime,
          endTime,
          leadTeacherId: teacherId,
          assistantTeacherId,
          room,
          content,
          remark,
          teacherHours,
        }),
      );

      Taro.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (err) {
      logError('lesson-edit save', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  }, [
    assistantTeacherId,
    content,
    endTime,
    remark,
    room,
    scheduleId,
    selectedDate,
    startTime,
    teacherHours,
    teacherId,
    validate,
  ]);

  return (
    <PageContainer safeBottom className="bg-white">
      <ScrollView scrollY className="h-screen">
        <View className="px-[32rpx] py-[24rpx] pb-[180rpx]">
          {/* 上课班级 */}
          <FormField label="上课班级" required>
            <View className="rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx] opacity-60">
              <Text className="text-base text-foreground">{className || '-'}</Text>
            </View>
          </FormField>

          {/* 开始日期 */}
          <FormField label="开始日期" required>
            <Picker
              mode="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.detail.value)}
            >
              <View className="flex items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                <Text
                  className={cn(
                    'text-base',
                    selectedDate ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {selectedDate || '请选择开始日期'}
                </Text>
                <Icon name="mdi-chevron-right" size="sm" color="muted" />
              </View>
            </Picker>
          </FormField>

          {/* 上课时间 */}
          <FormField label="上课时间" required>
            <View className="flex items-center gap-[16rpx]">
              <Picker mode="time" value={startTime} onChange={(e) => setStartTime(e.detail.value)}>
                <View className="flex flex-1 items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                  <Text
                    className={cn(
                      'text-base',
                      startTime ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {startTime || '开始时间'}
                  </Text>
                  <Icon name="mdi-chevron-down" size="sm" color="muted" />
                </View>
              </Picker>
              <Text className="text-base text-muted-foreground">-</Text>
              <Picker mode="time" value={endTime} onChange={(e) => setEndTime(e.detail.value)}>
                <View className="flex flex-1 items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                  <Text
                    className={cn(
                      'text-base',
                      endTime ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {endTime || '结束时间'}
                  </Text>
                  <Icon name="mdi-chevron-down" size="sm" color="muted" />
                </View>
              </Picker>
            </View>
          </FormField>

          {/* 上课老师 */}
          <FormField label="上课老师" required>
            <Picker
              mode="selector"
              range={teacherOptions.map((t) => t.name)}
              value={teacherIndex}
              onChange={(e) => setTeacherId(teacherOptions[e.detail.value]?.id || '')}
            >
              <View className="flex items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                <Text
                  className={cn(
                    'text-base',
                    teacherId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {teacherOptions[teacherIndex]?.name || '请选择上课老师'}
                </Text>
                <Icon name="mdi-chevron-right" size="sm" color="muted" />
              </View>
            </Picker>
          </FormField>

          {/* 上课助教 */}
          <FormField label="上课助教">
            <Picker
              mode="selector"
              range={assistantTeacherOptions.map((t) => t.name)}
              value={assistantTeacherIndex}
              onChange={(e) =>
                setAssistantTeacherId(assistantTeacherOptions[e.detail.value]?.id || '')
              }
            >
              <View className="flex items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                <Text
                  className={cn(
                    'text-base',
                    assistantTeacherId ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {assistantTeacherOptions[assistantTeacherIndex]?.name || '请选择上课助教'}
                </Text>
                <Icon name="mdi-chevron-right" size="sm" color="muted" />
              </View>
            </Picker>
          </FormField>

          {/* 老师上课课时 */}
          <FormField label="老师上课课时">
            <FormInput
              label=""
              type="digit"
              value={teacherHours}
              onInput={(e) => setTeacherHours(e.detail.value)}
              placeholder="请输入老师上课课时"
              className="mb-0"
            />
          </FormField>

          {/* 上课教室 */}
          <FormField label="上课教室">
            <Picker
              mode="selector"
              range={roomOptions}
              value={roomIndex}
              onChange={(e) => {
                const value = roomOptions[e.detail.value];
                setRoom(value === '请选择' ? '' : value);
              }}
            >
              <View className="flex items-center justify-between rounded-2xl border-[3rpx] border-border-light bg-primary-5 px-[28rpx] py-[22rpx]">
                <Text
                  className={cn('text-base', room ? 'text-foreground' : 'text-muted-foreground')}
                >
                  {room || '请选择上课教室'}
                </Text>
                <Icon name="mdi-chevron-down" size="sm" color="muted" />
              </View>
            </Picker>
          </FormField>

          {/* 上课内容 */}
          <FormField label="上课内容">
            <FormInput
              label=""
              multiline
              minHeight="200rpx"
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              placeholder="请输入上课内容"
              maxlength={500}
              className="mb-0"
              suffix={
                <Text className="text-[22rpx] text-muted-foreground">({content.length}/500)</Text>
              }
            />
          </FormField>

          {/* 备注 */}
          <FormField label="备注">
            <FormInput
              label=""
              multiline
              minHeight="160rpx"
              value={remark}
              onInput={(e) => setRemark(e.detail.value)}
              placeholder="请输入备注"
              className="mb-0"
            />
          </FormField>
        </View>
      </ScrollView>

      {/* 底部保存按钮 */}
      <View className="fixed bottom-0 left-0 right-0 bg-white px-[32rpx] py-[24rpx] pb-safe-bottom shadow-[0_-4rpx_20rpx_rgba(0,0,0,0.05)]">
        <View
          className={cn(
            'flex h-[88rpx] items-center justify-center rounded-[16rpx] bg-[#FF7E67]',
            saving && 'opacity-70',
          )}
          onClick={saving ? undefined : handleSave}
        >
          <Text className="text-[30rpx] font-medium text-white">
            {saving ? '保存中...' : '保存'}
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(LessonEdit);
