/**
 * SendSalarySheet - 发送工资单结果弹窗
 *
 * 使用场景：薪资发放页面全部核对完成后，点击"发送工资单"触发
 * 功能：直接发送工资单并展示发送结果，无需二次确认
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import type { SendResult } from '@/types/teacher';

export interface SendSalarySheetProps {
  visible: boolean;
  count: number;
  submitting?: boolean;
  result?: SendResult;
  onClose: () => void;
}

const SendSalarySheet: React.FC<SendSalarySheetProps> = ({
  visible,
  count,
  submitting = false,
  result,
  onClose,
}) => {
  const successCount = result?.success.length ?? 0;
  const failedList = result?.failed ?? [];

  return (
    <BottomSheet visible={visible} title="发送工资单" onClose={onClose} height="46vh">
      <View className="px-[32rpx] pt-[12rpx] pb-[48rpx]">
        {submitting ? (
          <View className="flex flex-col items-center py-[48rpx]">
            <View className="w-[80rpx] h-[80rpx] rounded-full border-[4rpx] border-primary border-t-transparent animate-spin mb-[24rpx]" />
            <Text className="text-[28rpx] text-foreground leading-relaxed text-center">
              正在向
              <Text className="font-bold text-primary mx-[6rpx]">{count}</Text>
              位教练发送工资单…
            </Text>
          </View>
        ) : (
          <>
            <View className="flex flex-col items-center mb-[32rpx]">
              <View className="w-[96rpx] h-[96rpx] rounded-full bg-success/15 flex items-center justify-center mb-[24rpx]">
                <Icon name="mdi-check" size={48} className="text-success" />
              </View>
              <Text className="text-[32rpx] font-bold text-foreground mb-[12rpx]">
                工资单已发送
              </Text>
              <Text className="text-[28rpx] text-foreground leading-relaxed text-center">
                已向
                <Text className="font-bold text-primary mx-[6rpx]">{successCount}</Text>
                位教练发送工资单
                {failedList.length > 0 && (
                  <>
                    ，
                    <Text className="font-bold text-destructive mx-[6rpx]">
                      {failedList.length}
                    </Text>
                    位发送失败
                  </>
                )}
              </Text>
            </View>

            {failedList.length > 0 && (
              <View className="bg-muted rounded-[16rpx] p-[24rpx] mb-[32rpx]">
                <Text className="text-[26rpx] text-muted-foreground mb-[12rpx]">
                  以下教练的微信提醒发送失败，请转告其查看：
                </Text>
                <Text className="text-[26rpx] text-foreground">
                  {failedList.map((t) => t.name).join('、')}
                </Text>
              </View>
            )}
          </>
        )}

        <View
          className={cn(
            'w-full py-[26rpx] rounded-full text-center text-[30rpx] font-semibold text-white press-scale',
            submitting ? 'bg-muted text-muted-foreground' : 'bg-primary shadow-primary',
          )}
          onClick={submitting ? undefined : onClose}
        >
          {submitting ? '发送中…' : '知道了'}
        </View>
      </View>
    </BottomSheet>
  );
};

export default SendSalarySheet;
