/**
 * 操作日志页 package-settings/pages/audit-log/index
 *
 * 使用场景：系统设置 → 操作日志
 * 可见范围（用户口径 2026-08-22）：
 * - 每个人只能看到【自己】的操作日志
 * - 管理者（管理员/校长）可查看【下属员工】的操作日志（支持切换"仅我的/全部员工"）
 * 功能说明：
 * - 展示审计日志（追加式、不可修改），保留最近 90 天
 * - 支持按时间范围 / 动作类型 / 关键字筛选，分页加载
 * 设计语言参考 package-settings/pages/permission-settings（Card + chips）。
 */
import { Input, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { auditLogService, isAuditLogManager } from '@/services/audit-log';
import { AUDIT_ACTION_LABELS, type AuditAction, type AuditLogEntry } from '@/types/audit-log';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const PAGE_SIZE = 20;

/** 时间范围快捷筛选（前端仅展示最近 90 天，后端长期保留） */
type TimeRange = 'all' | '7d' | '30d';

/** 可见范围：全部员工（仅管理角色）/ 仅我的 */
type ViewScope = 'all' | 'mine';

const TIME_TABS: { key: TimeRange; label: string }[] = [
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近30天' },
  { key: 'all', label: '近90天' },
];

const ROLE_LABELS: Record<string, string> = {
  admin: '管理员',
  principal: '校长',
  teacher: '老师',
  assistant: '前台',
  parent: '家长',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

function rangeDates(range: TimeRange): { startDate?: string; endDate?: string } {
  if (range === 'all') return {};
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (range === '7d' ? 6 : 29));
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    startDate: `${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`,
    endDate: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
  };
}

const AuditLog: React.FC = () => {
  useCardNavigationBar();
  const { profile, currentRole } = useAuth();
  const isManager = isAuditLogManager(currentRole);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [viewScope, setViewScope] = useState<ViewScope>(isManager ? 'all' : 'mine');
  const [keyword, setKeyword] = useState('');
  const searchKeywordRef = useRef('');

  const ACTIONS = useMemo(() => Object.keys(AUDIT_ACTION_LABELS) as AuditAction[], []);

  const fetchLogs = useCallback(
    async (nextPage: number, reset: boolean) => {
      if (!profile?.id) return;
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const range = rangeDates(timeRange);
        const res = await auditLogService.query(
          { id: profile.id, isManager },
          {
            action: action || undefined,
            keyword: searchKeywordRef.current || undefined,
            // 管理角色："仅我的"时按本人过滤；非管理角色由服务层强制只看自己
            operatorId: isManager && viewScope === 'mine' ? profile.id : undefined,
            startDate: range.startDate,
            endDate: range.endDate,
            page: nextPage,
            pageSize: PAGE_SIZE,
          },
        );
        setLogs((prev) => (reset ? res.list : [...prev, ...res.list]));
        setTotal(res.total);
        setPage(nextPage);
      } catch (err) {
        Taro.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [timeRange, action, viewScope, isManager, profile?.id],
  );

  // 首次进入 / 筛选变化 → 重新加载第一页
  useEffect(() => {
    fetchLogs(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, action, viewScope, isManager]);

  const handleSearch = useCallback(() => {
    searchKeywordRef.current = keyword.trim();
    fetchLogs(1, true);
  }, [keyword, fetchLogs]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || loading || logs.length >= total) return;
    fetchLogs(page + 1, false);
  }, [fetchLogs, loadingMore, loading, logs.length, total, page]);

  // 未登录回首页（页面本身登录即可进入；可见范围由服务层控制）
  if (!profile?.id) {
    Taro.switchTab({ url: '/pages/home/index' });
    return null;
  }

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx]">
        <Text className="text-[32rpx] font-semibold text-foreground">操作日志</Text>
        <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
          {isManager
            ? '可查看全部员工的操作日志，展示最近 90 天（历史长期保留）'
            : '仅显示我的操作日志，展示最近 90 天（历史长期保留）'}
        </Text>
      </View>

      {/* 筛选区 */}
      <View className="px-[32rpx] mt-[24rpx]">
        {/* 可见范围（仅管理角色可切换；普通角色固定"我的"） */}
        {isManager && (
          <View className="flex flex-row gap-[16rpx] mb-[20rpx]">
            {(
              [
                { key: 'all', label: '全部员工' },
                { key: 'mine', label: '仅我的' },
              ] as { key: ViewScope; label: string }[]
            ).map((s) => (
              <View
                key={s.key}
                className={cn(
                  'px-[24rpx] py-[10rpx] rounded-full active:opacity-70',
                  viewScope === s.key ? 'bg-primary-bg' : 'bg-muted',
                )}
                onClick={() => setViewScope(s.key)}
              >
                <Text
                  className={cn(
                    'text-[24rpx]',
                    viewScope === s.key ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 时间范围 tab */}
        <View className="flex flex-row gap-[16rpx]">
          {TIME_TABS.map((t) => (
            <View
              key={t.key}
              className={cn(
                'px-[24rpx] py-[10rpx] rounded-full active:opacity-70',
                timeRange === t.key ? 'bg-primary-bg' : 'bg-muted',
              )}
              onClick={() => setTimeRange(t.key)}
            >
              <Text
                className={cn(
                  'text-[24rpx]',
                  timeRange === t.key ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 动作类型 chips（横向滚动） */}
        <ScrollView scrollX className="mt-[20rpx]" showScrollbar={false}>
          <View className="flex flex-row gap-[12rpx] pr-[32rpx]">
            <View
              className={cn(
                'px-[20rpx] py-[8rpx] rounded-full shrink-0 active:opacity-70',
                action === '' ? 'bg-primary-bg' : 'bg-muted',
              )}
              onClick={() => setAction('')}
            >
              <Text
                className={cn(
                  'text-[22rpx]',
                  action === '' ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                全部动作
              </Text>
            </View>
            {ACTIONS.map((a) => (
              <View
                key={a}
                className={cn(
                  'px-[20rpx] py-[8rpx] rounded-full shrink-0 active:opacity-70',
                  action === a ? 'bg-primary-bg' : 'bg-muted',
                )}
                onClick={() => setAction(a)}
              >
                <Text
                  className={cn(
                    'text-[22rpx]',
                    action === a ? 'text-primary font-medium' : 'text-muted-foreground',
                  )}
                >
                  {AUDIT_ACTION_LABELS[a]}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* 关键字搜索 */}
        <View className="mt-[20rpx] flex flex-row items-center gap-[16rpx] bg-muted rounded-[16rpx] px-[20rpx] py-[12rpx]">
          <Input
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            placeholder="搜索操作人 / 日志内容"
            placeholderClass="text-muted-foreground"
            className="flex-1 text-[26rpx] text-foreground"
            confirmType="search"
            onConfirm={handleSearch}
          />
          <View
            className="px-[24rpx] py-[8rpx] rounded-full bg-primary active:opacity-70 press-scale"
            onClick={handleSearch}
          >
            <Text className="text-[24rpx] text-white">搜索</Text>
          </View>
        </View>
      </View>

      {/* 日志列表 */}
      <View className="px-[32rpx] mt-[24rpx] pb-[200rpx]">
        {loading ? (
          <View className="mt-[80rpx]">
            <Loading text="加载日志中..." />
          </View>
        ) : logs.length === 0 ? (
          <View className="mt-[100rpx] flex flex-col items-center justify-center gap-[16rpx]">
            <Text className="text-[28rpx] text-muted-foreground">暂无操作日志</Text>
            <Text className="text-[24rpx] text-muted-foreground/70">
              执行编辑课时、开卡、薪资发放等关键操作后会记录在此
            </Text>
          </View>
        ) : (
          <>
            {logs.map((log) => (
              <View
                key={log.id}
                className="bg-card rounded-[20rpx] px-[24rpx] py-[24rpx] mb-[16rpx]"
              >
                <View className="flex flex-row items-center justify-between">
                  <View className="px-[14rpx] py-[4rpx] rounded-full bg-primary-bg">
                    <Text className="text-[22rpx] text-primary">{log.actionLabel}</Text>
                  </View>
                  <Text className="text-[22rpx] text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </Text>
                </View>
                <Text className="mt-[12rpx] block text-[26rpx] text-foreground leading-relaxed">
                  {log.detail}
                </Text>
                <Text className="mt-[8rpx] block text-[22rpx] text-muted-foreground">
                  {log.operatorName} · {ROLE_LABELS[log.operatorRole] || log.operatorRole}
                </Text>
              </View>
            ))}

            {logs.length < total ? (
              <View
                className="mt-[16rpx] rounded-[18rpx] py-[20rpx] flex items-center justify-center bg-muted active:opacity-70 press-scale"
                onClick={handleLoadMore}
              >
                <Text className="text-[26rpx] text-muted-foreground">
                  {loadingMore ? '加载中...' : `加载更多（${logs.length}/${total}）`}
                </Text>
              </View>
            ) : (
              <View className="mt-[24rpx] flex items-center justify-center">
                <Text className="text-[22rpx] text-muted-foreground">
                  共 {total} 条记录 · 展示最近 90 天（历史日志长期保留）
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </PageContainer>
  );
};

export default AuditLog;
