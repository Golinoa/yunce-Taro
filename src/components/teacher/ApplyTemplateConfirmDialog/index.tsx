/**
 * ApplyTemplateConfirmDialog - 套用薪资模板二次确认弹窗
 *
 * 居中 Dialog：
 *  - 标题：套用薪资模板
 *  - 正文：将把模板「xxx」套用给所选 N 位教练，并覆盖他们现有配置，确定？
 *  - 取消 / 确定（绿色 primary 按钮）
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Dialog from '@/components/Dialog';

export interface ApplyTemplateConfirmDialogProps {
  visible: boolean;
  templateName: string;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const ApplyTemplateConfirmDialog: React.FC<ApplyTemplateConfirmDialogProps> = ({
  visible,
  templateName,
  count,
  onCancel,
  onConfirm,
}) => {
  return (
    <Dialog visible={visible} onClose={onCancel} maskClosable={false}>
      <View className="w-[600rpx] max-w-[86vw] rounded-[28rpx] bg-white overflow-hidden">
        <View className="pt-[48rpx] px-[36rpx]">
          <Text className="text-[36rpx] font-bold text-foreground text-center block">
            套用薪资模板
          </Text>
        </View>
        <View className="px-[36rpx] py-[32rpx]">
          <Text className="text-[28rpx] text-foreground leading-relaxed text-center block">
            将把模板「{templateName}」套用给所选 {count} 位教练，并覆盖他们现有配置，确定？
          </Text>
        </View>
        <View className="flex border-t border-border">
          <View
            className="flex-1 py-[28rpx] border-r border-border text-center press-bg"
            onClick={onCancel}
          >
            <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
          </View>
          <View className="flex-1 py-[28rpx] text-center press-bg bg-primary" onClick={onConfirm}>
            <Text className="text-[30rpx] font-semibold text-white">确定</Text>
          </View>
        </View>
      </View>
    </Dialog>
  );
};

export default ApplyTemplateConfirmDialog;
