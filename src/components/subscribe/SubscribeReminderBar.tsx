import { View, Text } from '@tarojs/components';
import React from 'react';

export interface SubscribeReminderBarProps {
  visible: boolean;
  message: string;
  /** 点击「开启」：必须在用户点击的同步调用栈内调起微信面板，由调用方保证 */
  onEnable: () => void;
  /** 点击「关闭」：进入冷却期 */
  onDismiss: () => void;
  loading?: boolean;
}

/**
 * 内嵌在页面内容流里的「开启提醒」引导条（非 fixed 浮层）。
 *
 * 与 `SubscribeQuotaBanner` 的区别：后者固定在页面顶部并跳转到补充次数页；
 * 本组件嵌在内容流中（今日课表上方），点「开启」直接调起微信授权面板。
 * 两者都带关闭按钮，关闭后不再打扰。
 */
const SubscribeReminderBar: React.FC<SubscribeReminderBarProps> = ({
  visible,
  message,
  onEnable,
  onDismiss,
  loading = false,
}) => {
  if (!visible || !message) return null;

  return (
    <View className="mb-[20rpx] flex items-center gap-[16rpx] rounded-[16rpx] bg-warning/15 px-[24rpx] py-[20rpx]">
      <Text className="flex-1 text-[24rpx] leading-[36rpx] text-foreground">{message}</Text>
      <Text
        className="shrink-0 text-[24rpx] font-medium text-primary active:opacity-80"
        onClick={onEnable}
      >
        {loading ? '处理中' : '开启'}
      </Text>
      <Text
        className="shrink-0 text-[24rpx] text-foreground-secondary active:opacity-80"
        onClick={onDismiss}
      >
        关闭
      </Text>
    </View>
  );
};

export default SubscribeReminderBar;
