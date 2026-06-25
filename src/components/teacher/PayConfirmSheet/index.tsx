import { View, Text, Textarea } from '@tarojs/components';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { PendingPayAction } from '@/types/teacher';

interface PayConfirmSheetProps {
  visible: boolean;
  /** 批量发放时传入 action，单人发放时传 teacherName + amount */
  action?: PendingPayAction | null;
  teacherName?: string;
  amount?: number;
  submitting?: boolean;
  onConfirm: (remark: string) => void;
  onClose: () => void;
}

/**
 * PayConfirmSheet - 薪资发放确认弹窗
 *
 * 使用场景：教师薪资状态为 confirmed 时，点击"确认发放"触发
 *         支持单人发放（教师详情页）和批量发放（教师列表页）
 * 功能：确认发放 + 填写备注
 * 相关组件：ConfirmSalarySheet（确认工资，薪资状态为 pending 时使用）
 */
const PayConfirmSheet: React.FC<PayConfirmSheetProps> = ({
  visible,
  action,
  teacherName,
  amount,
  submitting = false,
  onConfirm,
  onClose,
}) => {
  const [remark, setRemark] = useState('');

  const handleConfirm = () => {
    if (submitting) return;
    onConfirm(remark);
    setRemark('');
  };

  const handleClose = () => {
    if (submitting) return;
    setRemark('');
    onClose();
  };

  const title = action?.type === 'batch' ? '批量发放确认' : '确认发放';

  return (
    <BottomSheet visible={visible} title={title} onClose={handleClose}>
      <View className="px-4 pb-6">
        {/* 发放信息 */}
        <View className="bg-amber-10 rounded-xl p-4 mb-4">
          {action?.type === 'batch' ? (
            <Text className="text-sm text-amber">
              确认发放 <Text className="font-bold">{action.ids.length}</Text> 位教师的
              {dayjs().month() + 1}月工资
            </Text>
          ) : (
            <View>
              <Text className="text-sm text-amber">
                确认发放 <Text className="font-bold">{teacherName}</Text> 的{dayjs().month() + 1}
                月工资
              </Text>
              <Text className="text-lg font-extrabold text-amber block mt-1">
                ¥{amount?.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* 备注输入 */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-2 block">备注（选填）</Text>
          <Textarea
            className="w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx]"
            placeholder="可填写发放备注信息"
            value={remark}
            onInput={(e) => setRemark(e.detail.value)}
            maxlength={200}
          />
        </View>

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <View
            className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-muted text-muted-foreground"
            onClick={submitting ? undefined : handleClose}
          >
            取消
          </View>
          <View
            className={`flex-1 py-3 rounded-xl text-center text-sm font-semibold shadow-sm ${submitting ? 'bg-muted text-muted-foreground' : 'bg-gradient-to-r from-amber to-amber-dark text-white'}`}
            onClick={submitting ? undefined : handleConfirm}
          >
            {submitting ? '发放中...' : '确认发放'}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default PayConfirmSheet;
