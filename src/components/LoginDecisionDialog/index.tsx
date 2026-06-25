import { View, Text } from '@tarojs/components';
import cn from 'classnames';
import React from 'react';

/**
 * LoginDecisionDialog - 登录决策对话框
 *
 * 使用场景：登录流程中需要用户做出选择时展示（如：账号不存在时选择注册或找回账号）。
 * 功能说明：模态对话框，展示标题、描述和两个操作按钮（主要/次要），点击遮罩或关闭按钮关闭。
 *
 * 使用方式：
 *   <LoginDecisionDialog
 *     visible={visible}
 *     title="账号不存在"
 *     description="该账号尚未注册"
 *     primaryText="立即注册"
 *     secondaryText="找回账号"
 *     onPrimary={handleRegister}
 *     onSecondary={handleFindAccount}
 *     onClose={handleClose}
 *   />
 */

export interface LoginDecisionDialogProps {
  /** 是否显示 */
  visible: boolean;
  /** 标题 */
  title: string;
  /** 描述文本 */
  description: string;
  /** 主要按钮文本 */
  primaryText: string;
  /** 次要按钮文本（可选，为空时不展示） */
  secondaryText?: string;
  /** 主要按钮点击回调 */
  onPrimary?: () => void;
  /** 次要按钮点击回调 */
  onSecondary?: () => void;
  /** 关闭回调（遮罩点击） */
  onClose?: () => void;
}

const LoginDecisionDialog: React.FC<LoginDecisionDialogProps> = ({
  visible,
  title,
  description,
  primaryText,
  secondaryText,
  onPrimary,
  onSecondary,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <View className="fixed inset-0 z-200 flex items-center justify-center">
      {/* 遮罩 */}
      <View className="absolute inset-0 bg-black/45" onClick={onClose} />

      {/* 对话框内容 */}
      <View className="relative mx-[60rpx] w-[600rpx] rounded-[24rpx] bg-white overflow-hidden shadow-elegant">
        {/* 标题 */}
        <View className="px-[40rpx] pt-[48rpx] pb-[16rpx]">
          <Text className="text-[34rpx] font-semibold text-foreground text-center block">
            {title}
          </Text>
        </View>

        {/* 描述 */}
        <View className="px-[40rpx] pb-[40rpx]">
          <Text className="text-[28rpx] text-muted-foreground text-center block leading-[1.6]">
            {description}
          </Text>
        </View>

        {/* 按钮区 */}
        <View className="flex border-t-[2rpx] border-solid border-border-light">
          {secondaryText ? (
            <View
              className={cn(
                'flex-1 py-[28rpx] flex items-center justify-center',
                'border-r-[2rpx] border-solid border-border-light',
                'active:bg-muted/30',
              )}
              onClick={onSecondary}
            >
              <Text className="text-[30rpx] text-muted-foreground font-medium">
                {secondaryText}
              </Text>
            </View>
          ) : null}
          <View
            className={cn(
              'flex-1 py-[28rpx] flex items-center justify-center',
              'active:bg-primary/10',
            )}
            onClick={onPrimary}
          >
            <Text className="text-[30rpx] text-primary font-semibold">
              {primaryText}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LoginDecisionDialog;
