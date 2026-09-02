/**
 * PrivacyPopup - 微信隐私授权强制弹窗 / 拒绝后全局拦截层
 */
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import { usePrivacyStore, PRIVACY_AGREE_BUTTON_ID } from '@/stores/privacy';
import { promptPrivacyIfNeeded } from '@/utils/privacy-authorize';
import { privacyTrace } from '@/utils/privacy-debug';

const PrivacyPopup: React.FC = () => {
  const visible = usePrivacyStore((s) => s.visible);
  const contractName = usePrivacyStore((s) => s.contractName);
  const status = usePrivacyStore((s) => s.status);
  const pendingCount = usePrivacyStore((s) => s.pendingResolves.length);
  const prompting = usePrivacyStore((s) => s.prompting);
  const [retrying, setRetrying] = useState(false);

  const hasPending = pendingCount > 0;
  const denied = status === 'denied';
  const busy = prompting || retrying;

  useEffect(() => {
    privacyTrace('PrivacyPopup.renderState', {
      visible,
      status,
      pendingCount,
      hasPending,
      denied,
      prompting,
      retrying,
      buttonMode: hasPending ? 'native-agreePrivacyAuthorization' : 'view-retry(非原生)',
    });
  }, [visible, status, pendingCount, hasPending, denied, prompting, retrying]);

  useEffect(() => {
    if (visible) {
      privacyTrace('PrivacyPopup.mounted', { hasPending, denied });
    } else {
      privacyTrace('PrivacyPopup.hidden');
    }
  }, [visible, hasPending, denied]);

  const handleAgree = () => {
    privacyTrace('PrivacyPopup.handleAgree', { pendingCount });
    usePrivacyStore.getState().agree();
  };

  const handleDisagree = () => {
    privacyTrace('PrivacyPopup.handleDisagree', { pendingCount });
    usePrivacyStore.getState().disagree();
    Taro.showToast({
      title: '不同意隐私保护指引将无法使用本小程序',
      icon: 'none',
      duration: 2800,
    });
  };

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    privacyTrace('PrivacyPopup.handleRetry.start');
    setRetrying(true);
    try {
      const ok = await promptPrivacyIfNeeded();
      privacyTrace('PrivacyPopup.handleRetry.done', { ok });
      if (!ok) {
        Taro.showToast({
          title: '请同意隐私保护指引后继续使用',
          icon: 'none',
          duration: 2500,
        });
      }
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  const openContract = () => {
    privacyTrace('PrivacyPopup.openContract');
    Taro.openPrivacyContract({
      success: () => privacyTrace('PrivacyPopup.openContract.success'),
      fail: (err) => {
        privacyTrace('PrivacyPopup.openContract.fail', { err });
        Taro.showToast({ title: '暂无法打开隐私协议', icon: 'none' });
      },
    });
  };

  if (!visible) return null;

  return (
    <View className="fixed inset-0 z-[9999] flex flex-col justify-end" catchMove>
      <View className="absolute inset-0 bg-black/55" />
      <View className="relative z-10 w-full rounded-t-[40rpx] bg-white px-[40rpx] pt-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
        <Text className="text-[34rpx] font-semibold text-foreground block mb-[20rpx]">
          {denied ? '须同意隐私保护指引' : '隐私保护指引'}
        </Text>

        <ScrollView scrollY style={{ maxHeight: '42vh' }}>
          {denied ? (
            <Text className="text-[28rpx] text-foreground leading-relaxed block">
              你已拒绝隐私保护指引，无法继续登录使用。请阅读并同意
              <Text className="text-primary" onClick={openContract}>
                {contractName}
              </Text>
              后重试。
            </Text>
          ) : (
            <>
              <Text className="text-[28rpx] text-foreground leading-relaxed block">
                在你使用「松果排课」小程序服务之前，请仔细阅读
              </Text>
              <Text className="text-[28rpx] text-primary" onClick={openContract}>
                {contractName}
              </Text>
              <Text className="text-[28rpx] text-foreground leading-relaxed block mt-[20rpx]">
                点击「同意并继续」，即表示你已理解并同意我们按上述指引收集、使用相关信息。
              </Text>
              <Text className="text-[26rpx] text-muted-foreground leading-relaxed block mt-[20rpx]">
                若不同意，将无法登录并正常使用本小程序。
              </Text>
            </>
          )}
        </ScrollView>

        <View className="pt-[28rpx]">
          {hasPending ? (
            <>
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
                <Text className="text-[30rpx] text-muted-foreground">不同意</Text>
              </View>
            </>
          ) : (
            <View
              className={`h-[96rpx] rounded-full flex items-center justify-center bg-primary active:opacity-90 ${
                busy ? 'opacity-60' : ''
              }`}
              onClick={() => {
                if (busy) return;
                void handleRetry();
              }}
            >
              <Text className="text-[32rpx] font-semibold text-white">
                {busy ? '正在唤起授权…' : '同意隐私保护指引并继续'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default PrivacyPopup;
