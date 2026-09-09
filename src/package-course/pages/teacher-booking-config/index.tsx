import { View, Text, ScrollView, Textarea, Switch } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import {
  createTeacherBookingConfig,
  getTeacherBookingNextSlotSummary,
  getTeacherBookingWeekdaySummary,
  readTeacherBookingConfig,
  fetchTeacherBookingConfig,
  saveTeacherBookingConfig,
  type TeacherBookingConfig,
  type TeacherBookingStatus,
  type TeacherBookingTimeSlot,
} from '@/utils/booking-one-on-one';
import { getBookingRuleSummaryList, readBookingRules } from '@/utils/booking-rules';
import { withRouteGuard } from '@/utils/route-guard';

const WEEKDAY_OPTIONS = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
];

const QUICK_TIME_SLOT_OPTIONS = [
  { label: '09:00-10:00', startTime: '09:00', endTime: '10:00' },
  { label: '10:30-11:30', startTime: '10:30', endTime: '11:30' },
  { label: '14:00-15:00', startTime: '14:00', endTime: '15:00' },
  { label: '16:00-17:00', startTime: '16:00', endTime: '17:00' },
  { label: '19:00-20:00', startTime: '19:00', endTime: '20:00' },
];

const ADVANCE_DAY_OPTIONS = [7, 14, 21, 30];
const CAPACITY_OPTIONS = [1, 2, 3, 4];

function isActionSheetCancelError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const errMsg = 'errMsg' in error ? String((error as { errMsg?: unknown }).errMsg || '') : '';
  return errMsg.includes('showActionSheet:fail cancel');
}

async function showActionSheetSafely(option: Taro.showActionSheet.Option) {
  return new Promise<Taro.showActionSheet.SuccessCallbackResult | null>((resolve, reject) => {
    const result = Taro.showActionSheet({
      ...option,
      fail: (error) => {
        option.fail?.(error);
        if (isActionSheetCancelError(error)) {
          resolve(null);
          return;
        }
        reject(error);
      },
      success: (res) => {
        option.success?.(res);
        resolve(res);
      },
    });

    result.catch((error) => {
      if (isActionSheetCancelError(error)) {
        resolve(null);
        return null;
      }
      reject(error);
      return null;
    });
  });
}

function buildTimeSlotId(teacherId: string, startTime: string, endTime: string): string {
  return `${teacherId}-${startTime.replace(':', '')}-${endTime.replace(':', '')}`;
}

const BookingTeacherConfigPage: React.FC = () => {
  const routerParams = useMemo(() => Taro.getCurrentInstance().router?.params || {}, []);
  const teacherId = decodeURIComponent(routerParams.teacherId || '');
  const teacherName = decodeURIComponent(routerParams.teacherName || '未命名老师');
  const subject = decodeURIComponent(routerParams.subject || '未配置课程');
  const campusId = decodeURIComponent(routerParams.campusId || '');
  const campusName = decodeURIComponent(routerParams.campusName || '未分配校区');

  const [config, setConfig] = useState<TeacherBookingConfig>(() => {
    if (!teacherId) {
      return createTeacherBookingConfig({
        teacherId: 'unknown',
        teacherName,
        subject,
        campusId,
        campusName,
      });
    }

    return (
      readTeacherBookingConfig(teacherId) ||
      createTeacherBookingConfig({
        teacherId,
        teacherName,
        subject,
        campusId,
        campusName,
      })
    );
  });
  useEffect(() => {
    if (!teacherId) return;
    void fetchTeacherBookingConfig(teacherId)
      .then((remote) => {
        if (remote) setConfig(remote);
      })
      .catch(() => undefined);
  }, [teacherId]);
  const ruleSummaryList = useMemo(() => getBookingRuleSummaryList(readBookingRules()), []);

  const updateConfig = useCallback(
    <K extends keyof TeacherBookingConfig>(key: K, value: TeacherBookingConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleStatusChange = useCallback(
    (status: TeacherBookingStatus) => {
      updateConfig('status', status);
    },
    [updateConfig],
  );

  const handleWeekdayToggle = useCallback((weekday: number) => {
    setConfig((prev) => {
      const exists = prev.availableWeekdays.includes(weekday);
      return {
        ...prev,
        availableWeekdays: exists
          ? prev.availableWeekdays.filter((item) => item !== weekday)
          : [...prev.availableWeekdays, weekday].sort((left, right) => left - right),
      };
    });
  }, []);

  const handleAddTimeSlot = useCallback(async () => {
    const result = await showActionSheetSafely({
      alertText: '快速添加时段',
      itemList: QUICK_TIME_SLOT_OPTIONS.map((item) => item.label),
    });
    if (!result) {
      return;
    }

    const selected = QUICK_TIME_SLOT_OPTIONS[result.tapIndex];
    if (!selected) {
      return;
    }

    setConfig((prev) => {
      const nextSlot: TeacherBookingTimeSlot = {
        id: buildTimeSlotId(prev.teacherId, selected.startTime, selected.endTime),
        startTime: selected.startTime,
        endTime: selected.endTime,
      };

      if (prev.timeSlots.some((item) => item.id === nextSlot.id)) {
        Taro.showToast({ title: '该时段已存在', icon: 'none' });
        return prev;
      }

      return {
        ...prev,
        timeSlots: [...prev.timeSlots, nextSlot].sort((left, right) =>
          `${left.startTime}-${left.endTime}`.localeCompare(`${right.startTime}-${right.endTime}`),
        ),
      };
    });
  }, []);

  const handleRemoveTimeSlot = useCallback((slotId: string) => {
    setConfig((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((slot) => slot.id !== slotId),
    }));
  }, []);

  const handleEditAdvanceDays = useCallback(async () => {
    const result = await showActionSheetSafely({
      alertText: '可提前预约天数',
      itemList: ADVANCE_DAY_OPTIONS.map((item) => `提前 ${item} 天开放`),
    });
    if (!result) {
      return;
    }

    updateConfig('advanceDays', ADVANCE_DAY_OPTIONS[result.tapIndex] || config.advanceDays);
  }, [config.advanceDays, updateConfig]);

  const handleEditCapacity = useCallback(async () => {
    const result = await showActionSheetSafely({
      alertText: '每个时段可预约人数',
      itemList: CAPACITY_OPTIONS.map((item) => `${item} 人/时段`),
    });
    if (!result) {
      return;
    }

    updateConfig('capacityPerSlot', CAPACITY_OPTIONS[result.tapIndex] || config.capacityPerSlot);
  }, [config.capacityPerSlot, updateConfig]);

  const handleSave = useCallback(async () => {
    try {
      await saveTeacherBookingConfig(config);
      Taro.showToast({ title: '老师预约时间已保存', icon: 'success' });
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }, [config]);

  return (
    <PageContainer safeBottom className="bg-[#f6f7fb]">
      <View className="h-screen bg-[#f6f7fb]">
        <ScrollView scrollY className="h-full" showScrollbar={false}>
          <View className="px-[24rpx] pb-[56rpx] pt-[24rpx]">
            <View className="mb-[18rpx] rounded-[28rpx] bg-white px-[24rpx] py-[24rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              <View className="flex items-start justify-between gap-[16rpx]">
                <View className="min-w-0 flex-1">
                  <Text className="block text-[34rpx] font-semibold text-[#202939]">
                    {config.teacherName}
                  </Text>
                  <Text className="mt-[10rpx] block text-[24rpx] text-[#8b95a7]">
                    {config.subject} · {config.campusName}
                  </Text>
                </View>
                <View className="rounded-full bg-[#fff4f2] px-[16rpx] py-[8rpx]">
                  <Text className="text-[22rpx] font-medium text-[#de7567]">
                    {getTeacherBookingNextSlotSummary(config)}
                  </Text>
                </View>
              </View>
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              预约状态
            </Text>
            <View className="mb-[24rpx] flex gap-[16rpx]">
              {[
                { label: '开放预约', value: 'open' as TeacherBookingStatus },
                { label: '休息中', value: 'rest' as TeacherBookingStatus },
                { label: '未设置', value: 'unset' as TeacherBookingStatus },
              ].map((item) => {
                const active = config.status === item.value;
                return (
                  <View
                    key={item.value}
                    className={
                      active
                        ? 'flex-1 rounded-[22rpx] border border-[#f5c6bf] bg-[#fff4f2] px-[18rpx] py-[20rpx]'
                        : 'flex-1 rounded-[22rpx] border border-[#e8ecf3] bg-white px-[18rpx] py-[20rpx]'
                    }
                    onClick={() => handleStatusChange(item.value)}
                  >
                    <Text
                      className={
                        active
                          ? 'text-[28rpx] font-semibold text-[#de7567]'
                          : 'text-[28rpx] text-[#5b6475]'
                      }
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              开放星期
            </Text>
            <View className="mb-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              <Text className="mb-[18rpx] block text-[24rpx] text-[#8b95a7]">
                当前：{getTeacherBookingWeekdaySummary(config.availableWeekdays)}
              </Text>
              <View className="flex flex-wrap gap-[14rpx]">
                {WEEKDAY_OPTIONS.map((item) => {
                  const active = config.availableWeekdays.includes(item.value);
                  return (
                    <View
                      key={item.value}
                      className={
                        active
                          ? 'rounded-full border border-[#f5c6bf] bg-[#fff4f2] px-[20rpx] py-[10rpx]'
                          : 'rounded-full border border-[#e8ecf3] bg-[#f9fafb] px-[20rpx] py-[10rpx]'
                      }
                      onClick={() => handleWeekdayToggle(item.value)}
                    >
                      <Text
                        className={
                          active
                            ? 'text-[24rpx] font-medium text-[#de7567]'
                            : 'text-[24rpx] text-[#5b6475]'
                        }
                      >
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              开放时段
            </Text>
            <View className="mb-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              <View className="mb-[18rpx] flex items-center justify-between">
                <Text className="text-[28rpx] font-semibold text-[#202939]">时段列表</Text>
                <View
                  className="rounded-full border border-[#f5c6bf] bg-[#fff4f2] px-[18rpx] py-[8rpx]"
                  onClick={() => void handleAddTimeSlot()}
                >
                  <Text className="text-[22rpx] font-medium text-[#de7567]">新增时段</Text>
                </View>
              </View>

              {config.timeSlots.length === 0 ? (
                <Text className="block py-[36rpx] text-center text-[24rpx] text-[#8b95a7]">
                  当前还没有设置可预约时段
                </Text>
              ) : (
                <View className="flex flex-col gap-[14rpx]">
                  {config.timeSlots.map((slot) => (
                    <View
                      key={slot.id}
                      className="flex items-center justify-between rounded-[20rpx] bg-[#f8fafc] px-[20rpx] py-[18rpx]"
                    >
                      <View className="flex items-center gap-[12rpx]">
                        <Icon name="mdi-clock-outline" size="xs" color="mutedForeground" />
                        <Text className="text-[28rpx] text-[#202939]">
                          {slot.startTime}-{slot.endTime}
                        </Text>
                      </View>
                      <View onClick={() => handleRemoveTimeSlot(slot.id)}>
                        <Text className="text-[24rpx] font-medium text-[#de7567]">删除</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              预约限制
            </Text>
            <View className="mb-[24rpx] rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              {ruleSummaryList.length ? (
                <View className="mb-[18rpx] flex flex-wrap gap-[12rpx]">
                  {ruleSummaryList.map((summary) => (
                    <View key={summary} className="rounded-full bg-[#fff4f2] px-[16rpx] py-[8rpx]">
                      <Text className="text-[22rpx] text-[#de7567]">{summary}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View
                className="flex items-center justify-between border-b border-[#eef2f7] py-[18rpx]"
                onClick={() => void handleEditAdvanceDays()}
              >
                <Text className="text-[28rpx] text-[#202939]">开放预约周期</Text>
                <View className="flex items-center gap-[10rpx]">
                  <Text className="text-[24rpx] text-[#8b95a7]">未来 {config.advanceDays} 天</Text>
                  <Icon name="mdi-chevron-right" size="xs" color="mutedForeground" />
                </View>
              </View>
              <View
                className="flex items-center justify-between py-[18rpx]"
                onClick={() => void handleEditCapacity()}
              >
                <Text className="text-[28rpx] text-[#202939]">每个时段人数</Text>
                <View className="flex items-center gap-[10rpx]">
                  <Text className="text-[24rpx] text-[#8b95a7]">{config.capacityPerSlot} 人</Text>
                  <Icon name="mdi-chevron-right" size="xs" color="mutedForeground" />
                </View>
              </View>
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              补充说明
            </Text>
            <View className="rounded-[28rpx] bg-white px-[24rpx] py-[22rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              <View className="mb-[18rpx] flex items-center justify-between">
                <Text className="text-[28rpx] font-semibold text-[#202939]">对家长展示备注</Text>
                <View className="flex items-center gap-[12rpx]">
                  <Text className="text-[22rpx] text-[#8b95a7]">家长端可见</Text>
                  <Switch checked={config.status === 'open'} color="#f97b6d" disabled />
                </View>
              </View>
              <Textarea
                value={config.notes}
                placeholder="例如：需自备瑜伽垫、适合零基础学员、请提前10分钟到店"
                maxlength={120}
                className="min-h-[180rpx] w-full rounded-[20rpx] bg-[#f8fafc] px-[20rpx] py-[18rpx] text-[26rpx] text-[#202939]"
                onInput={(event) => updateConfig('notes', event.detail.value)}
              />
            </View>

            <View
              className="mt-[28rpx] flex h-[88rpx] items-center justify-center rounded-[24rpx] bg-[#f97b6d] shadow-[0_12rpx_28rpx_rgba(249,123,109,0.25)]"
              onClick={handleSave}
            >
              <Text className="text-[30rpx] font-semibold text-white">保存预约设置</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BookingTeacherConfigPage);
