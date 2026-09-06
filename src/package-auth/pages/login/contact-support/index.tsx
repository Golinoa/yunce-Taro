/**
 * 登录流程 · 联系客服页
 * 统一使用 SupportQrDialog（维修企微码）。
 */
import { View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import SupportQrDialog from '@/components/SupportQrDialog';

const ContactSupportPage: React.FC = () => {
  const [visible, setVisible] = useState(true);

  const handleClose = useCallback(() => {
    setVisible(false);
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      void Taro.navigateBack();
      return;
    }
    void Taro.reLaunch({ url: '/package-auth/pages/login/index' });
  }, []);

  return (
    <View className="min-h-screen bg-background">
      <SupportQrDialog visible={visible} onClose={handleClose} />
    </View>
  );
};

export default ContactSupportPage;
