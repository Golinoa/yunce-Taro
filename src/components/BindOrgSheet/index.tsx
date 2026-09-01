/**
 * BindOrgSheet - 选择身份「绑定机构」统一输码弹窗
 *
 * 使用场景：identity-select 点击「绑定机构」；不跳转 parent-onboarding。
 * 功能：单个邀请码输入 → 调用 POST /organization/bind-code（S 学员 / E 员工）。
 * 相关组件：BottomSheet、FormInput
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';

export interface BindOrgSheetProps {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (inviteCode: string) => void | Promise<void>;
}

const BindOrgSheet: React.FC<BindOrgSheetProps> = ({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!visible) {
      setCode('');
    }
  }, [visible]);

  const handleSubmit = useCallback(() => {
    if (submitting) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Taro.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    void onSubmit(trimmed);
  }, [code, onSubmit, submitting]);

  return (
    <BottomSheet visible={visible} title="绑定机构" onClose={onClose} height="auto" keyboardAware>
      <View className="flex flex-col gap-[24rpx] px-[8rpx] pb-[16rpx]">
        <Text className="text-[26rpx] leading-relaxed text-muted-foreground">
          请输入机构提供的邀请码。系统将自动识别学员码或员工码。
        </Text>
        <FormInput
          label="邀请码"
          variant="capsule"
          placeholder="请输入邀请码"
          value={code}
          onInput={(e) => setCode(e.detail.value.toUpperCase())}
          maxlength={32}
          adjustPosition={false}
          focus={visible}
          required
        />
        <View
          className={cn(
            'mt-[8rpx] center h-[96rpx] rounded-[28rpx] bg-gradient-primary active:opacity-90',
            submitting && 'opacity-60',
          )}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className="text-[32rpx] font-bold text-white">
            {submitting ? '绑定中...' : '确认绑定'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default BindOrgSheet;
