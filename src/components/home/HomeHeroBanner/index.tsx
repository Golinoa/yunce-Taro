/**
 * HomeHeroBanner - 首页头部视觉区
 *
 * - 固定高度：有图 / 无图一致，避免校区卡片错位
 * - 有封面：顶部对齐裁切，底部压暗保证铃铛可读
 * - 无封面：主题色实底 + 大写拼音水印（与微信胶囊同行）+ 品牌文案上移排版
 */
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import {
  BRAND_NAME_EN,
  BRAND_NAME_EN_SECONDARY,
  BRAND_NAME_EN_SUB,
  BRAND_NAME_ZH,
  BRAND_SLOGAN,
} from '@/constants/brand';

export interface HomeHeroBannerProps {
  /** 可选封面图；不传则走品牌文字托底 */
  coverSrc?: string | string[];
  /** 通知未读数（>0 显示红点） */
  unreadCount?: number;
  /** 通知铃铛距顶（含状态栏，px） */
  bellTopPx: number;
  /** 点击通知 */
  onNotify?: () => void;
  className?: string;
}

type CoverStatus = 'idle' | 'loading' | 'ready' | 'error';

/** 弱网过久仍未 onLoad，视为失败走品牌托底 */
const COVER_LOAD_TIMEOUT_MS = 8000;

/** 拼音水印完整文案 */
const WATERMARK_TEXT = `${BRAND_NAME_EN} ${BRAND_NAME_EN_SECONDARY}`;

/** rpx → px（按屏宽） */
function rpxToPx(rpx: number): number {
  try {
    const { windowWidth } = Taro.getSystemInfoSync();
    return (rpx / 750) * windowWidth;
  } catch {
    return rpx / 2;
  }
}

/**
 * 按可用宽度估算水印字号，保证「SONGGUO PAIKE」一行露全、贴到胶囊左侧。
 * extrabold 大写 + tracking 0.12em 的经验系数。
 */
function fitWatermarkFontPx(maxWidthPx: number, text: string): number {
  const tracking = 0.12;
  const avgGlyphEm = 0.58;
  const emUnits = text.length * avgGlyphEm + Math.max(text.length - 1, 0) * tracking;
  if (emUnits <= 0 || maxWidthPx <= 0) return 22;
  const raw = maxWidthPx / emUnits;
  return Math.min(36, Math.max(16, Math.floor(raw * 10) / 10));
}

/** 读取微信胶囊位置，供水印与原生「··· / 退出」同行对齐 */
function useCapsuleRow(): { top: number; height: number; bottom: number; left: number } {
  return useMemo(() => {
    try {
      const menu = Taro.getMenuButtonBoundingClientRect();
      if (menu?.top > 0 && menu.height > 0 && menu.left > 0) {
        return {
          top: menu.top,
          height: menu.height,
          bottom: menu.bottom,
          left: menu.left,
        };
      }
    } catch {
      // ignore
    }
    return { top: 48, height: 32, bottom: 80, left: 280 };
  }, []);
}

const HomeHeroBanner: React.FC<HomeHeroBannerProps> = ({
  coverSrc,
  unreadCount = 0,
  bellTopPx,
  onNotify,
  className,
}) => {
  const capsule = useCapsuleRow();
  const coverSources = useMemo(
    () => (Array.isArray(coverSrc) ? coverSrc : coverSrc ? [coverSrc] : []).filter(Boolean),
    [coverSrc],
  );
  const hasCoverSrc = coverSources.length > 0;
  const [status, setStatus] = useState<CoverStatus>(hasCoverSrc ? 'loading' : 'error');

  useEffect(() => {
    if (!hasCoverSrc) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const timer = setTimeout(() => {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }, COVER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [coverSrc, hasCoverSrc]);

  const handleLoad = useCallback(() => setStatus('ready'), []);
  const handleError = useCallback(() => setStatus('error'), []);

  const showBrandFallback = status !== 'ready';
  const showCover = hasCoverSrc && status !== 'error';
  const coverReady = status === 'ready';

  /** 左内边距 + 与胶囊留一点间隙，右边界贴到胶囊左边 */
  const watermarkLayout = useMemo(() => {
    const leftPadPx = rpxToPx(32);
    const gapToCapsulePx = rpxToPx(10);
    const maxWidthPx = Math.max(capsule.left - leftPadPx - gapToCapsulePx, 100);
    const fontPx = fitWatermarkFontPx(maxWidthPx, WATERMARK_TEXT);
    const topPx = capsule.top + (capsule.height - fontPx) / 2;
    return { leftPadPx, maxWidthPx, fontPx, topPx: Math.max(topPx, 8) };
  }, [capsule.height, capsule.left, capsule.top]);

  /** 主文案紧贴胶囊行下方，整体上移（不再垂直居中） */
  const brandBlockTopPx = capsule.bottom + 10;

  return (
    <View className={cn('relative h-[480rpx] overflow-hidden', className)}>
      {/* 托底：主题色实底 */}
      <View className="absolute inset-0 bg-home-hero-brand" />

      {/* 封面图：加高 + 贴顶，底部多裁、顶部内容优先保留 */}
      {showCover ? (
        coverSources.length > 1 ? (
          <Swiper
            className={cn(
              'absolute left-0 top-0 w-full transition-opacity duration-300',
              coverReady ? 'opacity-100' : 'opacity-0',
            )}
            style={{ height: '128%' }}
            indicatorDots
            autoplay
            circular
            interval={4000}
            duration={300}
            onAnimationFinish={handleLoad}
          >
            {coverSources.map((src, index) => (
              <SwiperItem key={`${src}-${index}`}>
                <Image
                  src={src}
                  className="h-full w-full"
                  mode="aspectFill"
                  lazyLoad={false}
                  onLoad={handleLoad}
                  onError={handleError}
                />
              </SwiperItem>
            ))}
          </Swiper>
        ) : (
          <Image
            src={coverSources[0]}
            className={cn(
              'absolute left-0 top-0 w-full transition-opacity duration-300',
              coverReady ? 'opacity-100' : 'opacity-0',
            )}
            style={{ height: '128%' }}
            mode="aspectFill"
            lazyLoad={false}
            onLoad={handleLoad}
            onError={handleError}
          />
        )
      ) : null}

      {/* 有图时压暗，保证铃铛对比度 */}
      <View
        className={cn(
          'absolute inset-0 transition-colors duration-300',
          coverReady ? 'bg-black/32' : 'bg-transparent',
        )}
      />
      {coverReady ? (
        <View className="absolute inset-x-0 bottom-0 h-[160rpx] bg-gradient-to-t from-black/25 to-transparent" />
      ) : null}

      {/* 无图兜底：现版排版，整体上移；拼音对齐胶囊行 */}
      <View
        className={cn(
          'absolute inset-0 z-[1] transition-opacity duration-300',
          showBrandFallback ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        {/* 大写拼音水印：字号按屏宽自适应，右缘贴近微信胶囊 */}
        <View
          className="pointer-events-none absolute z-0"
          style={{
            top: `${watermarkLayout.topPx}px`,
            left: `${watermarkLayout.leftPadPx}px`,
            width: `${watermarkLayout.maxWidthPx}px`,
          }}
        >
          <Text
            className="block whitespace-nowrap font-extrabold leading-none tracking-[0.12em] text-white/15"
            style={{ fontSize: `${watermarkLayout.fontPx}px` }}
          >
            {WATERMARK_TEXT}
          </Text>
        </View>

        {/* 品牌主文案：紧随胶囊行下方，整体上移；右侧给铃铛留空 */}
        <View
          className="absolute left-[40rpx] z-[1]"
          style={{ top: `${brandBlockTopPx}px`, right: '112rpx' }}
        >
          <Text className="block text-[64rpx] font-extrabold leading-tight tracking-wide text-white">
            {BRAND_NAME_ZH}
          </Text>
          <Text className="mt-[12rpx] block text-[24rpx] font-semibold tracking-[0.18em] text-white/75">
            {BRAND_NAME_EN_SUB}
          </Text>
          <Text className="mt-[12rpx] block text-[26rpx] leading-relaxed text-white/55">
            {BRAND_SLOGAN}
          </Text>
        </View>
      </View>

      {/* 通知铃铛：与胶囊同排高度 */}
      <View
        className="absolute right-[24rpx] z-10"
        style={{ top: `${bellTopPx}px` }}
        onClick={onNotify}
      >
        <View className="relative flex h-[80rpx] w-[80rpx] items-center justify-center">
          <Icon name="mdi-bell-outline" size={44} color="white" />
          {unreadCount > 0 ? (
            <View className="absolute top-[10rpx] right-[10rpx] h-[18rpx] w-[18rpx] rounded-full border-[2rpx] border-primary bg-destructive" />
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default HomeHeroBanner;
