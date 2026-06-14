import { View, Text, Textarea } from '@tarojs/components';
import cn from 'classnames';
import React, { useState, useEffect } from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { ResignType } from '@/types/teacher';

interface ResignSheetProps {
  visible: boolean;
  teacherName: string;
  onConfirm: (type: ResignType, reason?: string) => void;
  onClose: () => void;
}

const RESIGN_OPTIONS: { label: string; value: ResignType }[] = [
  { label: '主动离职', value: 'quit' },
  { label: '合同到期', value: 'expire' },
  { label: '辞退', value: 'dismiss' },
];

/**
 * ResignSheet - 离职确认弹窗
 *
 * 使用场景：教师详情页标记教师离职
 * 功能：选择离职类型 + 填写离职原因
 */
const ResignSheet: React.FC<ResignSheetProps> = ({ visible, teacherName, onConfirm, onClose }) => {
  const [resignType, setResignType] = useState<ResignType>('quit');
  const [reason, setReason] = useState('');

  // 打开时重置
  useEffect(() => {
    if (visible) {
      setResignType('quit');
      setReason('');
    }
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(resignType, reason.trim() || undefined);
  };

  return (
    <BottomSheet visible={visible} title="确认标记离职" onClose={onClose}>
      <View className="px-4 pb-6">
        <Text className="text-sm text-foreground mb-4 block">
          确认将 <Text className="font-bold">{teacherName}</Text> 标记为离职？
        </Text>

        {/* 离职类型 */}
        <View className="flex gap-2 mb-4">
          {RESIGN_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className={cn(
                'flex-1 py-[20rpx] rounded-xl text-center text-sm font-medium bg-muted text-muted-foreground press-scale',
                resignType === opt.value && 'bg-destructive-10 text-destructive font-semibold',
              )}
              onClick={() => setResignType(opt.value)}
            >
              {opt.label}
            </View>
          ))}
        </View>

        {/* 离职原因 */}
        <View className="mb-6">
          <Text className="text-sm font-medium text-foreground mb-2 block">离职原因（选填）</Text>
          <Textarea
            className="w-full bg-muted rounded-xl p-3 text-sm min-h-[120rpx] text-foreground"
            placeholder="请输入离职原因"
            value={reason}
            onInput={(e) => setReason(e.detail.value)}
            maxlength={200}
          />
        </View>

        {/* 操作按钮 */}
        <View className="flex gap-3">
          <View
            className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-muted text-muted-foreground"
            onClick={onClose}
          >
            取消
          </View>
          <View
            className="flex-1 py-3 rounded-xl text-center text-sm font-semibold bg-destructive text-white"
            onClick={handleConfirm}
          >
            确认离职
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default ResignSheet;
