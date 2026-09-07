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
  filterShelfPlansByEntitlement,
  getShelfPlan,
  matchShelfSku,
  shelfBaseVersionCode,
  shelfFeatureRows,
  type ShelfPlanCode,
  type ShelfTermKey,
  defaultShelfTerm,
} from '@/constants/membership-shelf';
import { resolveLifecycle } from '@/constants/membership-tips';
import { SUPPORT_QR_MEMBERSHIP_FREE_COPY } from '@/constants/support-qr';
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
  const [qrCopy, setQrCopy] = useState<QrCopy>(SUPPORT_QR_MEMBERSHIP_FREE_COPY);
  const [selectedPlanCode, setSelectedPlanCode] = useState<ShelfPlanCode>(() => {
    if (!cachedQuota) return 'STANDARD';
    const base = shelfBaseVersionCode(cachedQuota.versionCode);
    if (base && base !== 'FREE' && cachedQuota.versionCode !== 'TRIAL') return base;
    return 'STANDARD';
  });
  const [term, setTerm] = useState<ShelfTermKey>(3);
  const [viewMode, setViewMode] = useState<'manage' | 'purchase'>('purchase');
  const [pendingOrder, setPendingOrder] = useState<PaymentOrderStatusResult | null>(null);
  const [pendingCd, setPendingCd] = useState<string | null>(null);
  const autoOpenedRedeem = useRef(false);
  const viewSeeded = useRef(false);
  const hasQuotaRef = useRef(Boolean(cachedQuota));

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

  const applyQuota = useCallback((data: OrganizationQuotaUsage) => {
    hasQuotaRef.current = true;
    setQuotaUsage(data);
    writeMembershipQuotaCache(data);
    const base = shelfBaseVersionCode(data.versionCode);
    if (base && base !== 'FREE' && data.versionCode !== 'TRIAL') {
      setSelectedPlanCode(base);
    } else {
      setSelectedPlanCode('STANDARD');
    }
  }, []);

  const loadQuotaUsage = useCallback(
    async (options?: { soft?: boolean; forceSku?: boolean }) => {
      if (!isManagerRole) {
        setLoading(false);
        setShelfLoading(false);
        return null;
      }
      const soft = options?.soft ?? hasQuotaRef.current;
      if (!soft) setLoading(true);

      const quotaPromise = organizationService.getQuotaUsage();
      const skuPromise = paymentService.listSkus(Boolean(options?.forceSku));

      try {
        const data = await quotaPromise;
        applyQuota(data);
        setLoading(false);

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
    [applyQuota, isManagerRole, loadPendingOrder],
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

  const waitOrderFulfilled = useCallback(async (orderId: string) => {
    Taro.showLoading({ title: '开通确认中…', mask: true });
    try {
      for (let i = 0; i < 30; i += 1) {
        const order = await paymentService.getOrder(orderId);
        if (order.status === 'FULFILLED') return order;
        if (order.status === 'CLOSED' || order.status === 'REFUNDED') return order;
        await new Promise((r) => setTimeout(r, 1500));
      }
      return paymentService.getOrder(orderId);
    } finally {
      Taro.hideLoading();
    }
  }, []);

  const showPaidResult = useCallback(
    async (result: { message: string; order?: PaymentOrderStatusResult; fulfilled?: boolean }) => {
      // 支付成功即刷信号，避免履约延迟时个人中心卡面陈旧
      await notifyMembershipPaid();
      await loadPendingOrder();

      if (result.fulfilled === false && result.order?.orderId) {
        const choice = await Taro.showModal({
          title: '支付成功',
          content: result.message || '权益开通中。可点「刷新权益」再确认，或打开订单详情查看进度。',
          confirmText: '刷新权益',
          cancelText: '订单详情',
        });
        if (choice.confirm) {
          const latest = await waitOrderFulfilled(result.order.orderId);
          if (latest.status === 'FULFILLED') {
            setViewMode('manage');
            const refreshed = await notifyMembershipPaid();
            const versionName =
              refreshed?.versionName || latest.versionName || refreshed?.versionCode || '';
            const expire =
              formatExpireDate(refreshed?.expireAt || latest.orgExpireAt || latest.fulfilledAt) ||
              '已更新';
            await Taro.showModal({
              title: '开通成功',
              content: versionName
                ? `当前权益：${versionName}\n到期：${expire}`
                : `到期：${expire}`,
              showCancel: false,
              confirmText: '知道了',
            });
            return;
          }
          Taro.showToast({
            title: '仍在开通中，请稍后再试或查看订单',
            icon: 'none',
            duration: 2800,
          });
          return;
        }
        goOrders();
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
        content: versionName ? `当前权益：${versionName}\n到期：${expire}` : `到期：${expire}`,
        showCancel: false,
        confirmText: '知道了',
      });
    },
    [goOrders, loadPendingOrder, notifyMembershipPaid, waitOrderFulfilled],
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
  const shelfPlansAll = useMemo(() => buildShelfPlans(catalogPlans, skus), [catalogPlans, skus]);
  const shelfPlans = useMemo(
    () =>
      filterShelfPlansByEntitlement(shelfPlansAll, {
        versionCode: quotaUsage?.versionCode,
        entitled,
      }),
    [shelfPlansAll, quotaUsage?.versionCode, entitled],
  );
  const currentPlan = useMemo(() => {
    const code = quotaUsage?.versionCode === 'TRIAL' ? 'STANDARD' : quotaUsage?.versionCode || '';
    return getShelfPlan(shelfPlansAll, shelfBaseVersionCode(code));
  }, [quotaUsage?.versionCode, shelfPlansAll]);
  /** 卡面「已生效」：付费或未到期试用 */
  const active = entitled;

  // 有效期过滤后，选中档可能已被隐藏 → 钳到货架首个可购档
  useEffect(() => {
    if (!shelfPlans.length) return;
    if (getShelfPlan(shelfPlans, selectedPlanCode)) return;
    const next =
      getShelfPlan(shelfPlans, 'STANDARD') ||
      shelfPlans.find((p) => p.recommended) ||
      shelfPlans[0];
    if (next?.code) setSelectedPlanCode(next.code);
  }, [shelfPlans, selectedPlanCode]);

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

  // 当前档可用时长变化时，钳制 term
  useEffect(() => {
    if (!shelfPlan.terms?.length) return;
    if (!shelfPlan.terms.includes(term)) {
      setTerm(defaultShelfTerm(shelfPlan.terms));
    }
  }, [shelfPlan.terms, term]);

  const shelfCalc = useMemo(() => calcShelfPay({ plan: shelfPlan, term }), [shelfPlan, term]);
  const shelfTerms = useMemo(() => buildShelfTerms(shelfPlan), [shelfPlan]);
  const matchedSku = useMemo(
    () => (shelfPlan.free ? null : matchShelfSku(skus, shelfPlan.code, term)),
    [skus, shelfPlan.code, term, shelfPlan.free],
  );

  const cardTone =
    lifecycle === 'expired' ? 'expired' : lifecycle === 'inactive' ? 'inactive' : 'active';

  const statusLabel = useMemo(() => {
    if (loading && !quotaUsage) return '加载中';
    if (lifecycle === 'expired') return '已到期';
    if (lifecycle === 'expiring_7') return '即将到期';
    if (lifecycle === 'inactive') {
      if (viewMode === 'purchase' && shelfPlan.free) return '需申请';
      return '未开通';
    }
    if (quotaUsage?.versionCode === 'FREE') return '众创';
    return '生效中';
  }, [lifecycle, loading, quotaUsage, shelfPlan.free, viewMode]);

  const cardTitle = useMemo(() => {
    if (viewMode === 'purchase' && lifecycle === 'inactive' && !shelfPlan.free) {
      return '开通机构会员';
    }
    if (viewMode === 'purchase' && shelfPlan.free) return shelfPlan.name;
    // 与付费档同一套：TRIAL 已映射到成长档 currentPlan，不单独写「试用版」
    return currentPlan?.name || quotaUsage?.versionName || '会员';
  }, [
    viewMode,
    lifecycle,
    shelfPlan.free,
    shelfPlan.name,
    currentPlan?.name,
    quotaUsage?.versionName,
  ]);

  /** 副文案：开通引导拆两行，避免单行挤在一起 */
  const cardSubLines = useMemo(() => {
    if (loading && !quotaUsage) return ['加载中…'];
    if (viewMode === 'purchase' && shelfPlan.free) return ['审批通过后开通'];
    if (viewMode === 'purchase' && lifecycle === 'inactive') return ['选择合适套餐', '开通'];
    if (lifecycle === 'expired') return [`已于 ${expireText} 到期`];
    if (quotaUsage?.versionCode === 'FREE' && !quotaUsage.expireAt) return ['长期有效'];
    return [`有效期至 ${expireText}`];
  }, [loading, quotaUsage, viewMode, shelfPlan.free, lifecycle, expireText]);

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
        title: '该时长暂未开放在线支付，请使用激活码',
        icon: 'none',
        duration: 2800,
      });
      return;
    }
    if (purchasing) return;
    const priceText = paymentService.formatPriceYuan(matchedSku.price);
    const termLabel = term === '1d' ? '1 天' : `${term} 年`;
    const confirm = await Taro.showModal({
      title: `购买${matchedSku.name}`,
      content: `¥${priceText} · ${termLabel}。支付成功后立即生效。`,
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
    term,
  ]);

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
      setTerm(defaultShelfTerm(p?.terms));
    },
    [shelfPlans],
  );

  const primaryActionLabel = useMemo(() => {
    if (lifecycle === 'inactive') return '购买开通';
    if (lifecycle === 'expired') return '立即续费';
    return '续费';
  }, [lifecycle]);

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

            <View className="mx-[32rpx] mt-[24rpx] rounded-[36rpx] bg-card shadow-soft p-[28rpx]">
              <Text className="text-[30rpx] font-semibold text-foreground mb-[8rpx] block">
                变更会员
              </Text>
              <View
                className="mt-[16rpx] flex flex-row items-center rounded-[28rpx] border border-border bg-bg-card px-[24rpx] py-[24rpx] active:opacity-85"
                onClick={() => setViewMode('purchase')}
              >
                <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-card border border-border flex items-center justify-center">
                  <Text className="text-[26rpx] font-extrabold text-primary">
                    {lifecycle === 'inactive' ? '购' : '续'}
                  </Text>
                </View>
                <View className="flex-1 ml-[20rpx] min-w-0">
                  <Text className="text-[28rpx] font-extrabold text-foreground block">
                    {primaryActionLabel}
                  </Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">去选购 ›</Text>
              </View>
              <View
                className="mt-[16rpx] flex flex-row items-center rounded-[28rpx] border border-border bg-bg-card px-[24rpx] py-[24rpx] active:opacity-85"
                onClick={handleOpenRedeem}
              >
                <View className="w-[80rpx] h-[80rpx] rounded-[24rpx] bg-card border border-border flex items-center justify-center">
                  <Text className="text-[26rpx] font-extrabold text-primary">码</Text>
                </View>
                <View className="flex-1 ml-[20rpx] min-w-0">
                  <Text className="text-[28rpx] font-extrabold text-foreground block">激活码</Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">兑换 ›</Text>
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
                    {shelfLoading ? '套餐加载中…' : '暂无在线套餐，请使用激活码'}
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
                        {p.free ? '申请' : p.yearPrice > 0 ? `¥${p.yearPrice}/年` : '询价'}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {!shelfPlan.free && shelfTerms.length > 0 ? (
              <View className="px-[24rpx] pb-[16rpx]">
                <Text className="text-[24rpx] text-muted-foreground mb-[20rpx] block">
                  开通时长 · 原价与实付并排可见
                </Text>
                <View className="flex flex-col gap-[20rpx]">
                  {shelfTerms.map((t) => {
                    const on = t.term === term;
                    return (
                      <View
                        key={String(t.term)}
                        className={cn(
                          'relative rounded-[28rpx] px-[28rpx] py-[24rpx] border-[3rpx]',
                          on ? 'border-primary/55 bg-primary/8' : 'border-border bg-bg-card',
                        )}
                        onClick={() => setTerm(t.term)}
                      >
                        <View className="flex flex-row items-center justify-between gap-[12rpx]">
                          <View className="flex flex-row items-center min-w-0">
                            <View
                              className={cn(
                                'w-[36rpx] h-[36rpx] rounded-full border-[3rpx] mr-[16rpx] flex items-center justify-center',
                                on ? 'border-primary' : 'border-border bg-white',
                              )}
                            >
                              {on ? (
                                <View className="w-[18rpx] h-[18rpx] rounded-full bg-primary" />
                              ) : null}
                            </View>
                            <Text className="text-[30rpx] font-extrabold text-foreground">
                              {t.label}
                            </Text>
                          </View>
                          {t.badge ? (
                            <View
                              className="shrink-0 px-[16rpx] py-[6rpx] rounded-full"
                              style={{
                                backgroundColor: t.bestSave ? '#16a34a' : MEMBERSHIP_MARKETING_RED,
                              }}
                            >
                              <Text className="text-[20rpx] text-white font-extrabold">
                                {t.badge}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {t.term === '1d' ? (
                          <View className="mt-[20rpx] rounded-[24rpx] border border-border/80 bg-white/90 px-[20rpx] py-[20rpx] flex flex-row items-center justify-between">
                            <Text className="text-[22rpx] text-muted-foreground">实付</Text>
                            <Text className="text-[34rpx] font-black text-foreground">
                              ¥{moneyYuan(t.pay)}
                            </Text>
                          </View>
                        ) : (
                          <View className="mt-[20rpx] rounded-[24rpx] border border-border/80 bg-white/90 px-[12rpx] py-[20rpx] flex flex-row items-center">
                            <View className="flex-1 items-center">
                              <Text className="text-[20rpx] text-muted-foreground block">原价</Text>
                              <Text className="text-[26rpx] font-bold text-muted-foreground line-through mt-[8rpx] block">
                                ¥{moneyYuan(t.list)}
                              </Text>
                            </View>
                            <Text className="text-[24rpx] text-muted-foreground font-bold px-[4rpx]">
                              →
                            </Text>
                            <View className="flex-1 items-center">
                              <Text className="text-[20rpx] text-muted-foreground block">实付</Text>
                              <Text className="text-[34rpx] font-black text-foreground mt-[4rpx] block">
                                ¥{moneyYuan(t.pay)}
                              </Text>
                            </View>
                            <Text className="text-[24rpx] text-muted-foreground font-bold px-[4rpx]">
                              =
                            </Text>
                            <View className="flex-1 items-center">
                              <Text className="text-[20rpx] text-muted-foreground block">立省</Text>
                              <Text
                                className="text-[30rpx] font-extrabold mt-[4rpx] block"
                                style={{ color: MEMBERSHIP_MARKETING_RED }}
                              >
                                ¥{moneyYuan(t.save)}
                              </Text>
                            </View>
                          </View>
                        )}

                        {t.term !== '1d' ? (
                          <View className="mt-[16rpx] flex flex-row items-center justify-between">
                            <Text className="text-[20rpx] text-muted-foreground">
                              {t.hint || `¥${shelfPlan.yearPrice}/年 × ${t.term}`}
                            </Text>
                            <Text className="text-[20rpx] text-muted-foreground">
                              ≈ ¥{moneyYuan(t.perYear)}/年
                              {t.savePct > 0 ? ` · 省 ${t.savePct}%` : ''}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {shelfPlan.free ? (
              <View className="mx-[24rpx] mb-[24rpx] rounded-[28rpx] border border-primary/12 bg-primary/8 px-[28rpx] py-[28rpx]">
                <Text className="text-[44rpx] font-black text-foreground">¥0</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] block">
                  申请开通
                </Text>
              </View>
            ) : (
              <View className="mx-[24rpx] mb-[24rpx] rounded-[28rpx] border border-primary/14 bg-primary/7 px-[28rpx] py-[28rpx]">
                <View className="flex flex-row items-end justify-between">
                  <View className="flex flex-row items-baseline">
                    <Text className="text-[30rpx] font-bold text-foreground mr-[4rpx]">¥</Text>
                    <Text className="text-[60rpx] font-black leading-none text-foreground">
                      {moneyYuan(shelfCalc.pay)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[24rpx] text-muted-foreground block">
                      原价 ¥{moneyYuan(shelfCalc.list)}
                    </Text>
                    {shelfCalc.save > 0 ? (
                      <Text
                        className="text-[24rpx] font-extrabold mt-[4rpx] block"
                        style={{ color: MEMBERSHIP_MARKETING_RED }}
                      >
                        本次立省 ¥{moneyYuan(shelfCalc.save)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text className="text-[24rpx] text-muted-foreground mt-[16rpx] block">
                  {term === '1d'
                    ? `${shelfPlan.name} · 1 天`
                    : `${shelfPlan.name} · ${term} 年 · 一天约 ¥${shelfCalc.daily}`}
                </Text>
              </View>
            )}

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
        <View className="flex flex-row gap-[16rpx]">
          {viewMode === 'manage' ? (
            <>
              <View
                className="flex-1 h-[96rpx] rounded-[28rpx] bg-primary flex items-center justify-center shadow-soft active:opacity-90"
                onClick={() => setViewMode('purchase')}
              >
                <Text className="text-[28rpx] font-extrabold text-white">{primaryActionLabel}</Text>
              </View>
              <View
                className="flex-1 h-[96rpx] rounded-[28rpx] bg-card border-[3rpx] border-primary/30 flex items-center justify-center active:opacity-90"
                onClick={handleOpenRedeem}
              >
                <Text className="text-[28rpx] font-extrabold text-primary">激活码</Text>
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
                      : `开通${shelfPlan.shortName} · ${term === '1d' ? '1 天' : `${term} 年`}`}
                </Text>
                <Text className="text-[20rpx] text-white/90 mt-[2rpx]">
                  {shelfPlan.free
                    ? '免费档'
                    : matchedSku
                      ? shelfCalc.save > 0
                        ? `实付 ¥${paymentService.formatPriceYuan(matchedSku.price)} · 省 ¥${moneyYuan(shelfCalc.save)}`
                        : `实付 ¥${paymentService.formatPriceYuan(matchedSku.price)}`
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
