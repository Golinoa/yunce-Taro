/**
 * 未绑定邮箱时的轻量提醒：首页/我的顶条，可稍后静默 7 天
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import BindEmailSheet from '@/components/BindEmailSheet';
import Icon from '@/components/Icon';
import { useAuth } from '@/utils/auth';
import {
  clearEmailBindSnooze,
  shouldShowEmailBindReminder,
  snoozeEmailBindReminder,
} from '@/utils/email-bind-reminder';

export interface EmailBindReminderProps {
  className?: string;
}

const EmailBindReminder: React.FC<EmailBindReminderProps> = ({ className }) => {
  const { profile, bindAccountEmail, sendBindEmailCode } = useAuth();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVisible(shouldShowEmailBindReminder(profile));
  }, [profile]);

  const handleSnooze = useCallback(() => {
    snoozeEmailBindReminder();
    setSheetOpen(false);
    setVisible(false);
  }, []);

  const handleSubmit = useCallback(
    async (payload: { email: string; code: string; password: string }) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        const { error } = await bindAccountEmail(payload.email, payload.code, payload.password);
        if (error) {
          Taro.showToast({ title: error.message || '绑定失败', icon: 'none' });
          return;
        }
        clearEmailBindSnooze();
        setSheetOpen(false);
        setVisible(false);
        Taro.showToast({ title: '邮箱已绑定', icon: 'success' });
      } finally {
        setSubmitting(false);
      }
    },
    [bindAccountEmail, submitting],
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
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="mdi-email-outline" size="sm" color="primary" />
          <View className="flex-1 min-w-0">
            <Text className="text-[26rpx] text-foreground block">建议绑定邮箱</Text>
            <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">
              便于找回账号，不会频繁打扰
            </Text>
          </View>
          <Text className="text-[24rpx] text-primary shrink-0">去绑定</Text>
        </View>
        <Text
          className="text-[22rpx] text-muted-foreground shrink-0 px-[8rpx]"
          onClick={handleSnooze}
        >
          稍后
        </Text>
      </View>
      <BindEmailSheet
        visible={sheetOpen}
        submitting={submitting}
        onClose={() => setSheetOpen(false)}
        onSendCode={sendBindEmailCode}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default EmailBindReminder;
