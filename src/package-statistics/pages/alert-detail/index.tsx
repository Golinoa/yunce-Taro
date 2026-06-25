/**
 * 预警详情页
 * 展示某类预警下的所有详情项，支持单条已读
 */
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { AlertItem, AlertDetailItem, AlertLevel } from '@/components/statistics/AlertSheet';
import { statisticsService } from '@/services';
import { getAlertReadIds, markAlertRead, markAlertsRead } from '@/utils/alert-read';

/** 预警级别颜色配置 */
const LEVEL_STYLE: Record<AlertLevel, { bg: string; text: string; dot: string }> = {
  danger: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
  primary: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
};

const AlertDetail: React.FC = () => {
  const router = useRouter();
  const alertId = router.params.alertId || '';
  const [alert, setAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAlert() {
      setLoading(true);
      const data = await statisticsService.getAlertById(alertId);
      if (!mounted) {
        return;
      }
      setAlert(data);
      setLoading(false);
    }

    loadAlert().catch(() => {
      if (!mounted) {
        return;
      }
      setAlert(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [alertId]);

  // 已读状态
  const [readIds, setReadIds] = useState<Set<string>>(() => getAlertReadIds());

  // 过滤未读详情
  const unreadDetails = useMemo(
    () => alert?.details.filter((d) => !readIds.has(d.id)) || [],
    [alert, readIds],
  );

  const handleMarkRead = useCallback((detailId: string) => {
    markAlertRead(detailId);
    setReadIds(getAlertReadIds());
  }, []);

  const handleMarkAllRead = useCallback(() => {
    if (!alert) return;
    markAlertsRead(alert.details.map((d) => d.id));
    setReadIds(getAlertReadIds());
  }, [alert]);

  const handleItemClick = useCallback(
    (detail: AlertDetailItem) => {
      // 先标记已读
      handleMarkRead(detail.id);
      // 如果有关联学员ID，跳转学员详情
      if (detail.refId?.startsWith('stu-')) {
        Taro.navigateTo({
          url: `/package-student/pages/student-detail/index?id=${detail.refId}`,
        });
      }
    },
    [handleMarkRead],
  );

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gradient-subtle">
        <Text className="text-[28rpx] text-muted-foreground">预警数据加载中...</Text>
      </View>
    );
  }

  if (!alert) {
    return (
      <View className="flex items-center justify-center h-screen bg-gradient-subtle">
        <Text className="text-[28rpx] text-muted-foreground">预警数据不存在</Text>
      </View>
    );
  }

  const style = LEVEL_STYLE[alert.level];

  return (
    <View className="bg-gradient-subtle min-h-screen">
      {/* 头部信息 */}
      <View className="bg-white px-[32rpx] py-[32rpx] border-b-[2rpx] border-solid border-border-light">
        <View className="flex items-center gap-[16rpx] mb-[16rpx]">
          <View className={`w-[16rpx] h-[16rpx] rounded-full ${style.dot}`} />
          <Text className="text-[36rpx] font-bold text-foreground">{alert.title}</Text>
        </View>
        <Text className="text-[26rpx] text-foreground-secondary">{alert.desc}</Text>
        <View className="flex items-center justify-between mt-[24rpx]">
          <Text className="text-[24rpx] text-muted-foreground">
            {unreadDetails.length} 项未读 / 共 {alert.details.length} 项
          </Text>
          {unreadDetails.length > 0 && (
            <View
              className="px-[24rpx] py-[12rpx] rounded-full bg-primary/10"
              onClick={handleMarkAllRead}
            >
              <Text className="text-[24rpx] text-primary font-medium">全部已读</Text>
            </View>
          )}
        </View>
      </View>

      {/* 详情列表 */}
      <View className="px-[24rpx] py-[24rpx] flex flex-col gap-[16rpx]">
        {alert.details.map((detail) => {
          const isRead = readIds.has(detail.id);
          return (
            <View
              key={detail.id}
              className={`bg-white rounded-[20rpx] p-[24rpx] border-[2rpx] border-solid border-border-light flex items-center gap-[20rpx] ${isRead ? 'opacity-50' : 'press-scale'}`}
              onClick={() => !isRead && handleItemClick(detail)}
            >
              {/* 状态指示 */}
              <View
                className={`w-[12rpx] h-[12rpx] rounded-full flex-shrink-0 ${isRead ? 'bg-muted-foreground/30' : style.dot}`}
              />
              {/* 名称 + 信息 */}
              <View className="flex-1 min-w-0">
                <Text className="text-[28rpx] font-medium text-foreground block truncate">
                  {detail.name}
                </Text>
                <Text className="text-[24rpx] text-foreground-secondary block mt-[4rpx] truncate">
                  {detail.info}
                </Text>
              </View>
              {/* 操作 */}
              {isRead ? (
                <Text className="text-[24rpx] text-muted-foreground flex-shrink-0">已读</Text>
              ) : (
                <View
                  className={`px-[20rpx] py-[8rpx] rounded-full ${style.bg} flex-shrink-0`}
                  onClick={(e) => {
                    e.stopPropagation?.();
                    handleMarkRead(detail.id);
                  }}
                >
                  <Text className={`text-[24rpx] font-medium ${style.text}`}>已读</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default AlertDetail;

definePageConfig({
  navigationBarTitleText: '预警详情',
  navigationBarBackgroundColor: '#ffffff',
  navigationBarTextStyle: 'black',
});
