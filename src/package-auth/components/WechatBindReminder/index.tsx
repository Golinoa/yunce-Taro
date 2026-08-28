/**
 * 未绑定手机号时的轻量提醒：首页/我的顶条，可稍后静默 7 天，不挡业务
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import WechatBindDialog from '@/package-auth/components/WechatBindDialog';
import { useAuth } from '@/utils/auth';
import {
  clearWechatBindSnooze,
  shouldShowWechatBindReminder,
  snoozeWechatBindReminder,
} from '@/utils/wechat-bind-reminder';

export interface WechatBindReminderProps {
  /** 外层额外 class（如首页内容区内边距） */
  className?: string;
}

const WechatBindReminder: React.FC<WechatBindReminderProps> = ({ className }) => {
  const { profile, bindWechatPhone } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVisible(shouldShowWechatBindReminder(profile));
  }, [profile]);

  const handleSnooze = useCallback(() => {
    snoozeWechatBindReminder();
    setDialogOpen(false);
    setVisible(false);
  }, []);

  const handleSubmit = useCallback(
    async (payload: { phone: string; password: string }) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const { error } = await bindWechatPhone(payload.phone, payload.password);
        if (error) {
          Taro.showToast({ title: error.message || '绑定失败', icon: 'none' });
          return;
        }
        clearWechatBindSnooze();
        setDialogOpen(false);
        setVisible(false);
        Taro.showToast({ title: '绑定成功', icon: 'success' });
      } finally {
        setSubmitting(false);
      }
    },
    [bindWechatPhone, submitting],
  );

  if (!visible) return null;

  return (
    <>
      <View
        className={
          className ||
          'mx-[28rpx] mb-[16rpx] px-[24rpx] py-[20rpx] rounded-[16rpx] bg-primary/8 flex items-center gap-[16rpx]'
        }
      >
        <View
          className="flex-1 flex items-center gap-[12rpx] active:opacity-80"
          onClick={() => setDialogOpen(true)}
        >
          <Icon name="mdi-phone" size="sm" color="primary" />
          <View className="flex-1 min-w-0">
            <Text className="text-[26rpx] text-foreground block">建议绑定手机号</Text>
            <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">
              无需短信，绑定后可找回账号
            </Text>
          </View>
          <Text className="text-[24rpx] text-primary shrink-0">去绑定</Text>
        </View>
        <View
          className="p-[8rpx] active:opacity-60 shrink-0"
          onClick={(e) => {
            e.stopPropagation?.();
            handleSnooze();
          }}
        >
          <Icon name="mdi-close" size="sm" color="muted" />
        </View>
      </View>

      <WechatBindDialog
        visible={dialogOpen}
        submitting={submitting}
        onClose={() => setDialogOpen(false)}
        onLater={handleSnooze}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default WechatBindReminder;
