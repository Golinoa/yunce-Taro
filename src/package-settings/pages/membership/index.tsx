/**
 * 会员权益页 — 1:1 对齐 docs/UI-design/membership-pricing.html + membership-active.html
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Dialog from '@/components/Dialog';
import FormInput from '@/components/FormInput';
import PageContainer from '@/components/PageContainer';
import SupportQrDialog from '@/components/SupportQrDialog';
import { isUnlimitedQuota } from '@/constants/membership-plans';
import {
  MEMBERSHIP_MARKETING_RED,
  buildShelfPlans,
  buildShelfTerms,
  calcShelfPay,
  getShelfPlan,
  matchShelfSku,
  shelfBaseVersionCode,
  shelfFeatureRows,
  type ShelfPlanCode,
  type ShelfTermYears,
} from '@/constants/membership-shelf';
import {
  DEFAULT_MEMBERSHIP_TIPS,
  dismissMembershipTip,
  loadDismissedTipIds,
  matchMembershipTip,
  mergeMembershipTips,
  resolveLifecycle,
  type MatchedMembershipTip,
} from '@/constants/membership-tips';
import {
  SUPPORT_QR_MEMBERSHIP_FREE_COPY,
  SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY,
} from '@/constants/support-qr';
import {
  isMembershipQuotaCacheFresh,
  peekMembershipQuotaCache,
  peekMembershipSkuCache,
  writeMembershipQuotaCache,
  writeMembershipSkuCache,
} from '@/services/membership-cache';
import {
  isOrgMembershipEntitled,
  organizationService,
  type OrganizationQuotaUsage,
} from '@/services/organization';
import {
  paymentService,
  type MembershipCatalogPlan,
  type MembershipSku,
  type PaymentOrderStatusResult,
} from '@/services/payment';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { setRefreshSignal, REFRESH_SIGNAL } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';

function formatExpireDate(iso?: string | null): string {
  if (!iso) return '未设置';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未设置';
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function formatCountdown(expiresAt?: string | null): string | null {
  if (!expiresAt) return null;
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  if (left <= 0) return '00:00:00';
  const h = String(Math.floor(left / 3600)).padStart(2, '0');
  const m = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

function moneyYuan(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

const QuotaBar: React.FC<{ label: string; current: number; max: number }> = ({
  label,
  current,
  max,
}) => {
  const unlimited = isUnlimitedQuota(max);
  const ratio = unlimited || max <= 0 ? 0 : Math.min(current / max, 1);
  const full = !unlimited && max > 0 && current >= max;
  return (
    <View className="mt-[20rpx]">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-[24rpx] text-foreground">{label}</Text>
        <Text className={cn('text-[24rpx]', full ? 'text-destructive' : 'text-muted-foreground')}>
          {unlimited ? `${current} / 不限` : `${current} / ${max}`}
        </Text>
      </View>
      <View className="mt-[12rpx] h-[16rpx] rounded-full bg-border overflow-hidden">
        <View
          className={cn('h-full rounded-full', full ? 'bg-destructive' : 'bg-primary')}
          style={{ width: unlimited ? '18%' : `${Math.max(ratio * 100, 4)}%` }}
        />
      </View>
    </View>
  );
};

const TipBanner: React.FC<{ tip: MatchedMembershipTip; onClose: () => void }> = ({
  tip,
  onClose,
}) => {
  const wrap =
    tip.tone === 'urgent'
      ? 'bg-destructive/8 border-destructive/20 text-destructive'
      : tip.tone === 'warn'
        ? 'bg-warning/10 border-warning/25 text-warning'
        : 'bg-primary/8 border-primary/20 text-primary';
  return (
    <View
      className={cn(
        'mx-[32rpx] mt-[16rpx] rounded-[24rpx] border px-[24rpx] py-[22rpx] flex flex-row gap-[12rpx]',
        wrap,
      )}
    >
      <View className="flex-1 min-w-0">
        <Text className="text-[26rpx] font-bold block">{tip.title}</Text>
        <Text className="text-[24rpx] mt-[6rpx] block leading-[36rpx] opacity-90">{tip.body}</Text>
      </View>
      <View
        className="w-[44rpx] h-[44rpx] flex items-center justify-center active:opacity-60"
        onClick={onClose}
      >
        <Text className="text-[32rpx] leading-none">×</Text>
      </View>
    </View>
  );
};

type QrCopy = {
  titleLine1: string;
  titleLine2: string;
  description: string;
  saveLabel: string;
};

const MembershipPage: React.FC = () => {
  useCardNavigationBar();
  const router = useRouter();
  const { currentRole, currentIdentity } = useAuth();
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';
  const orgNameHint = currentIdentity?.organizationName || '';

  const cachedQuota = peekMembershipQuotaCache();
  const cachedSku = peekMembershipSkuCache();

  const [quotaUsage, setQuotaUsage] = useState<OrganizationQuotaUsage | null>(cachedQuota);
  const [tipDefs, setTipDefs] = useState(DEFAULT_MEMBERSHIP_TIPS);
  const [loading, setLoading] = useState(!cachedQuota);
  const [shelfLoading, setShelfLoading] = useState(!(cachedSku && cachedSku.skus.length > 0));
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemFocus, setRedeemFocus] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [payEnabled, setPayEnabled] = useState(
    Boolean(cachedSku?.enabled && (cachedSku?.skus.length || 0) > 0),
  );
  const [skus, setSkus] = useState<MembershipSku[]>(cachedSku?.skus || []);
  const [catalogPlans, setCatalogPlans] = useState<MembershipCatalogPlan[]>(cachedSku?.plans || []);
  const [supportQrVisible, setSupportQrVisible] = useState(false);
  const [qrCopy, setQrCopy] = useState<QrCopy>(SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY);
  const [selectedPlanCode, setSelectedPlanCode] = useState<ShelfPlanCode>(() => {
    if (!cachedQuota) return 'STANDARD';
    const base = shelfBaseVersionCode(cachedQuota.versionCode);
    if (base && base !== 'FREE' && cachedQuota.versionCode !== 'TRIAL') return base;
    return 'STANDARD';
  });
  const [years, setYears] = useState<ShelfTermYears>(3);
  const [viewMode, setViewMode] = useState<'manage' | 'purchase'>('purchase');
  const [matchedTip, setMatchedTip] = useState<MatchedMembershipTip | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PaymentOrderStatusResult | null>(null);
  const [pendingCd, setPendingCd] = useState<string | null>(null);
  const autoOpenedRedeem = useRef(false);
  const viewSeeded = useRef(false);
  const hasQuotaRef = useRef(Boolean(cachedQuota));

  const refreshTip = useCallback(
    (quota: OrganizationQuotaUsage | null, tips = tipDefs) => {
      setMatchedTip(matchMembershipTip(quota, tips, loadDismissedTipIds()));
    },
    [tipDefs],
  );

  const loadPendingOrder = useCallback(async () => {
    if (!isManagerRole) {
      setPendingOrder(null);
      return;
    }
    try {
      const data = await paymentService.listOrders({ page: 1, pageSize: 5, status: 'PAYING' });
      const hit = (data.items || []).find((x) => x.status === 'PAYING' && x.expiresAt) || null;
      setPendingOrder(hit);
    } catch {
      setPendingOrder(null);
    }
  }, [isManagerRole]);

  const applyQuota = useCallback(
    (data: OrganizationQuotaUsage) => {
      hasQuotaRef.current = true;
      setQuotaUsage(data);
      writeMembershipQuotaCache(data);
      const base = shelfBaseVersionCode(data.versionCode);
      if (base && base !== 'FREE' && data.versionCode !== 'TRIAL') {
        setSelectedPlanCode(base);
      } else {
        setSelectedPlanCode('STANDARD');
      }
      refreshTip(data);
    },
    [refreshTip],
  );

  const loadQuotaUsage = useCallback(
    async (options?: { soft?: boolean; forceSku?: boolean }) => {
      if (!isManagerRole) {
        setLoading(false);
        setShelfLoading(false);
        return null;
      }
      const soft = options?.soft ?? hasQuotaRef.current;
      if (!soft) setLoading(true);

      // 卡面只等配额；tips / 待付单延后，不挡首屏
      const quotaPromise = organizationService.getQuotaUsage();
      const skuPromise = paymentService.listSkus(Boolean(options?.forceSku));

      try {
        const data = await quotaPromise;
        applyQuota(data);
        setLoading(false);

        void organizationService.getMembershipTips().then((remoteTips) => {
          const tips = mergeMembershipTips(DEFAULT_MEMBERSHIP_TIPS, remoteTips);
          setTipDefs(tips);
          refreshTip(data, tips);
        });
        void loadPendingOrder();

        const catalog = await skuPromise;
        setPayEnabled(Boolean(catalog.enabled && catalog.skus.length > 0));
        setSkus(catalog.skus);
        setCatalogPlans(catalog.plans || []);
        writeMembershipSkuCache({
          enabled: catalog.enabled,
          showTestSkus: catalog.showTestSkus,
          plans: catalog.plans,
          skus: catalog.skus,
        });
        setShelfLoading(false);
        return data;
      } catch {
        if (!hasQuotaRef.current) {
          Taro.showToast({ title: '加载会员信息失败', icon: 'none' });
        }
        setLoading(false);
        setShelfLoading(false);
        return null;
      }
    },
    [applyQuota, isManagerRole, loadPendingOrder, refreshTip],
  );

  useDidShow(() => {
    // 有新鲜缓存：后台静默刷新；无缓存才转圈
    const soft = hasQuotaRef.current || isMembershipQuotaCacheFresh();
    void loadQuotaUsage({ soft });
  });

  useEffect(() => {
    if (!pendingOrder?.expiresAt) {
      setPendingCd(null);
      return undefined;
    }
    const tick = () => setPendingCd(formatCountdown(pendingOrder.expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pendingOrder?.expiresAt]);

  const goOrders = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/membership-orders/index' });
  }, []);

  const notifyMembershipPaid = useCallback(async () => {
    setRefreshSignal(REFRESH_SIGNAL.membership);
    setRefreshSignal(REFRESH_SIGNAL.profileQuota);
    return loadQuotaUsage({ soft: true, forceSku: true });
  }, [loadQuotaUsage]);

  const showPaidResult = useCallback(
    async (result: { message: string; order?: PaymentOrderStatusResult; fulfilled?: boolean }) => {
      if (result.fulfilled === false) {
        await loadPendingOrder();
        await loadQuotaUsage({ soft: true, forceSku: true });
        await Taro.showModal({
          title: '支付成功',
          content:
            result.message ||
            '权益正在开通中。可稍后下拉刷新会员页，或在「订单详情」查看履约状态。',
          showCancel: false,
          confirmText: '知道了',
        });
        return;
      }
      setViewMode('manage');
      const refreshed = await notifyMembershipPaid();
      const versionName =
        refreshed?.versionName || result.order?.versionName || refreshed?.versionCode || '';
      const expire =
        formatExpireDate(
          refreshed?.expireAt || result.order?.orgExpireAt || result.order?.fulfilledAt,
        ) || '已更新';
      await Taro.showModal({
        title: result.message || '开通成功',
        content: versionName
          ? `当前权益：${versionName}\n到期：${expire}`
          : `到期：${expire}\n若卡片未变，请下拉或重新进入会员页`,
        showCancel: false,
        confirmText: '知道了',
      });
    },
    [loadPendingOrder, loadQuotaUsage, notifyMembershipPaid],
  );

  const payHooks = useMemo(
    () => ({
      onOrderCreated: () => {
        Taro.hideLoading();
      },
    }),
    [],
  );

  const continuePendingPay = useCallback(async () => {
    if (!pendingOrder || purchasing) return;
    setPurchasing(true);
    try {
      Taro.showLoading({ title: '下单中…', mask: true });
      const result = await paymentService.continuePay(pendingOrder.orderId, payHooks);
      Taro.hideLoading();
      if (result.ok) {
        await showPaidResult(result);
      } else {
        Taro.showToast({ title: result.message || '支付未完成', icon: 'none', duration: 2500 });
        await loadPendingOrder();
      }
    } catch (err) {
      Taro.hideLoading();
      Taro.showToast({
        title: err instanceof Error ? err.message : '支付失败',
        icon: 'none',
      });
    } finally {
      setPurchasing(false);
    }
  }, [loadPendingOrder, payHooks, pendingOrder, purchasing, showPaidResult]);

  const entitled = isOrgMembershipEntitled(quotaUsage);
  const lifecycle = resolveLifecycle(quotaUsage);
  const expireText = formatExpireDate(quotaUsage?.expireAt);
  const remainDays = daysUntil(quotaUsage?.expireAt);
  const shelfPlans = useMemo(() => buildShelfPlans(catalogPlans, skus), [catalogPlans, skus]);
  const currentPlan = useMemo(() => {
    const code = quotaUsage?.versionCode === 'TRIAL' ? 'STANDARD' : quotaUsage?.versionCode || '';
    return getShelfPlan(shelfPlans, shelfBaseVersionCode(code));
  }, [quotaUsage?.versionCode, shelfPlans]);
  const isTrial = quotaUsage?.versionCode === 'TRIAL';
  /** 卡面「已生效」：付费或未到期试用（含联调履约） */
  const active = entitled;

  useEffect(() => {
    if (loading || viewSeeded.current) return;
    viewSeeded.current = true;
    const action = String(router.params?.action || '');
    if (action === 'open' || action === 'redeem' || lifecycle === 'inactive') {
      setViewMode('purchase');
    } else {
      setViewMode('manage');
    }
  }, [lifecycle, loading, router.params?.action]);

  const shelfPlan = getShelfPlan(shelfPlans, selectedPlanCode) ||
    getShelfPlan(shelfPlans, 'STANDARD') ||
    shelfPlans[0] || {
      code: 'STANDARD',
      shortName: '成长',
      name: '成长版',
      yearPrice: 0,
      pay: {},
      terms: [],
      membersLabel: '—',
      employeesLabel: '—',
      campusesLabel: '—',
      includedCampuses: 1,
      marketing: false,
      features: {},
    };

  // 当前档可用时长变化时，钳制 years
  useEffect(() => {
    if (!shelfPlan.terms?.length) return;
    if (!shelfPlan.terms.includes(years)) {
      setYears(shelfPlan.terms.includes(3) ? 3 : shelfPlan.terms[shelfPlan.terms.length - 1]);
    }
  }, [shelfPlan.terms, years]);

  const shelfCalc = useMemo(() => calcShelfPay({ plan: shelfPlan, years }), [shelfPlan, years]);
  const shelfTerms = useMemo(() => buildShelfTerms(shelfPlan), [shelfPlan]);
  const matchedSku = useMemo(
    () => (shelfPlan.free ? null : matchShelfSku(skus, selectedPlanCode, years)),
    [skus, selectedPlanCode, years, shelfPlan.free],
  );
  const testPaySkus = useMemo(
    () =>
      skus
        .filter((s) => s.versionCode === 'TEST_PAY' || s.versionCode === 'TEST_PAY_1FEN')
        // 1 元联调优先展示
        .sort((a, b) => (a.versionCode === 'TEST_PAY' ? -1 : b.versionCode === 'TEST_PAY' ? 1 : 0)),
    [skus],
  );

  const cardTone =
    lifecycle === 'expired' ? 'expired' : lifecycle === 'inactive' ? 'inactive' : 'active';

  const statusLabel = useMemo(() => {
    if (loading && !quotaUsage) return '加载中';
    if (isTrial && active) return '试用中';
    if (lifecycle === 'expired') return '已到期';
    if (lifecycle === 'expiring_7') return '即将到期';
    if (lifecycle === 'inactive') {
      if (viewMode === 'purchase' && shelfPlan.free) return '需申请';
      return '未开通';
    }
    if (quotaUsage?.versionCode === 'FREE') return '众创';
    return '生效中';
  }, [isTrial, active, lifecycle, loading, quotaUsage, shelfPlan.free, viewMode]);

  const cardTitle = useMemo(() => {
    if (viewMode === 'purchase' && lifecycle === 'inactive' && !shelfPlan.free) {
      return '开通机构会员';
    }
    if (viewMode === 'purchase' && shelfPlan.free) return shelfPlan.name;
    if (isTrial) return '试用版';
    return quotaUsage?.versionName || currentPlan?.name || '会员';
  }, [
    viewMode,
    lifecycle,
    shelfPlan.free,
    shelfPlan.name,
    isTrial,
    currentPlan?.name,
    quotaUsage?.versionName,
  ]);

  /** 副文案：开通引导拆两行，避免单行挤在一起 */
  const cardSubLines = useMemo(() => {
    if (loading && !quotaUsage) return ['加载中…'];
    if (viewMode === 'purchase' && shelfPlan.free) return ['审批通过后开通'];
    if (viewMode === 'purchase' && lifecycle === 'inactive') return ['选择合适套餐', '开通'];
    if (lifecycle === 'expired') return [`已于 ${expireText} 到期`];
    if (isTrial && remainDays != null) return [`试用剩余 ${Math.max(remainDays, 0)} 天`];
    if (quotaUsage?.versionCode === 'FREE' && !quotaUsage.expireAt) return ['长期有效'];
    return [`有效期至 ${expireText}`];
  }, [loading, quotaUsage, viewMode, shelfPlan.free, lifecycle, expireText, isTrial, remainDays]);

  const cardRemain = useMemo(() => {
    if (viewMode === 'purchase' && shelfPlan.free) {
      return `${shelfPlan.membersLabel} 人档`;
    }
    if (viewMode === 'purchase' && lifecycle === 'inactive') {
      return `当前 · ${quotaUsage?.versionName || currentPlan?.name || '未开通'}`;
    }
    if (lifecycle === 'expired') return '权益已暂停';
    if (remainDays != null && remainDays >= 0) return `剩余 ${remainDays} 天`;
    return '长期有效';
  }, [
    viewMode,
    shelfPlan.free,
    shelfPlan.membersLabel,
    lifecycle,
    currentPlan?.name,
    quotaUsage?.versionName,
    remainDays,
  ]);

  const openQr = useCallback((copy: QrCopy) => {
    setQrCopy(copy);
    setSupportQrVisible(true);
  }, []);

  const handleOpenRedeem = useCallback(() => {
    setRedeemCode('');
    setRedeemFocus(false);
    setShowRedeem(true);
  }, []);

  // 弹框打开后再拉焦点（微信需先 false→true）
  useEffect(() => {
    if (!showRedeem) {
      setRedeemFocus(false);
      return;
    }
    const timer = setTimeout(() => setRedeemFocus(true), 80);
    return () => clearTimeout(timer);
  }, [showRedeem]);

  const handlePurchase = useCallback(async () => {
    if (shelfPlan.free) {
      openQr(SUPPORT_QR_MEMBERSHIP_FREE_COPY);
      return;
    }
    if (!matchedSku) {
      Taro.showToast({
        title: '该时长暂未开放在线支付，请用激活码或联系运营',
        icon: 'none',
        duration: 2800,
      });
      return;
    }
    if (purchasing) return;
    const priceText = paymentService.formatPriceYuan(matchedSku.price);
    const confirm = await Taro.showModal({
      title: `购买${matchedSku.name}`,
      content: `¥${priceText} · ${years} 年。支付成功后立即生效。`,
      confirmText: '去支付',
      cancelText: '取消',
    });
    if (!confirm.confirm) return;

    setPurchasing(true);
    try {
      Taro.showLoading({ title: '下单中…', mask: true });
      const result = await paymentService.purchaseMembership(matchedSku.versionCode, payHooks);
      Taro.hideLoading();
      if (result.ok) {
        await showPaidResult(result);
      } else if (result.message === '已取消支付') {
        await loadPendingOrder();
        const go = await Taro.showModal({
          title: '订单待付款',
          content: '已为你保留订单，请在有效期内完成支付',
          confirmText: '继续支付',
          cancelText: '稍后再说',
        });
        if (go.confirm && result.order?.orderId) {
          setPurchasing(true);
          try {
            Taro.showLoading({ title: '下单中…', mask: true });
            const again = await paymentService.continuePay(result.order.orderId, payHooks);
            Taro.hideLoading();
            if (again.ok) {
              await showPaidResult(again);
            } else {
              Taro.showToast({
                title: again.message || '支付未完成',
                icon: 'none',
                duration: 2500,
              });
              await loadPendingOrder();
            }
          } catch (e2) {
            Taro.hideLoading();
            Taro.showToast({
              title: e2 instanceof Error ? e2.message : '支付失败',
              icon: 'none',
            });
          } finally {
            setPurchasing(false);
          }
        }
      } else {
        Taro.showToast({ title: result.message || '支付未完成', icon: 'none', duration: 2500 });
        await loadPendingOrder();
      }
    } catch (err) {
      Taro.hideLoading();
      const msg = err instanceof Error ? err.message : '下单失败';
      Taro.showToast({ title: msg, icon: 'none' });
    } finally {
      setPurchasing(false);
    }
  }, [
    loadPendingOrder,
    matchedSku,
    openQr,
    payHooks,
    purchasing,
    shelfPlan.free,
    showPaidResult,
    years,
  ]);

  const handleTestPay = useCallback(
    async (sku: MembershipSku) => {
      if (!sku || purchasing) return;
      const priceText = paymentService.formatPriceYuan(sku.price);
      const confirm = await Taro.showModal({
        title: `联调支付 · ${sku.name}`,
        content: `¥${priceText}（测试道具 ${sku.productId}）。仅用于支付链路验证。`,
        confirmText: '去支付',
        cancelText: '取消',
      });
      if (!confirm.confirm) return;
      setPurchasing(true);
      try {
        Taro.showLoading({ title: '下单中…', mask: true });
        const result = await paymentService.purchaseMembership(sku.versionCode, payHooks);
        Taro.hideLoading();
        if (result.ok) {
          await showPaidResult(result);
        } else {
          Taro.showToast({ title: result.message || '支付未完成', icon: 'none', duration: 2500 });
          await loadPendingOrder();
        }
      } catch (err) {
        Taro.hideLoading();
        const msg = err instanceof Error ? err.message : '下单失败';
        Taro.showToast({ title: msg, icon: 'none' });
      } finally {
        setPurchasing(false);
      }
    },
    [loadPendingOrder, payHooks, purchasing, showPaidResult],
  );

  useEffect(() => {
    if (autoOpenedRedeem.current || loading) return;
    const action = String(router.params?.action || '');
    if (action === 'redeem') {
      autoOpenedRedeem.current = true;
      setShowRedeem(true);
    }
  }, [loading, router.params?.action]);

  const handleSubmitRedeem = useCallback(async () => {
    const code = redeemCode.trim().toUpperCase();
    if (!code) {
      Taro.showToast({ title: '请输入激活码', icon: 'none' });
      return;
    }
    if (code.length < 8) {
      Taro.showToast({ title: '激活码格式不正确', icon: 'none' });
      return;
    }
    setRedeeming(true);
    try {
      const result = await organizationService.redeemActivationCode(code);
      if (result.error) {
        Taro.showToast({ title: result.error.message, icon: 'none' });
        return;
      }
      setShowRedeem(false);
      setRedeemCode('');
      Taro.showToast({ title: result.message || '兑换成功', icon: 'success', duration: 2500 });
      setViewMode('manage');
      await notifyMembershipPaid();
    } finally {
      setRedeeming(false);
    }
  }, [notifyMembershipPaid, redeemCode]);

  const handleSelectPlan = useCallback(
    (code: ShelfPlanCode) => {
      setSelectedPlanCode(code);
      const p = getShelfPlan(shelfPlans, code);
      if (p?.recommended && p.terms.includes(3)) {
        setYears(3);
      } else if (p?.terms?.length) {
        setYears(p.terms.includes(3) ? 3 : p.terms[p.terms.length - 1]);
      }
    },
    [shelfPlans],
  );

  const manageTip = useMemo(() => {
    if (lifecycle === 'expired') {
      return '会员已到期。请自助续费同档货架价，或兑换激活码；换更高版本请联系运营。';
    }
    if (isTrial) {
      return '试用版生效中（标准功能 · 体验配额）。正式开通请自助选购货架价；升旗舰请联系运营。';
    }
    if (quotaUsage?.versionCode === 'FREE') {
      return '众创为申请制免费档。开通付费版请走货架价。';
    }
    if (quotaUsage?.versionCode === 'FLAGSHIP') {
      return `当前${quotaUsage.versionName || '旗舰版'}（含 ${
        currentPlan?.includedCampuses || 2
      } 校区）。续费自助选购；更多校区请联系运营。`;
    }
    return '当前成长/付费档生效中。续费可自助购买同档货架 SKU；升级请联系运营补差。';
  }, [
    isTrial,
    lifecycle,
    quotaUsage?.versionCode,
    quotaUsage?.versionName,
    currentPlan?.includedCampuses,
  ]);

  if (!isManagerRole) {
    return (
      <PageContainer>
        <View className="px-[32rpx] py-[80rpx] flex flex-col items-center">
          <Text className="text-[28rpx] text-muted-foreground">仅校长/管理员可查看会员权益</Text>
        </View>
      </PageContainer>
    );
  }

  const featureRows = shelfFeatureRows(shelfPlan);

  return (
    <PageContainer>
      <View className="min-h-screen bg-background pb-[calc(140rpx+env(safe-area-inset-bottom))]">
        {/* 原生导航栏下方：卡外右上角「订单详情」 */}
        <View className="mx-[32rpx] mt-[8rpx] mb-[4rpx] flex flex-row items-center justify-end">
          <Text className="text-[24rpx] font-semibold text-primary" onClick={goOrders}>
            订单详情
          </Text>
        </View>

        {/* 会员卡 */}
        <View
          className={cn(
            'mx-[32rpx] mt-[8rpx] rounded-[36rpx] p-[36rpx] shadow-soft overflow-hidden relative',
            cardTone === 'active' && 'bg-primary',
            cardTone === 'inactive' && 'bg-primary',
            cardTone === 'expired' && 'bg-[#5C6678]',
          )}
        >
          <View className="absolute -right-[60rpx] -top-[80rpx] w-[280rpx] h-[280rpx] rounded-full bg-white/12" />
          <View className="flex flex-row items-start justify-between relative z-10">
            <View className="flex flex-row items-baseline">
              <Text className="text-[48rpx] font-black leading-none italic text-white">V</Text>
              <Text className="text-[32rpx] font-bold ml-[6rpx] text-white">会员卡</Text>
            </View>
            <View className="px-[20rpx] py-[10rpx] rounded-full bg-white/20">
              <Text className="text-[22rpx] font-semibold text-white">{statusLabel}</Text>
            </View>
          </View>
          <Text className="relative z-10 mt-[28rpx] text-[44rpx] font-extrabold leading-tight text-white">
            {cardTitle}
          </Text>
          <View className="relative z-10 mt-[12rpx]">
            {cardSubLines.map((line) => (
              <Text key={line} className="block text-[26rpx] leading-[40rpx] text-white/85">
                {line}
              </Text>
            ))}
          </View>
          <View className="relative z-10 mt-[24rpx] pt-[20rpx] flex flex-row justify-between border-t border-white/20">
            <Text className="text-[24rpx] text-white/80">
              机构：{quotaUsage?.organizationName || orgNameHint || (loading ? '加载中…' : '—')}
            </Text>
            <Text className="text-[24rpx] text-white/80">{cardRemain}</Text>
          </View>
        </View>

        {pendingOrder && pendingCd ? (
          <View className="mx-[32rpx] mt-[20rpx] rounded-[28rpx] border border-warning/35 bg-[#fff7ed] px-[28rpx] py-[24rpx] flex flex-row items-center justify-between gap-[16rpx]">
            <View className="flex-1 min-w-0">
              <Text className="text-[26rpx] font-bold text-foreground">
                有一笔待付款 · {pendingOrder.versionName || pendingOrder.versionCode}
              </Text>
              <Text className="mt-[6rpx] text-[24rpx] font-bold text-warning">
                {pendingCd} 后关闭
              </Text>
            </View>
            <View
              className="shrink-0 px-[24rpx] py-[14rpx] rounded-full bg-warning"
              onClick={() => void continuePendingPay()}
            >
              <Text className="text-[24rpx] font-bold text-white">去支付</Text>
            </View>
          </View>
        ) : null}

        {matchedTip && viewMode === 'manage' ? (
          <TipBanner
            tip={matchedTip}
            onClose={() => {
              dismissMembershipTip(matchedTip.tipId);
              setMatchedTip(null);
            }}
          />
        ) : null}

        {viewMode === 'manage' ? (
          <>
            {quotaUsage ? (
              <View className="mx-[32rpx] mt-[24rpx] rounded-[36rpx] bg-card shadow-soft p-[28rpx]">
                <View className="flex flex-row items-center justify-between">
                  <Text className="text-[30rpx] font-semibold text-foreground">机构配额</Text>
                  <Text className="text-[22rpx] text-muted-foreground">
                    {currentPlan?.name || quotaUsage.versionName}
                    {(quotaUsage.campuses.max || 1) <= 1
                      ? ' · 单校区'
                      : ` · 含 ${quotaUsage.campuses.max} 校区`}
                  </Text>
                </View>
                <QuotaBar
                  label="会员"
                  current={quotaUsage.members.current}
                  max={quotaUsage.members.max}
                />
                <QuotaBar
                  label="员工"
                  current={quotaUsage.employees.current}
                  max={quotaUsage.employees.max}
                />
                <QuotaBar
                  label="校区"
                  current={quotaUsage.campuses.current}
                  max={quotaUsage.campuses.max}
                />
              </View>
            ) : null}

            <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] border border-[#fed7aa] bg-[#fff7ed] px-[28rpx] py-[24rpx]">
              <Text className="text-[24rpx] leading-[38rpx] text-[#9a3412]">
                支付仅支持货架固定价（2 年 / 3 年 SKU）。
                <Text className="font-bold text-[#c2410c]">
                  版本升级需联系运营按剩余时长核算补差
                </Text>
                ，后台发放，不支持自助任意金额支付。
              </Text>
            </View>

            <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] border border-dashed border-primary/30 bg-primary/6 px-[28rpx] py-[24rpx]">
              <Text className="text-[24rpx] leading-[38rpx] text-muted-foreground">
                {manageTip}
              </Text>
            </View>

            <View className="mx-[32rpx] mt-[24rpx] rounded-[36rpx] bg-card shadow-soft p-[28rpx]">
              <View className="flex flex-row items-center justify-between mb-[8rpx]">
                <Text className="text-[30rpx] font-semibold text-foreground">变更会员</Text>
                <Text className="text-[22rpx] text-muted-foreground">两条路径</Text>
              </View>
              <View
                className="mt-[16rpx] flex flex-row items-center rounded-[28rpx] border border-border bg-bg-card px-[24rpx] py-[24rpx] active:opacity-85"
                onClick={() => setViewMode('purchase')}
              >
                <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-card border border-border flex items-center justify-center">
                  <Text className="text-[26rpx] font-extrabold text-primary">续</Text>
                </View>
                <View className="flex-1 ml-[20rpx] min-w-0">
                  <Text className="text-[28rpx] font-extrabold text-foreground block">
                    {lifecycle === 'expired' ? '立即续费' : isTrial ? '正式开通' : '续费同档'}
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[6rpx] block">
                    按货架价购买 2 年 / 3 年，自助支付
                  </Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">去选购 ›</Text>
              </View>
              <View
                className="mt-[16rpx] flex flex-row items-center rounded-[28rpx] border border-border bg-bg-card px-[24rpx] py-[24rpx] active:opacity-85"
                onClick={() => openQr(SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY)}
              >
                <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-[#fff7f2] border border-[#ffd4c2] flex items-center justify-center">
                  <Text
                    className="text-[26rpx] font-extrabold"
                    style={{ color: MEMBERSHIP_MARKETING_RED }}
                  >
                    升
                  </Text>
                </View>
                <View className="flex-1 ml-[20rpx] min-w-0">
                  <Text className="text-[28rpx] font-extrabold text-foreground block">
                    升级更高版本
                  </Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[6rpx] block">
                    旗舰含 2 校区 · 联系运营核算补差
                  </Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">联系 ›</Text>
              </View>
            </View>
          </>
        ) : (
          <View className="mx-[32rpx] mt-[24rpx] rounded-[36rpx] bg-card shadow-soft overflow-hidden">
            <View className="px-[32rpx] pt-[28rpx] pb-[16rpx]">
              <Text className="text-[30rpx] font-bold text-foreground">选择版本</Text>
            </View>

            <View className="px-[20rpx] pb-[24rpx] flex flex-row gap-[10rpx]">
              {shelfPlans.length === 0 ? (
                <View className="flex-1 rounded-[24rpx] border border-dashed border-border px-[16rpx] py-[28rpx] text-center">
                  <Text className="text-[24rpx] text-muted-foreground">
                    {shelfLoading ? '套餐加载中…' : '暂无在线套餐，请用激活码或联系运营'}
                  </Text>
                </View>
              ) : (
                shelfPlans.map((p) => {
                  const on = p.code === selectedPlanCode;
                  return (
                    <View
                      key={p.code}
                      className={cn(
                        'flex-1 min-w-0 relative rounded-[24rpx] px-[4rpx] py-[20rpx] border-[3rpx] text-center',
                        on ? 'border-primary/45 bg-primary/6' : 'border-border bg-bg-card',
                      )}
                      onClick={() => handleSelectPlan(p.code)}
                    >
                      {p.recommended ? (
                        <View
                          className="absolute -top-[14rpx] right-[8rpx] px-[12rpx] py-[4rpx] rounded-full z-10"
                          style={{ backgroundColor: MEMBERSHIP_MARKETING_RED }}
                        >
                          <Text className="text-[18rpx] text-white font-bold">荐</Text>
                        </View>
                      ) : null}
                      <Text className="text-[24rpx] font-extrabold text-foreground block">
                        {p.shortName}
                      </Text>
                      <Text className="text-[20rpx] text-muted-foreground mt-[8rpx] block">
                        {p.free ? '申请' : p.yearPrice > 0 ? `¥${p.yearPrice}` : '询价'}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {!shelfPlan.free && shelfTerms.length > 0 ? (
              <View className="px-[24rpx] pb-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground mb-[16rpx] block">
                  开通时长
                </Text>
                <View className="flex flex-row gap-[16rpx]">
                  {shelfTerms.map((t) => {
                    const on = t.years === years;
                    return (
                      <View
                        key={t.years}
                        className={cn(
                          'flex-1 relative rounded-[24rpx] px-[16rpx] py-[24rpx] border-[3rpx] text-center',
                          on ? 'border-primary/45 bg-primary/6' : 'border-border bg-bg-card',
                        )}
                        onClick={() => setYears(t.years)}
                      >
                        {t.badge ? (
                          <View
                            className="absolute -top-[14rpx] right-[16rpx] px-[12rpx] py-[4rpx] rounded-full"
                            style={{ backgroundColor: MEMBERSHIP_MARKETING_RED }}
                          >
                            <Text className="text-[20rpx] text-white font-bold">{t.badge}</Text>
                          </View>
                        ) : null}
                        <Text className="text-[28rpx] font-extrabold text-foreground block">
                          {t.label}
                        </Text>
                        <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                          {t.hint}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View className="mx-[24rpx] mb-[24rpx] rounded-[28rpx] border border-primary/12 bg-primary/8 px-[28rpx] py-[28rpx]">
              {shelfPlan.free ? (
                <>
                  <Text className="text-[44rpx] font-black text-foreground">¥0</Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] block">
                    申请开通 · 添加客服企微
                  </Text>
                </>
              ) : (
                <>
                  <View className="flex flex-row items-end justify-between">
                    <View className="flex flex-row items-baseline">
                      <Text className="text-[32rpx] font-bold text-foreground mr-[4rpx]">¥</Text>
                      <Text className="text-[64rpx] font-black leading-none text-foreground">
                        {moneyYuan(shelfCalc.pay)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[24rpx] text-muted-foreground line-through block">
                        ¥{moneyYuan(shelfCalc.list)}
                      </Text>
                      {shelfCalc.save > 0 ? (
                        <Text
                          className="text-[24rpx] font-bold mt-[4rpx] block"
                          style={{ color: MEMBERSHIP_MARKETING_RED }}
                        >
                          省 ¥{moneyYuan(shelfCalc.save)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text className="text-[24rpx] text-muted-foreground mt-[16rpx] block">
                    {shelfPlan.name} · {years} 年 · ¥{moneyYuan(shelfCalc.perYear)}/年
                  </Text>
                  {years === 3 ? (
                    <Text className="text-[26rpx] font-bold text-primary mt-[12rpx] block">
                      一天约 ¥{shelfCalc.daily}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            {shelfPlan.free ? (
              <View className="mx-[24rpx] mb-[24rpx] rounded-[28rpx] border border-primary/15 bg-primary/8 px-[28rpx] py-[24rpx]">
                <Text className="text-[26rpx] font-extrabold text-primary block">
                  众创版，为「一个人先干起来」而设
                </Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] leading-[38rpx] block">
                  给独立老师、初创小工作室：学员还不多、团队还很小，也值得用上干净的排课与课时。先把教学管清楚，等长大了再升级——我们想陪你们从第一位学员走起。
                </Text>
              </View>
            ) : null}

            {!shelfPlan.free ? (
              <View
                className="mx-[24rpx] mb-[24rpx] rounded-[28rpx] border border-border px-[28rpx] py-[24rpx] flex flex-row items-center justify-between active:opacity-80"
                onClick={() => openQr(SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY)}
              >
                <View className="flex-1 min-w-0 pr-[16rpx]">
                  <Text className="text-[26rpx] font-bold text-foreground block">额外校区</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] block">
                    含 {shelfPlan.includedCampuses} 校区 · 加购请联系运营（不在线计价）
                  </Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">联系 ›</Text>
              </View>
            ) : null}

            <View className="mx-[24rpx] mb-[28rpx] rounded-[28rpx] bg-bg-card px-[28rpx] py-[8rpx]">
              {featureRows.map(([k, v]) => (
                <View
                  key={k}
                  className="flex flex-row items-center justify-between py-[20rpx] border-t border-border/80 first:border-t-0"
                >
                  <Text className="text-[24rpx] text-foreground">{k}</Text>
                  <Text
                    className={cn(
                      'text-[24rpx] font-semibold',
                      v === '✓' && 'text-success',
                      v === '—' && 'text-muted-foreground',
                    )}
                  >
                    {v}
                  </Text>
                </View>
              ))}
            </View>

            {lifecycle !== 'inactive' ? (
              <View
                className="mx-[24rpx] mb-[28rpx] text-center active:opacity-70"
                onClick={() => setViewMode('manage')}
              >
                <Text className="text-[24rpx] text-primary font-semibold">返回会员卡 ›</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View className="fixed left-0 right-0 bottom-0 z-20 px-[32rpx] pt-[16rpx] pb-[calc(16rpx+env(safe-area-inset-bottom))] bg-background">
        {viewMode === 'purchase' && testPaySkus.length > 0 ? (
          <View className="mb-[12rpx] flex flex-col gap-[8rpx]">
            {testPaySkus.map((sku) => (
              <View
                key={sku.versionCode}
                className="h-[64rpx] rounded-[20rpx] border border-dashed border-warning/50 bg-warning/8 flex flex-row items-center justify-center active:opacity-80"
                onClick={() => {
                  void handleTestPay(sku);
                }}
              >
                <Text className="text-[24rpx] font-semibold text-warning">
                  联调 · {sku.name} ¥{paymentService.formatPriceYuan(sku.price)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className="flex flex-row gap-[16rpx]">
          {viewMode === 'manage' ? (
            <>
              <View
                className="flex-1 h-[96rpx] rounded-[28rpx] bg-primary flex flex-col items-center justify-center shadow-soft active:opacity-90"
                onClick={() => setViewMode('purchase')}
              >
                <Text className="text-[28rpx] font-extrabold text-white">
                  {lifecycle === 'expired' ? '立即续费' : isTrial ? '正式开通' : '续费同档'}
                </Text>
                <Text className="text-[20rpx] text-white/90 mt-[2rpx]">货架价自助支付</Text>
              </View>
              <View
                className="flex-1 h-[96rpx] rounded-[28rpx] bg-card border-[3rpx] border-primary/30 flex items-center justify-center active:opacity-90"
                onClick={() => openQr(SUPPORT_QR_MEMBERSHIP_UPGRADE_COPY)}
              >
                <Text className="text-[28rpx] font-extrabold text-primary">联系运营</Text>
              </View>
            </>
          ) : (
            <>
              <View
                className={cn(
                  'flex-[1.4] h-[96rpx] rounded-[28rpx] bg-primary flex flex-col items-center justify-center shadow-soft active:opacity-90',
                  purchasing && 'opacity-60',
                )}
                onClick={() => {
                  void handlePurchase();
                }}
              >
                <Text className="text-[28rpx] font-extrabold text-white">
                  {purchasing
                    ? '处理中…'
                    : shelfPlan.free
                      ? '申请众创版'
                      : `开通${shelfPlan.shortName} · ${years} 年`}
                </Text>
                <Text className="text-[20rpx] text-white/90 mt-[2rpx]">
                  {shelfPlan.free
                    ? '一个人也能开始'
                    : matchedSku
                      ? `实付 ¥${paymentService.formatPriceYuan(matchedSku.price)}`
                      : payEnabled
                        ? '时长未上架·可用激活码'
                        : shelfCalc.pay > 0
                          ? `货架 ¥${moneyYuan(shelfCalc.pay)}`
                          : '加载货架中…'}
                </Text>
              </View>
              <View
                className="flex-1 h-[96rpx] rounded-[28rpx] bg-card border-[3rpx] border-primary/30 flex items-center justify-center active:opacity-90"
                onClick={handleOpenRedeem}
              >
                <Text className="text-[28rpx] font-extrabold text-primary">激活码</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <Dialog
        visible={showRedeem}
        maskClosable={!redeeming}
        onClose={() => {
          if (!redeeming) setShowRedeem(false);
        }}
        className="relative z-10 w-[86%] max-w-[620rpx] rounded-[28rpx] bg-white px-[32rpx] pt-[36rpx] pb-[28rpx]"
      >
        <Text className="text-[34rpx] font-extrabold text-foreground text-center block">
          {lifecycle === 'expired' || active ? '续费 / 兑换' : '开通会员'}
        </Text>
        <Text className="mt-[16rpx] text-[26rpx] text-muted-foreground text-center block">
          输入激活码即可
        </Text>
        <FormInput
          variant="capsule"
          placeholder="激活码"
          value={redeemCode}
          focus={redeemFocus}
          adjustPosition={false}
          onInput={(e) => setRedeemCode(e.detail.value.trim().toUpperCase())}
          maxlength={64}
          className="mt-[28rpx] mb-[28rpx]"
        />
        <View className="flex flex-row gap-[16rpx]">
          <View
            className="flex-1 h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-muted/40 active:opacity-90"
            onClick={() => {
              if (!redeeming) setShowRedeem(false);
            }}
          >
            <Text className="text-[30rpx] font-semibold text-muted-foreground">取消</Text>
          </View>
          <View
            className={cn(
              'flex-1 h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90',
              redeeming && 'opacity-60',
            )}
            onClick={() => {
              void handleSubmitRedeem();
            }}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {redeeming ? '兑换中…' : '确认兑换'}
            </Text>
          </View>
        </View>
      </Dialog>

      <SupportQrDialog
        visible={supportQrVisible}
        onClose={() => setSupportQrVisible(false)}
        titleLine1={qrCopy.titleLine1}
        titleLine2={qrCopy.titleLine2}
        description={qrCopy.description}
        saveLabel={qrCopy.saveLabel}
      />
    </PageContainer>
  );
};

export default withRouteGuard(MembershipPage);
