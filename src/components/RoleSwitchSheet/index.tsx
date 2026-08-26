/**
 * RoleSwitchSheet 身份切换底部弹窗
 * 用于 App 内快速切换当前身份
 * 底部提供"添加新身份"入口，进入独立角色切换页面
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';
import RoleCard from '@/components/RoleCard';
import { useAuth } from '@/utils/auth';
import { safeReLaunch } from '@/utils/navigation';

export interface RoleSwitchSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

const ROLE_DESCRIPTION: Record<string, string> = {
  principal: '管理机构、校区与教师',
  teacher: '管理班级、课程与学员',
  parent: '查看孩子课程与考勤',
};

const RoleSwitchSheet: React.FC<RoleSwitchSheetProps> = ({ visible, onClose }) => {
  const { profile, currentIdentity, switchIdentity } = useAuth();

  const identities = useMemo(() => profile?.identities || [], [profile]);

  const handleSwitch = useCallback(
    async (identityId: string) => {
      if (identityId === currentIdentity?.id) {
        onClose();
        return;
      }
      const { error } = await switchIdentity(identityId);
      if (error) {
        Taro.showToast({ title: error.message, icon: 'none' });
        return;
      }
      onClose();
      Taro.showToast({ title: '切换成功', icon: 'success' });
      // 切换后刷新首页
      await safeReLaunch('/pages/home/index');
    },
    [currentIdentity?.id, switchIdentity, onClose],
  );

  const handleAddIdentity = useCallback(() => {
    onClose();
    Taro.navigateTo({ url: '/package-auth/pages/role-switch/index' });
  }, [onClose]);

  return (
    <BottomSheet visible={visible} title="切换身份" onClose={onClose} maxHeight="70vh">
      <View className="px-page-padding pt-[24rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
        <View className="space-y-[24rpx]">
          {identities.map((identity) => (
            <RoleCard
              key={identity.id}
              role={identity.role}
              title={identity.organizationName}
              description={ROLE_DESCRIPTION[identity.role]}
              active={identity.id === currentIdentity?.id}
              mode="default"
              onClick={() => handleSwitch(identity.id)}
            />
          ))}
        </View>

        {/* 添加新身份 */}
        <View
          className={cn(
            'mt-[32rpx] flex items-center justify-center py-[24rpx] rounded-2xl border-2 border-dashed border-border',
            'active:bg-primary-5 transition-colors',
          )}
          onClick={handleAddIdentity}
        >
          <Text className="text-[28rpx] font-medium text-primary">+ 添加新身份</Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default RoleSwitchSheet;
