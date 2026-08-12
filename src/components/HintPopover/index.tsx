/**
 * HintPopover - 问号气泡提示组件
 *
 * 点击问号图标，在图标下方弹出气泡提示框，展示说明文案。
 * 符合设计原则：提示就近显示，不打断用户操作流。
 *
 * 图标设计：实心主题色圆形 + 白色粗问号，尺寸 32rpx，清晰明显。
 * 气泡风格：白色卡片 + 主题蓝阴影 + 小三角，与系统设计语言一致。
 * 气泡定位：以问号图标为锚点，通过 id 选择器测量位置，自动检测边界防止超出屏幕。
 *
 * 使用方式：
 *   <HintPopover content="该课程的单次约课收费价格..." />
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useRef, useState } from 'react';

/** 气泡唯一 id 计数器 */
let instanceCounter = 0;

export interface HintPopoverProps {
  /** 提示内容 */
  content: string;
  /** 额外类名 */
  className?: string;
  /** 图标外层自定义类名 */
  iconClassName?: string;
  /** 图标文字自定义类名 */
  textClassName?: string;
}

/** 气泡水平对齐方式 */
type Align = 'left' | 'center' | 'right';

const HintPopover: React.FC<HintPopoverProps> = ({
  content,
  className,
  iconClassName,
  textClassName,
}) => {
  const [visible, setVisible] = useState(false);
  const [align, setAlign] = useState<Align>('left');
  const uidRef = useRef<number>(++instanceCounter);
  const iconId = `hint-popover-icon-${uidRef.current}`;

  /** 检测图标位置，决定气泡对齐方向防止超出屏幕 */
  const handleToggle = useCallback(
    (e: any) => {
      e.stopPropagation();

      // 已显示时直接关闭
      if (visible) {
        setVisible(false);
        return;
      }

      Taro.nextTick(() => {
        Taro.createSelectorQuery()
          .select(`#${iconId}`)
          .boundingClientRect((rect: any) => {
            if (!rect || typeof rect.left !== 'number') {
              setAlign('left');
              setVisible(true);
              return;
            }

            const screenWidth = Taro.getWindowInfo().windowWidth;
            const iconCenterX = rect.left + rect.width / 2;
            // 气泡宽度 480rpx ≈ 240px
            const BUBBLE_HALF_WIDTH = 120;

            if (iconCenterX < BUBBLE_HALF_WIDTH) {
              // 图标靠近左侧，左对齐
              setAlign('left');
            } else if (screenWidth - iconCenterX < BUBBLE_HALF_WIDTH) {
              // 图标靠近右侧，右对齐
              setAlign('right');
            } else {
              // 居中
              setAlign('center');
            }

            setVisible(true);
          })
          .exec();
      });
    },
    [visible, iconId],
  );

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <View className={cn('relative inline-flex items-center', className)}>
      {/* 问号图标 - 灰色圆形外边框 + 透明背景 + 灰色问号（边框与问号粗细协调） */}
      <View
        id={iconId}
        className={cn(
          'w-[30rpx] h-[30rpx] rounded-full border-[2rpx] border-solid border-muted-foreground bg-transparent flex items-center justify-center ml-[8rpx] press-scale',
          iconClassName,
        )}
        onClick={handleToggle}
      >
        <Text
          className={cn(
            'text-[20rpx] leading-none text-muted-foreground font-semibold',
            textClassName,
          )}
        >
          ?
        </Text>
      </View>

      {/* 遮罩层 - 点击关闭气泡 */}
      {visible && <View className="fixed inset-0 z-150" onClick={handleClose} catchMove />}

      {/* 气泡提示框 */}
      {visible && (
        <View
          className={cn('absolute top-[44rpx] z-200 popover-in', {
            'left-0': align === 'left',
            'left-1/2 -translate-x-1/2': align === 'center',
            'right-0': align === 'right',
          })}
        >
          {/* 气泡小三角 - 白色 */}
          <View
            className={cn('absolute top-0 -translate-y-full', {
              'left-[12rpx]': align === 'left',
              'left-1/2 -translate-x-1/2': align === 'center',
              'right-[12rpx]': align === 'right',
            })}
          >
            <View
              className="w-0 h-0"
              style={{
                borderLeft: '10rpx solid transparent',
                borderRight: '10rpx solid transparent',
                borderBottom: '10rpx solid #fff',
              }}
            />
          </View>

          {/* 气泡内容 - 白色卡片风格，固定宽度防止文字竖向异常排列 */}
          <View
            className="rounded-[16rpx] bg-white px-[24rpx] py-[20rpx] shadow-popup border-[1rpx] border-primary/10"
            style={{ width: '480rpx' }}
          >
            <Text
              className="text-[26rpx] text-foreground leading-[40rpx]"
              style={{ whiteSpace: 'normal', wordBreak: 'break-all' }}
            >
              {content}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default HintPopover;
