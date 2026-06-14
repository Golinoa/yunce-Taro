import { View, Text, Input } from '@tarojs/components';
import cn from 'classnames';
import React, { useCallback } from 'react';

/**
 * ContactList - 动态联系人列表组件
 *
 * 对齐设计稿 .contact-list / .contact-item：
 * - 联系人卡片：bg-input, 圆角 12px(24rpx), padding 12px(24rpx), border 1px solid border
 * - 关系字段：宽 72px(144rpx), 居中, 小字号
 * - 手机号字段：flex-1
 * - 删除按钮：36px(72rpx) 圆角, 红色 ×
 * - 添加按钮：虚线边框, 圆角 10px(20rpx), min-h 44px(88rpx)
 */

export interface ContactItem {
  id: string;
  relation: string;
  phone: string;
}

export interface ContactListProps {
  contacts: ContactItem[];
  onChange: (contacts: ContactItem[]) => void;
  maxCount?: number;
  className?: string;
}

const DEFAULT_RELATIONS = ['妈妈', '爸爸', '爷爷', '奶奶', '其他'];

let nextId = 2;

const ContactList: React.FC<ContactListProps> = ({
  contacts,
  onChange,
  maxCount = 3,
  className,
}) => {
  const handleUpdate = useCallback(
    (id: string, field: 'relation' | 'phone', val: string) => {
      onChange(contacts.map((c) => (c.id === id ? { ...c, [field]: val } : c)));
    },
    [contacts, onChange],
  );

  const handleAdd = useCallback(() => {
    if (contacts.length >= maxCount) return;
    const nextRelation = DEFAULT_RELATIONS[contacts.length] || '其他';
    onChange([...contacts, { id: String(nextId++), relation: nextRelation, phone: '' }]);
  }, [contacts, maxCount, onChange]);

  const handleRemove = useCallback(
    (id: string) => {
      onChange(contacts.filter((c) => c.id !== id));
    },
    [contacts, onChange],
  );

  return (
    <View className={cn('flex flex-col gap-[20rpx]', className)}>
      {contacts.map((contact, index) => (
        <View key={contact.id} className="contact-card">
          <View className="flex flex-row items-center gap-[16rpx]">
            {/* 关系输入（对齐设计稿 .relation-field: flex 0 0 72px） */}
            <View className="w-[144rpx] flex-shrink-0 py-[18rpx] px-[12rpx] rounded-xl border-[2rpx] border-solid border-border bg-white">
              <Input
                className="w-full text-sm text-foreground text-center h-[40rpx] leading-[40rpx]"
                placeholder="关系"
                placeholderClass="input-placeholder"
                value={contact.relation}
                onInput={(e) => handleUpdate(contact.id, 'relation', e.detail.value || '')}
              />
            </View>
            {/* 手机号输入 */}
            <View className="flex-1 py-[18rpx] px-[20rpx] rounded-xl border-[2rpx] border-solid border-border bg-white">
              <Input
                className="w-full text-sm text-foreground h-[40rpx] leading-[40rpx]"
                placeholder="手机号码"
                placeholderClass="input-placeholder"
                type="number"
                maxlength={11}
                value={contact.phone}
                onInput={(e) => handleUpdate(contact.id, 'phone', e.detail.value || '')}
              />
            </View>
            {/* 删除按钮（仅第二条及以后显示） */}
            {index > 0 && (
              <View
                className="w-[72rpx] h-[72rpx] flex items-center justify-center rounded-lg flex-shrink-0"
                onClick={() => handleRemove(contact.id)}
              >
                <Text className="text-lg text-destructive leading-none">×</Text>
              </View>
            )}
          </View>
        </View>
      ))}

      {/* 添加按钮（对齐设计稿 .add-contact-btn） */}
      {contacts.length < maxCount && (
        <View
          className="flex flex-row items-center justify-center gap-[12rpx] py-[20rpx] border-[3rpx] border-dashed border-border rounded-[20rpx]"
          onClick={handleAdd}
        >
          <View className="w-[36rpx] h-[36rpx] rounded-full bg-primary-bg flex items-center justify-center">
            <Text className="text-xs text-primary font-semibold leading-none">+</Text>
          </View>
          <Text className="text-xs text-muted-foreground font-medium">添加联系人</Text>
        </View>
      )}
    </View>
  );
};

export default ContactList;
