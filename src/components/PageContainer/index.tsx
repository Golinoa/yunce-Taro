import { View } from '@tarojs/components';
import React from 'react';

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
  return (
    <View
      className={`min-h-screen bg-background ${safeTop ? 'pt-safe' : ''} ${safeBottom ? 'pb-safe-bottom' : ''} ${className}`}
    >
      {children}
    </View>
  );
};

export default PageContainer;
