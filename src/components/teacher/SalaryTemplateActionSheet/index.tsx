/**
 * SalaryTemplateActionSheet - 员工工资设置页的"薪资模板"操作弹窗
 *
 * 使用场景：点击保存按钮上方的"薪资模板"按钮后从页面中央弹出
 * 功能：
 *  - 套用薪资模板
 *  - 把当前配置另存为模板
 *  - 复制给其他教练
 *  - 取消
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import Dialog from '@/components/Dialog';

export type SalaryTemplateAction = 'apply' | 'save' | 'copy';

export interface SalaryTemplateActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: SalaryTemplateAction) => void;
}

const ACTIONS: { key: SalaryTemplateAction; label: string }[] = [
  { key: 'apply', label: '套用薪资模板' },
  { key: 'save', label: '把当前配置另存为模板' },
  { key: 'copy', label: '复制给其他教练' },
];

const SalaryTemplateActionSheet: React.FC<SalaryTemplateActionSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  return (
    <Dialog visible={visible} onClose={onClose} maskClosable>
      <View className="w-[640rpx] max-w-[90vw] rounded-[28rpx] bg-white overflow-hidden">
        {/* 选项列表 */}
        <View className="flex flex-col">
          {ACTIONS.map((action, index) => (
            <View key={action.key}>
              <View
                className="py-[32rpx] flex items-center justify-center active:opacity-70"
                onClick={() => {
                  onSelect(action.key);
                }}
              >
                <Text className="text-[30rpx] text-foreground">{action.label}</Text>
              </View>
              {index < ACTIONS.length - 1 && <View className="h-[1rpx] bg-border" />}
            </View>
          ))}
        </View>

        {/* 取消按钮 */}
        <View className="px-[32rpx] pt-[24rpx] pb-[32rpx]">
          <View
            className="w-full py-[26rpx] rounded-full bg-muted flex items-center justify-center active:opacity-70"
            onClick={onClose}
          >
            <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
          </View>
        </View>
      </View>
    </Dialog>
  );
};

export default SalaryTemplateActionSheet;
