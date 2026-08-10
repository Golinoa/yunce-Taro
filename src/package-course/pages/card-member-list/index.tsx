/**
 * 卡种会员列表页
 *
 * 从卡种管理页底部统计点击进入，按「已售/在用/用完/未开卡/冻卡」维度
 * 展示该卡种下的会员列表，点击会员进入学员详情。
 *
 * @page /package-course/pages/card-member-list/index
 * @query cardTypeId   卡种 ID
 * @query cardTypeName 卡种名称
 * @query stat         统计维度
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { memberCardService } from '@/services/member-card';
import {
  CARD_TYPE_STAT_LABELS,
  type CardTypeStatKey,
  type MemberCardDetail,
} from '@/types/member-card';

/** 页面 URL 参数 */
interface PageQuery {
  cardTypeId: string;
  cardTypeName: string;
  stat: CardTypeStatKey;
}

/** 安全解码 URL 参数，兼容未编码或编码失败场景 */
const decodeParam = (value: string | undefined): string => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** 会员卡状态展示映射 */
const STATUS_LABELS: Record<MemberCardDetail['status'], string> = {
  active: '在用',
  inactive: '停用',
  usedUp: '已用完',
  notActivated: '未开卡',
  frozen: '冻结',
};

/** 会员卡状态标签样式映射 */
const STATUS_TAG_STYLES: Record<MemberCardDetail['status'], string> = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
  usedUp: 'bg-muted text-muted-foreground',
  notActivated: 'bg-warning/10 text-warning',
  frozen: 'bg-error/10 text-error',
};

/** 统计维度单位映射 */
const STAT_UNIT_LABELS: Record<CardTypeStatKey, string> = {
  sold: '张',
  inUse: '张',
  usedUp: '张',
  notActivated: '张',
  frozen: '张',
};

/** 金额分转元并千分位格式化 */
const formatPrice = (priceInCent: number): string => {
  const yuan = (priceInCent / 100).toFixed(2);
  return yuan.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const CardMemberListPage: React.FC = () => {
  const [query, setQuery] = useState<PageQuery>({
    cardTypeId: '',
    cardTypeName: '',
    stat: 'sold',
  });
  const [list, setList] = useState<MemberCardDetail[]>([]);
  const [loading, setLoading] = useState(false);

  /** 解析 URL 参数 */
  const resolveQuery = useCallback(() => {
    const params = Taro.getCurrentInstance()?.router?.params || {};
    setQuery({
      cardTypeId: (params.cardTypeId as string) || '',
      cardTypeName: decodeParam(params.cardTypeName as string),
      stat: (params.stat as CardTypeStatKey) || 'sold',
    });
  }, []);

  /** 加载会员列表 */
  const fetchList = useCallback(async () => {
    const { cardTypeId, stat } = query;
    if (!cardTypeId || !stat) return;

    setLoading(true);
    try {
      const data = await memberCardService.getListByCardType(cardTypeId, stat);
      setList(data);
    } finally {
      setLoading(false);
    }
  }, [query]);

  /** 首次挂载解析参数 */
  useEffect(() => {
    resolveQuery();
  }, [resolveQuery]);

  /** 参数就绪后加载数据并设置标题 */
  useEffect(() => {
    const { cardTypeId, cardTypeName, stat } = query;
    if (!cardTypeId || !stat) return;

    void fetchList();
    const title = `${cardTypeName || ''}${CARD_TYPE_STAT_LABELS[stat]}`;
    void Taro.setNavigationBarTitle({ title });
  }, [query, fetchList]);

  /** 页面重新显示时刷新 */
  useDidShow(() => {
    resolveQuery();
    if (query.cardTypeId && query.stat) {
      void fetchList();
    }
  });

  /** 点击会员进入学员详情 */
  const handleMemberClick = useCallback((member: MemberCardDetail) => {
    if (!member.studentId) return;
    void Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${member.studentId}`,
    });
  }, []);

  /** 顶部汇总数据 */
  const summary = useMemo(() => {
    const totalSales = list.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    return {
      count: list.length,
      totalSales,
    };
  }, [list]);

  /** 根据卡种类型构建剩余数据展示 */
  const getRemainingInfo = useCallback((member: MemberCardDetail) => {
    switch (member.cardTypeKind) {
      case 'count':
        return {
          value: `${member.remainingCount ?? 0}次`,
          label: '剩余次数',
          subText: member.cardTypeCount ? `共 ${member.cardTypeCount} 次` : undefined,
        };
      case 'time':
        return {
          value: `${member.remainingDays ?? 0}天`,
          label: '剩余天数',
          subText: member.cardTypeValidDays ? `共 ${member.cardTypeValidDays} 天` : undefined,
        };
      case 'stored':
        return {
          value: `¥${formatPrice(member.remainingAmount || 0)}`,
          label: '剩余金额',
          subText: member.purchasePrice ? `充值 ¥${formatPrice(member.purchasePrice)}` : undefined,
        };
      default:
        return { value: '-', label: '剩余' };
    }
  }, []);

  /** 渲染顶部汇总卡片 */
  const renderSummaryCard = () => (
    <View className="mx-[32rpx] mb-[20rpx] rounded-[28rpx] bg-white shadow-card px-[28rpx] py-[24rpx]">
      <Text className="text-[36rpx] font-bold text-foreground leading-tight">
        {query.cardTypeName}
      </Text>
      <View className="mt-[16rpx] flex flex-row items-center justify-between">
        <Text className="text-[28rpx] text-muted-foreground">
          {CARD_TYPE_STAT_LABELS[query.stat]}（{summary.count}
          {STAT_UNIT_LABELS[query.stat]}）
        </Text>
        <View className="inline-flex flex-row items-center rounded-[24rpx] bg-muted/10 px-[20rpx] py-[10rpx]">
          <Text className="text-[24rpx] text-muted-foreground">总销售额 </Text>
          <Text className="text-[28rpx] font-bold text-foreground">
            ¥{formatPrice(summary.totalSales)}
          </Text>
        </View>
      </View>
    </View>
  );

  /** 渲染单个会员详情卡片 */
  const renderMemberCard = (member: MemberCardDetail) => {
    const remaining = getRemainingInfo(member);

    return (
      <View
        key={member.id}
        className="mx-[32rpx] mb-[16rpx] rounded-[24rpx] bg-white shadow-card overflow-hidden"
      >
        {/* 头部：学员信息 + 剩余数据 */}
        <View
          className="flex flex-row items-center gap-[16rpx] px-[24rpx] py-[16rpx] border-b border-border press-scale"
          onClick={() => handleMemberClick(member)}
        >
          <Avatar name={member.studentName} avatarUrl={member.studentAvatar} size="md" />
          <View className="flex-1 min-w-0 flex flex-col justify-center gap-[6rpx]">
            <View className="flex flex-row items-center gap-[12rpx]">
              <Text className="text-[30rpx] font-bold text-foreground leading-none">
                {member.studentName}
              </Text>
              <View
                className={cn(
                  'inline-flex items-center rounded-[16rpx] px-[10rpx] py-[2rpx]',
                  STATUS_TAG_STYLES[member.status],
                )}
              >
                <Text className={cn('text-[20rpx] font-medium', STATUS_TAG_STYLES[member.status])}>
                  {STATUS_LABELS[member.status]}
                </Text>
              </View>
            </View>
            <Text className="text-[22rpx] text-muted-foreground leading-none">
              {member.studentPhone || '-'}
            </Text>
          </View>

          {/* 剩余数据：放到头部右侧空白区域 */}
          <View className="flex flex-col items-end gap-[4rpx] ml-[12rpx] min-w-[130rpx]">
            <Text className="text-[34rpx] font-bold text-foreground leading-none">
              {remaining.value}
            </Text>
            <View className="flex flex-row items-center gap-[6rpx]">
              <Text className="text-[18rpx] text-muted-foreground">{remaining.label}</Text>
              {remaining.subText && (
                <Text className="text-[18rpx] text-muted-foreground">· {remaining.subText}</Text>
              )}
            </View>
          </View>
        </View>

        {/* 时间信息三列 + 底部信息 */}
        <View className="px-[20rpx] py-[16rpx]">
          {/* 时间信息三列 */}
          <View className="flex flex-row items-center">
            <View className="flex-1 flex flex-col items-center gap-[4rpx] border-r border-border">
              <Text className="text-[20rpx] text-muted-foreground">购买时间</Text>
              <Text className="text-[22rpx] font-medium text-foreground">
                {member.purchaseAt || '-'}
              </Text>
            </View>
            <View className="flex-1 flex flex-col items-center gap-[4rpx] border-r border-border">
              <Text className="text-[20rpx] text-muted-foreground">开卡时间</Text>
              <Text className="text-[22rpx] font-medium text-foreground">
                {member.activatedAt || '-'}
              </Text>
            </View>
            <View className="flex-1 flex flex-col items-center gap-[4rpx]">
              <Text className="text-[20rpx] text-muted-foreground">到期时间</Text>
              <Text className="text-[22rpx] font-medium text-foreground">
                {member.expiredAt || '-'}
              </Text>
            </View>
          </View>

          {/* 底部信息 */}
          <View className="mt-[16rpx] pt-[12rpx] border-t border-border flex flex-col gap-[8rpx]">
            <View className="flex flex-row items-center justify-between">
              <Text className="text-[22rpx] text-muted-foreground">
                冻卡 {member.frozenCount}/{member.cardTypeFreezeCount}次 · {member.frozenDays}/
                {member.cardTypeFreezeDays}天
              </Text>
              <View className="flex flex-row items-baseline">
                <Text className="text-[20rpx] text-muted-foreground">购买价 </Text>
                <Text className="text-[26rpx] font-bold text-error">
                  ¥{formatPrice(member.purchasePrice)}
                </Text>
              </View>
            </View>
            <View className="flex flex-row items-center justify-between">
              <View className="flex flex-row items-center gap-[8rpx]">
                <Text className="text-[20rpx] text-muted-foreground">开卡人</Text>
                <Text className="text-[22rpx] font-medium text-foreground">
                  {member.operatorName || '-'}
                </Text>
              </View>
              {member.source && (
                <View className="rounded-[12rpx] bg-muted/10 px-[12rpx] py-[2rpx]">
                  <Text className="text-[20rpx] text-muted-foreground">{member.source}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (loading && list.length === 0) {
    return (
      <PageContainer>
        <Loading title="正在加载" text="正在加载会员列表，请稍候" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScrollView scrollY className="h-screen pt-[24rpx]">
        {list.length === 0 ? (
          <Empty description="暂无该状态的会员" icon="mdi-account-search" />
        ) : (
          <View className="flex flex-col pb-[32rpx]">
            {renderSummaryCard()}
            {list.map(renderMemberCard)}
          </View>
        )}
      </ScrollView>
    </PageContainer>
  );
};

export default CardMemberListPage;
