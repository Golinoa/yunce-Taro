/**
 * 卡种管理列表页
 *
 * 按「在售/停售」状态与「全部/班课/团课/私教」范围展示会员卡模板列表，
 * 分类数据与课程管理模块实时同步，支持新增卡种、查看编辑、首次进入展示引导弹窗。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/Card';
import ConfirmDialog from '@/components/ConfirmDialog';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import PageIntroSheet from '@/components/PageIntroSheet';
import SwappableCard from '@/components/SwappableCard';
import { CARD_KIND_LABELS, COURSE_FILTER_TABS } from '@/constants/card-type-ui';
import { cardTypeService } from '@/services/card-type';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useCardTypeStore } from '@/stores/card-type';
import { useCourseCategoryStore } from '@/stores/course-category';
import type { CardType, CardTypeStatus } from '@/types/card-type';
import type { CourseCategoryMode } from '@/types/course-category';
import type { CardTypeStatKey } from '@/types/member-card';
import { withRouteGuard } from '@/utils/route-guard';

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.package;

const STATUS_OPTIONS: { label: string; value: CardTypeStatus }[] = [
  { label: '在售', value: 'active' },
  { label: '停售', value: 'inactive' },
];

/** 金额千分位格式化 */
const formatPrice = (priceInCent: number): string => {
  const yuan = (priceInCent / 100).toFixed(2);
  return yuan.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** 顶部统计项 */
interface StatItem {
  label: string;
  value: number;
  unit: string;
}

/** 卡种管理列表页 */
const CardManagementPage: React.FC = () => {
  const { cards, loading, error, fetchList, remove } = useCardTypeStore();
  const { categories, fetchList: fetchCategories } = useCourseCategoryStore();

  // 在售/停售 状态过滤
  const [statusFilter, setStatusFilter] = useState<CardTypeStatus>('active');
  // 全部/班课/团课/私教 范围过滤（与课程分类 mode 对齐）
  const [courseFilter, setCourseFilter] = useState<'all' | CourseCategoryMode>('all');
  // 搜索
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  // 引导弹窗
  const [showIntro, setShowIntro] = useState(false);
  // 操作确认弹窗：停售 / 恢复 / 删除
  const [confirmAction, setConfirmAction] = useState<{
    type: 'stop' | 'restore' | 'delete';
    card: CardType;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  // 当前打开的滑动卡片 ID（互斥）
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  // 状态切换中
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 页面首次挂载时加载数据（解决 withRouteGuard 导致 useDidShow 首次未触发的问题）
  useEffect(() => {
    void fetchList();
    void fetchCategories();
  }, [fetchList, fetchCategories]);

  // 页面重新显示时刷新数据
  useDidShow(() => {
    void fetchList();
    void fetchCategories();
  });

  useEffect(() => {
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      setShowIntro(hidden !== true);
    } catch {
      setShowIntro(true);
    }
  }, []);

  const handleAdd = useCallback(() => {
    Taro.navigateTo({ url: '/package-course/pages/card-form/index' });
  }, []);

  const handleEdit = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-course/pages/card-form/index?id=${id}` });
  }, []);

  /** 复制卡种：跳转到新增页并传入原卡种 ID */
  const handleCopy = useCallback((id: string) => {
    Taro.navigateTo({ url: `/package-course/pages/card-form/index?copyFromId=${id}` });
  }, []);

  /** 点击卡片底部统计项，进入卡种会员列表 */
  const handleStatClick = useCallback(
    (card: CardType, stat: CardTypeStatKey, e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      Taro.navigateTo({
        url: `/package-course/pages/card-member-list/index?cardTypeId=${card.id}&cardTypeName=${encodeURIComponent(card.name)}&stat=${stat}`,
      });
    },
    [],
  );

  /** 打开操作确认弹窗 */
  const handleOpenConfirm = useCallback((type: 'stop' | 'restore' | 'delete', card: CardType) => {
    setConfirmAction({ type, card });
  }, []);

  /** 执行确认后的操作 */
  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { type, card } = confirmAction;
    setConfirmLoading(true);

    try {
      if (type === 'delete') {
        await remove(card.id);
        Taro.showToast({ title: '已删除', icon: 'success' });
      } else {
        const nextStatus = type === 'stop' ? 'inactive' : 'active';
        const actionText = type === 'stop' ? '停售' : '恢复';
        setTogglingId(card.id);
        await cardTypeService.toggleStatus(card.id, nextStatus);
        Taro.showToast({ title: `${actionText}成功`, icon: 'success' });
      }
      setConfirmAction(null);
      await fetchList();
    } catch {
      const errorText = type === 'delete' ? '删除失败' : type === 'stop' ? '停售失败' : '恢复失败';
      Taro.showToast({ title: errorText, icon: 'none' });
    } finally {
      setConfirmLoading(false);
      setTogglingId(null);
    }
  }, [confirmAction, fetchList, remove]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (card.status !== statusFilter) return false;
      if (courseFilter !== 'all') {
        // 仅当卡种适用分类中至少有一个属于当前 mode 时显示
        const matched = card.categoryIds.some((id) =>
          categories.find((cat) => cat.id === id && cat.mode === courseFilter),
        );
        if (!matched) return false;
      }
      if (searchKeyword.trim() && !card.name.includes(searchKeyword.trim())) return false;
      return true;
    });
  }, [cards, statusFilter, courseFilter, searchKeyword, categories]);

  const stats = useMemo<StatItem[]>(() => {
    const activeMembers = cards.reduce((sum, card) => sum + (card.stats.activeMembers || 0), 0);
    const totalSold = filteredCards.reduce((sum, card) => sum + card.stats.sold, 0);
    const storedBalance = cards
      .filter((card) => card.kind === 'stored')
      .reduce((sum, card) => sum + card.price * card.stats.inUse, 0);
    return [
      { label: '在用会员', value: activeMembers, unit: '人' },
      { label: '累计已售', value: totalSold, unit: '张' },
      { label: '储值结余', value: storedBalance, unit: '' },
    ];
  }, [filteredCards, cards]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList();
    setRefreshing(false);
  }, [fetchList]);

  const handleToggleSearch = useCallback(() => {
    setSearchVisible((prev) => !prev);
    if (searchVisible) {
      setSearchKeyword('');
    }
  }, [searchVisible]);

  if (loading && cards.length === 0) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载卡种数据中..." />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScrollView
        scrollY
        enhanced
        scrollWithAnimation
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => void handleRefresh()}
        className="h-screen"
        style={{ paddingBottom: 'calc(96rpx + env(safe-area-inset-bottom))' }}
      >
        <View className="px-[32rpx] py-[24rpx]">
          {/* 状态标签 + 搜索 */}
          <View className="flex flex-row items-center justify-between mb-[24rpx]">
            <View className="segment-wrap flex-1">
              {STATUS_OPTIONS.map((option) => {
                const isActive = statusFilter === option.value;
                return (
                  <View
                    key={option.value}
                    className={cn('segment-item', isActive ? 'segment-active' : 'segment-inactive')}
                    onClick={() => setStatusFilter(option.value)}
                  >
                    <Text
                      className={cn(
                        'text-[28rpx] font-medium',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {option.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View
              className="shrink-0 w-[80rpx] h-[72rpx] ml-[16rpx] rounded-[16rpx] bg-card flex items-center justify-center press-scale shadow-card"
              onClick={handleToggleSearch}
            >
              <Icon
                name={searchVisible ? 'mdi-close' : 'mdi-magnify'}
                size={32}
                color="mutedForeground"
              />
            </View>
          </View>

          {/* 搜索输入 */}
          {searchVisible && (
            <View className="mb-[24rpx]">
              <FormInput
                placeholder="搜索卡种名称"
                value={searchKeyword}
                onInput={(e) => setSearchKeyword(e.detail.value || '')}
                prefixNode={
                  <Icon
                    name="mdi-magnify"
                    size={28}
                    color="mutedForeground"
                    className="mr-[12rpx]"
                  />
                }
              />
            </View>
          )}

          {/* 课程范围过滤 */}
          <View className="flex flex-row gap-[16rpx] mb-[24rpx]">
            {COURSE_FILTER_TABS.map((option) => {
              const isActive = courseFilter === option.value;
              return (
                <View
                  key={option.value}
                  className={cn(
                    'py-[12rpx] px-[28rpx] rounded-[24rpx] text-[26rpx] font-medium press-scale',
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-card text-muted-foreground border-[2rpx] border-border',
                  )}
                  onClick={() => setCourseFilter(option.value)}
                >
                  <Text className={cn(isActive ? 'text-white' : 'text-muted-foreground')}>
                    {option.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 统计卡片 */}
          <Card className="p-[32rpx] mb-[24rpx]" shadow="card">
            <View className="flex flex-row items-center">
              {stats.map((stat, index) => (
                <React.Fragment key={stat.label}>
                  <View className="flex-1 flex flex-col items-center justify-center">
                    <View className="flex flex-row items-baseline">
                      <Text className="text-[40rpx] font-bold text-foreground leading-none">
                        {stat.value}
                      </Text>
                      <Text className="text-[24rpx] text-foreground ml-[4rpx]">{stat.unit}</Text>
                    </View>
                    <Text className="text-[24rpx] text-muted-foreground mt-[10rpx]">
                      {stat.label}
                    </Text>
                  </View>
                  {index < stats.length - 1 && <View className="w-[2rpx] h-[60rpx] bg-border" />}
                </React.Fragment>
              ))}
            </View>
          </Card>

          {/* 卡种列表 */}
          <View className="flex flex-col gap-[24rpx]">
            {error && cards.length === 0 ? (
              <Empty description={error} actionText="重新加载" onAction={() => void fetchList()} />
            ) : filteredCards.length === 0 ? (
              <Empty
                icon="mdi-package-variant"
                description="暂无会员卡安排哦"
                actionText="新增卡种"
                onAction={handleAdd}
              />
            ) : (
              filteredCards.map((card) => (
                <SwappableCard
                  key={card.id}
                  cardId={card.id}
                  direction="left"
                  openCardId={openCardId}
                  onOpenChange={setOpenCardId}
                  radiusClassName="rounded-[32rpx]"
                  actions={
                    card.status === 'active'
                      ? [
                          {
                            label: '复制',
                            onClick: () => handleCopy(card.id),
                          },
                          {
                            label: '停售',
                            variant: 'warning',
                            disabled: togglingId === card.id,
                            onClick: () => handleOpenConfirm('stop', card),
                          },
                        ]
                      : [
                          {
                            label: '恢复',
                            disabled: togglingId === card.id,
                            onClick: () => handleOpenConfirm('restore', card),
                          },
                          {
                            label: '复制',
                            onClick: () => handleCopy(card.id),
                          },
                          {
                            label: '删除',
                            variant: 'danger',
                            onClick: () => handleOpenConfirm('delete', card),
                          },
                        ]
                  }
                  onClick={() => handleEdit(card.id)}
                >
                  <CardItem card={card} onStatClick={(stat, e) => handleStatClick(card, stat, e)} />
                </SwappableCard>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* 新增卡种悬浮按钮（独立在页面流之外的 FAB） */}
      <View
        className="fixed bottom-[calc(8rpx+env(safe-area-inset-bottom))] right-[32rpx] z-100"
        onClick={handleAdd}
      >
        <View className="flex h-[88rpx] w-[88rpx] flex-col items-center justify-center rounded-full bg-primary shadow-float press-scale">
          <Icon name="mdi-plus" size="md" color="white" />
          <Text className="mt-[2rpx] text-[18rpx] font-medium text-white leading-none">新增</Text>
        </View>
      </View>

      {/* 操作确认弹窗：停售 / 恢复 / 删除 */}
      <ConfirmDialog
        visible={!!confirmAction}
        title={
          confirmAction?.type === 'delete'
            ? '确认删除'
            : confirmAction?.type === 'stop'
              ? '确认停售'
              : '确认恢复'
        }
        description={
          confirmAction
            ? confirmAction.type === 'delete'
              ? `删除后「${confirmAction.card.name}」将不可恢复，是否确认删除？`
              : confirmAction.type === 'stop'
                ? `停售后「${confirmAction.card.name}」将不可再售卖，是否确认停售？`
                : `恢复后「${confirmAction.card.name}」将重新上架售卖，是否确认恢复？`
            : ''
        }
        confirmText={
          confirmAction?.type === 'delete'
            ? '删除'
            : confirmAction?.type === 'stop'
              ? '停售'
              : '恢复'
        }
        tone={
          confirmAction?.type === 'delete'
            ? 'danger'
            : confirmAction?.type === 'stop'
              ? 'warning'
              : 'primary'
        }
        confirmLoading={confirmLoading}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />

      {/* 页面引导弹窗 */}
      <PageIntroSheet
        visible={showIntro}
        onClose={() => setShowIntro(false)}
        storageKey={INTRO_STORAGE_KEY}
        currentStep={5}
        totalSteps={6}
        title="第 5 步：设置卡种（价格表）"
        description="这里相当于门店的「卡种价目表/模板库」，配置好之后，前台给会员开卡/续费时直接选用。"
        bulletPoints={[
          '这里不是给某个会员开卡 —— 给具体会员开卡请到「会员管理」里办',
          '次卡：限定上课次数（如 10 次卡），可叠加有效期（如「1 个月内用完的 10 次卡」仍是次卡，不是时间卡）',
          '时间卡：只看时间不看次数（如「30 天月卡，期内不限次」才是真正的时间卡）',
          '储值卡：充钱进卡包，按节扣费，灵活但需配每节单价',
          '一个卡种可以同时归属多家分店共享',
        ]}
      />
    </PageContainer>
  );
};

/** 卡种卡片 */
const CardItem: React.FC<{
  card: CardType;
  onClick?: () => void;
  onStatClick?: (stat: CardTypeStatKey, e?: { stopPropagation?: () => void }) => void;
}> = ({ card, onClick, onStatClick }) => {
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (card.kind === 'count' && card.count) {
      parts.push(`有效 ${card.count} 次`);
    } else if (card.kind === 'time') {
      parts.push(`有效 ${card.validDays} 天`);
    } else if (card.kind === 'stored') {
      parts.push(`储值 ¥${formatPrice(card.price)}`);
    }
    const campusCount = card.campusCount || 0;
    parts.push(campusCount > 0 ? `${campusCount} 家通用` : '全校区通用');
    return parts.join(' · ');
  }, [card]);

  const bottomStats = useMemo(
    () => [
      { key: 'sold' as CardTypeStatKey, label: '已售', value: card.stats.sold },
      { key: 'inUse' as CardTypeStatKey, label: '在用', value: card.stats.inUse },
      { key: 'usedUp' as CardTypeStatKey, label: '用完', value: card.stats.usedUp },
      { key: 'notActivated' as CardTypeStatKey, label: '未开卡', value: card.stats.notActivated },
      { key: 'frozen' as CardTypeStatKey, label: '冻卡/停卡', value: card.stats.frozen },
    ],
    [card.stats],
  );

  return (
    <View
      className={cn('rounded-[32rpx] overflow-hidden shadow-card', onClick && 'press-scale')}
      onClick={onClick}
    >
      {/* 柔和主题色渐变卡片主体 */}
      <View className="bg-gradient-primary-soft p-[32rpx] relative overflow-hidden">
        {/* 装饰圆形：对角分布、减少重叠，保持通透感 */}
        <View className="absolute -top-[60rpx] -right-[60rpx] w-[220rpx] h-[220rpx] rounded-full bg-white/10" />
        <View className="absolute -bottom-[80rpx] -left-[40rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/8" />

        <View className="relative z-1 flex flex-col gap-[12rpx]">
          {/* 第一行：卡名称 + 类型标签 */}
          <View className="flex flex-row items-start justify-between gap-[16rpx]">
            <Text className="flex-1 min-w-0 text-[36rpx] font-bold text-white leading-tight">
              {card.name}
            </Text>
            <View className="shrink-0 inline-flex px-[16rpx] py-[6rpx] rounded-[12rpx] bg-white/25">
              <Text className="text-[22rpx] text-white font-medium whitespace-nowrap">
                {CARD_KIND_LABELS[card.kind]}
              </Text>
            </View>
          </View>

          {/* 第二行：副标题 + 价格 */}
          <View className="flex flex-row items-end justify-between gap-[16rpx]">
            <Text className="flex-1 min-w-0 text-[24rpx] text-white/80 leading-snug">
              {subtitle}
            </Text>
            <View className="shrink-0 flex flex-row items-baseline">
              <Text className="text-[28rpx] text-white font-medium mr-[4rpx]">¥</Text>
              <Text className="text-[44rpx] font-bold text-white">
                {formatPrice(card.price).split('.')[0]}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 底部统计：点击跳转到对应会员卡列表 */}
      <View className="bg-white px-[16rpx] py-[24rpx]">
        <View className="flex flex-row items-center">
          {bottomStats.map((stat, index) => (
            <React.Fragment key={stat.key}>
              <View
                className="flex-1 flex flex-col items-center justify-center press-scale"
                onClick={(e) => onStatClick?.(stat.key, e)}
              >
                <Text
                  className={cn(
                    'text-[32rpx] font-bold leading-none',
                    stat.value > 0 ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {stat.value}
                </Text>
                <Text className="text-[20rpx] text-muted-foreground mt-[8rpx]">{stat.label}</Text>
              </View>
              {index < bottomStats.length - 1 && <View className="w-[2rpx] h-[40rpx] bg-border" />}
            </React.Fragment>
          ))}
        </View>
      </View>
    </View>
  );
};

// 页面配置：白色导航栏 + 黑色标题
// eslint-disable-next-line import/no-named-as-default-member
definePageConfig({
  navigationBarTitleText: '卡种管理',
  navigationBarBackgroundColor: '#FFFFFF',
  navigationBarTextStyle: 'black',
});

export default withRouteGuard(CardManagementPage);
