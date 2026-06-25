import { View, Text } from '@tarojs/components';
import dayjs from 'dayjs';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';

interface ConfirmSalarySheetProps {
  visible: boolean;
  teacherName: string;
  amount: number;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * ConfirmSalarySheet - 确认工资弹窗
 *
 * 使用场景：教师薪资状态为 pending 时，点击"确认工资"触发
 * 功能：二次确认教师工资金额
 * 相关组件：PayConfirmSheet（确认发放，薪资状态为 confirmed 后使用）
 */
const ConfirmSalarySheet: React.FC<ConfirmSalarySheetProps> = ({
  visible,
  teacherName,
  amount,
  submitting = false,
  onConfirm,
  onClose,
}) => {
  return (
    <BottomSheet visible={visible} title="确认工资" onClose={onClose}>
      <View className="px-4 pb-6">
        {/* 提示信息 */}
        <View className="bg-amber-bg rounded-xl p-4 mb-4">
          <Text className="text-sm text-amber">
            确认 <Text className="font-bold">{teacherName}</Text> 的{dayjs().month() + 1}月工资
          </Text>
          <Text className="text-lg font-extrabold text-amber block mt-1">
            ¥{amount.toLocaleString()}
          </Text>
          <Text className="text-xs text-amber/70 block mt-2">确认后仍可在工资单中取消确认</Text>
        </View>

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <View
            className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-muted text-muted-foreground"
            onClick={submitting ? undefined : onClose}
          >
            再想想
          </View>
          <View
            className={`flex-1 py-3 rounded-xl text-center text-sm font-semibold ${submitting ? 'bg-muted text-muted-foreground' : 'text-white bg-gradient-amber'}`}
            onClick={submitting ? undefined : onConfirm}
          >
            {submitting ? '确认中...' : '确认工资'}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default ConfirmSalarySheet;
