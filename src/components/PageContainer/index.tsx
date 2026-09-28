import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { useThemeStore } from '@/stores/theme';

/** 构建期常量：生产构建恒为 false，DCE 整棵移除调试用子树（P-05/B-02） */
const isDebugBuild = process.env.TARO_ENABLE_LOCAL_DEBUG === 'true';

interface PageContainerProps {
  safeBottom?: boolean;
  safeTop?: boolean;
  className?: string;
  children: React.ReactNode;
}

const PageContainer: React.FC<PageContainerProps> = ({
  safeBottom = false,
  safeTop = false,
  className = '',
  children,
}) => {
  const { activeTheme } = useThemeStore();

  return (
    <View
      className={cn(
        `theme-${activeTheme}`,
        'min-h-screen bg-background',
        safeTop && 'pt-safe',
        safeBottom && 'pb-safe-bottom',
        className,
      )}
    >
      {children}
      {/* MockIdentitySwitcher 已于 2026-09-28 按用户要求彻底移除（含组件与全部引用）；
          需要恢复时从 git 历史（components/MockIdentitySwitcher）找回。 */}
      {isDebugBuild && null}
    </View>
  );
};

export default PageContainer;
