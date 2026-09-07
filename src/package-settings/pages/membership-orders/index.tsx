/**
 * 会员订单列表 / 详情 — 对齐 docs/UI-design/membership-orders.html + pay-pending
 * 使用原生导航栏；待付展示倒计时并支持继续支付
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import {
  prefetchMembershipBootstrap,
  writeMembershipQuotaCache,
} from '@/services/membership-cache';
import { organizationService } from '@/services/organization';
import { paymentService, type PaymentOrderStatusResult } from '@/services/payment';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { REFRESH_SIGNAL, setRefreshSignal } from '@/utils/refresh-signal';
import { withRouteGuard } from '@/utils/route-guard';

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function statusMeta(status: string): { label: string; tone: 'ok' | 'pay' | 'off' | 'ref' } {
  switch (status) {
    case 'FULFILLED':
      return { label: '已开通', tone: 'ok' };
    case 'PAYING':
      return { label: '待付款', tone: 'pay' };
    case 'PAID':
      return { label: '履约中', tone: 'pay' };
    case 'CLOSED':
      return { label: '已关闭', tone: 'off' };
    case 'REFUNDING':
    case 'REFUNDED':
      return { label: '已退款', tone: 'ref' };
    default:
      return { label: status, tone: 'off' };
  }
}

function useCountdown(expiresAt?: string | null): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setText(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      const h = String(Math.floor(left / 3600)).padStart(2, '0');
      const m = String(Math.floor((left % 3600) / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      setText(left > 0 ? `${h}:${m}:${s}` : '00:00:00');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return text;
}

const Badge: React.FC<{ tone: 'ok' | 'pay' | 'off' | 'ref'; label: string }> = ({
  tone,
  label,
}) => (
  <View
    className={cn(
      'px-[16rpx] py-[6rpx] rounded-full',
      tone === 'ok' && 'bg-success/12',
      tone === 'pay' && 'bg-warning/14',
      tone === 'off' && 'bg-border',
      tone === 'ref' && 'bg-destructive/10',
    )}
  >
    <Text
      className={cn(
        'text-[22rpx] font-bold',
        tone === 'ok' && 'text-success',
        tone === 'pay' && 'text-warning',
        tone === 'off' && 'text-muted-foreground',
        tone === 'ref' && 'text-destructive',
      )}
    >
      {label}
    </Text>
  </View>
);

const MembershipOrdersPage: React.FC = () => {
  useCardNavigationBar();
  const router = useRouter();
  const focusId = router.params?.orderId || '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [items, setItems] = useState<PaymentOrderStatusResult[]>([]);
  const [detail, setDetail] = useState<PaymentOrderStatusResult | null>(null);
  const [paying, setPaying] = useState(false);

  const detailCountdown = useCountdown(detail?.status === 'PAYING' ? detail.expiresAt : null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await Promise.race([
        paymentService.listOrders({ page: 1, pageSize: 50 }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('加载超时')), 15000);
        }),
      ]);
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      if (focusId) {
        const hit = list.find((x) => x.orderId === focusId);
        if (hit) {
          setDetail(hit);
        } else {
          try {
            setDetail(await paymentService.getOrder(focusId));
          } catch {
            setDetail(null);
          }
        }
      }
    } catch {
      setItems([]);
      setLoadError(true);
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [focusId]);

  useDidShow(() => {
    void loadList();
  });

  const openDetail = useCallback(async (order: PaymentOrderStatusResult) => {
    try {
      const fresh = await paymentService.getOrder(order.orderId);
      setDetail(fresh);
    } catch {
      setDetail(order);
    }
  }, []);

  const notifyMembershipPaid = useCallback(async () => {
    setRefreshSignal(REFRESH_SIGNAL.membership);
    setRefreshSignal(REFRESH_SIGNAL.profileQuota);
    try {
      const quota = await organizationService.getQuotaUsage();
      writeMembershipQuotaCache(quota);
    } catch {
      /* ignore */
    }
    void prefetchMembershipBootstrap({ force: true });
  }, []);

  const handleContinue = useCallback(async () => {
    if (!detail || detail.status !== 'PAYING' || paying) return;
    setPaying(true);
    try {
      Taro.showLoading({ title: '下单中…', mask: true });
      const result = await paymentService.continuePay(detail.orderId, {
        onOrderCreated: () => Taro.hideLoading(),
      });
      Taro.hideLoading();
      if (result.ok && result.fulfilled) {
        Taro.showToast({ title: result.message || '开通成功', icon: 'success' });
        await notifyMembershipPaid();
        setDetail(null);
        await loadList();
      } else if (result.ok && !result.fulfilled) {
        await notifyMembershipPaid();
        const orderId = result.order?.orderId;
        const choice = await Taro.showModal({
          title: '支付成功',
          content: result.message || '权益开通中。可点「刷新状态」再确认。',
          confirmText: '刷新状态',
          cancelText: '关闭',
        });
        if (choice.confirm && orderId) {
          Taro.showLoading({ title: '开通确认中…', mask: true });
          try {
            let latest = result.order!;
            for (let i = 0; i < 20; i += 1) {
              latest = await paymentService.getOrder(orderId);
              if (latest.status === 'FULFILLED' || latest.status === 'CLOSED') break;
              await new Promise((r) => setTimeout(r, 1500));
            }
            setDetail(latest);
            if (latest.status === 'FULFILLED') {
              await notifyMembershipPaid();
              Taro.showToast({ title: '开通成功', icon: 'success' });
              setDetail(null);
            }
          } finally {
            Taro.hideLoading();
          }
        } else if (orderId) {
          try {
            setDetail(await paymentService.getOrder(orderId));
          } catch {
            /* keep */
          }
        }
        await loadList();
      } else {
        Taro.showToast({ title: result.message || '支付未完成', icon: 'none' });
        await loadList();
        if (result.order?.orderId) {
          try {
            setDetail(await paymentService.getOrder(result.order.orderId));
          } catch {
            /* keep */
          }
        }
      }
    } catch (err) {
      Taro.hideLoading();
      Taro.showToast({
        title: err instanceof Error ? err.message : '支付失败',
        icon: 'none',
      });
    } finally {
      setPaying(false);
    }
  }, [detail, loadList, notifyMembershipPaid, paying]);

  const handleClose = useCallback(async () => {
    if (!detail || detail.status !== 'PAYING' || paying) return;
    const confirm = await Taro.showModal({
      title: '关闭订单',
      content: '关闭后需重新下单才能支付。确定关闭？',
      confirmText: '关闭',
      cancelText: '取消',
    });
    if (!confirm.confirm) return;
    try {
      await paymentService.closeOrder(detail.orderId);
      Taro.showToast({ title: '已关闭', icon: 'none' });
      setDetail(null);
      await loadList();
    } catch (err) {
      Taro.showToast({
        title: err instanceof Error ? err.message : '关闭失败',
        icon: 'none',
      });
    }
  }, [detail, loadList, paying]);

  const titleSku = useMemo(() => {
    if (!detail) return '';
    const name = detail.versionName || detail.versionCode;
    const days = detail.durationDays || 0;
    if (days > 0 && days <= 3) return `${name} · ${days} 天`;
    const years = days ? Math.round(days / 365) : 0;
    return years > 0 ? `${name} · ${years} 年` : name;
  }, [detail]);

  if (loading && items.length === 0 && !detail) {
    return (
      <PageContainer>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载订单…" />
        </View>
      </PageContainer>
    );
  }

  if (!detail && loadError && items.length === 0) {
    return (
      <PageContainer safeBottom>
        <View className="px-[32rpx] pt-[80rpx] flex flex-col items-center">
          <Empty icon="mdi-alert-circle-outline" description="订单加载失败" />
          <View
            className="mt-[32rpx] px-[40rpx] py-[20rpx] rounded-full bg-primary"
            onClick={() => void loadList()}
          >
            <Text className="text-[28rpx] font-semibold text-white">重新加载</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  if (detail) {
    const meta = statusMeta(detail.status);
    const isPaying = detail.status === 'PAYING';
    return (
      <PageContainer safeBottom>
        <View className="px-[32rpx] pt-[24rpx] pb-[calc(160rpx+env(safe-area-inset-bottom))]">
          <View
            className={cn(
              'rounded-[32rpx] border border-border bg-card px-[32rpx] py-[40rpx] flex flex-col items-center',
              isPaying && 'border-warning/40 bg-[#fffaf5]',
            )}
          >
            <Badge tone={meta.tone} label={meta.label} />
            <Text className="mt-[20rpx] text-[34rpx] font-bold text-foreground">{titleSku}</Text>
            <Text className="mt-[12rpx] text-[56rpx] font-extrabold text-primary">
              ¥{paymentService.formatPriceYuan(detail.goodsPrice)}
            </Text>
            {isPaying && detailCountdown ? (
              <View className="mt-[28rpx] pt-[28rpx] w-full border-t border-dashed border-border flex flex-col items-center">
                <Text className="text-[24rpx] text-muted-foreground font-semibold">
                  支付剩余时间
                </Text>
                <Text className="mt-[12rpx] text-[40rpx] font-extrabold text-warning tracking-wider">
                  {detailCountdown}
                </Text>
                <Text className="mt-[12rpx] text-[24rpx] text-warning font-semibold">
                  超时将自动关闭，需重新下单
                </Text>
              </View>
            ) : null}
          </View>

          {detail.status === 'FULFILLED' ? (
            <View className="mt-[24rpx] rounded-[32rpx] border border-border bg-card px-[28rpx] py-[24rpx] flex flex-row items-center">
              <View className="flex-1 flex flex-col items-center">
                <Text className="text-[24rpx] text-muted-foreground">支付前有效期</Text>
                <Text className="mt-[8rpx] text-[28rpx] font-semibold text-foreground">
                  至 {formatDate(detail.orgExpireAt)}
                </Text>
              </View>
              <Text className="text-[32rpx] text-primary font-bold px-[12rpx]">→</Text>
              <View className="flex-1 flex flex-col items-center">
                <Text className="text-[24rpx] text-muted-foreground">履约后有效期</Text>
                <Text className="mt-[8rpx] text-[28rpx] font-semibold text-foreground">
                  至 {formatDate(detail.expireHint || detail.orgExpireAt)}
                </Text>
              </View>
            </View>
          ) : null}

          <View className="mt-[24rpx] rounded-[32rpx] border border-border bg-card px-[32rpx]">
            <Text className="pt-[24rpx] pb-[8rpx] text-[26rpx] font-bold text-muted-foreground">
              订单信息
            </Text>
            <Kv k="商户单号" v={detail.outTradeNo} />
            {detail.wxOrderId ? <Kv k="微信单号" v={detail.wxOrderId} /> : null}
            <Kv k="套餐编码" v={detail.versionCode} />
            <Kv k="支付方式" v="微信支付" last={!isPaying} />
            {isPaying && detail.expiresAt ? (
              <Kv k="关闭时间" v={formatDateTime(detail.expiresAt)} last />
            ) : null}
          </View>

          <View className="mt-[24rpx] rounded-[32rpx] border border-border bg-card px-[32rpx]">
            <Text className="pt-[24rpx] pb-[8rpx] text-[26rpx] font-bold text-muted-foreground">
              时间
            </Text>
            <Kv k="创建时间" v={formatDateTime(detail.createdAt)} />
            <Kv k="支付时间" v={formatDateTime(detail.paidAt)} />
            <Kv k="开通时间" v={formatDateTime(detail.fulfilledAt)} last />
          </View>

          <View
            className="mt-[32rpx] py-[20rpx] flex items-center justify-center"
            onClick={() => setDetail(null)}
          >
            <Text className="text-[28rpx] text-primary font-semibold">返回列表</Text>
          </View>
        </View>

        {isPaying ? (
          <View className="fixed left-0 right-0 bottom-0 px-[32rpx] pt-[16rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-background flex flex-row gap-[20rpx]">
            <View
              className="flex-1 h-[92rpx] rounded-[28rpx] border border-border bg-card flex items-center justify-center"
              onClick={() => void handleClose()}
            >
              <Text className="text-[30rpx] font-bold text-muted-foreground">关闭订单</Text>
            </View>
            <View
              className="flex-1 h-[92rpx] rounded-[28rpx] bg-primary flex items-center justify-center"
              onClick={() => void handleContinue()}
            >
              <Text className="text-[30rpx] font-bold text-white">继续支付</Text>
            </View>
          </View>
        ) : null}
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[24rpx] pb-[48rpx]">
        {items.length === 0 ? (
          <Empty icon="mdi-file-document-outline" description="暂无订单" />
        ) : (
          items.map((order) => (
            <OrderCard
              key={order.orderId}
              order={order}
              onOpen={() => void openDetail(order)}
              onContinue={async () => {
                if (paying) return;
                setPaying(true);
                try {
                  Taro.showLoading({ title: '下单中…', mask: true });
                  const result = await paymentService.continuePay(order.orderId, {
                    onOrderCreated: () => Taro.hideLoading(),
                  });
                  Taro.hideLoading();
                  if (result.ok && result.fulfilled) {
                    Taro.showToast({ title: result.message || '开通成功', icon: 'success' });
                    await notifyMembershipPaid();
                    await loadList();
                  } else if (result.ok) {
                    await Taro.showModal({
                      title: '支付成功',
                      content: result.message || '权益开通中，请稍后刷新',
                      showCancel: false,
                    });
                    await loadList();
                  } else {
                    Taro.showToast({ title: result.message || '支付未完成', icon: 'none' });
                    await loadList();
                  }
                } catch (err) {
                  Taro.hideLoading();
                  Taro.showToast({
                    title: err instanceof Error ? err.message : '支付失败',
                    icon: 'none',
                  });
                } finally {
                  setPaying(false);
                }
              }}
            />
          ))
        )}
      </View>
    </PageContainer>
  );
};

const Kv: React.FC<{ k: string; v: string; last?: boolean }> = ({ k, v, last }) => (
  <View
    className={cn(
      'flex flex-row justify-between gap-[24rpx] py-[22rpx]',
      !last && 'border-b border-border',
    )}
  >
    <Text className="text-[26rpx] text-muted-foreground shrink-0">{k}</Text>
    <Text className="text-[26rpx] font-semibold text-foreground text-right break-all">{v}</Text>
  </View>
);

const OrderCard: React.FC<{
  order: PaymentOrderStatusResult;
  onOpen: () => void;
  onContinue: () => void;
}> = ({ order, onOpen, onContinue }) => {
  const meta = statusMeta(order.status);
  const countdown = useCountdown(order.status === 'PAYING' ? order.expiresAt : null);
  const years = order.durationDays ? Math.round(order.durationDays / 365) : 0;
  const sku =
    years > 0
      ? `${order.versionName || order.versionCode} · ${years} 年`
      : order.versionName || order.versionCode;

  return (
    <View
      className={cn(
        'mb-[20rpx] rounded-[32rpx] border border-border bg-card px-[32rpx] py-[28rpx]',
        order.status === 'PAYING' && 'border-warning/45 bg-[#fffaf5]',
      )}
      onClick={onOpen}
    >
      <View className="flex flex-row justify-between items-start gap-[20rpx]">
        <View className="flex-1 min-w-0">
          <Text className="text-[30rpx] font-bold text-foreground">{sku}</Text>
          <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground">
            {formatDateTime(order.createdAt)}
          </Text>
          {countdown && order.status === 'PAYING' ? (
            <Text className="mt-[12rpx] text-[24rpx] font-bold text-warning">
              {countdown} 后关闭
            </Text>
          ) : null}
        </View>
        <Badge tone={meta.tone} label={meta.label} />
      </View>
      <View className="mt-[24rpx] pt-[24rpx] border-t border-border flex flex-row items-center justify-between">
        <Text className="text-[40rpx] font-extrabold text-primary">
          ¥{paymentService.formatPriceYuan(order.goodsPrice)}
        </Text>
        {order.status === 'PAYING' ? (
          <View
            className="px-[28rpx] py-[14rpx] rounded-full bg-primary"
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
          >
            <Text className="text-[24rpx] font-bold text-white">继续支付</Text>
          </View>
        ) : (
          <Text className="text-[36rpx] text-muted-foreground font-light">›</Text>
        )}
      </View>
    </View>
  );
};

export default withRouteGuard(MembershipOrdersPage);
