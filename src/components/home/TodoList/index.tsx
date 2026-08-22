import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Icon from '@/components/Icon';

/** 待办事项数据 */
export interface TodoItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  iconBg: string;
  url?: string;
}

export interface TodoListProps {
  items: TodoItem[];
  /** 手动点「已读」回调（用户口径 2026-08-23：预警提醒进待办，需手动已读） */
  onMarkRead?: (todoId: string) => void;
}

/** 图标背景渐变映射（使用 theme token） */
const ICON_BG_MAP: Record<string, string> = {
  alert: 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--warning) / 0.85))',
  leave: 'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning) / 0.7))',
  hours: 'linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.7))',
  checkin: 'linear-gradient(135deg, hsl(var(--success)), hsl(var(--success) / 0.7))',
};

/**
 * TodoList - 待办事项列表 v14
 *
 * 对齐设计稿 index_v14.html todo-list：
 * - 图标 + 标题 + 描述 + 箭头
 * - 图标配色：alert(红橙预警)、leave(橙/warning)、hours(红/destructive)、checkin(绿/success)
 */
const TodoList: React.FC<TodoListProps> = ({ items, onMarkRead }) => {
  if (items.length === 0) {
    return (
      <View className="bg-card rounded-[28rpx] shadow-card px-[28rpx] py-[60rpx] text-center">
        <Text className="text-muted-foreground text-[28rpx]">暂无待办事项</Text>
      </View>
    );
  }

  return (
    <View className="flex flex-col gap-[20rpx]">
      {items.map((item) => (
        <View
          key={item.id}
          className="flex items-center gap-[20rpx] px-[28rpx] py-[24rpx] bg-card rounded-[28rpx] shadow-card border-[2rpx] border-[hsl(var(--border))] active:shadow-float transition-shadow duration-200"
          onClick={() => item.url && Taro.navigateTo({ url: item.url })}
        >
          <View
            className="w-[76rpx] h-[76rpx] rounded-[24rpx] flex items-center justify-center shrink-0 shadow-float"
            style={{ background: ICON_BG_MAP[item.iconBg] || ICON_BG_MAP.checkin }}
          >
            <Icon name={item.icon} size="sm" color="white" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[28rpx] font-semibold text-foreground block mb-[4rpx]">
              {item.title}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground">{item.desc}</Text>
          </View>
          {onMarkRead && (
            <View
              className="px-[20rpx] py-[10rpx] rounded-full bg-muted active:opacity-70 press-scale"
              onClick={(e) => {
                e.stopPropagation?.();
                onMarkRead(item.id);
              }}
            >
              <Text className="text-[24rpx] text-muted-foreground">已读</Text>
            </View>
          )}
          <Text className="text-[hsl(var(--border))] text-[32rpx]">›</Text>
        </View>
      ))}
    </View>
  );
};

export default TodoList;
