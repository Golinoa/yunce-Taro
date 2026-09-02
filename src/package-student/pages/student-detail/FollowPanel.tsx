/**
 * 学员详情 · 跟进 Tab
 *
 * 使用场景：跟进记录列表。
 * 功能说明：点击卡片进入 follow-record-form 编辑。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import React from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import type { FollowRecord } from '@/types/follow-record';

export interface FollowPanelProps {
  followRecords: FollowRecord[];
  onFollowClick: (record: FollowRecord) => void;
}

const FollowPanel: React.FC<FollowPanelProps> = ({ followRecords, onFollowClick }) => {
  return (
    <ScrollView scrollY className="h-full">
      <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
        {followRecords.length === 0 ? (
          <Empty description="暂无跟进记录" />
        ) : (
          <View className="flex flex-col gap-[20rpx]">
            {followRecords.map((record) => (
              <View
                key={record.id}
                className="bg-card rounded-[24rpx] p-[24rpx] shadow-soft press-scale"
                onClick={() => onFollowClick(record)}
              >
                <View className="flex items-start justify-between gap-[12rpx]">
                  <View className="flex-1 min-w-0">
                    <View className="flex items-center gap-[8rpx]">
                      <Icon name="mdi-text-box-outline" size={22} color="primary" />
                      <Text className="text-[26rpx] font-semibold text-foreground">跟进记录</Text>
                    </View>
                    <Text className="text-[26rpx] text-foreground block mt-[10rpx]">
                      {record.content}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground block mt-[10rpx]">
                      操作人：{record.operatorName || '-'}
                    </Text>
                  </View>
                  <Text className="text-[20rpx] text-muted-foreground flex-shrink-0">
                    {record.createdAt}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default FollowPanel;
