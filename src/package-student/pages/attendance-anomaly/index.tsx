/**
 * 考勤异常 — 超上 / 长期未上课 / 长期停课
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import StudentListCard from '@/components/student/StudentListCard';
import {
  opsAlertService,
  type AttendanceAnomalyItem,
  type AttendanceAnomalyKind,
} from '@/services/ops-alerts';
import { isStaffRole, useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

type TabKey = 'all' | AttendanceAnomalyKind;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'over_attend', label: '超上学员' },
  { key: 'long_absent', label: '长期未上课' },
  { key: 'long_paused', label: '长期停课' },
];

const KIND_BADGE: Record<AttendanceAnomalyKind, { bg: string; text: string }> = {
  over_attend: { bg: 'bg-destructive/10', text: 'text-destructive' },
  long_absent: { bg: 'bg-warning-bg', text: 'text-amber' },
  long_paused: { bg: 'bg-muted', text: 'text-muted-foreground' },
};

const AttendanceAnomalyPage: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.currentContext?.role;
  const campusId = profile?.currentContext?.campusId;

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<AttendanceAnomalyItem[]>([]);
  const [tab, setTab] = useState<TabKey>('all');

  const load = useCallback(async () => {
    if (!isStaffRole(role)) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await opsAlertService.listAttendanceAnomalies(campusId);
      setList(data);
    } catch (err) {
      logError('attendance-anomaly load', err);
      Taro.showToast({ title: '加载失败', icon: 'none' });
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [campusId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  useDidShow(() => {
    void load();
  });

  usePullDownRefresh(() => {
    void load().finally(() => Taro.stopPullDownRefresh());
  });

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = {
      all: list.length,
      over_attend: 0,
      long_absent: 0,
      long_paused: 0,
    };
    list.forEach((i) => {
      base[i.kind] += 1;
    });
    return base;
  }, [list]);

  const filtered = useMemo(
    () => (tab === 'all' ? list : list.filter((i) => i.kind === tab)),
    [list, tab],
  );

  const openStudent = useCallback((studentId: string) => {
    void Taro.navigateTo({
      url: `/package-student/pages/student-detail/index?id=${encodeURIComponent(studentId)}`,
    });
  }, []);

  if (!isStaffRole(role)) {
    return (
      <PageContainer className="bg-muted">
        <View className="py-[160rpx]">
          <Empty icon="mdi-lock-outline" description="仅机构人员可查看考勤异常" />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-muted">
      <View className="sticky top-0 z-10 border-b border-border bg-card px-[24rpx] py-[16rpx]">
        <ScrollView scrollX enhanced showScrollbar={false} className="whitespace-nowrap">
          <View className="inline-flex flex-row gap-[12rpx] pr-[24rpx]">
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = counts[t.key];
              return (
                <View
                  key={t.key}
                  className={cn(
                    'rounded-full px-[24rpx] py-[10rpx]',
                    active ? 'bg-primary' : 'bg-muted',
                  )}
                  onClick={() => setTab(t.key)}
                >
                  <Text
                    className={cn(
                      'text-[24rpx]',
                      active ? 'font-semibold text-white' : 'text-foreground-secondary',
                    )}
                  >
                    {t.label}
                    {count > 0 ? ` ${count}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex items-center justify-center py-[200rpx]">
          <Loading text="加载中..." />
        </View>
      ) : filtered.length === 0 ? (
        <View className="py-[160rpx]">
          <Empty icon="mdi-inbox" description="暂无考勤异常学员" />
        </View>
      ) : (
        <ScrollView scrollY className="h-screen" enhanced showScrollbar={false}>
          <View className="flex flex-col gap-[16rpx] px-[24rpx] py-[16rpx] pb-safe-bar">
            {filtered.map((item) => {
              const badgeStyle = KIND_BADGE[item.kind];
              return (
                <StudentListCard
                  key={item.id}
                  name={item.studentName}
                  nickname={item.nickname}
                  avatarUrl={item.avatarUrl}
                  subtitle={item.subtitle}
                  onClick={() => openStudent(item.studentId)}
                  badge={
                    <View className={cn('shrink-0 rounded-full px-[14rpx] py-[4rpx]', badgeStyle.bg)}>
                      <Text className={cn('text-[20rpx] font-bold', badgeStyle.text)}>
                        {item.kindLabel}
                      </Text>
                    </View>
                  }
                />
              );
            })}
          </View>
        </ScrollView>
      )}
    </PageContainer>
  );
};

export default withRouteGuard(AttendanceAnomalyPage);
