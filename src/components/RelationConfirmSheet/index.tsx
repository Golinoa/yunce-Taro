/**
 * RelationConfirmSheet - 关系确认弹窗（R11）
 *
 * 使用场景：绑定机构/分享归属完成后进入首页时，询问「您与 xx 的关系」。
 * 选项：本人 / 子女·爸爸 / 子女·妈妈；选择后保存 relation（self/father/mother），
 * 持久化后不再重复弹；支持「暂不选择」（dismiss，本地记录当天不弹）。
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { organizationService, type StudentParentRelation } from '@/services/organization';

export interface RelationConfirmSheetProps {
  visible: boolean;
  /** 学员姓名（「您将绑定 xx 的会员信息」） */
  studentName: string;
  /** 待确认关系的 StudentParent ID（保存 relation 的目标） */
  studentParentId: string;
  /** 关闭（含暂不选择） */
  onClose: () => void;
  /** 关系保存成功回调（relation 已持久化） */
  onConfirmed: (relation: StudentParentRelation) => void;
}

interface RelationOption {
  value: StudentParentRelation;
  label: string;
  desc: string;
  icon: string;
}

const RELATION_OPTIONS: RelationOption[] = [
  { value: 'self', label: '本人', desc: '我就是这个学员', icon: 'mdi-account' },
  { value: 'father', label: '爸爸', desc: '我是学员的父亲', icon: 'mdi-account-child' },
  { value: 'mother', label: '妈妈', desc: '我是学员的母亲', icon: 'mdi-account-child' },
];

const RelationConfirmSheet: React.FC<RelationConfirmSheetProps> = ({
  visible,
  studentName,
  studentParentId,
  onClose,
  onConfirmed,
}) => {
  const [saving, setSaving] = useState(false);

  const handleSelect = useCallback(
    async (relation: StudentParentRelation) => {
      if (saving) return;
      setSaving(true);
      try {
        await organizationService.saveRelation(studentParentId, relation);
        Taro.showToast({ title: '关系已保存', icon: 'success' });
        onConfirmed(relation);
      } catch {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      } finally {
        setSaving(false);
      }
    },
    [onConfirmed, saving, studentParentId],
  );

  return (
    <BottomSheet
      visible={visible}
      title="确认关系"
      onClose={onClose}
      height="auto"
      scrollable={false}
    >
      <View className="px-[40rpx] pb-[calc(40rpx+env(safe-area-inset-bottom))]">
        <View className="bg-primary/10 rounded-[20rpx] px-[24rpx] py-[24rpx] mb-[28rpx]">
          <Text className="text-[28rpx] leading-[1.6] text-foreground">
            您将绑定 <Text className="text-primary font-semibold">{studentName || '学员'}</Text>{' '}
            的会员信息
          </Text>
        </View>
        <Text className="text-[26rpx] text-muted-foreground block mb-[20rpx]">
          请选择您与 ta 的关系
        </Text>

        <View className="space-y-[20rpx]">
          {RELATION_OPTIONS.map((opt) => (
            <View
              key={opt.value}
              className="flex items-center rounded-[24rpx] bg-background border-2 border-border px-[28rpx] py-[24rpx] active:opacity-80"
              onClick={() => {
                void handleSelect(opt.value);
              }}
            >
              <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary/10 flex items-center justify-center mr-[20rpx]">
                <Icon name={opt.icon} size={36} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="text-[30rpx] font-semibold text-foreground block">
                  {opt.label}
                </Text>
                <Text className="text-[24rpx] text-muted-foreground block mt-[4rpx]">
                  {opt.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="mt-[32rpx] py-[24rpx] flex items-center justify-center" onClick={onClose}>
          <Text className="text-[26rpx] text-muted-foreground">
            {saving ? '保存中...' : '暂不选择，稍后设置'}
          </Text>
        </View>
      </View>
    </BottomSheet>
  );
};

export default RelationConfirmSheet;
