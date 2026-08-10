/**
 * 教室表单页 - package-settings/pages/room-form/index
 *
 * 已合并到场地设置页（venue-form），此页面仅做兼容重定向。
 * 所有新增 / 编辑教室（场地）操作请使用 /package-settings/pages/venue-form/index。
 */
import Taro from '@tarojs/taro';
import React, { useEffect } from 'react';

const RoomFormPage: React.FC = () => {
  const instance = Taro.getCurrentInstance();
  const roomId = decodeURIComponent(instance?.router?.params?.id || '');

  useEffect(() => {
    const url = roomId
      ? `/package-settings/pages/venue-form/index?id=${roomId}`
      : '/package-settings/pages/venue-form/index';
    Taro.redirectTo({ url });
  }, [roomId]);

  return null;
};

definePageConfig({
  navigationBarTitleText: '场地设置',
});

export default RoomFormPage;
