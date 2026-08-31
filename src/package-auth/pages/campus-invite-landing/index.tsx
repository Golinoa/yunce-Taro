/**
 * ?????????
 * ????code=XXXXXXXXXX
 * - ?????????? ? ???? ? ????
 * - ???????? ? ?? token ? ?????
 */
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { getSession } from '@/services/auth';
import { campusInviteService, type CampusInvitePreview } from '@/services/campus-invite';
import { useAuth } from '@/utils/auth';
import { clearIdentitySelectionPending } from '@/utils/auth-onboarding';
import {
  consumePendingCampusInviteCode,
  storePendingCampusInviteCode,
} from '@/utils/invite-staff-link';
import { navigateAfterLogin } from '@/utils/route-guard';
import { useNavSafeHeight } from '@/utils/use-nav-safe-height';

function formatExpireAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const CampusInviteLanding: React.FC = () => {
  const router = useRouter();
  const navHeight = useNavSafeHeight();
  const { profile, refreshProfile, session } = useAuth();

  const inviteCode = useMemo(() => {
    const fromRoute = (router.params.code || '').trim().toUpperCase();
    if (fromRoute) return fromRoute;
    return consumePendingCampusInviteCode();
  }, [router.params.code]);

  const [preview, setPreview] = useState<CampusInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (inviteCode) {
      storePendingCampusInviteCode(inviteCode);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (!inviteCode) {
      setError('????????????');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await campusInviteService.preview(inviteCode);
        if (!cancelled) {
          setPreview(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '?????????');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const handleLogin = useCallback(() => {
    if (inviteCode) {
      storePendingCampusInviteCode(inviteCode);
    }
    Taro.navigateTo({ url: '/package-auth/pages/login/index' });
  }, [inviteCode]);

  const handleAccept = useCallback(async () => {
    if (!inviteCode || accepting) return;

    if (!session) {
      handleLogin();
      return;
    }

    setAccepting(true);
    try {
      const result = await campusInviteService.accept(inviteCode);
      consumePendingCampusInviteCode();
      clearIdentitySelectionPending();
      await refreshProfile();
      const { profile: latestProfile } = await getSession();
      Taro.showToast({
        title: result.alreadyJoined ? '???????' : '????',
        icon: 'success',
      });
      setTimeout(() => {
        navigateAfterLogin(latestProfile || profile);
      }, 600);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '??????',
        icon: 'none',
      });
    } finally {
      setAccepting(false);
    }
  }, [inviteCode, accepting, session, handleLogin, refreshProfile, profile]);

  if (loading) {
    return (
      <View className="min-h-screen bg-background flex items-center justify-center">
        <View style={{ height: `${navHeight}px` }} />
        <Loading text="??????..." />
      </View>
    );
  }

  if (error || !preview) {
    return (
      <View className="min-h-screen bg-background px-[48rpx]">
        <View style={{ height: `${navHeight}px` }} />
        <View className="pt-[80rpx] flex flex-col items-center">
          <Icon
            name="mdi-alert-circle-outline"
            size={80}
            className="text-muted-foreground mb-[24rpx]"
          />
          <Text className="text-[32rpx] text-foreground text-center">{error || '????'}</Text>
          <Text
            className="text-[28rpx] text-primary mt-[48rpx]"
            onClick={() => Taro.navigateTo({ url: '/package-auth/pages/login/index' })}
          >
            ????
          </Text>
        </View>
      </View>
    );
  }

  const isExpired =
    preview.status === 'EXPIRED' || new Date(preview.expireAt).getTime() <= Date.now();
  const isUsed = preview.status === 'USED';
  const canAccept = !isExpired && !isUsed && preview.status === 'PENDING';

  return (
    <View className="min-h-screen flex flex-col bg-background">
      <View style={{ height: `${navHeight}px` }} />

      <View className="px-[48rpx] pt-[32rpx] flex-1">
        <Text className="text-[44rpx] font-bold text-foreground block mb-[12rpx]">
          ?? {preview.organizationName}
        </Text>
        <Text className="text-[28rpx] text-muted-foreground block mb-[48rpx]">
          ????????????????????
        </Text>

        <View className="bg-card rounded-[28rpx] p-[32rpx] border border-border shadow-soft mb-[32rpx]">
          <InfoRow label="??" value={preview.organizationName} />
          <InfoRow label="??" value={preview.campusName} />
          <InfoRow label="????" value={preview.roleLabel || preview.roleCode} />
          <InfoRow label="????" value={formatExpireAt(preview.expireAt)} />
          <InfoRow label="???" value={preview.inviteCode} copyable />
        </View>

        {isUsed ? (
          <Text className="text-[28rpx] text-muted-foreground text-center block">???????</Text>
        ) : null}
        {isExpired ? (
          <Text className="text-[28rpx] text-muted-foreground text-center block">
            ??????????????????
          </Text>
        ) : null}
      </View>

      <View className="px-[48rpx] pb-[calc(48rpx+env(safe-area-inset-bottom))]">
        {canAccept ? (
          session ? (
            <View
              className="h-[96rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
              onClick={handleAccept}
            >
              <Text className="text-[32rpx] font-semibold text-white">
                {accepting ? '???...' : '????'}
              </Text>
            </View>
          ) : (
            <View
              className="h-[96rpx] rounded-full bg-primary flex items-center justify-center active:opacity-90"
              onClick={handleLogin}
            >
              <Text className="text-[32rpx] font-semibold text-white">???????</Text>
            </View>
          )
        ) : null}
      </View>
    </View>
  );
};

const InfoRow: React.FC<{
  label: string;
  value: string;
  copyable?: boolean;
}> = ({ label, value, copyable }) => (
  <View className="flex flex-row items-center justify-between py-[16rpx] border-b border-border last:border-b-0">
    <Text className="text-[28rpx] text-muted-foreground">{label}</Text>
    <View className="flex flex-row items-center gap-[12rpx]">
      <Text className="text-[28rpx] text-foreground font-medium">{value}</Text>
      {copyable ? (
        <Icon
          name="mdi-content-copy"
          size={28}
          className="text-primary"
          onClick={() => {
            Taro.setClipboardData({ data: value });
            Taro.showToast({ title: '???', icon: 'success' });
          }}
        />
      ) : null}
    </View>
  </View>
);

export default CampusInviteLanding;
