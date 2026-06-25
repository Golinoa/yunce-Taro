import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export interface LoginHelpDialogProps {
  visible: boolean;
  onClose: () => void;
}

const LoginHelpDialog: React.FC<LoginHelpDialogProps> = ({ visible, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      rafRef.current = requestAnimationFrame(() => {
        setAnimating(true);
      });
    } else {
      setAnimating(false);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [visible]);

  const handleTransitionEnd = () => {
    if (!animating) {
      setMounted(false);
    }
  };

  if (!mounted) return null;

  return (
    <View className="fixed inset-0 z-[220] flex items-center justify-center px-[32rpx]">
      <View
        className={cn(
          'absolute inset-0 transition-all duration-300',
          animating ? 'bg-black/48' : 'bg-transparent',
        )}
        onClick={onClose}
        catchMove
      />
      <View
        className={cn(
          'relative w-full max-w-[680rpx] rounded-[36rpx] bg-white px-[36rpx] py-[40rpx]',
          'transition-all duration-300 ease-out',
          animating ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        )}
        onTransitionEnd={handleTransitionEnd}
      >
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 mx-auto mb-[24rpx] flex items-center justify-center">
          <Icon name="help-circle-outline" size={54} className="text-primary" />
        </View>
        <Text className="text-[34rpx] font-semibold text-foreground text-center block mb-[12rpx]">
          登录遇到问题
        </Text>
        <Text className="text-[26rpx] text-foreground-secondary text-center block leading-[1.6] mb-[36rpx]">
          先按下面的方式自助排查，仍未解决再联系客服
        </Text>

        <View className="rounded-[28rpx] bg-primary/5 px-[28rpx] py-[24rpx] mb-[20rpx]">
          <View className="flex flex-row items-center gap-[16rpx] mb-[12rpx]">
            <View className="w-[56rpx] h-[56rpx] rounded-full bg-white flex items-center justify-center">
              <Icon name="account-circle-outline" size={32} className="text-primary" />
            </View>
            <Text className="text-[30rpx] font-semibold text-foreground">忘记账号</Text>
          </View>
          <Text className="text-[24rpx] leading-[1.7] text-foreground-secondary">
            建议先联系机构管理员核对手机号、姓名或机构信息，确认账号后再登录。
          </Text>
        </View>

        <View className="rounded-[28rpx] bg-primary/5 px-[28rpx] py-[24rpx] mb-[24rpx]">
          <View className="flex flex-row items-center gap-[16rpx] mb-[12rpx]">
            <View className="w-[56rpx] h-[56rpx] rounded-full bg-white flex items-center justify-center">
              <Icon name="lock-outline" size={32} className="text-primary" />
            </View>
            <Text className="text-[30rpx] font-semibold text-foreground">忘记密码</Text>
          </View>
          <Text className="text-[24rpx] leading-[1.7] text-foreground-secondary">
            如果账号已绑定邮箱，可切换到邮箱登录完成验证；若未绑定邮箱，请联系机构或客服处理。
          </Text>
        </View>

        <View className="rounded-[28rpx] border-[2rpx] border-dashed border-primary/35 bg-primary/3 px-[28rpx] py-[28rpx] mb-[28rpx]">
          <Text className="text-[30rpx] font-semibold text-foreground text-center block mb-[12rpx]">
            未能解决，联系客服
          </Text>
          <Text className="text-[24rpx] leading-[1.7] text-foreground-secondary text-center block mb-[20rpx]">
            这里预留客服二维码位置，后续替换为正式客服二维码图片即可。
          </Text>
          <View className="w-[240rpx] h-[240rpx] mx-auto rounded-[24rpx] border-[2rpx] border-dashed border-primary/45 bg-white flex items-center justify-center">
            <View className="flex flex-col items-center">
              <Icon name="qrcode" size={56} className="text-primary/60" />
              <Text className="text-[22rpx] text-muted-foreground mt-[12rpx]">客服二维码占位图</Text>
            </View>
          </View>
        </View>

        <View
          className="h-[96rpx] rounded-full flex items-center justify-center bg-primary active:opacity-90 transition-opacity shadow-login-btn"
          onClick={onClose}
        >
          <Text className="text-[32rpx] font-semibold text-white">我知道了</Text>
        </View>
      </View>
    </View>
  );
};

export default LoginHelpDialog;
