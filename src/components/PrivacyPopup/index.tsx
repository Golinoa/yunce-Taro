/**
 * PrivacyPopup - 微信隐私授权强制弹窗
 *
 * 仅在微信平台隐私授权流程中由 usePrivacyStore.visible 控制展示。
 * 关键点：
 *  - 「同意并继续」必须是原生 <Button open-type="agreePrivacyAuthorization">，
 *    微信基础库靠它识别用户的真实点击；点击后 onAgreePrivacyAuthorization 触发，
 *    再调用 store.agree() 放行被拦截的隐私接口。
 *  - 「暂不使用」调用 store.disagree()，被拦截接口以隐私未授权失败。
 *  - 不传 BottomSheet 的 onClose，避免点击遮罩把等待中的隐私接口卡在 pending。
 *  - 协议名称可点击跳转 wx.openPrivacyContract 查看完整协议。
 */
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import { usePrivacyStore, PRIVACY_AGREE_BUTTON_ID } from '@/stores/privacy';

const PrivacyPopup: React.FC = () => {
  const visible = usePrivacyStore((s) => s.visible);
  const contractName = usePrivacyStore((s) => s.contractName);

  const handleAgree = () => {
    usePrivacyStore.getState().agree();
  };

  const handleDisagree = () => {
    usePrivacyStore.getState().disagree();
  };

  const openContract = () => {
    Taro.openPrivacyContract({
      fail: () => {
        Taro.showToast({ title: '暂无法打开隐私协议', icon: 'none' });
      },
    });
  };

  return (
    <BottomSheet visible={visible} title="隐私保护指引" fillHeight scrollable={false}>
      <View className="flex flex-col h-full px-[40rpx] pt-[8rpx]">
        <ScrollView scrollY className="flex-1">
          <Text className="text-[28rpx] text-foreground leading-relaxed block">
            在你使用「松果排课」小程序服务之前，请仔细阅读
          </Text>
          <Text className="text-[28rpx] text-primary" onClick={openContract}>
            {contractName}
          </Text>
          <Text className="text-[28rpx] text-foreground leading-relaxed block mt-[20rpx]">
            当您点击“同意并继续”，即表示您已理解并同意我们按照上述指引收集、使用您的个人信息。我们仅在您授权范围内使用信息，并严格保护您的数据安全。
          </Text>
          <Text className="text-[26rpx] text-muted-foreground leading-relaxed block mt-[20rpx]">
            若不同意，部分功能（如定位、选择位置、读取剪切板等）将无法正常使用。
          </Text>
        </ScrollView>

        <View className="pt-[24rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
          <Button
            id={PRIVACY_AGREE_BUTTON_ID}
            openType="agreePrivacyAuthorization"
            onAgreePrivacyAuthorization={handleAgree}
            className="privacy-agree-btn"
          >
            同意并继续
          </Button>
          <View
            className="mt-[24rpx] flex items-center justify-center h-[88rpx] active:opacity-70"
            onClick={handleDisagree}
          >
            <Text className="text-[30rpx] text-muted-foreground">暂不使用</Text>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default PrivacyPopup;
