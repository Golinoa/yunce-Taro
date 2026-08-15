import { View, Text } from '@tarojs/components';
import React, { useCallback, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import Switch from '@/components/Switch';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/**
 * 通知设置项
 */
interface NotifyItem {
  id: string;
  label: string;
  sub?: string;
  enabled: boolean;
}

/**
 * 通知分组
 */
interface NotifyGroup {
  title: string;
  items: NotifyItem[];
}

/**
 * 消息通知页面
 *
 * 按系统实际提供的通知能力分组展示，每项使用「左侧标题 + 右侧开关」布局。
 * 未接入业务的功能不展示，避免界面冗余。
 */
const NotificationsPage: React.FC = () => {
  useCardNavigationBar();
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

  const handleToggle = useCallback((groupIndex: number, itemIndex: number) => {
    setGroups((prev) => {
      const next = prev.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) }));
      const item = next[groupIndex]?.items[itemIndex];
      if (item) {
        item.enabled = !item.enabled;
      }
      return next;
    });
  }, []);

  return (
    <PageContainer>
      <View className="min-h-screen bg-background">
        {/* 分组列表 */}
        <View className="px-[32rpx] pt-[24rpx] pb-[60rpx] flex flex-col gap-[24rpx]">
          {groups.map((group, groupIndex) => (
            <View key={group.title} className="bg-card rounded-[28rpx] overflow-hidden">
              {/* 分组标题 */}
              <View className="flex flex-row items-center px-[32rpx] pt-[28rpx] pb-[12rpx]">
                <View className="w-[8rpx] h-[24rpx] rounded-[4rpx] bg-primary mr-[12rpx]" />
                <Text className="text-[26rpx] font-semibold text-muted-foreground">
                  {group.title}
                </Text>
              </View>

              {/* 通知项 */}
              <View className="flex flex-col">
                {group.items.map((item, itemIndex) => (
                  <View
                    key={item.id}
                    className={`flex flex-row items-center justify-between px-[32rpx] py-[24rpx] ${
                      itemIndex < group.items.length - 1 ? 'border-b-[1rpx] border-border' : ''
                    }`}
                  >
                    <View className="flex-1 mr-[24rpx]">
                      <Text className="text-[30rpx] font-medium text-foreground">{item.label}</Text>
                      {item.sub && (
                        <Text className="text-[24rpx] text-muted-foreground mt-[6rpx]">
                          {item.sub}
                        </Text>
                      )}
                    </View>
                    <Switch
                      checked={item.enabled}
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
