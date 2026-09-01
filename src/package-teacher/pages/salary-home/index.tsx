/**
 * 薪资管理首页
 *
 * 三大入口：
 * - 薪资发放：月度统计、员工薪资列表、一键核对
 * - 薪资设置：每位员工的薪资规则配置
 * - 薪资模板：可复用的薪资模板，支持套用到教练
 *
 * 首次进入显示新手引导（第 6 步 / 共 6 步）
 */
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import Icon from '@/components/Icon';
import PageIntroSheet from '@/components/PageIntroSheet';
import { PAGE_INTRO_STORAGE_KEYS } from '@/services/onboarding';
import { useTeacherStore } from '@/stores/teacher';
import { useThemeStore } from '@/stores/theme';
import { useCardNavigationBar } from '@/utils/navigation-bar';

const INTRO_STORAGE_KEY = PAGE_INTRO_STORAGE_KEYS.salary;

interface EntryItem {
  key: 'payment' | 'settings' | 'template';
  label: string;
  icon: string;
  url: string;
  desc?: string;
}

/** 三大入口：发放 / 设置 / 模板 */
const ENTRY_LIST: EntryItem[] = [
  {
    key: 'payment',
    label: '薪资发放',
    icon: 'mdi-cash-multiple',
    url: '/package-teacher/pages/salary-payment/index',
    desc: '月度统计、核对、发放',
  },
  {
    key: 'settings',
    label: '薪资设置',
    icon: 'mdi-cog-outline',
    url: '/package-teacher/pages/salary-settings/index',
    desc: '员工薪资规则配置',
  },
  {
    key: 'template',
    label: '薪资模板',
    icon: 'mdi-file-document-outline',
    url: '/package-teacher/pages/salary-template/index',
    desc: '可复用模板管理',
  },
];

const SalaryHomePage: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme } = useThemeStore();
  const { fetchSalaryTemplates, fetchTeachers } = useTeacherStore();
  const [introVisible, setIntroVisible] = useState(false);

  useDidShow(() => {
    void fetchTeachers();
    void fetchSalaryTemplates();
    try {
      const hidden = Taro.getStorageSync(INTRO_STORAGE_KEY);
      if (hidden !== true) {
        setIntroVisible(true);
      }
    } catch {
      setIntroVisible(true);
    }
  });

  const handleEntryClick = useCallback((url: string) => {
    Taro.navigateTo({ url });
  }, []);

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      {/* 三大入口卡片 */}
      <View className="px-[32rpx] pt-[24rpx] flex flex-col gap-[24rpx]">
        {ENTRY_LIST.map((item) => (
          <View
            key={item.key}
            className="bg-white rounded-[28rpx] px-[32rpx] py-[40rpx] flex items-center shadow-card press-bg"
            onClick={() => handleEntryClick(item.url)}
          >
            {/* 图标 */}
            <View className="w-[96rpx] h-[96rpx] rounded-[24rpx] bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name={item.icon} size={44} className="text-primary" />
            </View>
            {/* 文字 */}
            <View className="flex-1 ml-[28rpx]">
              <Text className="text-[34rpx] font-semibold text-foreground block">{item.label}</Text>
              {item.desc && (
                <Text className="text-[24rpx] text-muted-foreground mt-[8rpx] block">
                  {item.desc}
                </Text>
              )}
            </View>
            {/* 右箭头 */}
            <Icon name="mdi-chevron-right" size={28} className="text-muted-foreground" />
          </View>
        ))}
      </View>

      {/* 新手引导弹窗 */}
      <PageIntroSheet
        visible={introVisible}
        currentStep={6}
        totalSteps={6}
        title="第 6 步：薪资发放"
        description="先核对本月薪资，再一键发放；模板可在「薪资模板」中维护。"
        bulletPoints={[
          '进入并查看一次后即标记为「已了解」',
          '可在「薪资设置」配置规则，「薪资模板」维护可复用模板',
        ]}
        storageKey={INTRO_STORAGE_KEY}
        onClose={() => setIntroVisible(false)}
      />
    </View>
  );
};

export default SalaryHomePage;
