/**
 * 会员权益页 — 到期信息 / 激活码兑换 / 机构配额
 * 从「我的」会员卡「立即查看 / 立即开通」进入
 *
 * 激活码由运营端批量生成（格式 HXK-…），兑换后顺延机构 expireAt，并可升级 versionCode。
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
  isOrgMembershipActive,
  organizationService,
  type OrganizationQuotaUsage,
} from '@/services/organization';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/** 配额使用率进度条（达到上限变红） */
const QuotaBar: React.FC<{ label: string; current: number; max: number }> = ({
  label,
  current,
  max,
}) => {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const full = current >= max;
  return (
    <View className="mt-[24rpx]">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-[28rpx] text-foreground">{label}</Text>
        <Text className={cn('text-[26rpx]', full ? 'text-destructive' : 'text-muted-foreground')}>
          {current}/{max}
          {full ? ' 已满' : ''}
        </Text>
      </View>
      <View className="mt-[12rpx] h-[12rpx] rounded-full bg-bg-card overflow-hidden">
        <View
          className={cn('h-full rounded-full', full ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.max(ratio * 100, 4)}%` }}
        />
      </View>
    </View>
  );
};

function formatExpireDate(iso?: string | null): string {
  if (!iso) return '未设置';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未设置';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isExpired(iso?: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now();
}

const MembershipPage: React.FC = () => {
  useCardNavigationBar();
  const router = useRouter();
  const { currentRole } = useAuth();
  const isManagerRole = currentRole === 'principal' || currentRole === 'admin';

  const [quotaUsage, setQuotaUsage] = useState<OrganizationQuotaUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const autoOpenedRedeem = useRef(false);

  const loadQuotaUsage = useCallback(async () => {
    if (!isManagerRole) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await organizationService.getQuotaUsage();
      setQuotaUsage(data);
    } catch {
      Taro.showToast({ title: '加载会员信息失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [isManagerRole]);

  useDidShow(() => {
    void loadQuotaUsage();
  });

  const expired = isExpired(quotaUsage?.expireAt);
  const active = isOrgMembershipActive(quotaUsage);
  const expireText = formatExpireDate(quotaUsage?.expireAt);

  const statusLabel = useMemo(() => {
    if (loading) return '加载中';
    if (active) return '生效中';
    if (expired) return '已到期';
    return '未开通';
  }, [active, expired, loading]);

  const handleOpenRedeem = useCallback(() => {
    setRedeemCode('');
    setShowRedeem(true);
  }, []);

  // 「立即开通」带 action=redeem：自动打开兑换弹层
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
      Taro.showToast({
        title: result.message || '兑换成功',
        icon: 'success',
        duration: 2500,
      });
      await loadQuotaUsage();
    } finally {
      setRedeeming(false);
    }
  }, [loadQuotaUsage, redeemCode]);

  const handleContactSupport = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  if (!isManagerRole) {
    return (
      <PageContainer>
        <View className="px-[32rpx] py-[80rpx] flex flex-col items-center">
          <Text className="text-[28rpx] text-muted-foreground">仅校长/管理员可查看会员权益</Text>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-background pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        {/* 会员状态卡片 */}
        <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] bg-card-gradient p-[32rpx] shadow-soft overflow-hidden relative">
          <View className="flex flex-row items-center justify-between relative z-10">
            <View className="flex-1 pr-[16rpx]">
              <View className="flex flex-row items-baseline">
                <Text className="text-[48rpx] font-black text-primary leading-none italic">V</Text>
                <Text className="text-[32rpx] font-bold text-primary ml-[6rpx]">会员卡</Text>
              </View>
              <Text className="text-[26rpx] text-muted-foreground mt-[16rpx] leading-[40rpx]">
                {loading
                  ? '加载中…'
                  : active
                    ? `${quotaUsage?.versionName || '会员'} · 有效期至 ${expireText}`
                    : expired
                      ? `${quotaUsage?.versionName || '会员'}已于 ${expireText} 到期，请兑换激活码续费`
                      : '当前为免费版，兑换激活码即可开通会员'}
              </Text>
            </View>
            <View
              className={cn(
                'px-[20rpx] py-[10rpx] rounded-full flex-shrink-0',
                active ? 'bg-primary/12' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-[22rpx] font-semibold',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          {quotaUsage?.organizationName ? (
            <Text className="relative z-10 mt-[20rpx] text-[24rpx] text-muted-foreground">
              机构：{quotaUsage.organizationName}
            </Text>
          ) : null}

          {/* 未开通 / 已到期：主 CTA */}
          {!loading && !active ? (
            <View
              className="relative z-10 mt-[28rpx] h-[80rpx] rounded-[24rpx] flex items-center justify-center bg-primary active:opacity-90"
              onClick={handleOpenRedeem}
            >
              <Text className="text-[28rpx] font-semibold text-white">
                {expired ? '兑换激活码续费' : '兑换激活码开通'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 激活码入口（开通与续费共用） */}
        <View
          className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] bg-card shadow-soft px-[28rpx] py-[28rpx] flex flex-row items-center active:opacity-80"
          onClick={handleOpenRedeem}
        >
          <View className="w-[72rpx] h-[72rpx] rounded-[20rpx] bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="mdi-ticket-outline" size={40} className="text-primary" />
          </View>
          <View className="flex-1 ml-[24rpx]">
            <Text className="text-[30rpx] font-semibold text-foreground block">
              {active ? '续费 / 升级' : '输入激活码'}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
              使用运营端发放的激活码开通或延长会员
            </Text>
          </View>
          <Icon name="mdi-chevron-right" size={36} className="text-muted-foreground" />
        </View>

        {/* 联系客服（无码时的充值/开通路径） */}
        <View
          className="mx-[32rpx] mt-[16rpx] rounded-[28rpx] bg-card shadow-soft px-[28rpx] py-[28rpx] flex flex-row items-center active:opacity-80"
          onClick={handleContactSupport}
        >
          <View className="w-[72rpx] h-[72rpx] rounded-[20rpx] bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="mdi-headset" size={40} className="text-primary" />
          </View>
          <View className="flex-1 ml-[24rpx]">
            <Text className="text-[30rpx] font-semibold text-foreground block">联系平台客服</Text>
            <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
              没有激活码？反馈需求，由运营开通或充值
            </Text>
          </View>
          <Icon name="mdi-chevron-right" size={36} className="text-muted-foreground" />
        </View>

        {/* 机构配额 */}
        <View className="mx-[32rpx] mt-[24rpx] rounded-[28rpx] bg-card shadow-soft p-[28rpx]">
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-row items-center gap-[12rpx]">
              <Text className="text-[30rpx] font-semibold text-foreground">机构配额</Text>
              {quotaUsage?.versionName ? (
                <View className="px-[12rpx] py-[4rpx] rounded-full bg-primary-10">
                  <Text className="text-[22rpx] text-primary">{quotaUsage.versionName}</Text>
                </View>
              ) : null}
            </View>
            <Text
              className={cn(
                'text-[22rpx]',
                quotaUsage &&
                  (quotaUsage.members.current >= quotaUsage.members.max ||
                    quotaUsage.employees.current >= quotaUsage.employees.max)
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {loading
                ? '加载中'
                : quotaUsage &&
                    (quotaUsage.members.current >= quotaUsage.members.max ||
                      quotaUsage.employees.current >= quotaUsage.employees.max)
                  ? '配额已满'
                  : '当前套餐配额'}
            </Text>
          </View>

          {quotaUsage ? (
            <>
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
            </>
          ) : (
            <Text className="mt-[28rpx] text-[26rpx] text-muted-foreground">
              {loading ? '正在加载配额…' : '暂无配额数据'}
            </Text>
          )}
        </View>

        <Text className="mx-[48rpx] mt-[32rpx] text-[22rpx] leading-[34rpx] text-muted-foreground text-center">
          激活码由平台运营在管理后台生成。兑换成功后立即生效，可延长有效期并升级会员档位。
        </Text>
      </View>

      <BottomSheet
        visible={showRedeem}
        onClose={() => {
          if (!redeeming) setShowRedeem(false);
        }}
        title={active ? '续费 / 升级' : '开通会员'}
      >
        <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]">
          <Text className="text-[26rpx] text-muted-foreground mb-[24rpx] block leading-[40rpx]">
            请输入运营发放的激活码（形如 HXK-xxxx-xxxxxxxx）。兑换成功后将更新机构会员有效期与套餐档位。
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
              {redeeming ? '兑换中…' : active ? '确认续费' : '确认开通'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

export default withRouteGuard(MembershipPage);
