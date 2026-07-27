import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React from 'react';
import Icon from '@/components/Icon';
import type { Class } from '@/types/class';
import { CLASS_ICONS, CLASS_GRADIENT } from './constants';

interface TransferSheetProps {
  show: boolean;
  studentName: string;
  currentClassId: string;
  allClasses: Class[];
  submitting?: boolean;
  onConfirm: (targetClassId: string) => void;
  onClose: () => void;
}

const TransferSheet: React.FC<TransferSheetProps> = ({
  show,
  studentName,
  currentClassId,
  allClasses,
  submitting = false,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <View className="fixed inset-0 z-100 flex items-end">
      <View className="absolute inset-0 bg-black/40" onClick={submitting ? undefined : onClose} />
      <View className="relative w-full bg-white rounded-t-32rpx max-h-60vh flex flex-col">
        {/* 拖拽条 */}
        <View className="flex justify-center pt-2 pb-0">
          <View className="w-9 h-1 rounded-full bg-gray-200" />
        </View>
        {/* 头部 */}
        <View className="px-5 pt-3 pb-3 border-b-d5e8e0">
          <View className="flex items-center justify-between">
            <Text className="text-base font-semibold text-foreground">调班</Text>
            <View
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              onClick={submitting ? undefined : onClose}
            >
              <Text className="text-xs text-muted-foreground">✕</Text>
            </View>
          </View>
          <Text className="text-sm text-muted-foreground mt-1">将「{studentName}」调至</Text>
        </View>
        {/* 班级列表 */}
        <ScrollView scrollY className="flex-1">
          <View className="px-5 py-2">
            {allClasses.map((cls) => {
              const isCurrent = cls.id === currentClassId;
              const isDisabled = cls.status === 'ended';
              const disabled = isCurrent || isDisabled || submitting;

              return (
                <View
                  key={cls.id}
                  className={`flex items-center gap-3 py-3 transition border-b-e8e8e8 ${disabled ? 'state-disabled' : 'press-bg'}`}
                  onClick={
                    disabled
                      ? undefined
                      : () => {
                          const targetClass = allClasses.find((c) => c.id === cls.id);
                          Taro.showModal({
                            title: '确认调班',
                            content: `将「${studentName}」调至「${targetClass?.name || ''}」？`,
                            confirmText: '确认调班',
                            success: (res) => {
                              if (res.confirm && !submitting) onConfirm(cls.id);
                            },
                          });
                        }
                  }
                >
                  <View
                    className={`w-9 h-9 rounded-xl ${CLASS_GRADIENT[cls.color]} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon name={CLASS_ICONS[cls.icon || 'piano']} size={18} color="white" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-medium text-foreground">{cls.name}</Text>
                    <Text className="text-sm text-muted-foreground mt-0_d5">
                      {cls.schedule} · {cls.student_count}人
                    </Text>
                  </View>
                  {isCurrent ? (
                    <View className="tag">当前班级</View>
                  ) : isDisabled ? (
                    <View className="tag-purple">已结课</View>
                  ) : cls.type === 'unlimited' ? (
                    <View className="tag-primary">循环</View>
                  ) : (
                    <View className="tag-amber">课时制</View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default TransferSheet;
