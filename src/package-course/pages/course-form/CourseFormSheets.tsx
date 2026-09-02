/**
 * 课程表单弹层集合（选择器 / 颜色 / 签到角色，W2 拆页）
 */
import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import PickerSheet, { type PickerOption } from '@/components/PickerSheet';
import { CHECKIN_ROLE_OPTIONS, COURSE_COLOR_OPTIONS } from '@/constants/course-template-ui';
import type { CheckinRole } from '@/types/course-template';
import type { PickerType } from './course-form-constants';

export interface CourseFormSheetsProps {
  pickerVisible: boolean;
  pickerType: PickerType;
  pickerTitle: string;
  pickerOptions: PickerOption[];
  pickerValue: string;
  customAgeGroups: string[];
  customLevels: string[];
  onClosePicker: () => void;
  onConfirmPicker: (value: string) => void;
  onAddCustomOption: (label: string) => void;
  onDeleteCustomOption: (value: string) => void;

  colorPickerVisible: boolean;
  color: string;
  onCloseColorPicker: () => void;
  onSelectColor: (color: string) => void;

  rolePickerVisible: boolean;
  roleTemp: CheckinRole[];
  onCloseRolePicker: () => void;
  onToggleRoleTemp: (role: CheckinRole) => void;
  onConfirmRolePicker: () => void;
}

const CourseFormSheets: React.FC<CourseFormSheetsProps> = ({
  pickerVisible,
  pickerType,
  pickerTitle,
  pickerOptions,
  pickerValue,
  customAgeGroups,
  customLevels,
  onClosePicker,
  onConfirmPicker,
  onAddCustomOption,
  onDeleteCustomOption,
  colorPickerVisible,
  color,
  onCloseColorPicker,
  onSelectColor,
  rolePickerVisible,
  roleTemp,
  onCloseRolePicker,
  onToggleRoleTemp,
  onConfirmRolePicker,
}) => (
  <>
    <PickerSheet
      visible={pickerVisible}
      title={pickerTitle}
      options={pickerOptions}
      value={pickerValue}
      addable={pickerType === 'ageGroup' || pickerType === 'level'}
      addPrompt={pickerType === 'ageGroup' ? '年龄组' : pickerType === 'level' ? '难度' : '选项'}
      addPlaceholder={
        pickerType === 'ageGroup'
          ? '如：中老年、幼儿'
          : pickerType === 'level'
            ? '如：入门级'
            : '请输入名称'
      }
      customOptions={
        pickerType === 'ageGroup'
          ? customAgeGroups.map((label) => ({ label, value: `custom:${label}` }))
          : pickerType === 'level'
            ? customLevels.map((label) => ({ label, value: `custom:${label}` }))
            : undefined
      }
      onAdd={onAddCustomOption}
      onDeleteCustom={onDeleteCustomOption}
      onClose={onClosePicker}
      onConfirm={onConfirmPicker}
    />

    <BottomSheet
      visible={colorPickerVisible}
      title="课程颜色"
      onClose={onCloseColorPicker}
      height="auto"
      scrollable={false}
    >
      <View className="px-[32rpx] pb-[48rpx] pt-[16rpx]">
        <Text className="text-[26rpx] text-muted-foreground mb-[24rpx]">
          用于在课表中区分不同课程，建议不同课程使用不同颜色。
        </Text>
        <View className="flex flex-row flex-wrap gap-[24rpx]">
          {COURSE_COLOR_OPTIONS.map((c) => (
            <View
              key={c}
              className={cn(
                'w-[80rpx] h-[80rpx] rounded-[20rpx] press-scale',
                color === c && 'ring-[4rpx] ring-offset-[4rpx] ring-primary',
              )}
              style={{ backgroundColor: c }}
              onClick={() => onSelectColor(c)}
            />
          ))}
        </View>
      </View>
    </BottomSheet>

    <BottomSheet
      visible={rolePickerVisible}
      title="允许签到角色"
      onClose={onCloseRolePicker}
      height="auto"
      scrollable={false}
    >
      <View className="px-[32rpx] pb-[48rpx]">
        <View className="flex flex-col gap-[12rpx]">
          <View className="flex flex-row items-center justify-between py-[24rpx] border-b border-border">
            <Text className="text-[30rpx] text-foreground">门店管理员</Text>
            <Text className="text-[24rpx] text-muted-foreground">始终可签</Text>
          </View>
          {CHECKIN_ROLE_OPTIONS.map((role) => {
            const checked = roleTemp.includes(role.value);
            return (
              <View
                key={role.value}
                className="flex flex-row items-center justify-between py-[24rpx] border-b border-border press-bg"
                onClick={() => onToggleRoleTemp(role.value)}
              >
                <Text className="text-[30rpx] text-foreground">{role.label}</Text>
                <View
                  className={cn(
                    'w-[40rpx] h-[40rpx] rounded-full flex items-center justify-center',
                    checked ? 'bg-warning' : 'border-[2rpx] border-muted-foreground',
                  )}
                >
                  {checked && <Icon name="mdi-check" size={24} color="white" />}
                </View>
              </View>
            );
          })}
        </View>
        <Text className="mt-[24rpx] text-[24rpx] text-muted-foreground leading-relaxed">
          未勾选的角色在该课程的签到台仅可查看，不能签到/取消签到；被关闭签到的角色代约时不会自动签到。
        </Text>
        <View
          className="mt-[32rpx] w-full py-[24rpx] rounded-full bg-primary flex items-center justify-center press-scale"
          onClick={onConfirmRolePicker}
        >
          <Text className="text-[30rpx] font-semibold text-white">确定</Text>
        </View>
      </View>
    </BottomSheet>
  </>
);

export default CourseFormSheets;
