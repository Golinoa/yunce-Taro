/**
 * 会员权益页 — 对齐设计稿
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import {
  MEMBERSHIP_FEATURE_ROWS,
  MEMBERSHIP_PLANS,
  getMembershipPlan,
  getPlanFeatureDisplay,
  isUnlimitedQuota,
} from '@/constants/membership-plans';
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
  isOrgMembershipActive,
  organizationService,
  type OrganizationQuotaUsage,
} from '@/services/organization';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

function formatExpireDate(iso?: string | null): string {
  if (!iso) return '未设置';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未设置';
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
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
    <View className="mt-[24rpx]">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-[28rpx] text-foreground">{label}</Text>
        <Text className={cn('text-[26rpx]', full ? 'text-destructive' : 'text-muted-foreground')}>
          {unlimited ? `${current} / 不限` : `${current}/${max}`}
          {full ? ' 已满' : ''}
        </Text>
      </View>
      <View className="mt-[12rpx] h-[12rpx] rounded-full bg-bg-card overflow-hidden">
        <View
          className={cn('h-full rounded-full', full ? 'bg-destructive' : 'bg-primary')}
          style={{ width: unlimited ? '8%' : `${Math.max(ratio * 100, 4)}%` }}
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

const MembershipPage: React.FC = () => {
  useCardNavigationBar();
  const router = useRouter();
  const { currentRole } = useAuth();
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';

  const [quotaUsage, setQuotaUsage] = useState<OrganizationQuotaUsage | null>(null);
  const [tipDefs, setTipDefs] = useState(DEFAULT_MEMBERSHIP_TIPS);
  const [loading, setLoading] = useState(true);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState('STANDARD');
  const [matchedTip, setMatchedTip] = useState<MatchedMembershipTip | null>(null);
  const autoOpenedRedeem = useRef(false);

  const refreshTip = useCallback(
    (quota: OrganizationQuotaUsage | null, tips = tipDefs) => {
      setMatchedTip(matchMembershipTip(quota, tips, loadDismissedTipIds()));
    },
    [tipDefs],
  );

  const loadQuotaUsage = useCallback(async () => {
    if (!isManagerRole) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, remoteTips] = await Promise.all([
        organizationService.getQuotaUsage(),
        organizationService.getMembershipTips(),
      ]);
      setQuotaUsage(data);
      const tips = mergeMembershipTips(DEFAULT_MEMBERSHIP_TIPS, remoteTips);
      setTipDefs(tips);
      const plan = getMembershipPlan(data.versionCode);
      setSelectedPlanCode(!plan || plan.code === 'FREE' ? 'STANDARD' : plan.code);
      refreshTip(data, tips);
    } catch {
      Taro.showToast({ title: '加载会员信息失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [isManagerRole, refreshTip]);

  useDidShow(() => {
    void loadQuotaUsage();
  });

  const active = isOrgMembershipActive(quotaUsage);
  const lifecycle = resolveLifecycle(quotaUsage);
  const expireText = formatExpireDate(quotaUsage?.expireAt);
  const remainDays = daysUntil(quotaUsage?.expireAt);
  const currentPlan = getMembershipPlan(quotaUsage?.versionCode);
  const previewPlan =
    MEMBERSHIP_PLANS.find((p) => p.code === selectedPlanCode) || MEMBERSHIP_PLANS[2];

  const statusLabel = useMemo(() => {
    if (loading) return '加载中';
    if (lifecycle === 'expired') return '已到期';
    if (lifecycle === 'expiring_7') return '即将到期';
    if (lifecycle === 'inactive') return '未开通';
    return '生效中';
  }, [lifecycle, loading]);

  const primaryDockLabel = useMemo(() => {
    if (lifecycle === 'expired') return '兑换激活码续费';
    if (lifecycle === 'inactive') return '兑换激活码开通';
    if (lifecycle === 'expiring_7' || lifecycle === 'expiring_30') return '立即续费';
    return '续费 / 升级';
  }, [lifecycle]);

  const handleOpenRedeem = useCallback(() => {
    setRedeemCode('');
    setShowRedeem(true);
  }, []);

  useEffect(() => {
    if (autoOpenedRedeem.current || loading) return;
    const action = String(router.params?.action || '');
    if (action === 'redeem' || (!active && action === 'open')) {
      autoOpenedRedeem.current = true;
      setShowRedeem(true);
    }
  }, [active, loading, router.params?.action]);

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
      await loadQuotaUsage();
    } finally {
      setRedeeming(false);
    }
  }, [loadQuotaUsage, redeemCode]);

  const handleContactSupport = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  const handleDismissTip = useCallback(() => {
    if (!matchedTip) return;
    dismissMembershipTip(matchedTip.tipId);
    setMatchedTip(null);
  }, [matchedTip]);

  if (!isManagerRole) {
    return (
      <PageContainer>
        <View className="px-[32rpx] py-[80rpx] flex flex-col items-center">
          <Text className="text-[28rpx] text-muted-foreground">仅校长/管理员可查看会员权益</Text>
        </View>
      </PageContainer>
    );
  }

  const cardTone =
    lifecycle === 'expired' ? 'expired' : lifecycle === 'inactive' ? 'inactive' : 'active';

  return (
    <PageContainer>
      <View className="min-h-screen bg-background pb-[calc(140rpx+env(safe-area-inset-bottom))]">
        <View
          className={cn(
            'mx-[32rpx] mt-[24rpx] rounded-[28rpx] p-[32rpx] shadow-soft overflow-hidden relative',
            cardTone === 'active' && 'bg-primary',
            cardTone === 'inactive' && 'bg-card-gradient',
            cardTone === 'expired' && 'bg-[#5C6678]',
          )}
        >
          <View className="flex flex-row items-start justify-between relative z-10">
            <View className="flex flex-row items-baseline">
              <Text
                className={cn(
                  'text-[48rpx] font-black leading-none italic',
                  cardTone === 'inactive' ? 'text-primary' : 'text-white',
                )}
              >
                V
              </Text>
              <Text
                className={cn(
                  'text-[32rpx] font-bold ml-[6rpx]',
                  cardTone === 'inactive' ? 'text-primary' : 'text-white',
                )}
              >
                会员卡
              </Text>
            </View>
            <View
              className={cn(
                'px-[20rpx] py-[10rpx] rounded-full',
                cardTone === 'active' && 'bg-white/20',
                cardTone === 'inactive' && 'bg-primary/12',
                cardTone === 'expired' && 'bg-white/15',
              )}
            >
              <Text
                className={cn(
                  'text-[22rpx] font-semibold',
                  cardTone === 'inactive' ? 'text-primary' : 'text-white',
                )}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <Text
            className={cn(
              'relative z-10 mt-[28rpx] text-[44rpx] font-extrabold leading-tight',
              cardTone === 'inactive' ? 'text-foreground' : 'text-white',
            )}
          >
            {lifecycle === 'inactive'
              ? '开通机构会员'
              : currentPlan?.name || quotaUsage?.versionName || '会员'}
          </Text>

          <Text
            className={cn(
              'relative z-10 mt-[12rpx] text-[26rpx] leading-[40rpx]',
              cardTone === 'inactive' ? 'text-muted-foreground' : 'text-white/85',
            )}
          >
            {loading
              ? '加载中…'
              : lifecycle === 'inactive'
                ? '选择合适套餐，兑换激活码即可开通'
                : lifecycle === 'expired'
                  ? `已于 ${expireText} 到期`
                  : `有效期至 ${expireText}`}
          </Text>

          <View
            className={cn(
              'relative z-10 mt-[24rpx] pt-[20rpx] flex flex-row justify-between',
              cardTone === 'inactive' ? 'border-t border-border/60' : 'border-t border-white/20',
            )}
          >
            <Text
              className={cn(
                'text-[24rpx]',
                cardTone === 'inactive' ? 'text-muted-foreground' : 'text-white/80',
              )}
            >
              机构：{quotaUsage?.organizationName || '—'}
            </Text>
            <Text
              className={cn(
                'text-[24rpx]',
                cardTone === 'inactive' ? 'text-muted-foreground' : 'text-white/80',
              )}
            >
              {lifecycle === 'inactive'
                ? `当前 · ${currentPlan?.name || '众创版'}`
                : lifecycle === 'expired'
                  ? '权益已暂停'
                  : remainDays != null && remainDays >= 0
                    ? `剩余 ${remainDays} 天`
                    : '长期有效'}
            </Text>
          </View>
        </View>

        {matchedTip ? <TipBanner tip={matchedTip} onClose={handleDismissTip} /> : null}

        {quotaUsage ? (
          <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] bg-card shadow-soft p-[28rpx]">
            <View className="flex flex-row items-center justify-between">
              <Text className="text-[30rpx] font-semibold text-foreground">机构配额</Text>
              <Text className="text-[22rpx] text-muted-foreground">
                {currentPlan?.name || quotaUsage.versionName}
                {(quotaUsage.campuses.max || 1) <= 1 ? ' · 单校区' : ' · 多校区'}
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

        <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] bg-card shadow-soft overflow-hidden">
          <View
            className="px-[28rpx] py-[28rpx] flex flex-row items-center justify-between active:opacity-80"
            onClick={() => setPlansOpen((v) => !v)}
          >
            <View>
              <Text className="text-[30rpx] font-semibold text-foreground block">套餐权益对比</Text>
              <Text className="text-[22rpx] text-muted-foreground mt-[6rpx] block">
                众创 / 基础 / 标准 / 旗舰
              </Text>
            </View>
            <Icon
              name="mdi-chevron-right"
              size={36}
              className={cn('text-muted-foreground', plansOpen && 'rotate-90')}
            />
          </View>

          {plansOpen ? (
            <View className="px-[20rpx] pb-[28rpx] border-t border-border">
              <View className="flex flex-row gap-[12rpx] mt-[20rpx]">
                {MEMBERSHIP_PLANS.map((plan) => {
                  const on = selectedPlanCode === plan.code;
                  return (
                    <View
                      key={plan.code}
                      className={cn(
                        'flex-1 min-w-0 rounded-[20rpx] px-[8rpx] py-[18rpx] border-[3rpx]',
                        on ? 'border-primary/45 bg-primary/6' : 'border-border bg-bg-card',
                      )}
                      onClick={() => setSelectedPlanCode(plan.code)}
                    >
                      <View className="flex flex-row items-center justify-center gap-[4rpx]">
                        <Text className="text-[24rpx] font-bold text-foreground">
                          {plan.shortName}
                        </Text>
                        {plan.recommended ? (
                          <View className="px-[8rpx] py-[2rpx] rounded-full bg-primary">
                            <Text className="text-[18rpx] text-white font-bold">荐</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-[20rpx] text-muted-foreground mt-[6rpx] text-center block">
                        {plan.subtitle}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View className="mt-[20rpx] rounded-[20rpx] bg-bg-card p-[24rpx]">
                <View className="flex flex-row items-center justify-between mb-[8rpx]">
                  <Text className="text-[28rpx] font-bold text-foreground">{previewPlan.name}</Text>
                  <Text className="text-[22rpx] text-primary">
                    {previewPlan.code === quotaUsage?.versionCode ? '当前' : '预览'}
                  </Text>
                </View>
                {MEMBERSHIP_FEATURE_ROWS.map((row) => {
                  const val = getPlanFeatureDisplay(previewPlan, row.key);
                  return (
                    <View
                      key={row.key}
                      className="flex flex-row items-center justify-between py-[14rpx] border-t border-border/70"
                    >
                      <Text className="text-[26rpx] text-foreground/80">{row.label}</Text>
                      <Text
                        className={cn(
                          'text-[26rpx] font-semibold',
                          val === '—' && 'text-muted-foreground font-medium',
                          val === '✓' && 'text-success',
                        )}
                      >
                        {val}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View
                className="mt-[20rpx] rounded-[20rpx] border border-dashed border-primary/30 bg-primary/4 px-[24rpx] py-[22rpx] flex flex-row items-center active:opacity-80"
                onClick={handleContactSupport}
              >
                <View className="w-[64rpx] h-[64rpx] rounded-[16rpx] bg-card border border-border flex items-center justify-center">
                  <Text className="text-[24rpx] font-bold text-primary">定</Text>
                </View>
                <View className="flex-1 ml-[20rpx]">
                  <Text className="text-[28rpx] font-bold text-foreground block">定制功能</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] block">
                    更大配额、专属模块 → 联系客服
                  </Text>
                </View>
                <Text className="text-[24rpx] font-bold text-primary">联系 ›</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Text className="mx-[48rpx] mt-[32rpx] mb-[16rpx] text-[22rpx] leading-[34rpx] text-muted-foreground text-center">
          激活码由平台运营发放。兑换成功后立即生效，可延长有效期并升级档位。
        </Text>
      </View>

      <View className="fixed left-0 right-0 bottom-0 z-20 px-[32rpx] pt-[16rpx] pb-[calc(16rpx+env(safe-area-inset-bottom))] bg-background">
        <View className="flex flex-row gap-[16rpx]">
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] bg-primary flex items-center justify-center shadow-soft active:opacity-90"
            onClick={handleOpenRedeem}
          >
            <Text className="text-[28rpx] font-bold text-white">{primaryDockLabel}</Text>
          </View>
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] bg-card border-[3rpx] border-primary/30 flex items-center justify-center active:opacity-90"
            onClick={handleContactSupport}
          >
            <Text className="text-[28rpx] font-bold text-primary">联系客服</Text>
          </View>
        </View>
      </View>

      <BottomSheet
        visible={showRedeem}
        onClose={() => {
          if (!redeeming) setShowRedeem(false);
        }}
        title={
          lifecycle === 'expired' || active
            ? lifecycle === 'expired'
              ? '续费会员'
              : '续费 / 升级'
            : '开通会员'
        }
      >
        <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
          <Text className="text-[26rpx] text-muted-foreground mb-[24rpx] block leading-[40rpx]">
            请输入运营发放的激活码（形如
            HXK-xxxx-xxxxxxxx）。兑换成功后将更新机构会员有效期与套餐档位。
          </Text>
          <FormInput
            variant="capsule"
            placeholder="请输入激活码"
            value={redeemCode}
            onInput={(e) => setRedeemCode(e.detail.value.trim().toUpperCase())}
            maxlength={64}
            className="mb-[32rpx]"
          />
          <View
            className={cn(
              'h-[88rpx] rounded-[28rpx] flex items-center justify-center bg-primary active:opacity-90',
              redeeming && 'opacity-60',
            )}
            onClick={() => {
              void handleSubmitRedeem();
            }}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {redeeming ? '兑换中…' : active || lifecycle === 'expired' ? '确认续费' : '确认开通'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default withRouteGuard(MembershipPage);
