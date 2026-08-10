/**
 * SaveTemplateDialog - 把当前薪资配置另存为模板
 *
 * 使用场景：员工工资设置页点击"另存为模板"
 * 功能：
 *  - 居中 Dialog
 *  - 图标 + 标题 + 说明的信息层级
 *  - 模板名称输入框（带字数提示）
 */
import { View, Text } from '@tarojs/components';
import React, { useEffect, useState } from 'react';
import Dialog from '@/components/Dialog';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';

export interface SaveTemplateDialogProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

const MAX_LENGTH = 30;

const SaveTemplateDialog: React.FC<SaveTemplateDialogProps> = ({ visible, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setError('');
    }
  }, [visible]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请填写模板名称');
      return;
    }
    onSave(trimmed);
  };

  return (
    <Dialog visible={visible} onClose={onClose} maskClosable={false}>
      <View className="w-[640rpx] max-w-[90vw] rounded-[28rpx] bg-white overflow-hidden">
        {/* 顶部图标 */}
        <View className="flex justify-center pt-[40rpx] pb-[16rpx]">
          <View className="w-[100rpx] h-[100rpx] rounded-[32rpx] bg-gradient-primary-soft flex items-center justify-center shadow-card">
            <Icon name="mdi-content-copy" size={40} className="text-primary" />
          </View>
        </View>

        {/* 标题与说明 */}
        <View className="px-[40rpx] text-center mb-[28rpx]">
          <Text className="text-[34rpx] font-semibold text-foreground">另存为薪资模板</Text>
          <Text className="text-[26rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
            将当前页面上的工资配置保存为模板，后续给新员工或调整时一键套用。
          </Text>
        </View>

        {/* 输入区 */}
        <View className="px-[40rpx] pb-[16rpx]">
          <Text className="text-[26rpx] font-medium text-foreground mb-[12rpx]">模板名称</Text>
          <FormInput
            placeholder="例如：全职教练标准档"
            value={name}
            onInput={(e) => {
              setName(e.detail.value);
              if (error) setError('');
            }}
            error={error}
            maxlength={MAX_LENGTH}
          />
          <View className="flex justify-end mt-[8rpx]">
            <Text
              className={`text-[22rpx] ${name.length > MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {name.length}/{MAX_LENGTH}
            </Text>
          </View>
        </View>

        {/* 底部按钮 */}
        <View className="flex items-center gap-[20rpx] px-[40rpx] py-[32rpx]">
          <View
            className="flex-1 py-[24rpx] rounded-full bg-muted flex items-center justify-center active:opacity-70"
            onClick={onClose}
          >
            <Text className="text-[30rpx] font-medium text-foreground">取消</Text>
          </View>
          <View
            className="flex-1 py-[24rpx] rounded-full bg-primary flex items-center justify-center active:opacity-70 shadow-float"
            onClick={handleSave}
          >
            <Text className="text-[30rpx] font-semibold text-white">保存</Text>
          </View>
        </View>
      </View>
    </Dialog>
  );
};

export default SaveTemplateDialog;
