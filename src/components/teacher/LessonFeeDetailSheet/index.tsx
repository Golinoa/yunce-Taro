/**
 * LessonFeeDetailSheet - 课时费核对明细弹窗
 *
 * 使用场景：调整工资页点击「团课/私教/班课课时费」后展示该分类的课时明细。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';
import type { LessonFeeRecord } from '@/types/teacher';

interface LessonFeeDetailSheetProps {
  visible: boolean;
  categoryName: string;
  records: LessonFeeRecord[];
  onClose: () => void;
}

const LessonFeeDetailSheet: React.FC<LessonFeeDetailSheetProps> = ({
  visible,
  categoryName,
  records,
  onClose,
}) => {
  const hasRecords = records.length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70vh">
      {/* 自定义标题栏：标题居左 + 关闭按钮居右 */}
      <View className="flex items-center justify-between px-[32rpx] pt-[28rpx] pb-[12rpx] bg-white">
        <Text className="text-[32rpx] font-semibold text-foreground">{categoryName}核对明细</Text>
        <Text className="text-[28rpx] text-muted-foreground press-scale" onClick={onClose}>
          关闭
        </Text>
      </View>

      <ScrollView
        scrollY
        className="bg-white px-[32rpx] pb-[48rpx]"
        style={{ height: 'calc(70vh - 120rpx)' }}
      >
        {hasRecords ? (
          <View className="flex flex-col">
            {records.map((rec, idx) => (
              <View
                key={idx}
                className="flex items-center justify-between py-[24rpx] border-b border-border/30 last:border-b-0"
              >
                <View className="flex flex-col gap-[8rpx]">
                  <Text className="text-[26rpx] text-foreground">{rec.courseName}</Text>
                  <Text className="text-[24rpx] text-muted-foreground">
                    {rec.date} · {rec.hours}课时
                  </Text>
                </View>
                <Text className="text-[28rpx] font-semibold text-foreground">
                  +{rec.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex items-center justify-center py-[120rpx]">
            <Text className="text-[28rpx] text-muted-foreground">本月暂无{categoryName}明细</Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

export default LessonFeeDetailSheet;
