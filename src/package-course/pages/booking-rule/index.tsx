import { View, Text, ScrollView, Switch } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import {
  BOOKING_DEADLINE_OPTIONS,
  CANCEL_DEADLINE_OPTIONS,
  DAILY_LIMIT_OPTIONS,
  formatBookingDeadline,
  readBookingRules,
  WAITLIST_LIMIT_OPTIONS,
  fetchBookingRules,
  saveBookingRules,
  type BookingRuleState,
} from '@/utils/booking-rules';
import { withRouteGuard } from '@/utils/route-guard';

interface RuleSwitchCellProps {
  title: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  onEdit?: () => void;
  editLabel?: string;
}

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

const RuleSwitchCell: React.FC<RuleSwitchCellProps> = ({
  title,
  description,
  checked,
  onToggle,
  onEdit,
  editLabel = '编辑',
}) => {
  return (
    <View className="rounded-[24rpx] bg-white px-[24rpx] py-[24rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
      <View className="flex items-start justify-between gap-[24rpx]">
        <View className="min-w-0 flex-1">
          <Text className="block text-[30rpx] font-semibold text-[#1f2937]">{title}</Text>
          <Text className="mt-[10rpx] block text-[24rpx] leading-[36rpx] text-[#8b95a7]">
            {description}
          </Text>
        </View>

        <View className="flex items-center gap-[16rpx]">
          {checked && onEdit ? (
            <View
              className="rounded-full border border-[#f5c6bf] bg-[#fff6f4] px-[18rpx] py-[8rpx]"
              onClick={onEdit}
            >
              <Text className="text-[22rpx] font-medium text-[#de7567]">{editLabel}</Text>
            </View>
          ) : null}
          <Switch
            checked={checked}
            color="#f97b6d"
            onChange={(event) => onToggle(event.detail.value)}
          />
        </View>
      </View>
    </View>
  );
};

const BookingRulePage: React.FC = () => {
  const [rules, setRules] = useState<BookingRuleState>(() => readBookingRules());
  useEffect(() => {
    void fetchBookingRules()
      .then(setRules)
      .catch(() => undefined);
  }, []);

  const updateRule = useCallback(
    <K extends keyof BookingRuleState>(key: K, value: BookingRuleState[K]) => {
      setRules((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handlePickOption = useCallback(
    async (params: { title: string; options: string[]; onSelect: (index: number) => void }) => {
      const result = await showActionSheetSafely({
        alertText: params.title,
        itemList: params.options,
      });
      if (!result) {
        return;
      }
      params.onSelect(result.tapIndex);
    },
    [],
  );

  const waitlistSummary = useMemo(
    () => `最多候补 ${rules.waitlistLimit} 人`,
    [rules.waitlistLimit],
  );
  const cancelSummary = useMemo(
    () => `仅支持在开课前 ${rules.cancelDeadlineHours} 小时取消`,
    [rules.cancelDeadlineHours],
  );
  const deadlineSummary = useMemo(
    () => `${formatBookingDeadline(rules.bookingDeadlineMinutes)} 停止预约`,
    [rules.bookingDeadlineMinutes],
  );
  const dailyLimitSummary = useMemo(
    () => `每位学员每天最多预约 ${rules.dailyLimit} 节`,
    [rules.dailyLimit],
  );

  const handleSave = useCallback(async () => {
    try {
      await saveBookingRules(rules);
      Taro.showToast({ title: '预约规则已保存', icon: 'success' });
    } catch {
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }, [rules]);

  return (
    <PageContainer safeBottom className="bg-[#f6f7fb]">
      <View className="h-screen bg-[#f6f7fb]">
        <ScrollView scrollY className="h-full" showScrollbar={false}>
          <View className="px-[24rpx] pb-[56rpx] pt-[24rpx]">
            <View className="mb-[20rpx] rounded-[28rpx] bg-[linear-gradient(135deg,#fff6f4_0%,#ffffff_100%)] px-[28rpx] py-[24rpx] shadow-[0_8rpx_24rpx_rgba(249,123,109,0.08)]">
              <Text className="block text-[32rpx] font-semibold text-[#202939]">预约规则</Text>
              <Text className="mt-[10rpx] block text-[24rpx] leading-[36rpx] text-[#8b95a7]">
                统一管理家长端可见性、预约限制、候补与取消规则，适用于预约制课程场景。
              </Text>
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              基础设置
            </Text>
            <View className="flex flex-col gap-[16rpx]">
              <RuleSwitchCell
                title="家长端显示预约课程"
                description="关闭后，家长端不再展示当前校区的预约课程入口与可预约时段。"
                checked={rules.parentVisible}
                onToggle={(checked) => updateRule('parentVisible', checked)}
              />
              <RuleSwitchCell
                title="开启候补机制"
                description={waitlistSummary}
                checked={rules.waitlistEnabled}
                onToggle={(checked) => updateRule('waitlistEnabled', checked)}
                onEdit={() =>
                  void handlePickOption({
                    title: '候补人数上限',
                    options: WAITLIST_LIMIT_OPTIONS.map((item) => `最多 ${item} 人`),
                    onSelect: (index) =>
                      updateRule(
                        'waitlistLimit',
                        WAITLIST_LIMIT_OPTIONS[index] || rules.waitlistLimit,
                      ),
                  })
                }
              />
              <RuleSwitchCell
                title="允许取消预约"
                description={cancelSummary}
                checked={rules.cancelEnabled}
                onToggle={(checked) => updateRule('cancelEnabled', checked)}
                onEdit={() =>
                  void handlePickOption({
                    title: '取消预约截止时间',
                    options: CANCEL_DEADLINE_OPTIONS.map((item) => `开课前 ${item} 小时`),
                    onSelect: (index) =>
                      updateRule(
                        'cancelDeadlineHours',
                        CANCEL_DEADLINE_OPTIONS[index] || rules.cancelDeadlineHours,
                      ),
                  })
                }
              />
            </View>

            <Text className="mb-[12rpx] ml-[8rpx] mt-[28rpx] block text-[24rpx] font-medium text-[#8b95a7]">
              预约限制
            </Text>
            <View className="flex flex-col gap-[16rpx]">
              <RuleSwitchCell
                title="开启预约截止时间"
                description={deadlineSummary}
                checked={rules.bookingDeadlineEnabled}
                onToggle={(checked) => updateRule('bookingDeadlineEnabled', checked)}
                onEdit={() =>
                  void handlePickOption({
                    title: '预约截止时间',
                    options: BOOKING_DEADLINE_OPTIONS.map((item) => formatBookingDeadline(item)),
                    onSelect: (index) =>
                      updateRule(
                        'bookingDeadlineMinutes',
                        BOOKING_DEADLINE_OPTIONS[index] || rules.bookingDeadlineMinutes,
                      ),
                  })
                }
              />
              <RuleSwitchCell
                title="限制单日预约上限"
                description={dailyLimitSummary}
                checked={rules.dailyLimitEnabled}
                onToggle={(checked) => updateRule('dailyLimitEnabled', checked)}
                onEdit={() =>
                  void handlePickOption({
                    title: '单日预约上限',
                    options: DAILY_LIMIT_OPTIONS.map((item) => `每天最多 ${item} 节`),
                    onSelect: (index) =>
                      updateRule('dailyLimit', DAILY_LIMIT_OPTIONS[index] || rules.dailyLimit),
                  })
                }
              />
              <RuleSwitchCell
                title="仅限本校区预约"
                description="开启后，家长只能预约当前校区开放的课程时段。"
                checked={rules.campusOnly}
                onToggle={(checked) => updateRule('campusOnly', checked)}
              />
            </View>

            <View className="mt-[32rpx] rounded-[24rpx] bg-white px-[24rpx] py-[22rpx] shadow-[0_8rpx_24rpx_rgba(15,23,42,0.04)]">
              <Text className="block text-[28rpx] font-semibold text-[#202939]">当前生效摘要</Text>
              <Text className="mt-[12rpx] block text-[24rpx] leading-[38rpx] text-[#8b95a7]">
                {rules.parentVisible ? '家长端可见；' : '家长端隐藏；'}
                {rules.waitlistEnabled ? `${waitlistSummary}；` : '不启用候补；'}
                {rules.cancelEnabled ? `${cancelSummary}；` : '不允许取消预约；'}
                {rules.bookingDeadlineEnabled ? `${deadlineSummary}；` : '不限制预约截止时间；'}
                {rules.dailyLimitEnabled ? `${dailyLimitSummary}；` : '不限制单日预约次数；'}
                预约成功后直接生效；
                {rules.campusOnly ? '仅限本校区预约。' : '允许跨校区预约。'}
              </Text>
            </View>

            <View
              className="mt-[28rpx] flex h-[88rpx] items-center justify-center rounded-[24rpx] bg-[#f97b6d] shadow-[0_12rpx_28rpx_rgba(249,123,109,0.25)]"
              onClick={handleSave}
            >
              <Text className="text-[30rpx] font-semibold text-white">保存规则</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(BookingRulePage);
