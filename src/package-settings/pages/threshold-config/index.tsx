/**
 * 预警阈值配置页 — 已合并到「续费提醒」提醒设置
 * 保留路由兼容旧入口，进入后直接跳转。
 */
import { View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useEffect } from 'react';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { withRouteGuard } from '@/utils/route-guard';

const ThresholdConfig: React.FC = () => {
  useEffect(() => {
    void Taro.redirectTo({
      url: '/package-student/pages/renewal-reminder/index',
    });
  }, []);

  useDidShow(() => {
    void Taro.redirectTo({
      url: '/package-student/pages/renewal-reminder/index',
    });
  });

  return (
    <PageContainer className="bg-muted">
      <View className="flex items-center justify-center py-[200rpx]">
        <Loading text="正在打开续费提醒..." />
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ThresholdConfig);
