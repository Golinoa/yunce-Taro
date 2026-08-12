/**
 * 主题颜色设置页
 *
 * 在系统设置中进入，支持切换 blue / coral / orange 三套主题，切换后即时生效并持久化。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import PageContainer from '@/components/PageContainer';
import { useThemeStore } from '@/stores/theme';
import { THEME_KEYS, THEME_META, hexThemeColors, type ThemeKey } from '@/theme';

const ThemeSettings: React.FC = () => {
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
        <Text className="mb-[32rpx] block text-[32rpx] font-bold text-foreground">选择主题色</Text>

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

export default ThemeSettings;
