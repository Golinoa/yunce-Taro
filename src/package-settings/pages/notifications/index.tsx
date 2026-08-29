import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import Switch from '@/components/Switch';
import Icon from '@/components/Icon';
import { calendarSyncService } from '@/services/calendar-sync';
import { subscribeMessageService } from '@/services/subscribe-message';
import { useAuth } from '@/utils/auth';
import {
  canUseCalendarSync,
  getCalendarSyncSettings,
} from '@/utils/calendar-sync-settings';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';
import { logError } from '@/utils/logger';

interface NotifyItem {
  id: string;
  label: string;
  sub?: string;
  enabled: boolean;
}

interface NotifyGroup {
  title: string;
  items: NotifyItem[];
}

/**
 * 消息通知页面
 * - 顶部总开关（默认开）
 * - 同步日历（默认关）
 * - 补充发送次数
 * - 分组业务提醒
 */
const NotificationsPage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentRole = profile?.currentContext?.role;
  const navigatingRef = useRef(false);
  const [masterEnabled, setMasterEnabled] = useState(() =>
    subscribeMessageService.getMasterNotifyEnabled(),
  );
  const [masterBusy, setMasterBusy] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const showCalendarSwitch = canUseCalendarSync(currentRole);

  useEffect(() => {
    if (!currentUserId || !showCalendarSwitch) {
      setCalendarEnabled(false);
      return;
    }
    setCalendarEnabled(getCalendarSyncSettings(currentUserId).enabled);
  }, [currentUserId, showCalendarSwitch]);

  const [groups, setGroups] = useState<NotifyGroup[]>([
    {
      title: '通知学员',
      items: [
        {
          id: 'student-class-one-day',
          label: '上课前一天提醒',
          sub: '上课前一天20:00点推送',
          enabled: true,
        },
        {
          id: 'student-class-same-day',
          label: '上课当天提醒',
          sub: '上课前30分钟推送',
          enabled: true,
        },
        { id: 'student-checkin', label: '学员点名通知', sub: '显示剩余课时', enabled: true },
        { id: 'student-comment', label: '课堂点评提醒', sub: '课后点评后通知家长', enabled: true },
        {
          id: 'student-renewal',
          label: '学员课时不足续费提醒',
          sub: '每天10点提醒一次（每7天提醒1次）',
          enabled: true,
        },
        {
          id: 'student-birthday',
          label: '学员生日提醒',
          sub: '生日快乐，天天开心！',
          enabled: true,
        },
        {
          id: 'student-schedule-change',
          label: '调课通知',
          sub: '课程调整、取消时通知',
          enabled: true,
        },
      ],
    },
    {
      title: '通知老师',
      items: [
        { id: 'teacher-class-remind', label: '上课提醒', sub: '开课前推送当日课程', enabled: true },
        {
          id: 'teacher-leave-audit',
          label: '请假审核结果通知',
          sub: '请假审批状态变更时通知',
          enabled: true,
        },
        { id: 'teacher-salary', label: '薪资提醒', sub: '发薪日前推送课时报表', enabled: false },
        { id: 'teacher-weekly', label: '周报推送', sub: '每周一推送上周数据汇总', enabled: false },
      ],
    },
  ]);

  const handleToggle = useCallback(
    (groupIndex: number, itemIndex: number) => {
      if (!masterEnabled) {
        Taro.showToast({ title: '请先打开顶部消息通知开关', icon: 'none' });
        return;
      }
      setGroups((prev) => {
        const next = prev.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }));
        const item = next[groupIndex]?.items[itemIndex];
        if (item) {
          item.enabled = !item.enabled;
        }
        return next;
      });
    },
    [masterEnabled],
  );

  const handleMasterChange = useCallback(
    async (next: boolean) => {
      if (masterBusy) return;
      setMasterBusy(true);
      setMasterEnabled(next);
      try {
        if (!next) {
          await subscribeMessageService.setMasterNotifyEnabled(false, { requestAuth: false });
          Taro.showToast({ title: '已关闭微信提醒', icon: 'none' });
          return;
        }
        await subscribeMessageService.setMasterNotifyEnabled(true, { requestAuth: false });
        await subscribeMessageService.requestNativeNotifyAuth({ scene: 'settings_toggle' });
        Taro.showToast({ title: '已开启消息通知', icon: 'none' });
      } catch (err) {
        logError('notifications.masterToggle', err);
        setMasterEnabled(!next);
        Taro.showToast({ title: '设置失败，请重试', icon: 'none' });
      } finally {
        setMasterBusy(false);
      }
    },
    [masterBusy],
  );

  const handleCalendarChange = useCallback(
    async (enabled: boolean) => {
      if (!currentUserId || calendarBusy) return;
      setCalendarBusy(true);
      setCalendarEnabled(enabled);
      try {
        if (!enabled) {
          calendarSyncService.disable(currentUserId);
          Taro.showToast({ title: '已关闭日历同步', icon: 'none' });
          return;
        }
        await calendarSyncService.enableAndSync({
          userId: currentUserId,
          teacherId: currentUserId,
          role: currentRole ?? undefined,
          campusId: profile?.currentContext?.campusId,
          directAuth: true,
        });
        Taro.showToast({ title: '已开启日历同步', icon: 'none' });
      } catch (err) {
        logError('notifications.calendarToggle', err);
        setCalendarEnabled(getCalendarSyncSettings(currentUserId).enabled);
        Taro.showToast({ title: '同步失败，请重试', icon: 'none' });
      } finally {
        setCalendarBusy(false);
      }
    },
    [calendarBusy, currentRole, currentUserId, profile?.currentContext?.campusId],
  );

  const handleOpenMessageAuth = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    void Taro.navigateTo({ url: subscribeMessageService.messageAuthPageUrl })
      .catch((err) => {
        logError('notifications.navigateMessageAuth', err);
        Taro.showToast({ title: '页面打开失败', icon: 'none' });
      })
      .finally(() => {
        setTimeout(() => {
          navigatingRef.current = false;
        }, 600);
      });
  }, []);

  return (
    <PageContainer>
      <View className="min-h-screen bg-background">
        <View className="flex flex-col gap-[24rpx] px-[32rpx] pb-[60rpx] pt-[24rpx]">
          <View className="flex flex-row items-center justify-between rounded-[28rpx] bg-card px-[32rpx] py-[28rpx]">
            <View className="mr-[24rpx] min-w-0 flex-1">
              <Text className="block text-[30rpx] font-medium text-foreground">消息通知</Text>
              <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                打开即同意小程序使用微信订阅消息向您推送提醒；关闭后不再发送微信服务通知
              </Text>
            </View>
            <Switch checked={masterEnabled} disabled={masterBusy} onChange={handleMasterChange} />
          </View>

          {showCalendarSwitch ? (
            <View className="flex flex-row items-center justify-between rounded-[28rpx] bg-card px-[32rpx] py-[28rpx]">
              <View className="mr-[24rpx] min-w-0 flex-1">
                <Text className="block text-[30rpx] font-medium text-foreground">同步日历</Text>
                <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                  默认关闭。开启后将未来一周课表写入手机日历，上课前可在系统日历收到提醒（比微信消息更稳）
                </Text>
              </View>
              <Switch
                checked={calendarEnabled}
                disabled={calendarBusy}
                onChange={handleCalendarChange}
              />
            </View>
          ) : null}

          <View
            className="flex flex-row items-center justify-between rounded-[28rpx] bg-card px-[32rpx] py-[28rpx] active:opacity-90"
            onClick={handleOpenMessageAuth}
          >
            <View className="mr-[16rpx] min-w-0 flex-1">
              <Text className="block text-[30rpx] font-medium text-foreground">补充发送次数</Text>
              <Text className="mt-[8rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                微信每次授权可攒 1 次服务通知；次数用完后重要事项仍会在小程序内提醒
              </Text>
            </View>
            <Icon name="mdi-chevron-right" size={20} color="mutedForeground" />
          </View>

          <Text className="block px-[8rpx] text-[24rpx] leading-relaxed text-muted-foreground">
            以下开关控制各类业务提醒偏好；关闭后不影响首页「待办事项」内的页面提醒。总开关关闭时微信侧不再推送。
          </Text>

          {groups.map((group, groupIndex) => (
            <View
              key={group.title}
              className={`overflow-hidden rounded-[28rpx] bg-card ${
                masterEnabled ? '' : 'opacity-55'
              }`}
            >
              <View className="flex flex-row items-center px-[32rpx] pb-[12rpx] pt-[28rpx]">
                <View className="mr-[12rpx] h-[24rpx] w-[8rpx] rounded-[4rpx] bg-primary" />
                <Text className="text-[26rpx] font-semibold text-muted-foreground">
                  {group.title}
                </Text>
              </View>

              <View className="flex flex-col">
                {group.items.map((item, itemIndex) => (
                  <View
                    key={item.id}
                    className={`flex flex-row items-center justify-between px-[32rpx] py-[24rpx] ${
                      itemIndex < group.items.length - 1 ? 'border-b-[1rpx] border-border' : ''
                    }`}
                  >
                    <View className="mr-[24rpx] min-w-0 flex-1">
                      <Text className="block text-[30rpx] font-medium text-foreground">
                        {item.label}
                      </Text>
                      {item.sub ? (
                        <Text className="mt-[6rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
                          {item.sub}
                        </Text>
                      ) : null}
                    </View>
                    <Switch
                      checked={item.enabled && masterEnabled}
                      disabled={!masterEnabled}
                      onChange={() => handleToggle(groupIndex, itemIndex)}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(NotificationsPage);
