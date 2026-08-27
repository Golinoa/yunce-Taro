/**
 * 门店入驻申请中页 pages/store-entry/pending/index
 *
 * 表单提交成功后进入：一句话状态提示 + 联系客服（微信二维码，点击放大可长按保存）。
 */
import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/** 分包静态资源，构建时 copy 至 dist/package-settings/assets/ */
const WX_QR_CODE = '/package-settings/assets/wx.jpg';

const StoreEntryPendingPage: React.FC = () => {
  usePrimaryNavigationBar();
  const router = useRouter();
  const status = router.params.status || 'pending';
  const storeName = router.params.storeName ? decodeURIComponent(router.params.storeName) : '';

  const isOpened = status === 'approved';

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: isOpened ? '入驻成功' : '申请中' });
  }, [isOpened]);

  const tip = useMemo(() => {
    if (isOpened) {
      return storeName
        ? `门店入驻成功，校区「${storeName}」已创建，可在校区列表中查看。`
        : '门店入驻成功，校区已创建，可在校区列表中查看。';
    }
    return '您的门店入驻申请已提交，工作人员将在 1-3 个工作日内与您联系。';
  }, [isOpened, storeName]);

  const handlePreviewQr = useCallback(() => {
    void Taro.previewImage({ current: WX_QR_CODE, urls: [WX_QR_CODE] });
  }, []);

  return (
    <PageContainer safeBottom className="px-[32rpx] py-[32rpx]">
      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[36rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)] mb-[24rpx]">
        <View className="w-[96rpx] h-[96rpx] rounded-full bg-primary/10 flex items-center justify-center mb-[24rpx]">
          <Icon
            name={isOpened ? 'mdi-check-circle-outline' : 'mdi-clock-outline'}
            size={52}
            className="text-primary"
          />
        </View>
        <Text className="text-[36rpx] font-semibold text-foreground block mb-[10rpx]">
          {isOpened ? '入驻成功' : '申请审核中'}
        </Text>
        <Text className="text-[28rpx] leading-[1.7] text-muted-foreground block">{tip}</Text>
      </View>

      <View className="rounded-[32rpx] bg-white px-[32rpx] py-[40rpx] shadow-[0_16rpx_48rpx_rgba(59,110,245,0.08)]">
        <View className="flex flex-row items-center gap-[12rpx] mb-[24rpx]">
          <Icon name="headset" size={40} className="text-primary" />
          <Text className="text-[32rpx] font-semibold text-foreground">联系客服</Text>
          <Text className="text-[24rpx] text-muted-foreground">在线客服</Text>
        </View>

        <View className="flex flex-col items-center" onClick={handlePreviewQr}>
          <Image
            src={WX_QR_CODE}
            mode="aspectFit"
            className="w-[320rpx] h-[320rpx] rounded-[28rpx] border-[2rpx] border-border"
            showMenuByLongpress
          />
          <Text className="text-[24rpx] text-muted-foreground text-center block mt-[24rpx] leading-[1.7]">
            点击图片放大，长按可保存微信二维码
          </Text>
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(StoreEntryPendingPage);
