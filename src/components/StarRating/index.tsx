import { View, Text } from '@tarojs/components';
import React, { useCallback } from 'react';

interface StarRatingProps {
  value: number;
  count?: number;
  onChange?: (value: number) => void;
}

/**
 * StarRating - 星级评分组件
 * 支持半星（0.5步进），Q版大图标
 *
 * 实现方式：每颗星由灰色底星 + 彩色覆盖星组成，
 * 通过控制覆盖星的宽度实现半星效果
 */
const StarRating: React.FC<StarRatingProps> = ({ value, count = 5, onChange }) => {
  const handleClick = useCallback(
    (star: number, isHalf: boolean) => {
      const newVal = isHalf ? star - 0.5 : star;
      onChange?.(newVal === value ? 0 : newVal);
    },
    [value, onChange],
  );

  return (
    <View className="flex items-center gap-3">
      {Array.from({ length: count }, (_, i) => i + 1).map((star) => {
        const isFull = value >= star;
        const isHalf = !isFull && value >= star - 0.5;
        // 覆盖宽度百分比：full=100%, half=50%, empty=0%
        const fillPercent = isFull ? 100 : isHalf ? 50 : 0;

        return (
          <View key={star} className="relative" style={{ width: '56rpx', height: '56rpx' }}>
            {/* 灰色底星 */}
            <Text
              style={{
                fontSize: '56rpx',
                lineHeight: '56rpx',
                color: '#D1D5DB',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              ★
            </Text>
            {/* 彩色覆盖星（通过 overflow:hidden + 宽度裁剪） */}
            <View
              style={{
                width: `${fillPercent}%`,
                height: '56rpx',
                overflow: 'hidden',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <Text
                style={{
                  fontSize: '56rpx',
                  lineHeight: '56rpx',
                  color: '#F59E0B',
                }}
              >
                ★
              </Text>
            </View>
            {/* 左半星点击区 */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '50%',
                height: '56rpx',
                zIndex: 1,
              }}
              onClick={() => handleClick(star, true)}
            />
            {/* 右半星点击区 */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '50%',
                height: '56rpx',
                zIndex: 1,
              }}
              onClick={() => handleClick(star, false)}
            />
          </View>
        );
      })}
    </View>
  );
};

export default StarRating;
