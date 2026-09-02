/**
 * 学员详情悬浮操作按钮
 *
 * 使用场景：卡包 Tab 发会员卡、跟进 Tab 写跟进。
 * 功能说明：按 activeTab 条件渲染，与原逻辑一致。
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import type { TabKey } from './student-detail-constants';

export interface StudentDetailFabProps {
  activeTab: TabKey;
  isTeacher: boolean;
  onIssueCard: () => void;
  onWriteFollow: () => void;
}

const StudentDetailFab: React.FC<StudentDetailFabProps> = ({
  activeTab,
  isTeacher,
  onIssueCard,
  onWriteFollow,
}) => {
  return (
    <>
      {activeTab === 'packages' && isTeacher && (
        <View className="fixed right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] z-10">
          <View
            className="w-[120rpx] h-[120rpx] rounded-full bg-gradient-primary shadow-elegant center flex flex-col gap-[4rpx] press-scale"
            onClick={onIssueCard}
          >
            <Icon name="mdi-plus" size={36} color="hsl(var(--primary-foreground))" />
            <Text className="text-[20rpx] text-primary-foreground font-medium">发会员卡</Text>
          </View>
        </View>
      )}

      {activeTab === 'follow' && (
        <View className="fixed right-[32rpx] bottom-[calc(32rpx+env(safe-area-inset-bottom))] z-10">
          <View
            className="w-[120rpx] h-[120rpx] rounded-full bg-gradient-primary shadow-elegant center flex flex-col gap-[4rpx] press-scale"
            onClick={onWriteFollow}
          >
            <Icon name="mdi-pencil" size={32} color="hsl(var(--primary-foreground))" />
            <Text className="text-[20rpx] text-primary-foreground font-medium">写跟进</Text>
          </View>
        </View>
      )}
    </>
  );
};

export default StudentDetailFab;
