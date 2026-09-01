/**
 * 关于页 pages/about/index
 *
 * 门店入驻引导页（品牌介绍落地页），从「我的」页「关于松果排课」按钮进入。
 * 分区顺序（对齐优化版设计稿）：
 *  Hero(蓝渐变 + 安全保障标签) → 数据背书(2×2) → 痛点共鸣 → 安全保障 →
 *  核心功能(6) → 为什么选择我们(2) → 入驻流程(纵向三步) → 底部悬浮「申请门店入驻」长按钮。
 * Hero 区 CTA 为「申请门店入驻」+「邀请朋友入驻」并排；分享仅保留在 Hero 与右上角菜单。
 * 产品：门店入驻须运营审核，无免审直开；获批后申请人 = 管理员（OWNER）。
 *
 * 技术约束：UnoCSS Token + rpx，随主题色(blue/coral/orange)联动；无 SCSS、无内联 style；
 * 图标统一走 @/components/Icon（仅支持 MDI_ICONS 表内名称）。
 */
import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo } from 'react';
import Icon, { IconName } from '@/components/Icon';
import { BRAND_LOGO, BRAND_NAME_ZH } from '@/constants/brand';
import { STORE_ENTRY_IDENTITY_COPY } from '@/constants/store-entry-copy';
import { useThemeStore } from '@/stores/theme';
import { useAuth } from '@/utils/auth';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/** 图标 + 标题 + 描述 的通用条目结构 */
interface InfoItem {
  icon: IconName;
  title: string;
  desc: string;
}

/** 数据背书（均为产品真实能力，不虚构用户量） */
const STATS: { value: string; label: string }[] = [
  { value: '10+', label: '核心业务模块' },
  { value: '3 端', label: '校长·教师·前台' },
  { value: '5 分钟', label: '完成配置' },
  { value: '1 账号', label: '多身份随时切换' },
];

/** 馆长/教练日常痛点 */
const PAINS: InfoItem[] = [
  {
    icon: 'mdi-calendar-clock-outline',
    title: '排课靠表格，撞车靠人工',
    desc: '谁上了课、还剩几节，月底对账对到崩溃',
  },
  {
    icon: 'mdi-credit-card-outline',
    title: '售卡消课记录散落',
    desc: '会员到期、余额多少，全靠拍脑袋回忆',
  },
  {
    icon: 'mdi-account-group-outline',
    title: '学员档案越积越乱',
    desc: '课时、续费、请假信息东一块西一块',
  },
  {
    icon: 'mdi-calculator',
    title: '算薪费时还易错',
    desc: '底薪、提成、课时费手动汇总，算到半夜',
  },
];

/** 安全保障细则（端到端加密主张的支撑点） */
const SECURITY_POINTS: InfoItem[] = [
  { icon: 'mdi-lock', title: '全链路传输加密', desc: '数据全程加密，杜绝窃取篡改' },
  { icon: 'mdi-shield-check', title: '数据归属机构', desc: '掌握数据主权，随时导出备份' },
  { icon: 'mdi-account-group', title: '分级权限管控', desc: '校长、教师、前台按角色授权' },
  { icon: 'mdi-clock-outline', title: '多重备份可审计', desc: '云端多重备份，异常可追溯' },
];

/** 核心功能（价值导向，与设计稿一致） */
const FEATURES: InfoItem[] = [
  {
    icon: 'mdi-calendar-clock-outline',
    title: '可视化排课',
    desc: '日历课表一目了然，请假调课一键完成',
  },
  {
    icon: 'mdi-credit-card-outline',
    title: '灵活卡项',
    desc: '次卡·时间卡·储值卡，自动消课扣次',
  },
  {
    icon: 'mdi-account-group-outline',
    title: '会员档案',
    desc: '课时、消课、续费记录全程可溯',
  },
  {
    icon: 'mdi-calculator',
    title: '自动算薪',
    desc: '底薪提成课时费智能汇总，一键发放',
  },
  {
    icon: 'mdi-chart-line',
    title: '数据看板',
    desc: '收支、耗卡、毛利多维分析辅助决策',
  },
  {
    icon: 'mdi-account-switch',
    title: '多端协同',
    desc: '校长·教师·前台一账号切换，各司其职',
  },
];

/** 为什么选择我们（优化版精简为 2 张，与设计稿一致） */
const WHY_CHOOSE: InfoItem[] = [
  {
    icon: 'mdi-rocket-launch',
    title: '即开即用不折腾',
    desc: '微信小程序打开即用，无需下载安装、无需维护服务器',
  },
  {
    icon: 'mdi-account',
    title: '一直陪着你',
    desc: '专属顾问一对一服务，按机构反馈每月迭代',
  },
];

/** 入驻流程 */
const STEPS: { step: string; title: string; desc: string }[] = [
  { step: '01', title: '填写申请', desc: '提交机构基本信息' },
  { step: '02', title: '运营审核', desc: '平台审核通过后开通机构' },
  { step: '03', title: '开通使用', desc: '以管理员身份进入机构端管理' },
];

/** 门店入驻引导页分享路径（分包完整路径，确保被分享者直达落地页） */
export const ABOUT_SHARE_PATH = '/package-settings/pages/about/index';

/**
 * 好友转发 / 朋友圈分享文案（不含小程序名，卡片已展示品牌）
 */
export const ABOUT_SHARE_SLOGAN = STORE_ENTRY_IDENTITY_COPY.aboutShareSlogan;

const About: React.FC = () => {
  usePrimaryNavigationBar();
  const { activeTheme } = useThemeStore();
  const { currentRole } = useAuth();
  // 已登录的教师/家长不应再被引导去门店入驻（会被守卫拦回）
  const showStoreEntry = useMemo(() => {
    if (!currentRole) return true;
    return currentRole === 'principal' || currentRole === 'admin';
  }, [currentRole]);

  useShareAppMessage(() => ({
    title: ABOUT_SHARE_SLOGAN,
    path: ABOUT_SHARE_PATH,
    imageUrl: BRAND_LOGO,
  }));

  useShareTimeline(() => ({
    title: ABOUT_SHARE_SLOGAN,
    imageUrl: BRAND_LOGO,
  }));

  useDidShow(() => {
    // 微信「···」菜单：转发好友在前，朋友圈在后
    Taro.showShareMenu({
      showShareItems: ['shareAppMessage', 'shareTimeline'],
    });
  });

  const handleEntry = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/store-entry/index' });
  }, []);

  return (
    <View className={`theme-${activeTheme} min-h-screen bg-background flex flex-col`}>
      <ScrollView scrollY className="flex-1" showScrollbar={false}>
        {/* ===== Hero 区 ===== */}
        <View className="relative bg-gradient-primary px-[40rpx] pt-[64rpx] pb-[88rpx] overflow-hidden">
          {/* 装饰圆 */}
          <View className="absolute -top-[60rpx] -right-[60rpx] w-[280rpx] h-[280rpx] rounded-full bg-white/10" />
          <View className="absolute top-[120rpx] -left-[80rpx] w-[220rpx] h-[220rpx] rounded-full bg-white/8" />

          <View className="relative z-10">
            {/* 品牌 */}
            <View className="flex items-center justify-center gap-[12rpx] mb-[28rpx]">
              <View className="w-[72rpx] h-[72rpx] rounded-full bg-white center shadow-soft">
                <Text className="text-[34rpx] font-black text-primary">SG</Text>
              </View>
              <Text className="text-[40rpx] font-black text-white tracking-wide">
                {BRAND_NAME_ZH}
              </Text>
            </View>

            {/* 安全保障标签 */}
            <View className="flex items-center justify-center mb-[20rpx]">
              <View className="px-[16rpx] h-[40rpx] rounded-full bg-white/15 center">
                <Text className="text-[22rpx] font-medium text-white/90">
                  端到端加密 · 数据安全
                </Text>
              </View>
            </View>

            {/* Slogan */}
            <Text className="block text-center text-[44rpx] font-black text-white leading-[1.35]">
              让机构的经营
              <Text className="mx-[8rpx] text-white/70">·</Text>
              更简单更安全
            </Text>
            <Text className="block text-center text-[26rpx] text-white/85 mt-[20rpx] leading-relaxed">
              排课、消课、售卡、算薪、数据分析
              <Text className="block">一套系统覆盖经营全流程，数据端到端加密</Text>
            </Text>

            {/* Hero CTA：开通 + 邀请并排（已登录教师/家长不展示开通，避免无权限） */}
            <View className="mt-[44rpx] flex gap-[16rpx]">
              {showStoreEntry ? (
                <View
                  className="flex-1 h-[92rpx] rounded-[28rpx] bg-white center press-scale shadow-lg"
                  onClick={handleEntry}
                >
                  <Text className="text-[28rpx] font-bold text-primary">
                    {STORE_ENTRY_IDENTITY_COPY.aboutCta}
                  </Text>
                </View>
              ) : null}
              <Button
                openType="share"
                className={cn(
                  'h-[92rpx] rounded-[28rpx] bg-white center press-scale shadow-lg m-0 p-0 leading-none after:border-none',
                  showStoreEntry ? 'flex-1' : 'flex-1',
                )}
              >
                <Text className="text-[28rpx] font-bold text-primary">邀请朋友入驻</Text>
              </Button>
            </View>
          </View>
        </View>

        {/* ===== 数据背书（叠在 Hero 下方，2×2 网格对齐设计稿） ===== */}
        <View className="px-[32rpx] -mt-[48rpx] relative z-10">
          <View className="bg-card rounded-[28rpx] shadow-card px-[24rpx] py-[32rpx] grid grid-cols-2 gap-y-[32rpx]">
            {STATS.map((item) => (
              <View key={item.label} className="center-col">
                <Text className="text-[34rpx] font-black text-primary leading-none">
                  {item.value}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] text-center leading-tight">
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="px-[32rpx] pt-[40rpx] pb-[180rpx] flex flex-col gap-[44rpx]">
          {/* ===== 痛点共鸣 ===== */}
          <View>
            <SectionHeader eyebrow="你是否也这样" title="机构的经营，不该这么累" />
            <View className="bg-card rounded-[28rpx] shadow-card overflow-hidden">
              {PAINS.map((item, index) => (
                <View
                  key={item.title}
                  className={cn(
                    'flex items-start gap-[20rpx] px-[28rpx] py-[26rpx]',
                    index < PAINS.length - 1 && 'border-b border-border/60',
                  )}
                >
                  <View className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-destructive-5 center flex-shrink-0">
                    <Icon name={item.icon} size={32} color="destructive" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      {item.title}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] leading-relaxed block">
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
              {/* 转折 */}
              <View className="bg-primary-10 px-[28rpx] py-[24rpx] flex items-center gap-[12rpx]">
                <Icon name="mdi-check-circle" size={32} color="primary" />
                <Text className="text-[26rpx] font-semibold text-primary">
                  这些困扰，{BRAND_NAME_ZH}都能替你解决
                </Text>
              </View>
            </View>
          </View>

          {/* ===== 安全保障 ===== */}
          <View>
            <SectionHeader eyebrow="安全保障" title="端到端加密，数据安全看得见" />
            <Text className="text-[24rpx] text-muted-foreground leading-relaxed mb-[24rpx] block">
              从学员档案到课时与财务数据，全程加密、按角色授权、随时可审计，安全不是口号而是机制。
            </Text>
            {/* 主主张卡 */}
            <View className="bg-card rounded-[24rpx] shadow-card p-[32rpx] mb-[24rpx] flex items-start gap-[24rpx]">
              <View className="w-[76rpx] h-[76rpx] rounded-[20rpx] bg-primary-10 center flex-shrink-0">
                <Icon name="mdi-shield-check" size={36} color="primary" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[30rpx] font-bold text-foreground block">端到端加密</Text>
                <Text className="text-[24rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
                  关键数据在离开设备前完成加密，密钥由机构独立掌控，机构以外任何第三方都无法读取明文。
                </Text>
              </View>
            </View>
            {/* 支撑点 2x2 */}
            <View className="grid grid-cols-2 gap-[24rpx]">
              {SECURITY_POINTS.map((item) => (
                <View key={item.title} className="bg-card rounded-[24rpx] p-[32rpx] shadow-card">
                  <View className="w-[68rpx] h-[68rpx] rounded-[20rpx] bg-primary-10 center mb-[20rpx]">
                    <Icon name={item.icon} size={34} color="primary" />
                  </View>
                  <Text className="text-[28rpx] font-bold text-foreground block">{item.title}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===== 核心功能 ===== */}
          <View>
            <SectionHeader eyebrow="核心能力" title="一套系统，覆盖经营全流程" />
            <View className="grid grid-cols-2 gap-[24rpx]">
              {FEATURES.map((item) => (
                <View key={item.title} className="bg-card rounded-[24rpx] p-[32rpx] shadow-card">
                  <View className="w-[68rpx] h-[68rpx] rounded-[20rpx] bg-primary-10 center mb-[20rpx]">
                    <Icon name={item.icon} size={34} color="primary" />
                  </View>
                  <Text className="text-[28rpx] font-bold text-foreground block">{item.title}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===== 为什么选择我们 ===== */}
          <View>
            <SectionHeader eyebrow="为什么选择我们" title="为什么机构选择松果排课" />
            <View className="grid grid-cols-2 gap-[24rpx]">
              {WHY_CHOOSE.map((item) => (
                <View key={item.title} className="bg-card rounded-[24rpx] p-[32rpx] shadow-card">
                  <View className="w-[68rpx] h-[68rpx] rounded-[20rpx] bg-primary-10 center mb-[20rpx]">
                    <Icon name={item.icon} size={34} color="primary" />
                  </View>
                  <Text className="text-[28rpx] font-bold text-foreground block">{item.title}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] leading-relaxed block">
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===== 入驻流程（纵向 3 步列表，对齐设计稿） ===== */}
          <View>
            <SectionHeader eyebrow="入驻流程" title="三步开启数字化经营" />
            <View className="bg-card rounded-[28rpx] shadow-card overflow-hidden">
              {STEPS.map((item, index) => (
                <View
                  key={item.step}
                  className={cn(
                    'flex items-start gap-[24rpx] px-[28rpx] py-[26rpx]',
                    index < STEPS.length - 1 && 'border-b border-border/60',
                  )}
                >
                  <Text className="w-[56rpx] flex-shrink-0 text-[34rpx] font-black text-primary leading-none">
                    {item.step}
                  </Text>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[28rpx] font-semibold text-foreground block">
                      {item.title}
                    </Text>
                    <Text className="text-[24rpx] text-muted-foreground mt-[6rpx] leading-relaxed block">
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ===== 底部悬浮入驻按钮（仅开通；教师/家长隐藏） ===== */}
      {showStoreEntry ? (
        <View className="fixed left-0 right-0 bottom-0 px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[16rpx] bg-gradient-to-t from-background via-background to-transparent z-50">
          <View
            className="h-[92rpx] rounded-[28rpx] bg-gradient-primary center shadow-lg press-scale"
            onClick={handleEntry}
          >
            <Icon name="mdi-office-building" size={28} color="white" />
            <Text className="text-[32rpx] font-bold text-white ml-[8rpx]">
              {STORE_ENTRY_IDENTITY_COPY.aboutCta}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

/**
 * 分区标题：主题色渐变背景卡片，居中白色大字标题。
 * 用于各内容分区的醒目区隔。
 */
export interface SectionHeaderProps {
  /** 小眉标文案，如「核心能力」 */
  eyebrow: string;
  /** 分区主标题 */
  title: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ eyebrow, title }) => (
  <View className="mb-[24rpx]">
    <View className="relative overflow-hidden rounded-[24rpx] px-[32rpx] py-[28rpx] center-col border border-white/30 bg-primary/60 backdrop-blur-md shadow-soft">
      {/* 弥散渐变光斑 */}
      <View className="absolute -top-[40rpx] -left-[40rpx] w-[160rpx] h-[160rpx] rounded-full bg-white/25 blur-[40rpx]" />
      <View className="absolute -bottom-[50rpx] -right-[30rpx] w-[180rpx] h-[180rpx] rounded-full bg-white/20 blur-[50rpx]" />
      <View className="absolute top-[20rpx] right-[60rpx] w-[80rpx] h-[80rpx] rounded-full bg-white/15 blur-[30rpx]" />

      <View className="relative z-10 center-col">
        {eyebrow && (
          <Text className="text-[22rpx] font-medium text-white/85 mb-[8rpx]">{eyebrow}</Text>
        )}
        <Text className="text-[36rpx] font-bold text-white leading-snug text-center">{title}</Text>
      </View>
    </View>
  </View>
);

export default withRouteGuard(About);
