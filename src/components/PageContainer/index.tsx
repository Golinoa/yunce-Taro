import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import MockIdentitySwitcher from '@/components/MockIdentitySwitcher';
import { useThemeStore } from '@/stores/theme';

/** 构建期常量：生产构建恒为 false，DCE 整棵移除 MockIdentitySwitcher（P-05/B-02） */
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
      {/* 仅 debug 构建挂载；生产构建常量折叠后整棵子树被移除，组件代码/样式不再进包 */}
      {isDebugBuild && <MockIdentitySwitcher />}
    </View>
  );
};

export default PageContainer;
