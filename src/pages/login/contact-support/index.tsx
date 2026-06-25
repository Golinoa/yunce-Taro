import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

const ContactSupportPage: React.FC = () => {
  return (
    <View className="min-h-screen bg-background px-[32rpx] py-[32rpx]">
      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[36rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mb-[24rpx]">
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 flex items-center justify-center mb-[24rpx]">
          <Icon name="headset" size={52} className="text-primary" />
        </View>
        <Text className="text-[36rpx] font-semibold text-foreground block mb-[10rpx]">
          联系客服
        </Text>
        <Text className="text-[24rpx] leading-[1.7] text-muted-foreground block">
          如自助找回仍未解决，可通过客服二维码联系人工协助。当前先使用占位图，后续替换正式二维码。
        </Text>
      </View>

      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[40rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)]">
        <View className="w-[320rpx] h-[320rpx] mx-auto rounded-[28rpx] border-[2rpx] border-dashed border-primary/35 bg-primary/4 flex items-center justify-center">
          <View className="flex flex-col items-center">
            <Icon name="mdi-qrcode-scan" size={72} className="text-primary" />
            <Text className="text-[24rpx] text-muted-foreground mt-[16rpx]">
              客服二维码占位图
            </Text>
          </View>
        </View>
        <Text className="text-[24rpx] text-muted-foreground text-center block mt-[24rpx] leading-[1.7]">
          后续把这里替换成正式客服二维码图片即可，无需再改页面结构。
        </Text>
      </View>
    </View>
  );
};

export default ContactSupportPage;
