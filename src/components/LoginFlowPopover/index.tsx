/**
 * LoginFlowPopover - 登录流程就近输入浮层
 *
 * 使用场景：
 * - 登录页中点击账户/邮箱输入框后，在输入框上方弹出轻量输入卡片
 * - 仅负责收集当前步骤输入值，不承载最终提交动作
 */
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';

interface SourceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LoginFlowPopoverProps {
  visible: boolean;
  title: string;
  placeholder: string;
  value: string;
  summaryText: string;
  submitText: string;
  password?: boolean;
  type?: 'text' | 'number';
  hint?: string;
  sourceRect?: SourceRect;
  buttonRect?: SourceRect;
  onChange: (value: string) => void;
  onOpen: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

const LoginFlowPopover: React.FC<LoginFlowPopoverProps> = ({
  visible,
  title,
  placeholder,
  value,
  summaryText,
  submitText,
  password = false,
  type = 'text',
  hint,
  sourceRect,
  buttonRect,
  onChange,
  onOpen,
  onSubmit,
  onClose,
}) => {
  const [closePhase, setClosePhase] = useState<'hidden' | 'closing-fade' | 'closing-collapse'>('hidden');
  const [inputReady, setInputReady] = useState(false);
  const closeFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputReadyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasOpenedRef = useRef(false);
  // 使用新版 getWindowInfo 替代已弃用的 getSystemInfoSync
  const windowInfo = useMemo(() => Taro.getWindowInfo(), []);
  const windowHeight = windowInfo.windowHeight || 667;
  const windowWidth = windowInfo.windowWidth || 375;
  const HEADER_TOP = 44;
  const PANEL_MOVE_DISTANCE = 108;
  const PANEL_TOP_GAP = 120;
  const OPEN_PANEL_MS = 240;
  const OPEN_FADE_MS = 160;
  const CLOSE_FADE_MS = 100;
  const CLOSE_COLLAPSE_MS = 180;
  const EXPANDED_INPUT_OFFSET = -20;
  const EXPANDED_BUTTON_OFFSET = -12;

  const fallbackRect = useMemo<SourceRect>(
    () => ({
      left: 24,
      top: Math.round(windowHeight * 0.56),
      width: Math.max(windowWidth - 48, 280),
      height: 48,
    }),
    [windowHeight, windowWidth],
  );

  const activeRect = sourceRect || fallbackRect;
  const fallbackButtonRect = {
    left: activeRect.left,
    top: activeRect.top + activeRect.height + 16,
    width: activeRect.width,
    height: 52,
  };
  const activeButtonRect = buttonRect || fallbackButtonRect;
  const hiddenPanelTop = Math.max(72, activeRect.top - PANEL_TOP_GAP);
  const visiblePanelTop = Math.max(16, hiddenPanelTop - PANEL_MOVE_DISTANCE);
  // 实际面板位移（处理 visiblePanelTop 被 Math.max 截断的边界情况）
  const panelMoveDistance = hiddenPanelTop - visiblePanelTop;
  const inputTop = activeRect.top - hiddenPanelTop;
  const buttonTop = activeButtonRect.top - hiddenPanelTop;
  const isClosingFade = closePhase === 'closing-fade';
  const isClosingCollapse = closePhase === 'closing-collapse';
  const panelExpanded = visible || isClosingFade;
  const overlayActive = visible || isClosingFade || isClosingCollapse;
  const panelSurfaceVisible = visible;
  const controlsHighlighted = visible || isClosingFade || isClosingCollapse;
  const inputOffset = controlsHighlighted ? EXPANDED_INPUT_OFFSET : 0;
  const buttonOffset = controlsHighlighted ? EXPANDED_BUTTON_OFFSET : 0;

  useEffect(() => {
    if (closeFadeTimerRef.current) {
      clearTimeout(closeFadeTimerRef.current);
      closeFadeTimerRef.current = null;
    }
    if (closeCollapseTimerRef.current) {
      clearTimeout(closeCollapseTimerRef.current);
      closeCollapseTimerRef.current = null;
    }
    if (inputReadyTimerRef.current) {
      clearTimeout(inputReadyTimerRef.current);
      inputReadyTimerRef.current = null;
    }

    if (visible) {
      hasOpenedRef.current = true;
      setClosePhase('hidden');
      // 面板位移动画结束后再渲染原生 Input，避免动画期间原生层不同步
      setInputReady(false);
      inputReadyTimerRef.current = setTimeout(() => {
        setInputReady(true);
      }, OPEN_PANEL_MS);
      return;
    }

    setInputReady(false);

    if (!hasOpenedRef.current) {
      setClosePhase('hidden');
      return;
    }

    setClosePhase('closing-fade');
    closeFadeTimerRef.current = setTimeout(() => {
      setClosePhase('closing-collapse');
      closeCollapseTimerRef.current = setTimeout(() => {
        setClosePhase('hidden');
      }, CLOSE_COLLAPSE_MS);
    }, CLOSE_FADE_MS);

    return () => {
      if (closeFadeTimerRef.current) {
        clearTimeout(closeFadeTimerRef.current);
        closeFadeTimerRef.current = null;
      }
      if (closeCollapseTimerRef.current) {
        clearTimeout(closeCollapseTimerRef.current);
        closeCollapseTimerRef.current = null;
      }
      if (inputReadyTimerRef.current) {
        clearTimeout(inputReadyTimerRef.current);
        inputReadyTimerRef.current = null;
      }
    };
  }, [visible]);

  const panelStyle = {
    left: 0,
    right: 0,
    top: `${hiddenPanelTop}px`,
    bottom: '0px',
    transform: panelExpanded ? `translateY(-${panelMoveDistance}px)` : 'translateY(0px)',
    transitionProperty: 'transform',
    transitionDuration: `${visible ? OPEN_PANEL_MS : CLOSE_COLLAPSE_MS}ms`,
    transitionTimingFunction: 'linear',
  };
  const panelBodyStyle = {
    opacity: panelSurfaceVisible ? 1 : 0,
    transitionProperty: 'opacity',
    transitionDuration: `${visible ? OPEN_FADE_MS : CLOSE_FADE_MS}ms`,
    transitionTimingFunction: 'linear',
  };
  const inputShellStyle = {
    top: `${inputTop}px`,
    left: `${activeRect.left}px`,
    width: `${activeRect.width}px`,
    transform: `translateY(${inputOffset}px)`,
    transition: `transform ${visible ? OPEN_PANEL_MS : CLOSE_COLLAPSE_MS}ms linear`,
  };
  const buttonStyle = {
    top: `${buttonTop}px`,
    left: `${activeButtonRect.left}px`,
    width: `${activeButtonRect.width}px`,
    height: `${activeButtonRect.height}px`,
    transform: `translateY(${buttonOffset}px)`,
    transition: `transform ${visible ? OPEN_PANEL_MS : CLOSE_COLLAPSE_MS}ms linear`,
  };
  const headerStyle = {
    opacity: panelSurfaceVisible ? 1 : 0,
    transition: `opacity ${visible ? OPEN_FADE_MS : CLOSE_FADE_MS}ms linear`,
  };
  const hintStyle = {
    opacity: panelSurfaceVisible ? 1 : 0,
    transition: `opacity ${visible ? OPEN_FADE_MS : CLOSE_FADE_MS}ms linear`,
  };

  return (
    <View
      className="fixed inset-0 z-200 pointer-events-none"
    >
      <View
        className={cn(
          'absolute inset-0 transition-opacity duration-[120ms] ease-linear',
          overlayActive ? 'pointer-events-auto' : 'pointer-events-none',
          visible ? 'bg-black/18' : 'bg-transparent',
        )}
        onClick={onClose}
        catchMove
      />
      <View
        className={cn(
            'absolute overflow-hidden will-change-transform',
          'rounded-t-[36rpx]',
          visible ? 'shadow-[0_-18rpx_56rpx_rgba(25,45,89,0.14)]' : 'shadow-none',
        )}
        style={panelStyle}
      >
        <View
          className={cn(
            'absolute left-0 right-0 top-0 bottom-0 bg-white px-[32rpx] pt-[40rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))]',
            panelSurfaceVisible ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={panelBodyStyle}
        >
          <View className="w-[72rpx] h-[8rpx] rounded-full bg-border-light mx-auto mb-[24rpx]" />
          <View
            className="relative h-[48rpx] flex items-center justify-center mb-[68rpx]"
            style={{ ...headerStyle, marginTop: `${HEADER_TOP}rpx` }}
          >
            <View className="absolute left-0 top-1/2 -translate-y-1/2 active:opacity-70" onClick={onClose}>
              <Icon name="arrow-left" size={36} color="foreground" />
            </View>
            <Text className="text-[30rpx] font-semibold text-foreground">{title}</Text>
            {summaryText ? (
              <Text className="text-[24rpx] text-muted-foreground block mt-[8rpx]">
                {summaryText}
              </Text>
            ) : null}
          </View>
          {hint ? (
            <View
              className="absolute left-[32rpx] right-[32rpx]"
              style={{
                top: `${buttonTop + buttonOffset + activeButtonRect.height + 22}px`,
                ...hintStyle,
              }}
            >
              <Text className="text-[22rpx] text-muted-foreground block leading-[1.6]">
                {hint}
              </Text>
            </View>
          ) : null}
        </View>

        <View
          className={cn(
            'absolute rounded-[24rpx] bg-white border-[2rpx] border-solid px-[28rpx] h-[96rpx] flex items-center will-change-transform',
            controlsHighlighted
              ? 'border-primary shadow-[0_16rpx_42rpx_rgba(59,110,245,0.18)]'
              : 'border-white/70 shadow-[0_12rpx_40rpx_rgba(59,110,245,0.10)]',
            'pointer-events-auto',
          )}
          style={inputShellStyle}
          onClick={visible ? undefined : onOpen}
        >
          {inputReady ? (
            <Input
              focus={inputReady}
              type={type}
              password={password}
              value={value}
              placeholder={placeholder}
              placeholderClass="input-placeholder"
              className="w-full text-[30rpx] text-foreground"
              adjustPosition={false}
              onInput={(event) => onChange(event.detail.value)}
            />
          ) : (
            <Text
              className={cn(
                'block w-full truncate text-[30rpx]',
                value ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {value || placeholder}
            </Text>
          )}
        </View>

        <View
          className="absolute rounded-full bg-gradient-primary shadow-login-btn flex items-center justify-center active:opacity-90 pointer-events-auto will-change-transform"
          style={buttonStyle}
          onClick={onSubmit}
        >
          <Text className="text-[34rpx] font-semibold text-white">{submitText}</Text>
        </View>
      </View>
    </View>
  );
};

export default LoginFlowPopover;
