import React, { useMemo } from 'react';
import PickerSheet from '@/components/PickerSheet';

/**
 * PackageSelectSheet - 会员卡选择底部弹窗
 *
 * 在代约页面点击「会员卡」行时弹出，使用滚轮选择器列出某会员的有效卡包。
 * 选项展示格式：卡包名称 | 余 N 次
 */

export interface PackageOption {
  id: string;
  name: string;
  remainingHours: number;
  /** 课包所属科目 ID，用于自动匹配课程科目 */
  subjectId?: string;
}

export interface PackageSelectSheetProps {
  visible: boolean;
  memberName?: string;
  options: PackageOption[];
  selectedId?: string;
  onClose: () => void;
  onConfirm: (pkg: PackageOption) => void;
}

const PackageSelectSheet: React.FC<PackageSelectSheetProps> = ({
  visible,
  memberName,
  options,
  selectedId,
  onClose,
  onConfirm,
}) => {
  const pickerOptions = useMemo(
    () =>
      options.map((item) => ({
        label: `${item.name} | 余${item.remainingHours}次`,
        value: item.id,
      })),
    [options],
  );

  const handleConfirm = (value: string) => {
    const selected = options.find((item) => item.id === value);
    if (selected) {
      onConfirm(selected);
    }
  };

  return (
    <PickerSheet
      visible={visible}
      title={memberName ? `${memberName}的会员卡` : '选择会员卡'}
      options={pickerOptions}
      value={selectedId}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
};

export default PackageSelectSheet;
