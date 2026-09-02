/**
 * 学员详情 · 卡包 Tab
 *
 * 使用场景：会员卡汇总、状态二级 Tab、卡面列表。
 * 功能说明：按 status 过滤；点击进 member-card-detail。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import Empty from '@/components/Empty';
import type { MemberCardDetail } from '@/types/member-card';
import {
  CARD_SUB_TABS,
  MEMBER_CARD_BG_MAP,
  MEMBER_CARD_OVERLAY_MAP,
  MEMBER_CARD_STATUS_MAP,
  type CardSubTabKey,
} from './student-detail-constants';

export interface PackagesPanelProps {
  memberCards: MemberCardDetail[];
  cardSubTab: CardSubTabKey;
  onCardSubTabChange: (key: CardSubTabKey) => void;
  memberCardStats: {
    totalCount: number;
    usedCount: number;
    remainingCount: number;
    totalAmount: number;
    usedAmount: number;
    remainingAmount: number;
  };
  onMemberCardClick: (card: MemberCardDetail) => void;
}

function filterCardsBySubTab(cards: MemberCardDetail[], subTab: CardSubTabKey): MemberCardDetail[] {
  return cards.filter((card) => {
    switch (subTab) {
      case 'active':
        return card.status === 'active';
      case 'frozen':
        return card.status === 'frozen';
      case 'notActivated':
        return card.status === 'notActivated';
      case 'inactive':
        return card.status === 'inactive' || card.status === 'usedUp';
      default:
        return true;
    }
  });
}

const PackagesPanel: React.FC<PackagesPanelProps> = ({
  memberCards,
  cardSubTab,
  onCardSubTabChange,
  memberCardStats,
  onMemberCardClick,
}) => {
  const filteredCards = filterCardsBySubTab(memberCards, cardSubTab);

  return (
    <ScrollView scrollY className="h-full">
      <View className="px-[32rpx] pt-[32rpx] pb-[200rpx]">
        <View className="bg-card rounded-[24rpx] p-[24rpx] shadow-soft mb-[24rpx]">
          <View className="flex flex-row gap-[24rpx]">
            <View className="flex-1 center-col">
              <Text className="text-[32rpx] font-bold text-foreground leading-none">
                {memberCardStats.totalCount}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">总计课时</Text>
            </View>
            <View className="w-[2rpx] bg-border-light" />
            <View className="flex-1 center-col">
              <Text className="text-[32rpx] font-bold text-foreground leading-none">
                {memberCardStats.usedCount}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">消耗课时</Text>
            </View>
            <View className="w-[2rpx] bg-border-light" />
            <View className="flex-1 center-col">
              <Text className="text-[32rpx] font-bold text-foreground leading-none">
                {memberCardStats.remainingCount}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">剩余课时</Text>
            </View>
          </View>
          <View className="h-[2rpx] bg-border-light my-[20rpx]" />
          <View className="flex flex-row gap-[24rpx]">
            <View className="flex-1 center-col">
              <Text className="text-[28rpx] font-bold text-foreground leading-none">
                ¥{(memberCardStats.totalAmount / 100).toFixed(0)}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">总储余额</Text>
            </View>
            <View className="w-[2rpx] bg-border-light" />
            <View className="flex-1 center-col">
              <Text className="text-[28rpx] font-bold text-foreground leading-none">
                ¥{(memberCardStats.usedAmount / 100).toFixed(0)}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">消耗金额</Text>
            </View>
            <View className="w-[2rpx] bg-border-light" />
            <View className="flex-1 center-col">
              <Text className="text-[28rpx] font-bold text-foreground leading-none">
                ¥{(memberCardStats.remainingAmount / 100).toFixed(0)}
              </Text>
              <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">剩余金额</Text>
            </View>
          </View>
        </View>

        <View className="flex flex-row items-center justify-between mb-[28rpx]">
          {CARD_SUB_TABS.map((tab) => {
            const isActive = cardSubTab === tab.key;
            return (
              <View
                key={tab.key}
                className="flex-1 center py-[16rpx]"
                onClick={() => onCardSubTabChange(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[26rpx] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <View className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rpx] h-[6rpx] rounded-full bg-primary" />
                )}
              </View>
            );
          })}
        </View>

        <View className="flex flex-col gap-[24rpx]">
          {filteredCards.map((card) => {
            const statusInfo = MEMBER_CARD_STATUS_MAP[card.status];
            const cardBgClass = MEMBER_CARD_BG_MAP[card.status];
            const cardOverlayClass = MEMBER_CARD_OVERLAY_MAP[card.status];
            const kindText =
              card.cardTypeKind === 'count'
                ? '次卡'
                : card.cardTypeKind === 'time'
                  ? '时间卡'
                  : '储值卡';
            const remainingText =
              card.cardTypeKind === 'count'
                ? `${card.remainingCount ?? 0}次`
                : card.cardTypeKind === 'time'
                  ? `${card.remainingDays ?? 0}天`
                  : `¥${((card.remainingAmount ?? 0) / 100).toFixed(2)}`;
            const totalText =
              card.cardTypeKind === 'count'
                ? `共 ${card.cardTypeCount ?? 0} 次`
                : card.cardTypeKind === 'time'
                  ? `共 ${card.cardTypeValidDays} 天`
                  : `充值 ¥${(card.purchasePrice / 100).toFixed(2)}`;
            return (
              <View
                key={card.id}
                className={cn(
                  'rounded-[28rpx] p-[28rpx] relative overflow-hidden shadow-soft press-scale',
                  cardBgClass,
                )}
                onClick={() => onMemberCardClick(card)}
              >
                {cardOverlayClass && (
                  <View className={cn('absolute inset-0 pointer-events-none', cardOverlayClass)} />
                )}
                <View className="absolute -right-[40rpx] -bottom-[40rpx] w-[180rpx] h-[180rpx] rounded-full bg-primary-foreground/10" />
                <View className="absolute top-[16rpx] right-[20rpx] text-[72rpx] font-bold text-primary-foreground/15 leading-none">
                  {kindText}
                </View>
                <View className="relative z-1">
                  <View className="flex items-start justify-between gap-[16rpx]">
                    <View className="flex-1 min-w-0">
                      <Text className="text-[32rpx] font-bold text-primary-foreground">
                        {card.cardTypeName}
                      </Text>
                      <Text className="text-[22rpx] text-primary-foreground/80 mt-[8rpx]">
                        有效{card.cardTypeKind === 'time' ? '天数' : '次数'} {remainingText}
                      </Text>
                    </View>
                    <View className="py-[6rpx] px-[16rpx] rounded-full bg-primary-foreground/20">
                      <Text className="text-[20rpx] text-primary-foreground font-medium">
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-[32rpx] flex items-end justify-between">
                    <View>
                      <Text className="text-[48rpx] font-bold text-primary-foreground leading-none">
                        {remainingText}
                      </Text>
                      <Text className="text-[22rpx] text-primary-foreground/80 mt-[8rpx]">
                        剩余{card.cardTypeKind === 'time' ? '天数' : '次数'}
                      </Text>
                    </View>
                    <Text className="text-[22rpx] text-primary-foreground/80">{totalText}</Text>
                  </View>
                </View>
              </View>
            );
          })}
          {filteredCards.length === 0 && <Empty description="暂无卡包" />}
        </View>
      </View>
    </ScrollView>
  );
};

export default PackagesPanel;
