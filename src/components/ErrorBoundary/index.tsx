/**
 * 全局错误边界（B-01 工程化质量债）
 *
 * 使用场景：包裹 App 根节点，捕获子组件渲染 / 生命周期中的未捕获错误，避免页面白屏。
 * 功能说明：渲染错误时展示降级 UI（含错误信息 + 点击重试），并通过 logError 记录日志。
 * 注意：React 错误边界必须是类组件（官方约束），与 AGENTS.md「页面禁类组件」不冲突。
 */
import { Text, View } from '@tarojs/components';
import React from 'react';
import { logError } from '@/utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message || '未知错误' };
  }

  state: ErrorBoundaryState = { hasError: false, message: '' };

  componentDidCatch(error: Error) {
    logError('ErrorBoundary', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View className="min-h-screen flex flex-col items-center justify-center px-[64rpx] bg-bg">
          <Text className="text-[34rpx] font-semibold text-foreground">页面出错了</Text>
          <Text className="mt-[16rpx] text-[26rpx] text-muted-foreground text-center">
            {this.state.message}
          </Text>
          <View
            className="mt-[48rpx] px-[64rpx] py-[20rpx] bg-primary text-primary-foreground rounded-full"
            onClick={this.handleReset}
          >
            <Text className="text-[28rpx]">点击重试</Text>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}
