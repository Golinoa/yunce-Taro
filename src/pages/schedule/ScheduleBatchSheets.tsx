/**
 * 课表批量处理弹层（类型选择 + 班级多选 + 危险确认，从 schedule/index 抽出，Q2-1）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import CircleCheckbox from '@/components/CircleCheckbox';
import ConfirmDialog from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';
import type { DangerActionMeta } from '@/utils/schedule-danger-meta';

export type ScheduleBatchActionType = 'reschedule' | 'delete';

export interface ScheduleBatchClassOption {
  id: string;
  name: string;
  studentCount: number;
  scheduleSummary: string;
}

export interface ScheduleBatchSheetsProps {
  batchActionSheetVisible: boolean;
  onCloseBatchActionSheet: () => void;
  onChooseBatchType: (type: ScheduleBatchActionType) => void;

  batchClassSheetVisible: boolean;
  onCloseBatchClassSheet: () => void;
  batchActionType: ScheduleBatchActionType;
  batchClassOptions: ScheduleBatchClassOption[];
  batchSelectedClassIds: string[];
  batchSubmitting: boolean;
  onSelectAllBatchClasses: () => void;
  onToggleBatchClassSelection: (classId: string) => void;
  onConfirmBatchClassSelection: () => void;

  dangerActionMeta: DangerActionMeta | null;
  dangerDialogVisible: boolean;
  dangerActionSubmitting: boolean;
  onCloseDangerDialog: () => void;
  onConfirmDangerAction: () => void;
}

const ScheduleBatchSheets: React.FC<ScheduleBatchSheetsProps> = ({
  batchActionSheetVisible,
  onCloseBatchActionSheet,
  onChooseBatchType,
  batchClassSheetVisible,
  onCloseBatchClassSheet,
  batchActionType,
  batchClassOptions,
  batchSelectedClassIds,
  batchSubmitting,
  onSelectAllBatchClasses,
  onToggleBatchClassSelection,
  onConfirmBatchClassSelection,
  dangerActionMeta,
  dangerDialogVisible,
  dangerActionSubmitting,
  onCloseDangerDialog,
  onConfirmDangerAction,
}) => {
  return (
    <>
      <BottomSheet
        visible={batchActionSheetVisible}
        title="批量处理"
        onClose={onCloseBatchActionSheet}
        scrollable={false}
        className="pb-safe-bar"
      >
        <View className="px-[24rpx] py-[18rpx]">
          <View className="rounded-[18rpx] bg-muted px-[18rpx] py-[16rpx]">
            <Text className="text-[24rpx] text-muted-foreground">请选择要执行的批量操作</Text>
          </View>
        </View>
        <View className="px-[24rpx] pb-[32rpx] flex flex-col gap-[18rpx]">
          <View
            className="rounded-[22rpx] border border-border bg-muted px-[24rpx] py-[24rpx]"
            onClick={() => onChooseBatchType('reschedule')}
          >
            <View className="flex items-center justify-between gap-[16rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-card shadow-card">
                  <Icon name="mdi-calendar-check-outline" size="md" color="primary" />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex items-center gap-[10rpx]">
                    <Text className="text-[30rpx] font-semibold text-foreground">批量调课</Text>
                    <View className="rounded-full bg-card/80 px-[12rpx] py-[6rpx]">
                      <Text className="text-[20rpx] font-medium text-primary">只调当天</Text>
                    </View>
                  </View>
                  <Text className="mt-[8rpx] block text-[24rpx] leading-[34rpx] text-muted-foreground">
                    选择多个班级，将当天课程统一调整到新的日期
                  </Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size="sm" color="primary" />
            </View>
          </View>
          <View
            className="rounded-[22rpx] border border-border bg-muted px-[24rpx] py-[24rpx]"
            onClick={() => onChooseBatchType('delete')}
          >
            <View className="flex items-center justify-between gap-[16rpx]">
              <View className="flex items-center gap-[16rpx]">
                <View className="flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[22rpx] bg-card shadow-card">
                  <Icon name="mdi-delete-outline" size="md" color="destructive" />
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex items-center gap-[10rpx]">
                    <Text className="text-[30rpx] font-semibold text-destructive">批量删除</Text>
                    <View className="rounded-full bg-card/85 px-[12rpx] py-[6rpx]">
                      <Text className="text-[20rpx] font-medium text-destructive">谨慎操作</Text>
                    </View>
                  </View>
                  <Text className="mt-[8rpx] block text-[24rpx] leading-[34rpx] text-muted-foreground">
                    选择多个班级删除，并向学员发送班级解散通知
                  </Text>
                </View>
              </View>
              <Icon name="mdi-chevron-right" size="sm" color="destructive" />
            </View>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={batchClassSheetVisible}
        title={batchActionType === 'reschedule' ? '选择调课班级' : '选择删除班级'}
        onClose={onCloseBatchClassSheet}
        className="pb-safe-bar"
      >
        <View className="px-[24rpx] py-[16rpx]">
          <View className="flex items-center justify-between">
            <Text className="text-[24rpx] text-muted-foreground">
              已选 {batchSelectedClassIds.length} 个班级
            </Text>
            <Text className="text-[24rpx] text-primary" onClick={onSelectAllBatchClasses}>
              {batchSelectedClassIds.length === batchClassOptions.length ? '取消全选' : '全选'}
            </Text>
          </View>
        </View>

        <View className="px-[24rpx] pb-[24rpx] flex flex-col gap-[16rpx]">
          {batchClassOptions.map((item) => {
            const checked = batchSelectedClassIds.includes(item.id);
            return (
              <View
                key={item.id}
                className={cn(
                  'rounded-[16rpx] border px-[24rpx] py-[22rpx] flex items-start gap-[18rpx]',
                  checked ? 'border-primary bg-primary-10' : 'border-schedule-soft bg-card',
                )}
                onClick={() => onToggleBatchClassSelection(item.id)}
              >
                <CircleCheckbox checked={checked} size={42} />
                <View className="min-w-0 flex-1">
                  <View className="flex items-center gap-[12rpx]">
                    <Text className="truncate text-[30rpx] font-semibold text-foreground">
                      {item.name}
                    </Text>
                    <Text className="text-[22rpx] text-muted-foreground">
                      {item.studentCount}人
                    </Text>
                  </View>
                  <Text className="mt-[8rpx] block text-[24rpx] text-muted-foreground">
                    {item.scheduleSummary}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View className="border-t border-schedule-soft px-[24rpx] pt-[20rpx] pb-[24rpx] flex gap-[16rpx] bg-card">
          <View
            className="flex-1 h-[84rpx] rounded-[14rpx] bg-muted flex items-center justify-center"
            onClick={onCloseBatchClassSheet}
          >
            <Text className="text-[28rpx] font-medium text-foreground-secondary">取消</Text>
          </View>
          <View
            className={cn(
              'flex-1 h-[84rpx] rounded-[14rpx] flex items-center justify-center',
              batchActionType === 'delete' ? 'bg-schedule-delete' : 'bg-schedule-adjust',
              batchSubmitting ? 'opacity-60' : '',
            )}
            onClick={() => void onConfirmBatchClassSelection()}
          >
            <Text className="text-[28rpx] font-semibold text-primary-foreground">
              {batchActionType === 'delete' ? '确定删除' : '下一步'}
            </Text>
          </View>
        </View>
      </BottomSheet>

      {dangerActionMeta ? (
        <ConfirmDialog
          visible={dangerDialogVisible}
          title={dangerActionMeta.title}
          description={dangerActionMeta.description}
          confirmText={dangerActionMeta.confirmText}
          tone={dangerActionMeta.tone}
          confirmLoading={dangerActionSubmitting}
          onClose={onCloseDangerDialog}
          onConfirm={() => void onConfirmDangerAction()}
        />
      ) : null}
    </>
  );
};

export default ScheduleBatchSheets;
