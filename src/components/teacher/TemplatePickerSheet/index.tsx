/**
 * TemplatePickerSheet - 套用薪资模板选择弹窗
 *
 * 使用场景：员工工资设置页点击"套用薪资模板"
 * 功能：
 *  - 展示已保存的薪资模板列表
 *  - 点击模板项直接选中并回调
 */
import { View, Text, ScrollView } from '@tarojs/components';
import React from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import { useTeacherStore } from '@/stores/teacher';
import type { SalaryTemplate } from '@/types/teacher';

export interface TemplatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: SalaryTemplate) => void;
}

const TemplatePickerSheet: React.FC<TemplatePickerSheetProps> = ({
  visible,
  onClose,
  onSelect,
}) => {
  const { salaryTemplates } = useTeacherStore();

  return (
    <BottomSheet visible={visible} height="70vh" onClose={onClose}>
      {/* 顶部按钮栏 */}
      <View className="flex items-center justify-between px-[40rpx] pt-[8rpx] pb-[20rpx]">
        <Text
          className="text-[28rpx] text-muted-foreground press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
          onClick={onClose}
        >
          取消
        </Text>
        <Text className="text-[30rpx] font-semibold text-foreground">套用薪资模板</Text>
        <View className="w-[56rpx]" />
      </View>

      {/* 提示 */}
      <View className="px-[40rpx] mb-[20rpx]">
        <Text className="text-[26rpx] text-muted-foreground leading-relaxed">
          选择模板后将覆盖当前员工的工资配置，点击保存后生效。
        </Text>
      </View>

      {/* 模板列表 */}
      <ScrollView scrollY className="max-h-[54vh] px-[24rpx] pb-[40rpx]">
        {salaryTemplates.length === 0 ? (
          <View className="py-[120rpx] flex items-center justify-center">
            <Text className="text-[26rpx] text-muted-foreground">暂无薪资模板</Text>
          </View>
        ) : (
          salaryTemplates.map((tpl) => (
            <View
              key={tpl.id}
              className="flex items-center px-[16rpx] py-[24rpx] mb-[16rpx] bg-white rounded-[24rpx] border-[2rpx] border-border active:shadow-float press-bg"
              onClick={() => onSelect(tpl)}
            >
              <Avatar name={tpl.name.slice(0, 1)} size="sm" />
              <View className="flex-1 ml-[20rpx]">
                <Text className="text-[30rpx] font-medium text-foreground">{tpl.name}</Text>
                {tpl.summary ? (
                  <Text className="text-[24rpx] text-muted-foreground mt-[4rpx]">
                    {tpl.summary}
                  </Text>
                ) : null}
              </View>
              {tpl.isDefault ? (
                <View className="px-[12rpx] py-[4rpx] rounded-[10rpx] bg-primary/10 text-primary text-[20rpx] font-medium">
                  默认
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheet>
  );
};

export default TemplatePickerSheet;
