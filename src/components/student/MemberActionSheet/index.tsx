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
  onBatchExtend: () => void;
  onBlacklist: () => void;
}

interface ActionOption {
  key: 'new_card' | 'batch_extend' | 'blacklist';
  label: string;
  desc: string;
}

const OPTIONS: ActionOption[] = [
  { key: 'new_card', label: '新增会员', desc: '录入新会员信息并办理会员卡' },
  { key: 'batch_extend', label: '批量延期', desc: '批量管理会员卡有效期' },
  { key: 'blacklist', label: '门店黑名单', desc: '禁止指定手机号进入本门店' },
];

const MemberActionSheet: React.FC<MemberActionSheetProps> = ({
  visible,
  onClose,
  onNewCard,
  onBatchExtend,
  onBlacklist,
}) => {
  const handleSelect = useCallback(
    (key: ActionOption['key']) => {
      onClose();
      // 等待弹窗关闭动画后再触发跳转，避免视觉闪动
      setTimeout(() => {
        if (key === 'new_card') onNewCard();
        if (key === 'batch_extend') onBatchExtend();
        if (key === 'blacklist') onBlacklist();
      }, 200);
    },
    [onClose, onNewCard, onBatchExtend, onBlacklist],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable={false}>
      <View
        className="bg-background rounded-t-[40rpx] overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
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
