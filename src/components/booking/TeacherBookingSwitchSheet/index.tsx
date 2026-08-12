/**
 * TeacherBookingSwitchSheet - 老师预约开关列表弹窗
 *
 * 使用场景：课表页「预约」视图右下角加号按钮触发。
 * 功能说明：展示「展示在私教老师列表」的老师，每位老师后带一个开关。
 * - 开关打开（status='open'）：该老师在日历下方的预约列表中显示，可被预约。
 * - 开关关闭（status='rest'）：该老师不在预约列表中显示，无法被预约。
 *
 * 数据来源：由父组件 TrialBookingView 传入 teachers，
 * 弹窗列表与日历下老师列表均按 showInPrivateList 过滤，保证数据来源一致。
 */
import { View, Text, Switch } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import ClassAvatar from '@/components/class/ClassAvatar';
import Icon from '@/components/Icon';
import { hexColors } from '@/theme';
import type { TeacherUIModel } from '@/types/teacher';
import {
  createTeacherBookingConfig,
  readTeacherBookingConfigs,
  writeTeacherBookingConfig,
  type TeacherBookingConfig,
} from '@/utils/booking-one-on-one';

export interface TeacherBookingSwitchSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 教师列表（用于补全老师姓名、科目等信息） */
  teachers: TeacherUIModel[];
  /** 开关变化后通知父组件刷新 */
  onChange?: () => void;
}

/** 弹窗中展示的老师条目（基于 showInPrivateList 派生） */
interface SwitchTeacherItem {
  teacherId: string;
  teacherName: string;
  subject: string;
}

const TeacherBookingSwitchSheet: React.FC<TeacherBookingSwitchSheetProps> = ({
  visible,
  onClose,
  teachers,
  onChange,
}) => {
  const [configs, setConfigs] = useState<Record<string, TeacherBookingConfig>>(() =>
    readTeacherBookingConfigs(),
  );

  /** 从「展示在私教老师列表」的老师派生弹窗列表（与日历下老师列表同源） */
  const switchTeachers = useMemo<SwitchTeacherItem[]>(() => {
    return teachers
      .filter((t) => t.showInPrivateList === true)
      .map((teacher) => ({
        teacherId: teacher.id,
        teacherName: teacher.name,
        subject: teacher.subject,
      }));
  }, [teachers]);

  /** 判断某位老师是否开放预约 */
  const isTeacherOpen = useCallback(
    (teacherId: string) => configs[teacherId]?.status === 'open',
    [configs],
  );

  const openCount = useMemo(
    () => switchTeachers.filter((t) => isTeacherOpen(t.teacherId)).length,
    [switchTeachers, isTeacherOpen],
  );

  /** 切换老师预约开关：打开=open，关闭=rest */
  const handleToggle = useCallback(
    (teacher: SwitchTeacherItem, nextChecked: boolean) => {
      const existing = configs[teacher.teacherId];
      const nextConfig: TeacherBookingConfig = existing
        ? { ...existing, status: nextChecked ? 'open' : 'rest' }
        : createTeacherBookingConfig({
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            subject: teacher.subject,
            status: nextChecked ? 'open' : 'rest',
          });
      writeTeacherBookingConfig(nextConfig);
      setConfigs((prev) => ({ ...prev, [teacher.teacherId]: nextConfig }));
      onChange?.();
    },
    [configs, onChange],
  );

  return (
    <BottomSheet visible={visible} title="老师预约管理" onClose={onClose} height="70vh">
      <View className="bg-white px-page-padding pb-[40rpx]">
        {/* 顶部说明 */}
        <View className="flex items-center justify-between pb-[20rpx] pt-[8rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            打开开关的老师会在预约列表中显示并可被预约
          </Text>
          <View className="ml-[16rpx] flex-shrink-0 rounded-full bg-primary/10 px-[18rpx] py-[8rpx]">
            <Text className="text-[22rpx] font-medium text-primary">
              已开放 {openCount}/{switchTeachers.length}
            </Text>
          </View>
        </View>

        {/* 老师列表 */}
        {switchTeachers.length === 0 ? (
          <View className="center flex-col gap-[16rpx] py-[100rpx]">
            <Icon name="mdi-account-off" size={56} className="text-muted-foreground" />
            <Text className="text-[26rpx] text-muted-foreground">暂无可预约的老师</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-[16rpx]">
            {switchTeachers.map((teacher) => {
              const open = isTeacherOpen(teacher.teacherId);
              return (
                <View
                  key={teacher.teacherId}
                  className="flex items-center justify-between rounded-[24rpx] bg-muted/50 px-[24rpx] py-[20rpx]"
                >
                  <View className="flex min-w-0 flex-1 items-center gap-[18rpx]">
                    <ClassAvatar />
                    <View className="min-w-0 flex-1">
                      <Text className="block truncate text-[30rpx] font-semibold text-foreground">
                        {teacher.teacherName}
                      </Text>
                      <View className="mt-[4rpx] flex items-center gap-[8rpx]">
                        <Text className="text-[22rpx] text-muted-foreground">
                          {teacher.subject}
                        </Text>
                        <View
                          className={cn(
                            'center rounded-[8rpx] px-[10rpx] py-[2rpx]',
                            open ? 'bg-success/10' : 'bg-muted',
                          )}
                        >
                          <Text
                            className={cn(
                              'text-[20rpx] font-medium leading-none',
                              open ? 'text-success' : 'text-muted-foreground',
                            )}
                          >
                            {open ? '可预约' : '已关闭'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <Switch
                    checked={open}
                    color={hexColors.primary}
                    onChange={(e) => handleToggle(teacher, e.detail.value)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default TeacherBookingSwitchSheet;
