/**
 * AddTodoCategorySheet - 我的待办新增分类（居中独立弹框）
 *
 * 使用场景：分类 Tab 旁加号；输入名称后写入本地分类列表。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useState } from 'react';
import FormInput from '@/components/FormInput';
import Modal from '@/components/Modal';

export interface AddTodoCategorySheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
}

const AddTodoCategorySheet: React.FC<AddTodoCategorySheetProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setSubmitting(false);
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Taro.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [name, onClose, onSubmit]);

  return (
    <Modal visible={visible} title="新增分类" onClose={onClose}>
      <View className="px-[32rpx] pt-[24rpx] pb-[40rpx]">
        <FormInput
          label="分类名称"
          placeholder="例如：工作、学习计划"
          value={name}
          maxlength={20}
          onInput={(event) => setName(event.detail.value || '')}
        />
        <View className="mt-[32rpx] flex flex-row gap-[20rpx]">
          <View
            className="flex h-[88rpx] flex-1 items-center justify-center rounded-[20rpx] bg-muted press-scale"
            onClick={onClose}
          >
            <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
          </View>
          <View
            className="flex h-[88rpx] flex-1 items-center justify-center rounded-[20rpx] bg-primary press-scale"
            onClick={() => void handleSubmit()}
          >
            <Text className="text-[30rpx] font-semibold text-white">
              {submitting ? '保存中…' : '保存'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AddTodoCategorySheet;
