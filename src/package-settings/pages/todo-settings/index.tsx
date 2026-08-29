/**
 * 待办提醒设置页
 *
 * 控制首页「待办事项」Tab 展示哪些提醒；样式对齐消息通知 / 系统设置（分组 + Switch）。
 * 入口：我的 → 系统设置 → 待办提醒
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import React, { useCallback, useMemo, useState } from 'react';
import PageContainer from '@/components/PageContainer';
import Switch from '@/components/Switch';
import type { DataModule } from '@/types/permission';
import { canAccessModule } from '@/types/permission';
import {
  DEFAULT_TODO_SETTINGS,
  type TodoReminderKey,
  type TodoSettings,
  getTodoSettings,
  setTodoSettingKey,
} from '@/utils/todo-settings';
import { useAuth } from '@/utils/auth';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

interface SettingRow {
  key: TodoReminderKey | 'showTabBadge';
  label: string;
  sub?: string;
}

interface SettingGroup {
  title: string;
  /** 需具备的数据模块权限，未设置则全员可见 */
  requiredModule?: DataModule;
  items: SettingRow[];
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    title: '教学考勤',
    requiredModule: 'classes',
    items: [
      {
        key: 'attendanceCheckin',
        label: '未点名补录提醒',
        sub: '昨日下课未点名的课节，次日进入待办',
      },
      {
        key: 'meetingRemind',
        label: '教学复盘提醒',
        sub: '周度教学或经营复盘类待办',
      },
    ],
  },
  {
    title: '学员运营',
    requiredModule: 'students',
    items: [
      {
        key: 'studentRecharge',
        label: '课时续费提醒',
        sub: '学员剩余课时低于阈值时提醒跟进',
      },
      {
        key: 'leavePending',
        label: '请假待审批',
        sub: '家长提交请假后提醒审批',
      },
    ],
  },
  {
    title: '财务课包',
    requiredModule: 'finance',
    items: [
      {
        key: 'financePackage',
        label: '课包即将到期',
        sub: '临近到期的课包进入待办提醒续费',
      },
    ],
  },
  {
    title: '招生线索',
    requiredModule: 'leads',
    items: [
      {
        key: 'leadFollowUp',
        label: '线索待跟进',
        sub: '新建或长期未跟进的线索提醒',
      },
    ],
  },
  {
    title: '人事薪资',
    requiredModule: 'salary',
    items: [
      {
        key: 'salaryRemind',
        label: '薪资与发薪提醒',
        sub: '发薪日前、工资待确认等待办',
      },
    ],
  },
  {
    title: '展示',
    items: [
      {
        key: 'showTabBadge',
        label: '首页 Tab 显示数量',
        sub: '关闭后待办 Tab 不显示红色数字角标',
      },
    ],
  },
];

const TodoSettingsPage: React.FC = () => {
  useCardNavigationBar();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<TodoSettings>(DEFAULT_TODO_SETTINGS);

  useDidShow(() => {
    setSettings(getTodoSettings());
  });

  const visibleGroups = useMemo(
    () =>
      SETTING_GROUPS.filter(
        (group) => !group.requiredModule || canAccessModule(profile, group.requiredModule),
      ),
    [profile],
  );

  const handleToggle = useCallback((key: keyof TodoSettings) => {
    const nextEnabled = !getTodoSettings()[key];
    const next = setTodoSettingKey(key, nextEnabled);
    setSettings(next);
    Taro.showToast({
      title: nextEnabled ? '已开启' : '已关闭',
      icon: 'none',
      duration: 1200,
    });
  }, []);

  return (
    <PageContainer safeBottom>
      <View className="min-h-screen bg-background">
        <View className="px-[32rpx] pt-[24rpx] pb-[60rpx] flex flex-col gap-[24rpx]">
          <Text className="text-[24rpx] text-muted-foreground leading-relaxed px-[8rpx]">
            以下开关控制首页「待办事项」是否展示对应提醒；关闭后不影响消息通知页的推送设置。
          </Text>

          {visibleGroups.map((group) => (
            <View key={group.title} className="bg-card rounded-[28rpx] overflow-hidden shadow-soft">
              <View className="flex flex-row items-center px-[32rpx] pt-[28rpx] pb-[12rpx]">
                <View className="w-[8rpx] h-[24rpx] rounded-[4rpx] bg-primary mr-[12rpx]" />
                <Text className="text-[26rpx] font-semibold text-muted-foreground">
                  {group.title}
                </Text>
              </View>

              <View className="flex flex-col">
                {group.items.map((item, index) => (
                  <View
                    key={item.key}
                    className={`flex flex-row items-center justify-between px-[32rpx] py-[24rpx] ${
                      index < group.items.length - 1 ? 'border-b-[1rpx] border-border' : ''
                    }`}
                  >
                    <View className="flex-1 mr-[24rpx]">
                      <Text className="text-[30rpx] font-medium text-foreground">{item.label}</Text>
                      {item.sub && (
                        <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] block leading-relaxed">
                          {item.sub}
                        </Text>
                      )}
                    </View>
                    <Switch
                      checked={settings[item.key]}
                      onChange={() => handleToggle(item.key)}
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

export default withRouteGuard(TodoSettingsPage);
