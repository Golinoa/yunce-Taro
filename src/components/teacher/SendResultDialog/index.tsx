/**
 * SendResultDialog - 发送工资单结果提示弹窗
 *
 * 使用场景：发送工资单后展示成功/失败结果
 * 功能：告知用户工资单已发送，列出微信提醒发送失败的教练
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Dialog from '@/components/Dialog';
import type { SendFailure } from '@/types/teacher';

export interface SendResultDialogProps {
  visible: boolean;
  successCount: number;
  failedList: SendFailure[];
  onClose: () => void;
}

const SendResultDialog: React.FC<SendResultDialogProps> = ({
  visible,
  successCount,
  failedList,
  onClose,
}) => {
  return (
    <Dialog visible={visible} onClose={onClose} maskClosable={false}>
      <View className="w-[600rpx] max-w-[86vw] rounded-[28rpx] bg-white overflow-hidden">
        <View className="pt-[48rpx] px-[36rpx]">
          <Text className="text-[36rpx] font-bold text-foreground text-center block">
            工资单已发送
          </Text>
        </View>
        <View className="px-[36rpx] py-[32rpx]">
          <Text className="text-[28rpx] text-foreground leading-relaxed text-center block">
            共发送 {successCount} 位教练，他们均可在小程序中查看并确认工资单。
          </Text>
          {failedList.length > 0 && (
            <Text className="text-[26rpx] text-muted-foreground leading-relaxed text-center block mt-[24rpx]">
              {failedList.map((t) => t.name).join('、')}的微信提醒发送失败，请转告其查看。
            </Text>
          )}
        </View>
        <View className="flex border-t border-border">
          <View className="flex-1 py-[28rpx] text-center press-bg bg-primary" onClick={onClose}>
            <Text className="text-[30rpx] font-semibold text-white">知道了</Text>
          </View>
        </View>
      </View>
    </Dialog>
  );
};

export default SendResultDialog;
