/**
 * 点名页顶部导航 + 模式 Tab（从 lesson-form 抽出，Q2-2）
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';

export interface LessonFormHeaderProps {
  mode: 'single' | 'class';
  pageTitle: string;
  selectedClassName?: string;
  shouldShowModeTabs: boolean;
  onBack: () => void;
  onModeChange: (mode: 'single' | 'class') => void;
}

const LessonFormHeader: React.FC<LessonFormHeaderProps> = ({
  mode,
  pageTitle,
  selectedClassName,
  shouldShowModeTabs,
  onBack,
  onModeChange,
}) => {
  return (
    <>
      {/* 自定义导航栏：标题居中，返回按钮与原生胶囊对齐 */}
      <View className="sticky top-0 z-50 border-b border-black/5 bg-white">
        <View className="pt-nav-safe">
          <View className="relative flex h-[88rpx] items-center justify-center">
            <View
              className="absolute left-[32rpx] flex h-[64rpx] w-[64rpx] items-center justify-center rounded-full active:bg-muted/60"
              onClick={onBack}
            >
              <Icon name="mdi-chevron-left" size={40} color="foreground" />
            </View>
            <Text className="max-w-[60%] truncate text-[34rpx] font-bold text-foreground">
              {mode === 'class' ? selectedClassName || pageTitle : pageTitle}
            </Text>
          </View>
        </View>
      </View>

      {/* 模式切换 Tab - 白色背景+底部指示器 */}
      {shouldShowModeTabs ? (
        <View className="bg-white shadow-sm">
          <View className="flex">
            <View
              className="flex-1 flex items-center justify-center py-3_d5 relative"
              onClick={() => onModeChange('single')}
            >
              <Text
                className={`text-base font-medium ${mode === 'single' ? 'text-primary' : 'text-muted-foreground'}`}
              >
                学员消课
              </Text>
              {mode === 'single' && (
                <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
              )}
            </View>
            <View
              className="flex-1 flex items-center justify-center py-3_d5 relative"
              onClick={() => onModeChange('class')}
            >
              <Text
                className={`text-base font-medium ${mode === 'class' ? 'text-primary' : 'text-muted-foreground'}`}
              >
                班级消课
              </Text>
              {mode === 'class' && (
                <View className="absolute bottom-0 left-0 right-0 h-0_d5 bg-primary" />
              )}
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
};

export default LessonFormHeader;
