import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import StudentAvatar from '@/components/student/StudentAvatar';
import { LEAD_SOURCE_META } from '@/constants/lead';
import type { LeadCardModel } from '@/types/lead';

/**
 * LeadCard - 线索卡片组件
 *
 * 参考图片布局：左侧头像、中间姓名/状态/描述、右侧电话按钮。
 * 点击卡片跳转线索详情页，点击电话按钮直接拨打。
 */

export interface LeadCardProps {
  data: LeadCardModel;
  className?: string;
}

/** 卡片上简化的状态标签 */
type CardLeadStatus = 'pending' | 'booked' | 'lost';

const CARD_STATUS_META: Record<CardLeadStatus, { label: string; className: string }> = {
  pending: {
    label: '待跟进',
    className: 'bg-[#fff7ed] text-[#f59e0b] border border-[#fbbf24]',
  },
  booked: {
    label: '已预约',
    className: 'bg-[#eff6ff] text-[#3b82f6] border border-[#60a5fa]',
  },
  lost: {
    label: '已流失',
    className: 'bg-[#f3f4f6] text-[#6b7280] border border-[#9ca3af]',
  },
};

/** 把原始线索状态映射为卡片上显示的三种状态 */
function mapToCardStatus(status: LeadCardModel['status']): CardLeadStatus | null {
  if (['new', 'pending', 'following', 'not_arrived'].includes(status)) return 'pending';
  if (['booked', 'arrived'].includes(status)) return 'booked';
  if (['closed', 'converted'].includes(status)) return 'lost';
  return null;
}

const LeadCard: React.FC<LeadCardProps> = ({ data, className }) => {
  const handleTap = useCallback(() => {
    Taro.navigateTo({ url: `/package-lead/pages/lead-detail/index?id=${data.id}` });
  }, [data.id]);

  const handlePhone = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (data.parent_phone) {
        Taro.makePhoneCall({ phoneNumber: data.parent_phone });
      }
    },
    [data.parent_phone],
  );

  const sourceMeta = LEAD_SOURCE_META[data.source_type];
  const formattedDate = dayjs(data.created_at).format('YYYY-MM-DD');
  const cardStatus = mapToCardStatus(data.status);
  const statusMeta = cardStatus ? CARD_STATUS_META[cardStatus] : null;

  return (
    <View
      className={cn(
        'bg-white rounded-[24rpx] p-[28rpx] shadow-soft press-scale flex gap-[24rpx]',
        className,
      )}
      onClick={handleTap}
    >
      {/* 左侧头像 */}
      <StudentAvatar name={data.child_name} src={data.avatar_url} size="lg" />

      {/* 中间信息 */}
      <View className="flex-1 min-w-0">
        <View className="flex items-center justify-between gap-[12rpx]">
          <View className="flex items-center gap-[12rpx] min-w-0">
            <Text className="text-[32rpx] font-semibold text-foreground truncate">
              {data.child_name}
            </Text>
            {data.child_nickname ? (
              <Text className="text-[24rpx] text-muted-foreground truncate max-w-[160rpx]">
                {data.child_nickname}
              </Text>
            ) : null}
            {statusMeta && (
              <View className={cn('px-[14rpx] py-[4rpx] rounded-full', statusMeta.className)}>
                <Text className="text-[22rpx] font-bold">{statusMeta.label}</Text>
              </View>
            )}
          </View>

          {/* 右侧电话：纯图标，无底色 */}
          {data.parent_phone && (
            <View
              className="flex h-[56rpx] w-[56rpx] flex-shrink-0 items-center justify-center active:opacity-60"
              onClick={handlePhone}
            >
              <Icon name="mdi-phone" size={28} color="primary" />
            </View>
          )}
        </View>
        <View className="mt-[8rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            {formattedDate} · #{sourceMeta.label}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default LeadCard;
