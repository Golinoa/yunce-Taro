import { ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { memberCardService } from '@/services/member-card';
import type { MemberCardDetail, MemberCardStatus } from '@/types/member-card';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type TabKey = 'records' | 'detail' | 'actions';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'records', label: '上课记录' },
  { key: 'detail', label: '详细资料' },
  { key: 'actions', label: '卡片操作' },
];

const TAB_INDEX_MAP: Record<TabKey, number> = {
  records: 0,
  detail: 1,
  actions: 2,
};

const STATUS_MAP: Record<MemberCardStatus, { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-success-bg text-success' },
  inactive: { label: '无效卡', className: 'bg-muted text-muted-foreground' },
  usedUp: { label: '已用完', className: 'bg-muted text-muted-foreground' },
  notActivated: { label: '未开卡', className: 'bg-warning-bg text-warning' },
  frozen: { label: '已停卡', className: 'bg-info-bg text-info' },
};

const CARD_KIND_LABEL: Record<string, string> = {
  count: '次卡',
  time: '时间卡',
  stored: '储值卡',
};

const OPERATIONS = [
  { key: 'edit', label: '编辑', icon: 'mdi-pencil', color: 'text-profile-orange' },
  { key: 'freeze', label: '停卡', icon: 'mdi-pause-circle-outline', color: 'text-warning' },
  { key: 'refund', label: '退卡', icon: 'mdi-delete', color: 'text-destructive' },
  { key: 'transfer', label: '转卡', icon: 'mdi-chevron-right', color: 'text-profile-orange' },
];

function formatCurrencyYuan(fen?: number): string {
  if (fen === undefined || fen === null) return '0.00';
  return (fen / 100).toFixed(2);
}

function formatDate(date?: string): string {
  if (!date) return '-';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : date;
}

function formatDateTime(date?: string): string {
  if (!date) return '-';
  const parsed = dayjs(date);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : date;
}

/**
 * 根据剩余价值/剩余权益自动计算退卡金额（分）
 */
function computeRefundAmount(card: MemberCardDetail): number {
  if (typeof card.remainingValue === 'number' && card.remainingValue > 0) {
    return card.remainingValue;
  }

  if (card.cardTypeKind === 'count') {
    const totalCount = Math.max((card.cardTypeCount || 0) - (card.totalGiftCount || 0), 0);
    if (totalCount > 0 && typeof card.remainingCount === 'number') {
      return Math.round(card.purchasePrice * (card.remainingCount / totalCount));
    }
  }

  if (card.cardTypeKind === 'time') {
    const totalDays = card.cardTypeValidDays || 0;
    if (totalDays > 0 && typeof card.remainingDays === 'number') {
      return Math.round(card.purchasePrice * (card.remainingDays / totalDays));
    }
  }

  if (card.cardTypeKind === 'stored') {
    return card.remainingAmount || 0;
  }

  return 0;
}

/**
 * 会员卡信息详情页
 *
 * 使用场景：
 * - 从学员详情页点击某张会员卡进入，查看该卡的上课记录、详细资料及可执行操作
 */
const MemberCardDetailPage: React.FC = () => {
  const cardId = useMemo(() => {
    const instance = Taro.getCurrentInstance();
    return decodeURIComponent(instance?.router?.params?.id || '');
  }, []);

  const [card, setCard] = useState<MemberCardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('detail');
  const [swiperCurrent, setSwiperCurrent] = useState(TAB_INDEX_MAP.detail);

  // 转卡弹窗
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [transferTargetName, setTransferTargetName] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const detail = await memberCardService.getById(cardId);
      if (!detail) {
        setCard(null);
        Taro.showToast({ title: '会员卡不存在', icon: 'none' });
        return;
      }
      setCard(detail);
    } catch (error) {
      logError('MemberCardDetailPage loadData', error);
      setLoadError('会员卡信息加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return;
      setSwiperCurrent(TAB_INDEX_MAP[tab]);
    },
    [activeTab],
  );

  const handleSwiperChange = useCallback((event: { detail?: { current?: number } }) => {
    setSwiperCurrent(event.detail?.current ?? 0);
  }, []);

  const handleSwiperFinish = useCallback(
    (event: { detail?: { current?: number } }) => {
      const current = event.detail?.current ?? swiperCurrent;
      const nextTab = TABS[current]?.key ?? 'detail';
      if (nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
    },
    [activeTab, swiperCurrent],
  );

  const handleFreezeToggle = useCallback(async () => {
    if (!card) return;
    const nextStatus: MemberCardStatus = card.status === 'frozen' ? 'active' : 'frozen';
    const actionLabel = nextStatus === 'frozen' ? '停卡' : '恢复';
    const { confirm } = await Taro.showModal({
      title: `确认${actionLabel}`,
      content: `确定要${actionLabel}该会员卡吗？`,
      confirmColor: '#3B6EF5',
    });
    if (!confirm) return;
    try {
      const updated = await memberCardService.update(card.id, { status: nextStatus });
      if (updated) {
        setCard(updated);
        Taro.showToast({ title: `${actionLabel}成功`, icon: 'success' });
      }
    } catch (error) {
      logError('handleFreezeToggle', error);
      Taro.showToast({ title: `${actionLabel}失败，请重试`, icon: 'none' });
    }
  }, [card]);

  const handleRefund = useCallback(async () => {
    if (!card) return;
    const refundAmount = computeRefundAmount(card);
    const refundText = formatCurrencyYuan(refundAmount);
    const { confirm } = await Taro.showModal({
      title: '确认退卡',
      content: `预计退费金额：¥${refundText}，退卡后该卡将标记为无效，是否继续？`,
      confirmColor: '#ef4444',
    });
    if (!confirm) return;
    try {
      const updated = await memberCardService.update(card.id, {
        status: 'inactive',
        remainingValue: 0,
        remainingCount: card.cardTypeKind === 'count' ? 0 : card.remainingCount,
        remainingDays: card.cardTypeKind === 'time' ? 0 : card.remainingDays,
        remainingAmount: card.cardTypeKind === 'stored' ? 0 : card.remainingAmount,
        remark: `${card.remark || ''} 退卡，退费金额：¥${refundText}`.trim(),
      });
      if (updated) {
        setCard(updated);
        Taro.showToast({ title: '退卡成功', icon: 'success' });
      }
    } catch (error) {
      logError('handleRefund', error);
      Taro.showToast({ title: '退卡失败，请重试', icon: 'none' });
    }
  }, [card]);

  const handleOperation = useCallback(
    (key: string) => {
      if (!card) return;
      switch (key) {
        case 'edit':
          Taro.navigateTo({
            url: `/package-student/pages/member-card-edit/index?id=${encodeURIComponent(card.id)}`,
          });
          break;
        case 'freeze':
          void handleFreezeToggle();
          break;
        case 'refund':
          void handleRefund();
          break;
        case 'transfer':
          setTransferTargetName('');
          setShowTransferSheet(true);
          break;
        default:
          break;
      }
    },
    [card, handleFreezeToggle, handleRefund],
  );

  const handleTransferSubmit = useCallback(async () => {
    if (!card) return;
    const target = transferTargetName.trim();
    if (!target) {
      Taro.showToast({ title: '请输入接收学员姓名', icon: 'none' });
      return;
    }
    setTransferSubmitting(true);
    try {
      const updated = await memberCardService.update(card.id, {
        studentName: target,
        remark: `${card.remark || ''} 转卡给：${target}`.trim(),
      });
      if (updated) {
        setCard(updated);
        setShowTransferSheet(false);
        Taro.showToast({ title: '转卡成功', icon: 'success' });
      }
    } catch (error) {
      logError('handleTransferSubmit', error);
      Taro.showToast({ title: '转卡失败，请重试', icon: 'none' });
    } finally {
      setTransferSubmitting(false);
    }
  }, [card, transferTargetName]);

  const detailRows = useMemo(() => {
    if (!card) return [];
    const rows: { label: string; value: string }[] = [
      { label: '卡名称', value: card.cardTypeName },
      { label: '卡权限', value: card.cardPermission || '-' },
      { label: '购卡价格', value: `¥${formatCurrencyYuan(card.purchasePrice)}` },
      { label: '卡号', value: card.cardNo || '-' },
      { label: '发卡场馆', value: card.campusName || '-' },
      { label: '发卡日期', value: formatDateTime(card.purchaseAt) },
      { label: '发卡人', value: card.operatorName || '-' },
      { label: '开卡日期', value: formatDateTime(card.activatedAt) },
      { label: '卡类型', value: CARD_KIND_LABEL[card.cardTypeKind] || card.cardTypeKind },
    ];

    if (card.cardTypeKind === 'count') {
      const purchaseRemaining = Math.max(
        (card.cardTypeCount || 0) - (card.totalGiftCount || 0) - (card.consumedValue || 0),
        0,
      );
      rows.push(
        { label: '开卡总次数', value: `${card.cardTypeCount || 0}次` },
        { label: '其中赠送', value: `${card.totalGiftCount || 0}次` },
        { label: '余额', value: `${card.remainingCount || 0}次` },
        { label: '购卡剩余', value: `${purchaseRemaining}次` },
        { label: '赠送剩余', value: `${card.remainingGiftCount || 0}次` },
      );
    }

    if (card.cardTypeKind === 'time') {
      rows.push(
        { label: '总天数', value: `${card.cardTypeValidDays || 0}天` },
        { label: '剩余天数', value: `${card.remainingDays || 0}天` },
      );
    }

    if (card.cardTypeKind === 'stored') {
      rows.push(
        { label: '总储值', value: `¥${formatCurrencyYuan(card.purchasePrice)}` },
        { label: '剩余金额', value: `¥${formatCurrencyYuan(card.remainingAmount)}` },
      );
    }

    rows.push(
      { label: '已耗卡价值', value: `¥${formatCurrencyYuan(card.consumedValue)}` },
      { label: '剩余价值', value: `¥${formatCurrencyYuan(card.remainingValue)}` },
      { label: '归属员工', value: card.ownerName || '-' },
      { label: '有效期至', value: formatDate(card.expiredAt) },
      { label: '已冻卡次数', value: `${card.frozenCount || 0}次` },
      {
        label: '剩余可冻卡次数',
        value: `${Math.max((card.cardTypeFreezeCount || 0) - (card.frozenCount || 0), 0)}次`,
      },
      { label: '已冻卡天数', value: `${card.frozenDays || 0}天` },
      {
        label: '剩余可冻卡天数',
        value: `${Math.max((card.cardTypeFreezeDays || 0) - (card.frozenDays || 0), 0)}天`,
      },
      { label: '卡片权益', value: card.cardBenefits || '-' },
      { label: '备注', value: card.remark || '-' },
    );

    return rows;
  }, [card]);

  const headerCard = useMemo(() => {
    if (!card) return null;
    const status = STATUS_MAP[card.status];
    const isCount = card.cardTypeKind === 'count';
    const isTime = card.cardTypeKind === 'time';
    const isStored = card.cardTypeKind === 'stored';
    const isExpired = !!card.expiredAt && dayjs(card.expiredAt).isBefore(dayjs(), 'day');
    const remainingText = isCount
      ? `${card.remainingCount || 0}次`
      : isTime
        ? `${card.remainingDays || 0}天`
        : isStored
          ? `¥${formatCurrencyYuan(card.remainingAmount)}`
          : '-';

    // 根据状态使用高对比度背景色：使用中用主题色，暂停用灰色，无效/退卡保持原有深色/红色
    const cardBgClass =
      card.status === 'frozen'
        ? 'bg-card-gray'
        : card.status === 'usedUp'
          ? 'bg-finance-dark'
          : card.status === 'inactive'
            ? 'bg-kpi-red'
            : card.status === 'notActivated'
              ? 'bg-class-info'
              : isExpired
                ? 'bg-class-amber'
                : 'bg-gradient-primary';

    // 状态蒙层：非正常使用状态加深一层，保持文字可读
    const cardOverlayClass =
      card.status === 'frozen' || card.status === 'usedUp'
        ? 'bg-black/10'
        : card.status === 'inactive'
          ? 'bg-black/10'
          : isExpired
            ? 'bg-black/15'
            : '';

    return (
      <View className="bg-white rounded-[24rpx] p-[24rpx] shadow-soft flex items-center gap-[20rpx]">
        <View
          className={cn(
            'w-[180rpx] h-[108rpx] rounded-[16rpx] center relative overflow-hidden flex-shrink-0',
            cardBgClass,
          )}
        >
          {cardOverlayClass && (
            <View className={cn('absolute inset-0 pointer-events-none', cardOverlayClass)} />
          )}
          <View className="absolute -right-[20rpx] -bottom-[20rpx] w-[72rpx] h-[72rpx] rounded-full bg-white/10" />
          <View className="absolute top-[12rpx] left-[14rpx] right-[14rpx]">
            <Text className="text-white text-[24rpx] font-bold truncate block">
              {card.cardTypeName}
            </Text>
          </View>
          <View className="absolute bottom-[12rpx] right-[14rpx]">
            <Text className="text-white text-[22rpx] font-medium opacity-95 block">
              余 {remainingText}
            </Text>
          </View>
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex items-center gap-[10rpx]">
            <Text className="text-[30rpx] font-bold text-foreground truncate block">
              {card.cardTypeName}
            </Text>
            <View className={cn('px-[10rpx] py-[2rpx] rounded-[6rpx] center', status.className)}>
              <Text className="text-[18rpx] font-medium">{status.label}</Text>
            </View>
          </View>
          <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
            {CARD_KIND_LABEL[card.cardTypeKind] || card.cardTypeKind}
          </Text>
          <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">
            有效期至 {formatDate(card.expiredAt)}
          </Text>
        </View>
      </View>
    );
  }, [card]);

  if (loading) {
    return (
      <PageContainer>
        <View className="h-screen bg-background flex items-center justify-center">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError || !card) {
    return (
      <PageContainer>
        <View className="h-screen bg-background px-[32rpx] flex items-center justify-center">
          <View className="center-col gap-[24rpx]">
            <Icon name="mdi-alert-circle" size={80} color="muted-foreground" />
            <Text className="text-[28rpx] text-muted-foreground">
              {loadError || '会员卡不存在'}
            </Text>
            <View
              className="px-[40rpx] py-[16rpx] rounded-[40rpx] bg-primary center press-scale"
              onClick={loadData}
            >
              <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
            </View>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="h-screen bg-background flex flex-col">
        {/* 会员卡信息卡片（Tab 外常驻） */}
        <View className="shrink-0 px-[32rpx] pt-[24rpx] pb-[24rpx]">{headerCard}</View>

        {/* Tab 栏 */}
        <View className="shrink-0 bg-white shadow-soft">
          <View className="flex items-center justify-center px-[32rpx]">
            {TABS.map((tab) => (
              <View
                key={tab.key}
                className={cn(
                  'flex-1 center py-[24rpx] relative press-scale',
                  activeTab === tab.key ? 'text-profile-orange' : 'text-muted-foreground',
                )}
                onClick={() => handleTabChange(tab.key)}
              >
                <Text
                  className={cn(
                    'text-[30rpx]',
                    activeTab === tab.key ? 'font-bold text-profile-orange' : 'font-medium',
                  )}
                >
                  {tab.label}
                </Text>
                {activeTab === tab.key && (
                  <View className="absolute bottom-[8rpx] left-[20%] right-[20%] h-[4rpx] rounded-full bg-profile-orange-solid" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* 内容区 */}
        <View className="flex-1 min-h-0">
          <Swiper
            className="h-full"
            style={{ flex: 1, minHeight: 0 }}
            current={swiperCurrent}
            duration={280}
            onChange={handleSwiperChange}
            onAnimationFinish={handleSwiperFinish}
          >
            {/* 上课记录 */}
            <SwiperItem itemId="records" className="h-full">
              <ScrollView scrollY className="h-full">
                <View className="px-[32rpx] pt-[32rpx] pb-[40rpx] min-h-full flex flex-col items-center justify-center">
                  <Empty description="暂无上课记录" />
                </View>
              </ScrollView>
            </SwiperItem>

            {/* 详细资料 */}
            <SwiperItem itemId="detail" className="h-full">
              <ScrollView scrollY className="h-full">
                <View className="px-[32rpx] pt-[32rpx] pb-[40rpx] min-h-full">
                  <View className="bg-white rounded-[32rpx] shadow-soft overflow-hidden min-h-full">
                    {detailRows.map((row, index) => (
                      <View
                        key={row.label}
                        className={cn(
                          'flex items-center justify-between px-[28rpx] py-[22rpx]',
                          index > 0 && 'border-t border-border-light',
                        )}
                      >
                        <Text className="text-[26rpx] text-foreground-secondary">{row.label}</Text>
                        <Text className="text-[26rpx] text-muted-foreground text-right flex-1 ml-[24rpx]">
                          {row.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </SwiperItem>

            {/* 卡片操作 */}
            <SwiperItem itemId="actions" className="h-full">
              <ScrollView scrollY className="h-full">
                <View className="px-[32rpx] pt-[32rpx] pb-[40rpx] min-h-full">
                  <View className="bg-white rounded-[32rpx] p-[28rpx] shadow-soft min-h-full">
                    <Text className="text-[30rpx] font-bold text-foreground mb-[24rpx] block">
                      操作
                    </Text>
                    <View className="flex flex-wrap">
                      {OPERATIONS.map((op) => {
                        const isFreeze = op.key === 'freeze';
                        const isFrozen = card.status === 'frozen';
                        const label = isFreeze ? (isFrozen ? '恢复' : '停卡') : op.label;
                        const icon = isFreeze
                          ? isFrozen
                            ? 'mdi-play-circle-outline'
                            : 'mdi-pause-circle-outline'
                          : op.icon;
                        const disabled = card.status === 'inactive' || card.status === 'usedUp';
                        return (
                          <View
                            key={op.key}
                            className={cn(
                              'w-1/4 center-col gap-[10rpx] py-[20rpx]',
                              disabled ? 'opacity-40' : 'press-scale',
                            )}
                            onClick={disabled ? undefined : () => handleOperation(op.key)}
                          >
                            <Icon name={icon} size={48} className={op.color} />
                            <Text className={cn('text-[24rpx]', op.color)}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </SwiperItem>
          </Swiper>
        </View>
      </View>

      {/* 转卡弹窗 */}
      <BottomSheet visible={showTransferSheet}>
        <View className="px-[32rpx] pt-[32rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
          <Text className="text-[32rpx] font-bold text-foreground mb-[28rpx] block">转卡</Text>
          <FormInput
            label="接收学员姓名"
            placeholder="请输入接收学员姓名"
            value={transferTargetName}
            onInput={(e) => setTransferTargetName(e.detail.value)}
            maxlength={32}
          />
          <View className="flex gap-[20rpx] mt-[16rpx]">
            <View
              className="flex-1 py-[24rpx] rounded-[40rpx] border-[3rpx] border-border center press-scale"
              onClick={() => setShowTransferSheet(false)}
            >
              <Text className="text-[28rpx] font-medium text-muted-foreground">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 py-[24rpx] rounded-[40rpx] center press-scale',
                transferTargetName.trim() && !transferSubmitting ? 'bg-primary' : 'bg-border',
              )}
              onClick={
                transferTargetName.trim() && !transferSubmitting ? handleTransferSubmit : undefined
              }
            >
              <Text className="text-[28rpx] font-semibold text-white">
                {transferSubmitting ? '提交中...' : '确认转卡'}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default withRouteGuard(MemberCardDetailPage);
