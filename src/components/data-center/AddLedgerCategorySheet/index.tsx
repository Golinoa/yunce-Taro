/**
 * AddLedgerCategorySheet - ??????????
 *
 * ???? + ???????????/?????????
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface AddLedgerCategorySheetProps {
  visible: boolean;
  ledgerType: 'expense' | 'income';
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

const AddLedgerCategorySheet: React.FC<AddLedgerCategorySheetProps> = ({
  visible,
  ledgerType,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setSubmitting(false);
  }, [visible, ledgerType]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Taro.showToast({ title: '???????', icon: 'none' });
      return;
    }
    if (trimmed.length > 20) {
      Taro.showToast({ title: '??????20?', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : '????';
      Taro.showToast({ title: message, icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  }, [name, onClose, onSubmit]);

  return (
    <BottomSheet
      visible={visible}
      title={ledgerType === 'expense' ? '??????' : '??????'}
      onClose={onClose}
      height="auto"
      scrollable={false}
      keyboardAware
    >
      <View className="flex flex-col">
        <View className="px-[32rpx] pt-[8rpx] pb-[24rpx]">
          <Text className="mb-[12rpx] block text-[26rpx] text-muted-foreground">????</Text>
          <View className="min-h-[88rpx] rounded-[16rpx] bg-muted px-[20rpx] py-[16rpx]">
            <Input
              className="w-full text-[30rpx] text-foreground"
              placeholder="????????????"
              placeholderClass="text-muted-foreground"
              value={name}
              maxlength={20}
              focus={visible}
              adjustPosition
              onInput={(event) => setName(event.detail.value || '')}
              onConfirm={() => void handleSubmit()}
            />
          </View>
        </View>

        <View className="border-t border-border px-[32rpx] pt-[24rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))]">
          <View className="flex flex-row gap-[20rpx]">
            <View
              className="flex h-[88rpx] flex-1 items-center justify-center rounded-[20rpx] bg-muted press-scale"
              onClick={onClose}
            >
              <Text className="text-[30rpx] font-medium text-foreground">??</Text>
            </View>
            <View
              className={`flex h-[88rpx] flex-1 items-center justify-center rounded-[20rpx] press-scale ${
                submitting ? 'bg-muted' : 'bg-primary'
              }`}
              onClick={submitting ? undefined : () => void handleSubmit()}
            >
              <Text className="text-[30rpx] font-semibold text-white">
                {submitting ? '????' : '??'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
};

export default AddLedgerCategorySheet;
