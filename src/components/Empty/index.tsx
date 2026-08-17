/**
 * 空状态组件
 * 支持 MDI 图标名（优先）和 Emoji（兼容）
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';

const MDI_ICON_NAMES: string[] = [
  'mdi-inbox',
  'mdi-account-search',
  'mdi-account-question-outline',
  'mdi-school-outline',
  'mdi-calendar-blank',
  'mdi-book-open-blank-variant',
  'mdi-book-open-variant',
  'mdi-wallet-outline',
  'mdi-calendar-check-outline',
  'mdi-account-group-outline',
  'mdi-account-multiple-plus',
  'mdi-bell-off',
  'mdi-chart-bar',
  'mdi-package-variant',
  'mdi-clipboard-text',
  'mdi-alert-circle-outline',
  'mdi-alert-circle',
  'mdi-history',
];

interface EmptyProps {
  icon?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

const Empty: React.FC<EmptyProps> = ({
  icon = 'mdi-inbox',
  description = '暂无数据',
  actionText,
  onAction,
}) => {
  const isMdi = icon.startsWith('mdi-') && MDI_ICON_NAMES.includes(icon);

  return (
    <View className="flex flex-col items-center justify-center py-12">
      {isMdi ? (
        <View className="mb-3 drop-shadow-sm">
          <Icon name={icon as IconName} size="xxl" color="muted" />
        </View>
      ) : (
        <Text className="text-6xl mb-3 drop-shadow-sm">{icon}</Text>
      )}
      <Text className="text-sm text-muted-foreground text-center">{description}</Text>
      {actionText && onAction && (
        <View
          className="mt-4 px-5 py-2 bg-primary/10 rounded-button flex items-center justify-center press-scale"
          onClick={onAction}
        >
          <Text className="text-sm text-primary font-medium whitespace-nowrap">{actionText}</Text>
        </View>
      )}
    </View>
  );
};

export default Empty;
