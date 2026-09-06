import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import { MDI_ICONS } from '@/components/Icon/icons';
import { HOME_TILE_3D } from '@/constants/home-ui';
import type { QuickEntry } from '@/services/home';
import { reportLocalDebug } from '@/utils/local-debug';

export interface KingKongSectionProps {
  entries: QuickEntry[];
  /**
   * staff：三卡片瓷片 + 图标网格（教师/校长）
   * grid：仅图标网格（家长端）
   */
  variant?: 'staff' | 'grid';
  /** 锚点跳转（url 以 # 开头时回调，如 #parent-schedule） */
  onAnchor?: (anchor: string) => void;
}

/** TabBar 主包路径：需 switchTab */
const TAB_PAGE_PATHS = new Set([
  '/pages/home/index',
  '/pages/schedule/index',
  '/pages/statistics/index',
  '/pages/profile/index',
]);

/**
 * 金刚区图标渐变配色方案（无 3D 图时回退）
 */
const HOME_GRID_GRADIENTS = [
  { from: '#FF6B6B', to: '#FFA94D', deg: 135 },
  { from: '#FF922B', to: '#FCC419', deg: 135 },
  { from: '#4DABF7', to: '#22B8CF', deg: 135 },
  { from: '#845EF7', to: '#E64980', deg: 135 },
  { from: '#FA5252', to: '#F06595', deg: 135 },
  { from: '#FF922B', to: '#FA5252', deg: 135 },
  { from: '#9775FA', to: '#4DABF7', deg: 135 },
  { from: '#E64980', to: '#9775FA', deg: 135 },
];

/**
 * 顶部瓷片配色：方案 A5（火箭暖高光）
 */
const TRIPLE_CARD_CONFIG = [
  {
    label: '快速消课',
    subLabel: '快速核销学员或班级课时',
    icon: 'mdi-check-circle',
    image: HOME_TILE_3D.rocket,
    url: '/package-course/pages/lesson-form/index',
    badge: 'HOT',
    cardBg: 'linear-gradient(145deg, #EEF2FF 0%, #E0E9FF 55%, #FFE8E0 100%)',
    cardShadow: '0 10rpx 24rpx rgba(37, 99, 235, 0.12)',
    accent: '#2563EB',
  },
  {
    label: '我的预约',
    subLabel: '查看关联\n预约',
    icon: 'mdi-calendar-check',
    image: HOME_TILE_3D.calendarCheck,
    url: '/package-course/pages/booking/index',
    cardBg: 'linear-gradient(145deg, #EAF8F4 0%, #D2EFE8 100%)',
    cardShadow: '0 8rpx 20rpx rgba(15, 118, 110, 0.12)',
    accent: '#0F766E',
  },
  {
    label: '学员管理',
    subLabel: '查看全部\n学员',
    icon: 'mdi-account-group',
    image: HOME_TILE_3D.users,
    url: '/package-student/pages/students/index',
    cardBg: 'linear-gradient(145deg, #ECF3FB 0%, #D6E6F7 100%)',
    cardShadow: '0 8rpx 20rpx rgba(59, 130, 246, 0.12)',
    accent: '#3B82F6',
  },
] as const;

const renderGradientIcon = (
  iconName: string,
  gradient: { from: string; to: string; deg: number },
  sizeRpx = 40,
) => {
  const svgPath = MDI_ICONS[iconName] || MDI_ICONS[`mdi-${iconName}`];
  if (!svgPath) return null;

  const svgUrl = `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='24' height='24'%3E%3Cpath fill='black' d='${svgPath}'/%3E%3C/svg%3E`;

  return (
    <View
      style={{
        width: `${sizeRpx}rpx`,
        height: `${sizeRpx}rpx`,
        backgroundImage: `linear-gradient(${gradient.deg}deg, ${gradient.from}, ${gradient.to})`,
        WebkitMaskImage: `url("${svgUrl}")`,
        maskImage: `url("${svgUrl}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
      }}
    />
  );
};

/** 瓷片 3D 图标：尺寸/倾斜；不做破框 */
const TileIcon: React.FC<{
  src: string;
  size?: number;
  rotateDeg?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ src, size = 120, rotateDeg = 0, className, style }) => (
  <View
    className={cn('pointer-events-none', className)}
    style={{
      width: `${size}rpx`,
      height: `${size}rpx`,
      ...style,
    }}
  >
    <Image
      src={src}
      mode="aspectFit"
      className="h-full w-full"
      style={{
        transform: rotateDeg ? `rotate(${rotateDeg}deg)` : undefined,
      }}
    />
  </View>
);

/**
 * KingKongSection
 * - 瓷片区：斜切角度不变；icon / 文字 / 卡片单色可调
 * - 金刚网格：小图或渐变 mdi
 */
const KingKongSection: React.FC<KingKongSectionProps> = ({
  entries,
  variant = 'staff',
  onAnchor,
}) => {
  if (!entries || entries.length === 0) return null;

  const tripleCards = TRIPLE_CARD_CONFIG;
  const gridEntries = entries.slice(0, 8);
  const showTripleCards = variant === 'staff';

  const handleNavigate = (url: string, label: string) => {
    reportLocalDebug({
      hypothesisId: 'H1',
      location: 'src/components/home/KingKongSection/index.tsx:onClick',
      msg: '[DEBUG] home navigate click',
      data: { url, label },
    });
    if (url.startsWith('#')) {
      onAnchor?.(url.slice(1));
      return;
    }
    const path = url.split('?')[0];
    if (TAB_PAGE_PATHS.has(path)) {
      Taro.switchTab({ url: path });
      return;
    }
    Taro.navigateTo({ url });
  };

  return (
    <View className="kingkong-section px-[24rpx] pb-[32rpx]">
      {showTripleCards && (
        <View className="relative mb-[28rpx] flex min-h-[280rpx] gap-0">
          {/* 左侧大瓷片 - 快速消课 */}
          <View
            className="relative mr-[-16rpx] flex-[1.35] active:opacity-92"
            onClick={() => handleNavigate(tripleCards[0].url, tripleCards[0].label)}
          >
            <View
              className="absolute inset-0 overflow-hidden rounded-[40rpx]"
              style={{
                background: tripleCards[0].cardBg,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 32rpx) 100%, 0 100%)',
                boxShadow: tripleCards[0].cardShadow,
              }}
            />
            <View className="relative z-10 flex h-full min-h-[280rpx] flex-col px-[28rpx] pb-[24rpx] pt-[24rpx] pr-[24rpx]">
              <View className="flex flex-wrap items-center gap-[10rpx]">
                <Text className="text-[30rpx] font-extrabold text-foreground">
                  {tripleCards[0].label}
                </Text>
                {tripleCards[0].badge ? (
                  <View className="rounded-[8rpx] bg-gradient-to-r from-[hsl(var(--destructive))] to-[hsl(var(--destructive)/0.7)] px-[10rpx] py-[2rpx]">
                    <Text className="text-[18rpx] font-bold text-white">
                      {tripleCards[0].badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text className="mt-[6rpx] text-[22rpx]" style={{ color: tripleCards[0].accent }}>
                {tripleCards[0].subLabel}
              </Text>
              <View className="mt-auto flex items-end justify-between">
                <View className="rounded-full bg-card px-[32rpx] py-[12rpx] shadow-card">
                  <Text className="text-[26rpx] font-bold" style={{ color: tripleCards[0].accent }}>
                    Go
                  </Text>
                </View>
                <TileIcon
                  src={tripleCards[0].image}
                  size={112}
                  rotateDeg={22}
                  className="mb-[2rpx] mr-[4rpx]"
                />
              </View>
            </View>
          </View>

          {/* 右侧两张小瓷片：约各半，与左侧同高 */}
          <View className="flex flex-1 flex-col gap-[12rpx]">
            {tripleCards.slice(1).map((entry, idx) => {
              const isBlue = idx === 0;
              const clipPath = isBlue
                ? 'polygon(32rpx 0, 100% 0, 100% 100%, 16rpx 100%)'
                : 'polygon(16rpx 0, 100% 0, 100% 100%, 0 100%)';

              return (
                <View
                  key={entry.label}
                  className="relative flex-1 active:opacity-92"
                  onClick={() => handleNavigate(entry.url, entry.label)}
                >
                  <View
                    className="absolute inset-0"
                    style={{
                      background: entry.cardBg,
                      clipPath,
                      boxShadow: entry.cardShadow,
                    }}
                  />
                  <View className="relative z-10 flex h-full min-h-[128rpx] items-center justify-between py-[14rpx] pl-[36rpx] pr-[16rpx]">
                    <View className="relative z-10 min-w-0 flex-1 pr-[8rpx]">
                      <Text className="text-[24rpx] font-bold text-foreground">{entry.label}</Text>
                      <View className="mt-[2rpx]">
                        {entry.subLabel.split('\n').map((line) => (
                          <Text
                            key={line}
                            className="block text-[20rpx] font-semibold leading-[1.3]"
                            style={{ color: entry.accent }}
                          >
                            {line}
                          </Text>
                        ))}
                      </View>
                    </View>
                    <TileIcon src={entry.image} size={64} className="relative z-0 shrink-0" />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 金刚网格：缩小精致；有 3D 图用小图，否则渐变 mdi */}
      <View
        className={cn(
          'grid grid-cols-4 gap-x-[12rpx] gap-y-[28rpx]',
          !showTripleCards && 'pt-[8rpx]',
        )}
      >
        {gridEntries.map((entry, idx) => {
          const gradient = HOME_GRID_GRADIENTS[idx % HOME_GRID_GRADIENTS.length];
          return (
            <View
              key={entry.label}
              className="flex flex-col items-center gap-[10rpx] active:opacity-80"
              onClick={() => handleNavigate(entry.url, entry.label)}
            >
              {entry.image ? (
                <View className="flex h-[72rpx] w-[72rpx] items-center justify-center">
                  <Image src={entry.image} mode="aspectFit" className="h-[56rpx] w-[56rpx]" />
                </View>
              ) : (
                <View className="icon-glass flex h-[72rpx] w-[72rpx] items-center justify-center rounded-[20rpx]">
                  {renderGradientIcon(entry.icon, gradient, 36)}
                </View>
              )}
              <Text className="whitespace-nowrap text-[22rpx] font-medium text-foreground-secondary">
                {entry.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default KingKongSection;
