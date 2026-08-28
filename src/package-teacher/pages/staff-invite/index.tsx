/**
 * ????????????? + ???????
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { campusService } from '@/services/campus';
import {
  campusInviteService,
  type CampusInviteItem,
  type CampusInviteRoleCode,
  type CreateCampusInviteResult,
} from '@/services/campus-invite';
import { useAuth } from '@/utils/auth';
import { copyCampusInviteLink } from '@/utils/invite-staff-link';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const ROLE_OPTIONS: { code: CampusInviteRoleCode; label: string; desc: string }[] = [
  { code: 'campus_teacher', label: '????', desc: '????????????' },
  { code: 'campus_reception', label: '??', desc: '?????????' },
  { code: 'campus_principal', label: '????', desc: '????????' },
];

const EXPIRE_OPTIONS: { label: string; expireMinutes?: number; expireDays?: number }[] = [
  { label: '30 ??', expireMinutes: 30 },
  { label: '1 ??', expireMinutes: 60 },
  { label: '1 ?', expireDays: 1 },
  { label: '7 ?', expireDays: 7 },
];

function formatExpireAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const StaffInvitePage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();

  const [campusId, setCampusId] = useState('');
  const [campusName, setCampusName] = useState('');
  const [roleCode, setRoleCode] = useState<CampusInviteRoleCode>('campus_teacher');
  const [expireIndex, setExpireIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [invites, setInvites] = useState<CampusInviteItem[]>([]);
  const [latest, setLatest] = useState<CreateCampusInviteResult | null>(null);

  const loadContext = useCallback(async () => {
    const campuses = await campusService.getList();
    const currentId = profile?.currentContext?.campusId || campuses[0]?.id || '';
    const current = campuses.find((c) => c.id === currentId) || campuses[0];
    setCampusId(current?.id || '');
    setCampusName(current?.name || '????');
  }, [profile?.currentContext?.campusId]);

  const loadInvites = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await campusInviteService.list({ status: 'PENDING', pageSize: 20 });
      setInvites(list);
    } catch {
      setInvites([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useDidShow(() => {
    void loadContext();
    void loadInvites();
  });

  const expireOption = EXPIRE_OPTIONS[expireIndex];

  const handleCreate = useCallback(async () => {
    if (!campusId || creating) return;
    setCreating(true);
    try {
      const result = await campusInviteService.create({
        campusId,
        roleCode,
        expireMinutes: expireOption.expireMinutes,
        expireDays: expireOption.expireDays,
      });
      setLatest(result);
      Taro.showToast({ title: '??????', icon: 'success' });
      void loadInvites();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '????',
        icon: 'none',
      });
    } finally {
      setCreating(false);
    }
  }, [campusId, creating, roleCode, expireOption, loadInvites]);

  const handleCopyLink = useCallback(async (code: string) => {
    await copyCampusInviteLink(code);
  }, []);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await campusInviteService.cancel(id);
        Taro.showToast({ title: '???', icon: 'success' });
        void loadInvites();
        if (latest?.id === id) {
          setLatest(null);
        }
      } catch {
        Taro.showToast({ title: '????', icon: 'none' });
      }
    },
    [latest?.id, loadInvites],
  );

  const displayCode = latest?.inviteCode;

  const pendingHint = useMemo(
    () => `????? ${invites.length} ?`,
    [invites.length],
  );

  return (
    <View className="min-h-screen bg-background flex flex-col">
      <ScrollView scrollY className="flex-1 px-[32rpx] pb-[48rpx]">
        <View className="pt-[24rpx] pb-[16rpx]">
          <Text className="text-[36rpx] font-bold text-foreground block">??????</Text>
          <Text className="text-[26rpx] text-muted-foreground mt-[8rpx] block">
            ??????????????????????????????????
          </Text>
        </View>

        <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[16rpx]">????</Text>
          <Text className="text-[26rpx] text-muted-foreground">{campusName || '???...'}</Text>
        </View>

        <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[20rpx]">????</Text>
          <View className="flex flex-col gap-[16rpx]">
            {ROLE_OPTIONS.map((opt) => (
              <View
                key={opt.code}
                className={cn(
                  'rounded-[20rpx] px-[24rpx] py-[20rpx] border-2',
                  roleCode === opt.code ? 'border-primary bg-primary/5' : 'border-border',
                )}
                onClick={() => setRoleCode(opt.code)}
              >
                <Text className="text-[30rpx] font-medium text-foreground block">{opt.label}</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">{opt.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[20rpx]">???</Text>
          <View className="flex flex-row flex-wrap gap-[16rpx]">
            {EXPIRE_OPTIONS.map((opt, index) => (
              <View
                key={opt.label}
                className={cn(
                  'px-[28rpx] py-[14rpx] rounded-full border',
                  expireIndex === index
                    ? 'bg-primary border-primary'
                    : 'bg-transparent border-border',
                )}
                onClick={() => setExpireIndex(index)}
              >
                <Text
                  className={cn(
                    'text-[26rpx]',
                    expireIndex === index ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <ActionButton
          text={creating ? '???...' : '?????'}
          onClick={handleCreate}
          disabled={creating || !campusId}
        />

        {displayCode ? (
          <View className="bg-primary/10 rounded-[24rpx] p-[28rpx] mt-[24rpx] border border-primary/20">
            <Text className="text-[26rpx] text-muted-foreground block mb-[8rpx]">?????</Text>
            <Text className="text-[40rpx] font-bold text-primary tracking-widest block mb-[16rpx]">
              {displayCode}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground block mb-[20rpx]">
              {latest?.roleLabel} � ???? {formatExpireAt(latest?.expireAt || '')}
            </Text>
            <View className="flex flex-row gap-[16rpx]">
              <View
                className="flex-1 h-[80rpx] rounded-full bg-primary flex items-center justify-center"
                onClick={() => void handleCopyLink(displayCode)}
              >
                <Text className="text-[28rpx] text-white font-medium">??????</Text>
              </View>
              <View
                className="w-[80rpx] h-[80rpx] rounded-full bg-card border border-border flex items-center justify-center"
                onClick={() => {
                  Taro.setClipboardData({ data: displayCode });
                  Taro.showToast({ title: '??????', icon: 'success' });
                }}
              >
                <Icon name="mdi-content-copy" size={32} className="text-primary" />
              </View>
            </View>
          </View>
        ) : null}

        <View className="mt-[40rpx] mb-[16rpx] flex flex-row items-center justify-between">
          <Text className="text-[30rpx] font-semibold text-foreground">?????</Text>
          <Text className="text-[24rpx] text-muted-foreground">{pendingHint}</Text>
        </View>

        {loadingList ? (
          <Loading text="??????..." />
        ) : invites.length === 0 ? (
          <Empty description="?????????" />
        ) : (
          <View className="flex flex-col gap-[16rpx]">
            {invites.map((item) => (
              <View
                key={item.id}
                className="bg-card rounded-[20rpx] px-[24rpx] py-[20rpx] border border-border"
              >
                <View className="flex flex-row items-center justify-between mb-[8rpx]">
                  <Text className="text-[32rpx] font-semibold text-foreground tracking-wide">
                    {item.inviteCode}
                  </Text>
                  <Text className="text-[22rpx] text-primary">{item.roleLabel}</Text>
                </View>
                <Text className="text-[24rpx] text-muted-foreground block">
                  {item.campusName} � ? {formatExpireAt(item.expireAt)}
                </Text>
                <View className="flex flex-row gap-[24rpx] mt-[16rpx]">
                  <Text
                    className="text-[26rpx] text-primary"
                    onClick={() => void handleCopyLink(item.inviteCode)}
                  >
                    ????
                  </Text>
                  <Text
                    className="text-[26rpx] text-destructive"
                    onClick={() => void handleCancel(item.id)}
                  >
                    ??
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default StaffInvitePage;
