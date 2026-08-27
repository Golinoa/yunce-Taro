/**
 * 校区配置引导弹窗（HomeCampusGuideDialog）
 *
 * 场景：新校长（principal/admin）入驻通过后首次进入首页，且机构尚未配置校区时弹出，
 * 引导用户去「我的」页面完成校区配置（我的页面已存在店铺管理配置引导）。
 * 仅弹一次（本地存储标记），避免打扰。
 */
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Dialog from '@/components/Dialog';

export const CAMPUS_GUIDE_SHOWN_KEY = 'yunce:home-campus-guide-shown';

/** 是否已展示过引导（读取本地标记） */
export function hasShownCampusGuide(): boolean {
  try {
    return Taro.getStorageSync(CAMPUS_GUIDE_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}

/** 标记引导已展示（用户点击去配置或暂不后调用，避免反复打扰） */
export function markCampusGuideShown(): void {
  try {
    Taro.setStorageSync(CAMPUS_GUIDE_SHOWN_KEY, '1');
  } catch {
    /* 静默 */
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 去配置回调（默认跳转「我的」Tab） */
  onGoConfig?: () => void;
}

const HomeCampusGuideDialog: React.FC<Props> = ({ visible, onClose, onGoConfig }) => {
  const handleGoConfig = () => {
    markCampusGuideShown();
    onClose();
    if (onGoConfig) {
      onGoConfig();
      return;
    }
    Taro.switchTab({ url: '/pages/profile/index' });
  };

  const handleDismiss = () => {
    markCampusGuideShown();
    onClose();
  };

  return (
    <Dialog visible={visible} onClose={handleDismiss}>
      <View className="w-[560rpx] rounded-[24rpx] bg-white px-[40rpx] pt-[40rpx] pb-[32rpx]">
        <Text className="block text-center text-[34rpx] font-semibold text-text-primary">
          欢迎使用松果排课
        </Text>
        <Text className="mt-[20rpx] block text-center text-[28rpx] leading-[44rpx] text-text-secondary">
          机构已开通！请先到「我的」页面完成校区配置，即可开始添加员工、创建课程与排课。
        </Text>
        <View className="mt-[36rpx] flex gap-[20rpx]">
          <Button
            className="flex-1 rounded-[16rpx] bg-bg-card text-[28rpx] text-text-secondary"
            onClick={handleDismiss}
          >
            暂不
          </Button>
          <Button
            className="flex-1 rounded-[16rpx] bg-primary text-[28rpx] text-white"
            onClick={handleGoConfig}
          >
            去配置
          </Button>
        </View>
      </View>
    </Dialog>
  );
};

export default HomeCampusGuideDialog;
