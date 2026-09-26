import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback } from 'react';
import BottomSheet from '@/components/BottomSheet';

/**
 * MemberActionSheet - 会员操作底部弹窗
 *
 * 在会员列表页面点击悬浮"会员操作"按钮后弹出，
 * 提供新客开卡、批量延期、门店黑名单等会员相关快捷入口。
 */

export interface MemberActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onNewCard: () => void;
  /** R1：老生历史课时录入（期初入账，单个学员） */
  onImportHistory: () => void;
  /** R2：老生课时批量导入（Excel）——置于批量延期上方 */
  onBatchImport: () => void;
  onBatchExtend: () => void;
  onBlacklist: () => void;
}

interface ActionOption {
  key: 'new_card' | 'import_history' | 'batch_import' | 'batch_extend' | 'blacklist';
  label: string;
  desc: string;
}

const OPTIONS: ActionOption[] = [
  { key: 'new_card', label: '新增会员', desc: '录入新会员信息并办理会员卡' },
  { key: 'import_history', label: '录入历史课时', desc: '为老生按科目录入剩余课时并建卡' },
  { key: 'batch_import', label: '批量导入课时', desc: '用 Excel 模板批量导入老生剩余课时' },
  { key: 'batch_extend', label: '批量延期', desc: '批量管理会员卡有效期' },
  { key: 'blacklist', label: '门店黑名单', desc: '禁止指定手机号进入本门店' },
];

const MemberActionSheet: React.FC<MemberActionSheetProps> = ({
  visible,
  onClose,
  onNewCard,
  onImportHistory,
  onBatchImport,
  onBatchExtend,
  onBlacklist,
}) => {
  const handleSelect = useCallback(
    (key: ActionOption['key']) => {
      onClose();
      // 等待弹窗关闭动画后再触发跳转，避免视觉闪动
      setTimeout(() => {
        if (key === 'new_card') onNewCard();
        if (key === 'import_history') onImportHistory();
        if (key === 'batch_import') onBatchImport();
        if (key === 'batch_extend') onBatchExtend();
        if (key === 'blacklist') onBlacklist();
      }, 200);
    },
    [onClose, onNewCard, onImportHistory, onBatchImport, onBatchExtend, onBlacklist],
  );

  return (
    // 短操作列表（3 个选项 + 取消）：显式传 height="auto" 让面板贴合内容，不留空白。
    // 与 PickerSheet / RelationConfirmSheet / BindOrgSheet 等短弹框保持同一写法。
    // 注：BottomSheet 自 2026-09-25 起「不传 height」也是贴合内容（70vh 为上限），此处的显式写法仅为同类统一。
    <BottomSheet visible={visible} onClose={onClose} height="auto" scrollable={false}>
      <View className="bg-background rounded-t-[40rpx] overflow-hidden pb-[env(safe-area-inset-bottom)]">
        {/* 操作选项 */}
        <View className="bg-white px-[32rpx] rounded-t-[40rpx]">
          {OPTIONS.map((option, index) => (
            <View
              key={option.key}
              className={cn(
                'py-[28rpx] center flex-col',
                index > 0 && 'border-t border-border-light',
              )}
              onClick={() => handleSelect(option.key)}
            >
              <Text className="text-[30rpx] text-foreground font-medium">{option.label}</Text>
              <Text className="text-[24rpx] text-muted-foreground mt-[6rpx]">{option.desc}</Text>
            </View>
          ))}
        </View>
        {/* 取消按钮 */}
        <View className="mt-[16rpx] bg-white py-[28rpx] center" onClick={onClose}>
          <Text className="text-[30rpx] text-foreground font-medium">取消</Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default MemberActionSheet;
