/**
 * 空状态组件
 * 支持 MDI 图标名（优先）和 Emoji（兼容）
 * mdi-* 一律走 Icon，禁止把图标名渲染成文案
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Icon from '@/components/Icon';
import type { IconName } from '@/components/Icon';
import { MDI_ICONS } from '@/components/Icon/icons';
import { resolveEmptyIcon, resolveEmptyMdiName } from '@/utils/empty-icon';

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
  const resolved = resolveEmptyIcon(icon);
  const mdiName =
    resolved.kind === 'mdi'
      ? resolveEmptyMdiName(resolved.value, (name) => Boolean(MDI_ICONS[name]))
      : null;

  return (
    <View className="flex flex-col items-center justify-center py-12">
      {mdiName ? (
        <View className="mb-3 drop-shadow-sm">
          <Icon name={mdiName as IconName} size="xxl" color="muted" />
        </View>
      ) : (
        <Text className="text-6xl mb-3 drop-shadow-sm">{resolved.value}</Text>
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
