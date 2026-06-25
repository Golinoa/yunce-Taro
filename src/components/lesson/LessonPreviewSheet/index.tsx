import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useCallback, useMemo } from 'react';
import BottomSheet from '@/components/BottomSheet';

/** 预览项状态 */
type PreviewStatus = 'ok' | 'warning' | 'error';

/** 单个学员的消课预览数据 */
export interface PreviewItem {
  studentId: string;
  studentName: string;
  packageName: string;
  deductHours: number;
  purchasedBefore: number;
  bonusBefore: number;
  purchasedAfter: number;
  bonusAfter: number;
  remainingAfter: number;
  status: PreviewStatus;
  warningText?: string;
  skipped: boolean;
}

export interface LessonPreviewSheetProps {
  visible: boolean;
  items: PreviewItem[];
  onConfirm: (skippedIds: string[]) => void;
  onClose: () => void;
}

/** 状态图标映射 */
const STATUS_ICON: Record<PreviewStatus, string> = {
  ok: '✓',
  warning: '⚠',
  error: '✕',
};

/** 状态颜色映射（UnoCSS Token） */
const STATUS_COLOR: Record<PreviewStatus, string> = {
  ok: 'text-primary',
  warning: 'text-warning',
  error: 'text-danger',
};

/** 状态背景色映射 */
const STATUS_BG: Record<PreviewStatus, string> = {
  ok: 'bg-primary/10',
  warning: 'bg-warning/10',
  error: 'bg-danger/10',
};

/**
 * LessonPreviewSheet - 班级消课预览弹窗
 *
 * 班级消课确认前展示每位学员的课包匹配结果和扣减预览，
 * 支持跳过特定学员，确认后只对未跳过学员执行消课。
 */
const LessonPreviewSheet: React.FC<LessonPreviewSheetProps> = ({
  visible,
  items,
  onConfirm,
  onClose,
}) => {
  // 管理跳过状态
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // 初始化时自动跳过 error 状态学员
  const initialSkipped = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => {
      if (item.status === 'error') ids.add(item.studentId);
    });
    return ids;
  }, [items]);

  // 当 items 变化时重置跳过状态
  React.useEffect(() => {
    setSkippedIds(initialSkipped);
  }, [initialSkipped]);

  const handleToggleSkip = useCallback((studentId: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(skippedIds));
  }, [skippedIds, onConfirm]);

  // 统计
  const validCount = items.filter((i) => !skippedIds.has(i.studentId)).length;
  const skippedCount = items.filter((i) => skippedIds.has(i.studentId)).length;

  return (
    <BottomSheet visible={visible} title="消课预览" onClose={onClose}>
      <View className="px-6 py-4">
        {/* 学员列表 */}
        {items.map((item) => {
          const isSkipped = skippedIds.has(item.studentId);
          const isAutoSkip = item.status === 'error';

          return (
            <View
              key={item.studentId}
              className={cn(
                'flex-row items-start py-4 border-b-[2rpx] border-solid border-border-light',
                isSkipped && 'opacity-50',
              )}
            >
              {/* 状态图标 */}
              <View
                className={cn(
                  'w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center mr-3 mt-1 shrink-0',
                  STATUS_BG[item.status],
                )}
              >
                <Text className={cn('text-[28rpx] font-bold', STATUS_COLOR[item.status])}>
                  {STATUS_ICON[item.status]}
                </Text>
              </View>

              {/* 信息区 */}
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center">
                  <Text className="text-[30rpx] font-semibold text-foreground">
                    {item.studentName}
                  </Text>
                  {isSkipped && <Text className="ml-2 text-[24rpx] text-muted">已跳过</Text>}
                </View>

                {item.status === 'ok' && (
                  <View className="mt-1">
                    <Text className="text-[26rpx] text-muted">
                      {item.packageName} · 扣{item.deductHours}课时 → 剩{item.remainingAfter}课时
                    </Text>
                    {item.bonusAfter > 0 && (
                      <Text className="text-[24rpx] text-muted ml-2">
                        (购买{item.purchasedAfter}/赠送{item.bonusAfter})
                      </Text>
                    )}
                  </View>
                )}

                {item.status === 'warning' && (
                  <Text className="mt-1 text-[26rpx] text-warning">
                    {item.warningText || '课时不足'}
                  </Text>
                )}

                {item.status === 'error' && (
                  <Text className="mt-1 text-[26rpx] text-danger">
                    {item.warningText || '无可用课包'}
                  </Text>
                )}
              </View>

              {/* 跳过按钮 */}
              {!isAutoSkip && item.status !== 'ok' && (
                <View
                  className={cn(
                    'ml-2 px-4 py-2 rounded-full shrink-0',
                    isSkipped ? 'bg-border-light' : 'bg-warning/10',
                  )}
                  onClick={() => handleToggleSkip(item.studentId)}
                >
                  <Text className={cn('text-[24rpx]', isSkipped ? 'text-muted' : 'text-warning')}>
                    {isSkipped ? '恢复' : '跳过'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* 底部统计 + 操作 */}
        <View className="pt-6 pb-4">
          <Text className="text-[26rpx] text-muted">
            共{items.length}人，消课{validCount}人
            {skippedCount > 0 ? `，跳过${skippedCount}人` : ''}
          </Text>

          <View className="flex-row mt-4 gap-3">
            <View className="flex-1 py-3 rounded-xl bg-border-light items-center" onClick={onClose}>
              <Text className="text-[30rpx] text-foreground">取消</Text>
            </View>
            <View
              className={cn(
                'flex-1 py-3 rounded-xl items-center',
                validCount > 0 ? 'bg-primary' : 'bg-border-light',
              )}
              onClick={validCount > 0 ? handleConfirm : undefined}
            >
              <Text
                className={cn(
                  'text-[30rpx] font-semibold',
                  validCount > 0 ? 'text-white' : 'text-muted',
                )}
              >
                确认消课({validCount}人)
              </Text>
            </View>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default LessonPreviewSheet;
