import { View } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import { useThemeStore } from '@/stores/theme';

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
    </View>
  );
};

export default PageContainer;
