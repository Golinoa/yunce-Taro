import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React from 'react';
import Icon from '@/components/Icon';
import { MDI_ICONS } from '@/components/Icon/icons';
import type { QuickEntry } from '@/services/home';
import { reportLocalDebug } from '@/utils/local-debug';

export interface KingKongSectionProps {
  entries: QuickEntry[];
  /**
   * staff：三卡片 + 图标网格（教师/校长）
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
 * 金刚区图标渐变配色方案（8 个不同方向的彩色渐变）
 * 配合霜白玻璃底，图标本身为品牌色渐变
 */
const HOME_GRID_GRADIENTS = [
  { from: '#FF6B6B', to: '#FFA94D', deg: 135 }, // 充值发卡 - 红橙
  { from: '#FF922B', to: '#FCC419', deg: 135 }, // 添加学员 - 橙黄
  { from: '#4DABF7', to: '#22B8CF', deg: 135 }, // 考勤管理 - 蓝青
  { from: '#845EF7', to: '#E64980', deg: 135 }, // 试听记录 - 紫粉
  { from: '#FA5252', to: '#F06595', deg: 135 }, // 充值记录 - 红粉
  { from: '#FF922B', to: '#FA5252', deg: 135 }, // 考勤异常 - 橙红警示
  { from: '#9775FA', to: '#4DABF7', deg: 135 }, // 续费提醒 - 紫蓝
  { from: '#E64980', to: '#9775FA', deg: 135 }, // 意向学员 - 粉紫（心形语义）
];

/** 三卡片配置：快速消课 / 预约课程 / 学员管理 */
const TRIPLE_CARD_CONFIG = [
  {
    label: '快速消课',
    subLabel: '快速核销学员或班级课时',
    icon: 'mdi-check-circle',
    url: '/package-course/pages/lesson-form/index',
    badge: 'HOT',
  },
  {
    label: '我的预约',
    subLabel: '查看与我关联的预约',
    icon: 'mdi-account-plus',
    url: '/package-course/pages/booking/index',
  },
  {
    label: '学员管理',
    subLabel: '查看 全部学员',
    icon: 'mdi-account-group',
    url: '/package-student/pages/students/index',
  },
];

/**
 * 渐变彩色图标渲染
 * 使用 backgroundImage + mask-image 实现品牌色渐变图标
 */
const renderGradientIcon = (
  iconName: string,
  gradient: { from: string; to: string; deg: number },
  sizeRpx = 56,
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

/**
 * KingKongSection - 金刚区 v14
 *
 * 对齐设计稿 index_v14.html kingkong-section：
 * - staff：三卡片 + 底部图标网格
 * - grid：仅图标网格（家长端）
 */
const KingKongSection: React.FC<KingKongSectionProps> = ({
  entries,
  variant = 'staff',
  onAnchor,
}) => {
  // 数据未加载时不渲染
  if (!entries || entries.length === 0) return null;

  // 三卡片使用固定配置
  const tripleCards = TRIPLE_CARD_CONFIG;
  // 图标网格使用全部入口
  const gridEntries = entries.slice(0, 8);
  const showTripleCards = variant === 'staff';
  const handleNavigate = (url: string, label: string) => {
    // #region debug-point H1:home-navigate-click
    reportLocalDebug({
      hypothesisId: 'H1',
      location: 'src/components/home/KingKongSection/index.tsx:onClick',
      msg: '[DEBUG] home navigate click',
      data: {
        url,
        label,
      },
    });
    // #endregion
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
      {/* 三卡片布局（仅教师端） */}
      {showTripleCards && (
        <View className="flex gap-0 mb-[40rpx] min-h-[320rpx] relative">
          {/* 左侧大卡片 - 快速消课 */}
          <View
            className="flex-[1.35] rounded-[40rpx] overflow-hidden relative mr-[-16rpx]"
            onClick={() => handleNavigate(tripleCards[0].url, tripleCards[0].label)}
          >
            <View
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--primary-glow) / 0.15) 40%, hsl(var(--primary) / 0.3) 100%)',
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 32rpx) 100%, 0 100%)',
              }}
            />
            <View className="relative z-10 p-[36rpx] h-full flex flex-col">
              <View className="flex items-center gap-[12rpx] flex-wrap">
                <Text className="text-[36rpx] font-extrabold text-foreground">
                  {tripleCards[0].label}
                </Text>
                {tripleCards[0].badge && (
                  <View className="bg-gradient-to-r from-[hsl(var(--destructive))] to-[hsl(var(--destructive)/0.7)] px-[12rpx] py-[4rpx] rounded-[8rpx]">
                    <Text className="text-[20rpx] font-bold text-white">
                      {tripleCards[0].badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-[24rpx] text-[hsl(var(--warning))] mt-[8rpx]">
                {tripleCards[0].subLabel}
              </Text>
              <View className="mt-auto flex items-end justify-between">
                <View className="bg-card px-[44rpx] py-[16rpx] rounded-full shadow-card">
                  <Text className="text-[28rpx] font-bold text-[hsl(var(--warning))]">Go</Text>
                </View>
                <View
                  className="w-[88rpx] h-[88rpx] rounded-[24rpx] opacity-60 flex items-center justify-center"
                  style={{
                    background:
                      'linear-gradient(135deg, hsl(var(--warning)), hsl(var(--warning) / 0.7))',
                  }}
                >
                  <Icon name="mdi-check" size="lg" color="white" />
                </View>
              </View>
            </View>
          </View>

          {/* 右侧两个小卡片 */}
          <View className="flex-1 flex flex-col gap-[16rpx]">
            {tripleCards.slice(1).map((entry, idx) => {
              const isBlue = idx === 0;
              const bgColor = isBlue ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--accent) / 0.08)';
              const clipPath = isBlue
                ? 'polygon(32rpx 0, 100% 0, 100% 100%, 16rpx 100%)'
                : 'polygon(16rpx 0, 100% 0, 100% 100%, 0 100%)';
              const iconBg = isBlue
                ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)))'
                : 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent-glow)))';
              const subColor = isBlue ? 'hsl(var(--primary))' : 'hsl(var(--accent))';

              return (
                <View
                  key={entry.label}
                  className="flex-1 rounded-0 overflow-hidden relative"
                  style={{ clipPath }}
                  onClick={() => handleNavigate(entry.url, entry.label)}
                >
                  <View className="absolute inset-0" style={{ background: bgColor }} />
                  <View className="relative z-10 p-[20rpx] pl-[44rpx] h-full flex flex-col justify-center">
                    <View
                      className="absolute top-[16rpx] right-[16rpx] w-[52rpx] h-[52rpx] rounded-[16rpx] flex items-center justify-center"
                      style={{ background: iconBg }}
                    >
                      <Icon name={entry.icon} size="xs" color="white" />
                    </View>
                    <Text className="text-[26rpx] font-bold text-foreground">{entry.label}</Text>
                    <Text className="text-[22rpx] font-semibold" style={{ color: subColor }}>
                      {entry.subLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 图标网格：两行四列，霜白玻璃底 + 品牌色渐变图标 */}
      <View
        className={cn(
          'grid grid-cols-4 gap-x-[16rpx] gap-y-[32rpx]',
          !showTripleCards && 'pt-[8rpx]',
        )}
      >
        {gridEntries.map((entry, idx) => {
          const gradient = HOME_GRID_GRADIENTS[idx % HOME_GRID_GRADIENTS.length];
          return (
            <View
              key={entry.label}
              className="flex flex-col items-center gap-[12rpx] active:opacity-80 transition-opacity duration-200"
              onClick={() => handleNavigate(entry.url, entry.label)}
            >
              <View className="icon-glass flex h-[80rpx] w-[80rpx] items-center justify-center rounded-[24rpx]">
                {renderGradientIcon(entry.icon, gradient, 48)}
              </View>
              <Text className="text-[22rpx] text-foreground-secondary font-medium whitespace-nowrap">
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
