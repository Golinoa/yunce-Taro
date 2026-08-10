import { View, Text, Textarea } from '@tarojs/components';
import cn from 'classnames';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import CircleCheckbox from '@/components/CircleCheckbox';
import type { PayMethod, PendingPayAction } from '@/types/teacher';
import { PAY_METHOD_TEXT } from '@/types/teacher';

const PAY_METHOD_OPTIONS: { value: PayMethod; label: string }[] = [
  { value: 'wechat', label: PAY_METHOD_TEXT.wechat },
  { value: 'alipay', label: PAY_METHOD_TEXT.alipay },
  { value: 'salary_card', label: PAY_METHOD_TEXT.salary_card },
  { value: 'union_card', label: PAY_METHOD_TEXT.union_card },
  { value: 'cash', label: PAY_METHOD_TEXT.cash },
  { value: 'other', label: PAY_METHOD_TEXT.other },
];

interface PayConfirmSheetProps {
  visible: boolean;
  /** 批量发放时传入 action，单人发放时传 teacherName + amount */
  action?: PendingPayAction | null;
  teacherName?: string;
  amount?: number;
  submitting?: boolean;
  onConfirm: (data: { remark: string; payMethod: PayMethod }) => void;
  onClose: () => void;
}

/**
 * PayConfirmSheet - 薪资发放确认弹窗
 *
 * 使用场景：教师薪资状态为 sending/teacher_confirmed 时，点击"确认发放"触发
 *         支持单人发放（教师详情页）和批量发放（教师列表页暂未使用）
 * 功能：选择发放方式 + 填写备注 + 确认发放
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
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat');

  const handleConfirm = () => {
    if (submitting) return;
    onConfirm({ remark, payMethod });
    setRemark('');
  };

  const handleClose = () => {
    if (submitting) return;
    setRemark('');
    setPayMethod('wechat');
    onClose();
  };

  const title = action?.type === 'batch' ? '批量发放确认' : '确认发放';

  return (
    <BottomSheet visible={visible} title={title} onClose={handleClose}>
      <View className="px-4 pb-6">
        {/* 发放信息 */}
        <View className="bg-primary-bg rounded-xl p-4 mb-4">
          {action?.type === 'batch' ? (
            <Text className="text-sm text-primary">
              确认发放 <Text className="font-bold">{action.ids.length}</Text> 位教师的
              {dayjs().month() + 1}月工资
            </Text>
          ) : (
            <View>
              <Text className="text-sm text-primary">
                确认发放 <Text className="font-bold">{teacherName}</Text> 的{dayjs().month() + 1}
                月工资
              </Text>
              <Text className="text-lg font-extrabold text-primary block mt-1">
                ¥{amount?.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* 发放方式 */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-foreground mb-3 block">发放方式</Text>
          <View className="grid grid-cols-3 gap-3">
            {PAY_METHOD_OPTIONS.map((item) => {
              const checked = payMethod === item.value;
              return (
                <View
                  key={item.value}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3 rounded-xl border-2 press-scale',
                    checked ? 'bg-primary-bg border-primary' : 'bg-white border-border',
                  )}
                  onClick={() => setPayMethod(item.value)}
                >
                  <CircleCheckbox checked={checked} size={32} />
                  <Text
                    className={cn(
                      'text-[26rpx] font-medium',
                      checked ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
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
            className={cn(
              'flex-1 py-3 rounded-xl text-center text-sm font-semibold shadow-sm',
              submitting ? 'bg-muted text-muted-foreground' : 'bg-gradient-primary text-white',
            )}
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
