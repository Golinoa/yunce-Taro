/**
 * 关于页 pages/about/index
 *
 * 品牌介绍落地页（H5 风格，用于吸引场馆入驻）：
 * - Hero：品牌 Slogan + 价值主张 + 行动号召
 * - 数据背书：产品事实数据条
 * - 痛点共鸣：馆长/教练日常困扰 → 解决方案
 * - 核心功能：价值导向的六大能力
 * - 选择理由：差异化优势
 * - 入驻流程：三步走
 * - 底部悬浮「门店入驻」按钮
 *
 * 全部使用 UnoCSS Token，随主题色（blue/coral/orange）联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback } from 'react';
import Icon from '@/components/Icon';
import { BRAND_NAME_ZH } from '@/constants/brand';
import { useThemeStore } from '@/stores/theme';
import { usePrimaryNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

/** 数据背书（均为产品真实能力，不虚构用户量） */
const STATS = [
  { value: '10+', label: '核心业务模块' },
  { value: '3 端', label: '馆主·教师·家长' },
  { value: '1 账号', label: '多身份随时切换' },
  { value: '5 分钟', label: '快速上手' },
];

/** 馆长/教练日常痛点 */
const PAINS = [
  {
    icon: 'mdi-calendar-clock-outline',
    title: '约课靠群接龙，消课全靠手记',
    desc: '谁上了课、还剩几节，月底对账对到崩溃',
  },
  {
    icon: 'mdi-credit-card-outline',
    title: '售卡记录散落各处',
    desc: '会员到期、余额多少，全靠拍脑袋回忆',
  },
  {
    icon: 'mdi-account-group-outline',
    title: '学员档案越积越乱',
    desc: '课时、续费、请假信息东一块西一块',
  },
  {
    icon: 'mdi-calculator',
    title: '排课撞车、算薪要命',
    desc: '调课靠嘴，底薪提成课时费算到半夜',
  },
];

/** 核心功能（价值导向） */
const FEATURES = [
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
    desc: '馆主·教师·家长一账号切换，各司其职',
  },
];

/** 选择理由（差异化优势） */
const REASONS = [
  {
    icon: 'mdi-heart-circle-outline',
    title: '懂行业，不折腾',
    desc: '由真实馆长、教练参与打磨，贴合每天的真实经营场景',
  },
  {
    icon: 'mdi-rocket-launch',
    title: '上手快',
    desc: '界面简洁克制，配置向导式引导，5 分钟即可跑通',
  },
  {
    icon: 'mdi-cash-check',
    title: '低成本',
    desc: '轻量工具级投入，换掉繁琐表格与群聊，物超所值',
  },
  {
    icon: 'mdi-update',
    title: '持续进化',
    desc: '每月迭代更新，认真倾听每一位场馆主的真实反馈',
  },
];

/** 入驻流程 */
const STEPS = [
  { step: '01', title: '填写申请', desc: '提交门店基本信息' },
  { step: '02', title: '专人对接', desc: '顾问 1 对 1 沟通需求' },
  { step: '03', title: '开通使用', desc: '配置完成，即刻上手' },
];

const About: React.FC = () => {
  usePrimaryNavigationBar();
  const { activeTheme } = useThemeStore();

  const handleEntry = useCallback(() => {
    Taro.navigateTo({ url: '/pages/store-entry/index' });
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
            <View className="flex items-center justify-center gap-[12rpx] mb-[36rpx]">
              <View className="w-[72rpx] h-[72rpx] rounded-full bg-white center shadow-soft">
                <Text className="text-[34rpx] font-black text-primary">SG</Text>
              </View>
              <Text className="text-[40rpx] font-black text-white tracking-wide">
                {BRAND_NAME_ZH}
              </Text>
            </View>

            {/* Slogan */}
            <Text className="block text-center text-[44rpx] font-black text-white leading-[1.35]">
              让场馆经营
              <Text className="mx-[8rpx] text-white/70">·</Text>
              更简单专业
            </Text>
            <Text className="block text-center text-[26rpx] text-white/85 mt-[20rpx] leading-relaxed">
              约课、消课、售卡、算薪、管数据
              <Text className="block">一套系统，全流程搞定</Text>
            </Text>

            {/* Hero CTA */}
            <View
              className="mt-[44rpx] h-[92rpx] rounded-[28rpx] bg-white center press-scale shadow-lg"
              onClick={handleEntry}
            >
              <Text className="text-[32rpx] font-bold text-primary">立即入驻</Text>
              <Icon name="mdi-chevron-right" size={28} color="primary" />
            </View>
          </View>
        </View>

        {/* ===== 数据背书（叠在 Hero 下方） ===== */}
        <View className="px-[32rpx] -mt-[48rpx] relative z-10">
          <View className="bg-card rounded-[28rpx] shadow-card px-[16rpx] py-[28rpx] flex">
            {STATS.map((item, index) => (
              <View key={item.label} className="relative flex-1 center-col">
                <Text className="text-[34rpx] font-black text-primary leading-none">
                  {item.value}
                </Text>
                <Text className="text-[22rpx] text-muted-foreground mt-[12rpx] text-center leading-tight">
                  {item.label}
                </Text>
                {index < STATS.length - 1 && (
                  <View className="absolute right-0 top-1/2 -translate-y-1/2 w-[2rpx] h-[44rpx] bg-border" />
                )}
              </View>
            ))}
          </View>
        </View>

        <View className="px-[32rpx] pt-[40rpx] pb-[180rpx] flex flex-col gap-[44rpx]">
          {/* ===== 痛点共鸣 ===== */}
          <View>
            <SectionHeader eyebrow="你是否也这样" title="场馆经营，真的不该这么累" />
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

          {/* ===== 核心功能 ===== */}
          <View>
            <SectionHeader eyebrow="核心能力" title="一套系统，覆盖经营全流程" />
            <View className="flex flex-wrap gap-[20rpx]">
              {FEATURES.map((item) => (
                <View
                  key={item.title}
                  className="w-[calc(50%-10rpx)] bg-card rounded-[24rpx] p-[26rpx] shadow-card"
                >
                  <View className="w-[64rpx] h-[64rpx] rounded-[20rpx] bg-primary-10 center mb-[16rpx]">
                    <Icon name={item.icon} size={32} color="primary" />
                  </View>
                  <Text className="text-[28rpx] font-bold text-foreground block">{item.title}</Text>
                  <Text className="text-[22rpx] text-muted-foreground mt-[8rpx] leading-relaxed block">
                    {item.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* ===== 选择理由 ===== */}
          <View>
            <SectionHeader
              eyebrow="为什么选择我们"
              title="不是软件公司做给你用，而是馆主做给自己用"
            />
            <View className="bg-card rounded-[28rpx] shadow-card p-[28rpx] flex flex-col gap-[28rpx]">
              {REASONS.map((item) => (
                <View key={item.title} className="flex items-start gap-[20rpx]">
                  <View className="w-[72rpx] h-[72rpx] rounded-full bg-primary-10 center flex-shrink-0">
                    <Icon name={item.icon} size={34} color="primary" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[28rpx] font-bold text-foreground block">
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

          {/* ===== 入驻流程 ===== */}
          <View>
            <SectionHeader eyebrow="入驻流程" title="三步开启数字化经营" />
            <View className="flex gap-[16rpx]">
              {STEPS.map((item, index) => (
                <View key={item.step} className="flex-1">
                  <View
                    className={cn(
                      'rounded-[24rpx] p-[24rpx]',
                      index === 0 ? 'bg-gradient-primary shadow-elegant' : 'bg-card shadow-card',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-[30rpx] font-black leading-none',
                        index === 0 ? 'text-white/90' : 'text-primary',
                      )}
                    >
                      {item.step}
                    </Text>
                    <Text
                      className={cn(
                        'block text-[26rpx] font-bold mt-[16rpx]',
                        index === 0 ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {item.title}
                    </Text>
                    <Text
                      className={cn(
                        'block text-[22rpx] mt-[8rpx] leading-relaxed',
                        index === 0 ? 'text-white/80' : 'text-muted-foreground',
                      )}
                    >
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ===== 收尾 CTA ===== */}
          <View className="bg-gradient-primary rounded-[28rpx] p-[36rpx] text-center shadow-elegant">
            <Text className="block text-[34rpx] font-black text-white">告别表格与群聊</Text>
            <Text className="block text-[26rpx] text-white/85 mt-[12rpx]">
              让{BRAND_NAME_ZH}帮你把场馆打理得井井有条
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== 底部悬浮入驻按钮 ===== */}
      <View className="fixed left-0 right-0 bottom-0 px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[16rpx] bg-gradient-to-t from-background via-background to-transparent z-50">
        <View
          className="h-[92rpx] rounded-[28rpx] bg-gradient-primary center shadow-lg press-scale"
          onClick={handleEntry}
        >
          <Text className="text-[32rpx] font-bold text-white">门店入驻</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * 分区标题：小眉标 + 主标题
 */
const SectionHeader: React.FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <View className="mb-[20rpx]">
    <View className="flex items-center gap-[8rpx] mb-[12rpx]">
      <View className="w-[8rpx] h-[8rpx] rounded-full bg-primary" />
      <Text className="text-[22rpx] font-medium text-primary tracking-wide">{eyebrow}</Text>
    </View>
    <Text className="block text-[32rpx] font-bold text-foreground leading-snug">{title}</Text>
  </View>
);

export default withRouteGuard(About);
