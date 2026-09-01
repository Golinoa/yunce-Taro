/**
 * ApplyTeacherSheet - 套用薪资模板到教练：多选教练底部弹窗
 *
 * 使用场景：薪资模板列表页，点击「套用到教练」时弹出，让用户选择哪些教练使用该模板
 * 功能：
 *  - 顶部提示：模板名 + "将覆盖所选教练现有的工资配置"
 *  - 搜索框
 *  - 全选 / 已选计数
 *  - 教练列表（圆形头像 + 姓名 + 多选圆圈）
 *  - 取消 / 确定
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Avatar from '@/components/Avatar';
import BottomSheet from '@/components/BottomSheet';
import Icon from '@/components/Icon';
import { useTeacherStore } from '@/stores/teacher';

export interface ApplyTeacherSheetProps {
  visible: boolean;
  /** 要套用的模板名，用于顶部提示 */
  templateName: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 确定回调，返回选中的教师 id 数组 */
  onConfirm: (teacherIds: string[]) => void;
}

const ApplyTeacherSheet: React.FC<ApplyTeacherSheetProps> = ({
  visible,
  templateName,
  onClose,
  onConfirm,
}) => {
  const { teachers } = useTeacherStore();
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setKeyword('');
    }
  }, [visible]);

  /** 可选择的教练：仅在职 */
  const activeTeachers = useMemo(() => teachers.filter((t) => t.status === 'active'), [teachers]);

  const filtered = useMemo(() => {
    if (!keyword.trim()) return activeTeachers;
    const kw = keyword.trim();
    return activeTeachers.filter((t) => t.name.includes(kw) || (t.subject || '').includes(kw));
  }, [activeTeachers, keyword]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selectedIds.includes(t.id));

  const handleToggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      // 取消全选：从 selectedIds 中移除当前 filtered 的所有 id
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((t) => t.id === id)));
    } else {
      // 全选：合并当前 filtered 的所有 id
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((t) => t.id)])));
    }
  }, [allSelected, filtered]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请至少选择一位教练', icon: 'none' });
      return;
    }
    onConfirm([...selectedIds]);
  }, [selectedIds, onConfirm]);

  return (
    <BottomSheet visible={visible} height="70vh" onClose={onClose}>
      {/* 顶部按钮栏 */}
      <View className="flex items-center justify-between px-[40rpx] pt-[8rpx] pb-[20rpx]">
        <Text
          className="text-[28rpx] text-muted-foreground press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
          onClick={onClose}
        >
          取消
        </Text>
        <Text className="text-[30rpx] font-semibold text-foreground">套用到教练</Text>
        <Text
          className={
            'text-[28rpx] font-medium press-bg px-[12rpx] py-[6rpx] rounded-[12rpx] ' +
            (selectedIds.length > 0 ? 'text-primary' : 'text-muted-foreground')
          }
          onClick={handleConfirm}
        >
          确定
        </Text>
      </View>

      {/* 提示 */}
      <View className="px-[40rpx] mb-[20rpx]">
        <Text className="text-[26rpx] text-muted-foreground leading-relaxed">
          模板「{templateName}」将覆盖所选教练现有的工资配置。
        </Text>
      </View>

      {/* 搜索 */}
      <View className="px-[40rpx] mb-[20rpx]">
        <View className="flex items-center gap-[12rpx] px-[24rpx] py-[16rpx] rounded-[24rpx] bg-muted">
          <Icon name="mdi-magnify" size={20} className="text-muted-foreground" />
          <Text className="text-[26rpx] text-muted-foreground flex-1">搜索教练姓名</Text>
        </View>
      </View>

      {/* 全选 & 已选数 */}
      <View className="flex items-center justify-between px-[40rpx] mb-[16rpx]">
        <Text
          className="text-[28rpx] font-medium text-primary press-bg px-[12rpx] py-[6rpx] rounded-[12rpx]"
          onClick={handleToggleAll}
        >
          {allSelected ? '取消全选' : '全选'}
        </Text>
        <Text className="text-[26rpx] text-muted-foreground">已选 {selectedIds.length} 位</Text>
      </View>

      {/* 教练列表 */}
      <ScrollView scrollY className="max-h-[44vh] px-[24rpx] pb-[40rpx]">
        {filtered.length === 0 ? (
          <View className="py-[120rpx] flex items-center justify-center">
            <Text className="text-[26rpx] text-muted-foreground">没有可选的教练</Text>
          </View>
        ) : (
          filtered.map((t) => {
            const checked = selectedIds.includes(t.id);
            return (
              <View
                key={t.id}
                className="flex items-center px-[16rpx] py-[20rpx] press-bg rounded-[20rpx]"
                onClick={() => handleToggleOne(t.id)}
              >
                <Avatar name={t.name} avatarUrl={t.avatar} size="sm" />
                <View className="flex-1 ml-[16rpx]">
                  <Text className="text-[30rpx] font-medium text-foreground">{t.name}</Text>
                </View>
                {/* 选圈 */}
                <View
                  className={
                    'w-[44rpx] h-[44rpx] rounded-full border-[3rpx] flex items-center justify-center ' +
                    (checked ? 'bg-primary border-primary' : 'border-foreground/30 bg-white')
                  }
                >
                  {checked && <Icon name="mdi-check" size={22} color="#fff" />}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
};

export default ApplyTeacherSheet;
