/**
 * 主题颜色设置页
 *
 * 全员个人偏好：切换 blue / coral / orange，即时生效并写入本地缓存（yunce:active-theme）。
 * 当前库/校区无主题色字段，不做校区默认同步。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { useThemeStore } from '@/stores/theme';
import { THEME_KEYS, THEME_META, hexThemeColors, type ThemeKey } from '@/theme';
import { useCardNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

const ThemeSettings: React.FC = () => {
  useCardNavigationBar();
  const { activeTheme, setTheme } = useThemeStore();

  const handleSelect = useCallback(
    (theme: ThemeKey) => {
      setTheme(theme);
      Taro.showToast({ title: '切换成功', icon: 'success' });
    },
    [setTheme],
  );

  return (
    <PageContainer safeBottom>
      <View className="px-[32rpx] pt-[32rpx]">
        <Text className="mb-[12rpx] block text-[32rpx] font-bold text-foreground">选择主题色</Text>
        <Text className="mb-[32rpx] block text-[24rpx] leading-relaxed text-muted-foreground">
          仅影响本机显示，设置保存在本地
        </Text>

        <View className="flex flex-col gap-[24rpx]">
          {THEME_KEYS.map((theme) => {
            const meta = THEME_META[theme];
            const selected = activeTheme === theme;
            const colors = hexThemeColors[theme];

            return (
              <View
                key={theme}
                className={cn(
                  'press-bg flex items-center gap-[24rpx] rounded-[28rpx] bg-white px-[28rpx] py-[28rpx] shadow-soft',
                  selected && 'border-[3rpx] border-primary',
                )}
                onClick={() => handleSelect(theme)}
              >
                {/* 主题色预览 */}
                <View className="flex -space-x-[12rpx]">
                  <View
                    className="h-[56rpx] w-[56rpx] rounded-full border-[4rpx] border-white"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <View
                    className="h-[56rpx] w-[56rpx] rounded-full border-[4rpx] border-white"
                    style={{ backgroundColor: colors.primaryLight }}
                  />
                  <View
                    className="h-[56rpx] w-[56rpx] rounded-full border-[4rpx] border-white"
                    style={{ backgroundColor: colors.accent }}
                  />
                </View>

                {/* 文案 */}
                <View className="min-w-0 flex-1">
                  <Text className="text-[30rpx] font-semibold text-foreground">{meta.label}</Text>
                  <Text className="mt-[6rpx] block text-[24rpx] text-muted-foreground">
                    {meta.description}
                  </Text>
                </View>

                {/* 选中标记 */}
                {selected && (
                  <View className="center flex h-[44rpx] w-[44rpx] rounded-full bg-primary">
                    <Icon name="mdi-check" size={24} color="white" />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </PageContainer>
  );
};

export default withRouteGuard(ThemeSettings);
