import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import { TYPE_ICON_MAP } from '@/package-course/pages/package-form/usePackageForm';
import type { CoursePackageTemplate } from '@/types/course-package';

export interface PackageSelectSheetProps {
  show: boolean;
  visible: boolean;
  templates: CoursePackageTemplate[];
  selectedTemplate: CoursePackageTemplate | null;
  isCustomPackage: boolean;
  customName: string;
  customHours: string;
  customValidDays: string;
  customPrice: string;
  onSelectTemplate: (tpl: CoursePackageTemplate) => void;
  onSelectCustom: () => void;
  onConfirmCustom: () => void;
  onClose: () => void;
  onCustomNameChange: (val: string) => void;
  onCustomHoursChange: (val: string) => void;
  onCustomValidDaysChange: (val: string) => void;
  onCustomPriceChange: (val: string) => void;
}

/** 课包选择底部弹窗组件 - 包含模板列表和自定义课包 */
const PackageSelectSheet: React.FC<PackageSelectSheetProps> = ({
  show,
  visible,
  templates,
  selectedTemplate,
  isCustomPackage,
  customName,
  customHours,
  customValidDays,
  customPrice,
  onSelectTemplate,
  onSelectCustom,
  onConfirmCustom,
  onClose,
  onCustomNameChange,
  onCustomHoursChange,
  onCustomValidDaysChange,
  onCustomPriceChange,
}) => {
  if (!show) return null;

  return (
    <BottomSheet show={show} visible={visible} title="选择课包" onClose={onClose} maxHeight="70vh">
      <View className="px-10 pb-10">
        {/* 模板列表 */}
        {templates.map((tpl) => {
          const typeInfo = TYPE_ICON_MAP[tpl.type] || TYPE_ICON_MAP.hour_package;
          const isSelected = selectedTemplate?.id === tpl.id;
          return (
            <View
              key={tpl.id}
              className={`flex items-center gap-5 p-[28rpx] rounded-[24rpx] border-[3rpx] mb-4 transition ${isSelected ? 'border-primary bg-primary-5' : 'border-input bg-white/50'}`}
              onClick={() => onSelectTemplate(tpl)}
            >
              <View
                className={cn(
                  'w-[84rpx] h-[84rpx] rounded-[20rpx] flex items-center justify-center flex-shrink-0',
                  typeInfo.bgClass,
                )}
              >
                <Text className="text-[40rpx]">{typeInfo.icon}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[28rpx] font-semibold text-foreground block">{tpl.name}</Text>
                {tpl.description && (
                  <Text className="text-[22rpx] text-muted-foreground block mt-1">
                    {tpl.description}
                  </Text>
                )}
                <View className="flex gap-2 mt-2">
                  <View className="py-1 px-3 rounded-sm bg-primary-15">
                    <Text className="text-[20rpx] text-primary font-medium">
                      {tpl.lesson_count}课时
                    </Text>
                  </View>
                  {tpl.valid_days ? (
                    <View className="py-1 px-3 rounded-sm bg-amber-15">
                      <Text className="text-[20rpx] text-amber font-medium">
                        {tpl.valid_days}天
                      </Text>
                    </View>
                  ) : (
                    <View className="py-1 px-3 rounded-sm bg-purple-15">
                      <Text className="text-[20rpx] text-purple font-medium">永久</Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="flex flex-col items-end gap-3 flex-shrink-0">
                {tpl.price > 0 && (
                  <Text className="text-[30rpx] font-bold text-primary">¥{tpl.price}</Text>
                )}
                <View
                  className={`w-[40rpx] h-[40rpx] rounded-full border-[4rpx] flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-input'}`}
                >
                  {isSelected && <Text className="text-[20rpx] text-white">✓</Text>}
                </View>
              </View>
            </View>
          );
        })}

        {/* 自定义课包 */}
        <View
          className={`border-[4rpx] border-dashed rounded-[24rpx] p-[28rpx] text-center transition ${isCustomPackage ? 'border-primary bg-primary-5' : 'border-input bg-white/50'}`}
          onClick={isCustomPackage ? undefined : onSelectCustom}
        >
          {!isCustomPackage ? (
            <>
              <Text className="text-[44rpx] block mb-1">✏️</Text>
              <Text className="text-[26rpx] font-semibold text-foreground block">自定义课包</Text>
              <Text className="text-[22rpx] text-muted-foreground block mt-1">
                手动输入课时和有效期
              </Text>
            </>
          ) : (
            <>
              <Text className="text-[26rpx] font-semibold text-foreground block mb-4">
                自定义课包
              </Text>
              <View className="text-left">
                <View className="mb-4">
                  <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                    名称 <Text className="text-destructive text-[20rpx]">*</Text>
                  </Text>
                  <Input
                    className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground"
                    placeholder="如：暑假特训课包"
                    value={customName}
                    onInput={(e) => onCustomNameChange(e.detail.value || '')}
                  />
                </View>
                <View className="flex gap-5 mb-4">
                  <View className="flex-1">
                    <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                      课时 <Text className="text-destructive text-[20rpx]">*</Text>
                    </Text>
                    <Input
                      className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground text-center"
                      type="number"
                      placeholder="课时数"
                      value={customHours}
                      onInput={(e) => onCustomHoursChange(e.detail.value || '')}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                      有效天数
                    </Text>
                    <Input
                      className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground text-center"
                      type="number"
                      placeholder="0=永久"
                      value={customValidDays}
                      onInput={(e) => onCustomValidDaysChange(e.detail.value || '')}
                    />
                  </View>
                </View>
                <View className="mb-4">
                  <Text className="text-[26rpx] font-semibold text-foreground block mb-2">
                    金额
                  </Text>
                  <Input
                    className="w-full py-5 px-7 rounded-[20rpx] border-[3rpx] border-input bg-white text-[28rpx] text-foreground"
                    type="digit"
                    placeholder="0.00"
                    value={customPrice}
                    onInput={(e) => onCustomPriceChange(e.detail.value || '')}
                  />
                </View>
                <View
                  className="w-full py-5 rounded-[24rpx] bg-gradient-primary text-center"
                  onClick={onConfirmCustom}
                >
                  <Text className="text-lg font-bold text-white">确认</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {templates.length === 0 && !isCustomPackage && (
          <View className="py-10 text-center">
            <Text className="text-md text-muted-foreground">暂无课包模板，请选择自定义课包</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

export default PackageSelectSheet;
