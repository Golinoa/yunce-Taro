/**
 * 员工邀请页：生成临时 E 码；支持点对点绑定（?teacherId=）
 */
import { Button, View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useRouter, useShareAppMessage } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ActionButton from '@/components/ActionButton';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import { teacherService } from '@/services';
import { campusService } from '@/services/campus';
import {
  campusInviteService,
  resolvePointToPointRoleCode,
  type CampusInviteItem,
  type CampusInviteRoleCode,
  type CreateCampusInviteResult,
} from '@/services/campus-invite';
import { useRoleGlossaryStore } from '@/stores/role-glossary';
import { useAuth } from '@/utils/auth';
import { TTL, markFetched, shouldRefetch } from '@/utils/data-freshness';
import { buildCampusInvitePath, copyCampusInviteCode } from '@/utils/invite-staff-link';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const EXPIRE_MINUTES = 24 * 60;

function formatExpireAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const StaffInvitePage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const titles = useRoleGlossaryStore((s) => s.titles);
  const loadTitles = useRoleGlossaryStore((s) => s.load);

  const ROLE_OPTIONS: { code: CampusInviteRoleCode; label: string; desc: string }[] = useMemo(
    () => [
      {
        code: 'campus_principal',
        label: titles.manager,
        desc: '校区管理与邀请',
      },
      {
        code: 'campus_teacher',
        label: titles.teacher,
        desc: '排课、消课、本人薪资',
      },
      {
        code: 'campus_reception',
        label: '前台',
        desc: '预约签到、开卡续费',
      },
    ],
    [titles],
  );
  const router = useRouter();
  const targetTeacherId = decodeURIComponent(router.params?.teacherId || '').trim();
  const isPointToPoint = Boolean(targetTeacherId);

  const [campusId, setCampusId] = useState('');
  const [campusName, setCampusName] = useState('');
  const [targetTeacherName, setTargetTeacherName] = useState('');
  const [roleCode, setRoleCode] = useState<CampusInviteRoleCode>('campus_principal');
  const autoCreateStartedRef = React.useRef(false);
  /** TTL 守卫：校区 / 角色称谓 / 邀请名单慢变，5min 内重复进页不重拉 */
  const lastFetchAtRef = React.useRef<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [invites, setInvites] = useState<CampusInviteItem[]>([]);
  const [latest, setLatest] = useState<CreateCampusInviteResult | null>(null);

  const loadContext = useCallback(async () => {
    const [campuses, targetTeacher] = await Promise.all([
      campusService.getList(),
      isPointToPoint ? teacherService.getById(targetTeacherId) : Promise.resolve(null),
    ]);
    const currentId = profile?.currentContext?.campusId || campuses[0]?.id || '';
    const current = campuses.find((c) => c.id === currentId) || campuses[0];
    setCampusId(current?.id || '');
    setCampusName(current?.name || '未选择校区');
    if (isPointToPoint) {
      if (!targetTeacher) throw new Error('员工资料不存在');
      setTargetTeacherName(targetTeacher.name);
      setRoleCode(resolvePointToPointRoleCode(targetTeacher.identity));
    }
  }, [profile?.currentContext?.campusId, isPointToPoint, targetTeacherId]);

  const loadInvites = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await campusInviteService.list({ status: 'PENDING', pageSize: 20 });
      setInvites(
        isPointToPoint
          ? list.filter((item) => item.targetTeacherId === targetTeacherId)
          : list.filter((item) => !item.targetTeacherId),
      );
    } catch {
      setInvites([]);
    } finally {
      setLoadingList(false);
    }
  }, [isPointToPoint, targetTeacherId]);

  useDidShow(() => {
    if (!shouldRefetch(lastFetchAtRef.current, TTL.list)) {
      return;
    }
    void loadTitles();
    void loadContext().catch((error) => {
      Taro.showToast({
        title: error instanceof Error ? error.message : '员工资料加载失败',
        icon: 'none',
      });
    });
    void loadInvites();
    markFetched(lastFetchAtRef);
  });

  const handleCreate = useCallback(async () => {
    if (!campusId || creating) return;
    if (isPointToPoint && !targetTeacherId) {
      Taro.showToast({ title: '缺少员工 ID', icon: 'none' });
      return;
    }
    setCreating(true);
    try {
      const result = await campusInviteService.create({
        campusId,
        roleCode,
        ...(isPointToPoint ? { targetTeacherId } : {}),
        expireMinutes: EXPIRE_MINUTES,
      });
      setLatest(result);
      Taro.showToast({ title: '邀请码已生成', icon: 'success' });
      void loadInvites();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '生成失败',
        icon: 'none',
      });
    } finally {
      setCreating(false);
    }
  }, [campusId, creating, roleCode, loadInvites, isPointToPoint, targetTeacherId]);

  useEffect(() => {
    if (
      !isPointToPoint ||
      !campusId ||
      !targetTeacherName ||
      loadingList ||
      autoCreateStartedRef.current
    ) {
      return;
    }
    const existing = invites[0];
    if (existing) {
      setLatest(existing);
      return;
    }
    autoCreateStartedRef.current = true;
    void handleCreate();
  }, [campusId, handleCreate, invites, isPointToPoint, loadingList, targetTeacherName]);

  useShareAppMessage(() => ({
    title: `请${targetTeacherName || '员工'}绑定微信，加入${campusName || '门店'}`,
    path: latest?.inviteCode
      ? buildCampusInvitePath(latest.inviteCode).replace(/^\//, '')
      : 'pages/index/index',
  }));

  const handleCopyCode = useCallback(async (code: string) => {
    await copyCampusInviteCode(code);
  }, []);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await campusInviteService.cancel(id);
        Taro.showToast({ title: '已取消', icon: 'success' });
        void loadInvites();
        if (latest?.id === id) {
          setLatest(null);
        }
      } catch {
        Taro.showToast({ title: '取消失败', icon: 'none' });
      }
    },
    [latest?.id, loadInvites],
  );

  const displayCode = latest?.inviteCode;
  const pendingHint = useMemo(() => `待使用 ${invites.length} 条`, [invites.length]);

  return (
    <View className="min-h-screen bg-background flex flex-col">
      <ScrollView scrollY className="flex-1 px-[32rpx] pb-[48rpx]">
        <View className="pt-[24rpx] pb-[16rpx]">
          <Text className="text-[36rpx] font-bold text-foreground block">
            {isPointToPoint ? '邀请绑定微信' : '生成临时邀请码'}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground mt-[8rpx] block">
            {isPointToPoint ? '绑定到已创建的员工资料' : '接受后将新建员工身份'}
          </Text>
        </View>

        <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[16rpx]">校区</Text>
          <Text className="text-[26rpx] text-muted-foreground">{campusName || '加载中...'}</Text>
        </View>

        {isPointToPoint ? (
          <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
            <Text className="text-[28rpx] font-semibold text-foreground block mb-[12rpx]">
              绑定员工
            </Text>
            <Text className="text-[30rpx] text-foreground block">
              {targetTeacherName || '加载中...'}
            </Text>
          </View>
        ) : (
          <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
            <Text className="text-[28rpx] font-semibold text-foreground block mb-[20rpx]">
              邀请角色
            </Text>
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
                  <Text className="text-[30rpx] font-medium text-foreground block">
                    {opt.label}
                  </Text>
                  <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block">
                    {opt.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="bg-card rounded-[24rpx] p-[28rpx] border border-border mb-[24rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground block mb-[12rpx]">
            有效期
          </Text>
          <Text className="text-[26rpx] text-muted-foreground">24 小时，过期后需重新生成</Text>
        </View>

        {isPointToPoint && displayCode ? (
          <Button
            openType="share"
            className="h-[92rpx] rounded-[28rpx] bg-primary center press-scale m-0 p-0 leading-none after:border-none"
          >
            <Text className="text-[30rpx] font-semibold text-white">直接分享绑定卡片</Text>
          </Button>
        ) : (
          <ActionButton
            text={creating ? '生成中...' : isPointToPoint ? '生成绑定卡片' : '生成邀请码'}
            onClick={handleCreate}
            disabled={creating || !campusId || (isPointToPoint && !targetTeacherId)}
          />
        )}

        {displayCode ? (
          <View className="bg-primary/10 rounded-[24rpx] p-[28rpx] mt-[24rpx] border border-primary/20">
            <Text className="text-[26rpx] text-muted-foreground block mb-[8rpx]">邀请码</Text>
            <Text className="text-[40rpx] font-bold text-primary tracking-widest block mb-[16rpx]">
              {displayCode}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground block mb-[20rpx]">
              {latest?.roleLabel} · 有效至 {formatExpireAt(latest?.expireAt || '')}
            </Text>
            <View
              className="h-[80rpx] rounded-full bg-primary flex items-center justify-center press-scale"
              onClick={() => void handleCopyCode(displayCode)}
            >
              <Text className="text-[28rpx] text-white font-medium">复制邀请码</Text>
            </View>
          </View>
        ) : null}

        <View className="mt-[40rpx] mb-[16rpx] flex flex-row items-center justify-between">
          <Text className="text-[30rpx] font-semibold text-foreground">待使用邀请</Text>
          <Text className="text-[24rpx] text-muted-foreground">{pendingHint}</Text>
        </View>

        {loadingList ? (
          <Loading text="加载中..." />
        ) : invites.length === 0 ? (
          <Empty description="暂无待使用的邀请码" />
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
                  {item.campusName} · 至 {formatExpireAt(item.expireAt)}
                </Text>
                <View className="flex flex-row gap-[24rpx] mt-[16rpx]">
                  <Text
                    className="text-[26rpx] text-primary"
                    onClick={() => void handleCopyCode(item.inviteCode)}
                  >
                    复制邀请码
                  </Text>
                  <Text
                    className="text-[26rpx] text-destructive"
                    onClick={() => void handleCancel(item.id)}
                  >
                    取消
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
