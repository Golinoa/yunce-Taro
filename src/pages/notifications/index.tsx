import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Empty from '@/components/Empty';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { notificationService } from '@/services';
import type { Notification, NotificationType } from '@/types/notification';
import { useAuth } from '@/utils/auth';
import { logError } from '@/utils/logger';
import { withRouteGuard } from '@/utils/route-guard';

/** 通知类型配置 */
const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  lesson_complete: { icon: '📖', color: 'bg-primary-15' },
  leave_request: { icon: '📋', color: 'bg-amber-500/15' },
  leave_response: { icon: '✉️', color: 'bg-purple-500/15' },
  schedule_change: { icon: '📅', color: 'bg-blue-500/15' },
  general: { icon: '🔔', color: 'bg-muted' },
};

/** 格式化时间 */
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
}

function getNotificationFallbackUrl(
  notification: Notification,
  currentRole: string | null,
): { url: string; mode: 'navigateTo' | 'switchTab' } | null {
  switch (notification.type) {
    case 'lesson_complete':
      return {
        url: notification.related_id
          ? `/package-course/pages/lesson-detail/index?id=${notification.related_id}`
          : '/package-course/pages/records/index',
        mode: 'navigateTo',
      };
    case 'leave_request':
    case 'leave_response':
      return {
        url: notification.related_id
          ? `/package-course/pages/leave-request/index?userRole=${currentRole || 'teacher'}&requestId=${notification.related_id}`
          : `/package-course/pages/leave-request/index?userRole=${currentRole || 'teacher'}`,
        mode: 'navigateTo',
      };
    case 'schedule_change':
      return {
        url: '/pages/schedule/index',
        mode: 'switchTab',
      };
    default:
      return null;
  }
}

const NotificationsPage: React.FC = () => {
  const { profile, currentRole } = useAuth();
  const userId = profile?.id || '';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      else setRefreshing(true);
      setErrorMsg('');
      try {
        const list = await notificationService.getByReceiver(userId);
        setNotifications(list);
      } catch (err) {
        logError('load notifications', err);
        setErrorMsg('消息加载失败，请稍后重试');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 每次显示页面时刷新
  Taro.useDidShow(() => {
    loadNotifications(true);
  });

  // 未读数
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  // 标记已读
  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch (err) {
      logError('mark notification read', err);
      Taro.showToast({ title: '标记已读失败', icon: 'none' });
    }
  }, []);

  // 全部已读
  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      Taro.showToast({ title: '已全部标记为已读', icon: 'success' });
    } catch (err) {
      logError('mark all notifications read', err);
      Taro.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  }, [userId]);

  // 点击通知
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.is_read) {
        await handleMarkRead(notification.id);
      }

      const target = getNotificationFallbackUrl(notification, currentRole);
      if (!target) {
        return;
      }

      if (target.mode === 'switchTab') {
        Taro.switchTab({ url: target.url });
        return;
      }

      Taro.navigateTo({ url: target.url });
    },
    [currentRole, handleMarkRead],
  );

  if (loading) {
    return (
      <PageContainer>
        <View className="flex items-center justify-center pt-50">
          <Loading text="加载中..." />
        </View>
      </PageContainer>
    );
  }

  // 错误态：加载失败且无缓存数据时展示重试入口
  if (errorMsg && notifications.length === 0) {
    return (
      <PageContainer>
        <View className="min-h-screen bg-gradient-subtle flex flex-col items-center justify-center gap-[32rpx] px-8">
          <Empty icon="mdi-alert-circle" description={errorMsg} />
          <View
            className="bg-gradient-primary px-[48rpx] py-[16rpx] rounded-[16rpx] active:opacity-90"
            onClick={() => loadNotifications()}
          >
            <Text className="text-[28rpx] text-white font-medium">重新加载</Text>
          </View>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <View className="min-h-screen bg-gradient-subtle">
        {/* 顶部标题栏 */}
        <View className="flex items-center px-8 pt-8 pb-4 gap-3">
          <Text className="text-2xl font-bold text-foreground">消息通知</Text>
          {unreadCount > 0 && (
            <View className="min-w-9 h-9 rounded-full bg-destructive flex items-center justify-center px-2">
              <Text className="text-white text-xs font-bold">{unreadCount}</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <View
              className="ml-auto py-2 px-5 rounded-2xl bg-primary-10"
              onClick={handleMarkAllRead}
            >
              <Text className="text-sm text-primary font-medium">全部已读</Text>
            </View>
          )}
          {refreshing && (
            <View className="ml-auto">
              <Text className="text-sm text-muted-foreground">刷新中...</Text>
            </View>
          )}
        </View>

        {/* 顶部错误提示条（有缓存数据时仍展示错误） */}
        {errorMsg && notifications.length > 0 && (
          <View className="mx-8 mb-3 bg-destructive-10 border-2 border-destructive-20 rounded-2xl p-4 flex items-center justify-between">
            <Text className="flex-1 text-base text-destructive">{errorMsg}</Text>
            <View
              className="px-4 py-2 rounded-full bg-destructive"
              onClick={() => loadNotifications(true)}
            >
              <Text className="text-white text-sm font-medium">重试</Text>
            </View>
          </View>
        )}

        {/* 通知列表 */}
        {notifications.length === 0 ? (
          <Empty icon="mdi-bell-off" description="暂无消息" />
        ) : (
          <View className="px-8 flex flex-col gap-3">
            {notifications.map((notification) => {
              const typeConfig = TYPE_CONFIG[notification.type] || TYPE_CONFIG.general;
              return (
                <View
                  key={notification.id}
                  className={`relative flex items-start gap-5 p-6 rounded-3xl bg-white shadow-soft transition overflow-hidden ${!notification.is_read ? 'bg-primary-5' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* 未读左侧绿色竖线 */}
                  {!notification.is_read && (
                    <View className="absolute left-0 top-3 bottom-3 w-1_d5 rounded-full bg-primary" />
                  )}

                  {/* 类型图标 */}
                  <View
                    className={`w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${typeConfig.color}`}
                  >
                    <Text className="text-2xl">{typeConfig.icon}</Text>
                  </View>

                  {/* 内容区 */}
                  <View className="flex-1 min-w-0">
                    <View className="flex items-center justify-between gap-2">
                      <Text className="text-lg font-medium text-foreground flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                        {notification.title}
                      </Text>
                      {!notification.is_read && (
                        <View className="w-4 h-4 rounded-full bg-destructive flex-shrink-0" />
                      )}
                    </View>
                    {notification.content && (
                      <Text className="text-base text-muted-foreground block mt-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        {notification.content}
                      </Text>
                    )}
                    <View className="flex items-center justify-between mt-2">
                      <Text className="text-sm text-muted-foreground">
                        {formatTime(notification.created_at)}
                      </Text>
                      {notification.sender && (
                        <Text className="text-sm text-muted-foreground">
                          来自：{notification.sender.name}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(NotificationsPage);
