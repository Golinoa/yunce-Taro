/**
 * 独立试听时段管理页 package-lead/pages/trial-slots
 *
 * 老师创建、编辑、删除独立试听时段配置。
 * 管理员可以管理所有老师的时段，也可以设置所有老师的时段。
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState, useCallback } from 'react';
import ActionButton from '@/components/ActionButton';
import BottomSheet from '@/components/BottomSheet';
import Card from '@/components/Card';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { leadService } from '@/services';
import type { TrialSlotConfig } from '@/services/lead';
import { useAuth } from '@/utils/auth';

interface SlotFormData {
  courseId: string;
  courseName: string;
  subjectName?: string;
  campusId: string;
  campusName?: string;
  teacherId: string;
  teacherName?: string;
  lessonDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  maxCount: number;
  note?: string;
}

const TrialSlotsPage: React.FC = () => {
  const { profile, session } = useAuth();
  const [slots, setSlots] = useState<TrialSlotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SlotFormData>({
    courseId: '',
    courseName: '',
    subjectName: '',
    campusId: profile?.currentContext?.campusId || '',
    campusName: '',
    teacherId: session?.user.id || '',
    teacherName: '',
    lessonDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    startTime: '10:00',
    endTime: '11:00',
    maxCount: 3,
  });

  const userId = session?.user.id;
  const campusId = profile?.currentContext?.campusId;

  useDidShow(() => {
    loadSlots();
  });

  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const teacherId = userId;
      const cid = campusId;
      const list = await leadService.getTrialSlotConfigs(teacherId, cid);
      setSlots(list);
    } finally {
      setLoading(false);
    }
  }, [userId, campusId]);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setFormData({
      courseId: '',
      courseName: '',
      subjectName: '',
      campusId: campusId || '',
      campusName: '',
      teacherId: userId || '',
      teacherName: '',
      lessonDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      startTime: '10:00',
      endTime: '11:00',
      maxCount: 3,
    });
    setShowForm(true);
  }, [userId, campusId]);

  const handleEdit = useCallback((slot: TrialSlotConfig) => {
    setEditingId(slot.id);
    setFormData({
      courseId: slot.course_id,
      courseName: slot.course_name,
      subjectName: slot.subject_name || '',
      campusId: slot.campus_id,
      campusName: slot.campus_name || '',
      teacherId: slot.teacher_id,
      teacherName: slot.teacher_name || '',
      lessonDate: slot.lesson_date,
      startTime: slot.start_time,
      endTime: slot.end_time,
      room: slot.room || '',
      maxCount: slot.max_count,
    });
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      Taro.showModal({
        title: '确认删除',
        content: '删除后该时段将不可恢复，确定要删除吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await leadService.deleteTrialSlotConfig(id);
              Taro.showToast({ title: '删除成功', icon: 'success' });
              loadSlots();
            } catch {
              Taro.showToast({ title: '删除失败', icon: 'none' });
            }
          }
        },
      });
    },
    [loadSlots],
  );

  const handleSubmit = useCallback(async () => {
    if (!formData.courseName || !formData.lessonDate) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    try {
      if (editingId) {
        await leadService.updateTrialSlotConfig(editingId, {
          course_id: formData.courseId,
          course_name: formData.courseName,
          subject_name: formData.subjectName,
          campus_id: formData.campusId,
          campus_name: formData.campusName,
          teacher_id: formData.teacherId,
          teacher_name: formData.teacherName,
          lesson_date: formData.lessonDate,
          start_time: formData.startTime,
          end_time: formData.endTime,
          room: formData.room,
          max_count: formData.maxCount,
        });
        Taro.showToast({ title: '修改成功', icon: 'success' });
      } else {
        await leadService.createTrialSlotConfig({
          course_id: formData.courseId,
          course_name: formData.courseName,
          subject_name: formData.subjectName,
          campus_id: formData.campusId,
          campus_name: formData.campusName,
          teacher_id: formData.teacherId,
          teacher_name: formData.teacherName,
          lesson_date: formData.lessonDate,
          start_time: formData.startTime,
          end_time: formData.endTime,
          room: formData.room,
          max_count: formData.maxCount,
          status: 'active',
          creator_teacher_id: userId || '',
          creator_teacher_name: profile?.name || '',
        });
        Taro.showToast({ title: '创建成功', icon: 'success' });
      }

      setShowForm(false);
      loadSlots();
    } catch {
      Taro.showToast({ title: '操作失败', icon: 'none' });
    }
  }, [formData, editingId, userId, profile?.name, loadSlots]);

  return (
    <PageContainer>
      <View className="px-page-padding py-4 pb-safe-bar">
        {loading && (
          <View className="py-20 center">
            <Text className="text-[26rpx] text-muted-foreground">加载中...</Text>
          </View>
        )}

        {!loading && slots.length === 0 && (
          <View className="py-20 center flex-col gap-3">
            <Icon name="mdi-calendar" size={64} className="text-muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">暂无独立试听时段</Text>
            <Text className="text-[24rpx] text-muted-foreground">点击下方按钮创建</Text>
          </View>
        )}

        {!loading && slots.length > 0 && (
          <View className="flex flex-col gap-3">
            {slots.map((slot) => (
              <Card key={slot.id}>
                <View className="flex justify-between items-start">
                  <View className="flex-1">
                    <View className="flex items-center gap-2">
                      <Text className="text-[28rpx] font-semibold text-foreground">
                        {slot.course_name}
                      </Text>
                      {slot.subject_name && (
                        <Text className="text-[24rpx] text-muted-foreground">
                          {slot.subject_name}
                        </Text>
                      )}
                    </View>
                    <View className="flex items-center gap-2 mt-2">
                      <Icon name="mdi-calendar" size={14} className="text-primary" />
                      <Text className="text-[24rpx] text-primary">
                        {dayjs(slot.lesson_date).format('YYYY年MM月DD日')}
                      </Text>
                      <Text className="text-[24rpx] text-primary">
                        {slot.start_time}-{slot.end_time}
                      </Text>
                    </View>
                  </View>
                  <View className="flex items-center gap-2">
                    <Text
                      className={cn(
                        'px-3 py-1 rounded-full text-[22rpx]',
                        slot.current_count >= slot.max_count
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-success/10 text-success',
                      )}
                    >
                      {slot.current_count}/{slot.max_count}
                    </Text>
                  </View>
                </View>

                <View className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                  {slot.campus_name && (
                    <View className="flex items-center gap-1">
                      <Icon name="mdi-map-marker" size={14} className="text-muted-foreground" />
                      <Text className="text-[22rpx] text-muted-foreground">{slot.campus_name}</Text>
                    </View>
                  )}
                  {slot.room && (
                    <Text className="text-[22rpx] text-muted-foreground">{slot.room}</Text>
                  )}
                  {slot.teacher_name && (
                    <View className="flex items-center gap-1">
                      <Icon
                        name="mdi-account-outline"
                        size={14}
                        className="text-muted-foreground"
                      />
                      <Text className="text-[22rpx] text-muted-foreground">
                        {slot.teacher_name}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex justify-end gap-3 mt-4">
                  <View
                    className="flex items-center gap-1 px-4 py-2 bg-muted rounded-full"
                    onClick={() => handleEdit(slot)}
                  >
                    <Icon name="mdi-pencil" size={14} className="text-muted-foreground" />
                    <Text className="text-[24rpx] text-muted-foreground">编辑</Text>
                  </View>
                  <View
                    className="flex items-center gap-1 px-4 py-2 bg-destructive/10 rounded-full"
                    onClick={() => handleDelete(slot.id)}
                  >
                    <Icon name="mdi-delete" size={14} className="text-destructive" />
                    <Text className="text-[24rpx] text-destructive">删除</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>

      <ActionButton text="新建独立试听时段" onClick={handleAdd} />

      {/* 新建/编辑弹窗 */}
      <BottomSheet
        visible={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? '编辑独立试听时段' : '新建独立试听时段'}
      >
        <View className="px-page-padding py-4 space-y-4">
          <FormInput
            label="课程名称"
            placeholder="请输入课程名称"
            value={formData.courseName}
            onInput={(e) => setFormData({ ...formData, courseName: e.detail.value })}
          />
          <FormInput
            label="科目名称"
            placeholder="选填"
            value={formData.subjectName || ''}
            onInput={(e) => setFormData({ ...formData, subjectName: e.detail.value })}
          />
          <FormInput
            label="校区"
            placeholder="请输入校区名称"
            value={formData.campusName || ''}
            onInput={(e) => setFormData({ ...formData, campusName: e.detail.value })}
          />
          <FormInput
            label="授课老师"
            placeholder="请输入老师名称"
            value={formData.teacherName || ''}
            onInput={(e) => setFormData({ ...formData, teacherName: e.detail.value })}
          />
          <FormInput
            label="预约日期"
            placeholder="YYYY-MM-DD"
            value={formData.lessonDate}
            onInput={(e) => setFormData({ ...formData, lessonDate: e.detail.value })}
          />
          <View className="flex gap-4">
            <FormInput
              label="开始时间"
              placeholder="HH:mm"
              value={formData.startTime}
              onInput={(e) => setFormData({ ...formData, startTime: e.detail.value })}
              className="flex-1"
            />
            <FormInput
              label="结束时间"
              placeholder="HH:mm"
              value={formData.endTime}
              onInput={(e) => setFormData({ ...formData, endTime: e.detail.value })}
              className="flex-1"
            />
          </View>
          <FormInput
            label="教室"
            placeholder="选填"
            value={formData.room || ''}
            onInput={(e) => setFormData({ ...formData, room: e.detail.value })}
          />
          <FormInput
            label="最大人数"
            placeholder="请输入最大试听人数"
            value={String(formData.maxCount)}
            onInput={(e) => setFormData({ ...formData, maxCount: Number(e.detail.value) || 3 })}
            type="number"
          />
        </View>

        <View className="px-page-padding pb-4">
          <ActionButton text={editingId ? '保存修改' : '确认创建'} onClick={handleSubmit} />
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default TrialSlotsPage;
