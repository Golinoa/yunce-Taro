/**
 * 使用帮助页 package-student/pages/help/index（家长端）
 *
 * 与教师端保持一致的设计风格：
 *   头部：Hi~ 问候 + 副标题 + 装饰图标
 *   功能入口：占位卡片横排（内容待填充）
 *   内容区：占位提示
 *   底部：联系客服 + 去反馈 双入口 + 保留「还有疑问」提示
 * 保留原生导航栏，标题「使用帮助」。全部使用 UnoCSS Token，随主题色联动。
 */
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useState } from 'react';
import Icon from '@/components/Icon';
import Dialog from '@/components/Dialog';
import { useThemeStore } from '@/stores/theme';

const CUSTOMER_WECHAT = 'by3737337';

/** 主题 key → CSS 类名映射 */
const THEME_CLASS_MAP: Record<string, string> = {
  orange: 'theme-orange',
  coral: 'theme-coral',
  blue: '',
};

const Help: React.FC = () => {
  const { activeTheme } = useThemeStore();
  const themeClass = THEME_CLASS_MAP[activeTheme] || '';

  const [serviceVisible, setServiceVisible] = useState(false);

  const handleFeedback = useCallback(() => {
    Taro.navigateTo({ url: '/package-settings/pages/feedback/index' });
  }, []);

  const handleCopyWechat = useCallback(() => {
    Taro.setClipboardData({
      data: CUSTOMER_WECHAT,
      success: () => setServiceVisible(false),
    });
  }, []);

  return (
    <View className={cn('min-h-screen bg-background flex flex-col', themeClass)}>
      {/* ====== 头部（Hi~ 问候 + 副标题 + 装饰图标） ====== */}
      <View className="bg-background px-[32rpx] pt-[24rpx] pb-[20rpx]">
        <View className="flex items-start justify-between">
          <View className="flex-1 pr-[16rp]">
            <Text className="text-[44rpx] font-bold text-foreground leading-tight">
              Hi~，有什么可以帮您！
            </Text>
            <Text className="mt-[12rpx] text-[26rpx] text-muted-foreground leading-relaxed block">
              家长端使用指引，陪伴孩子轻松学习
            </Text>
          </View>
          {/* 装饰图标 */}
          <View className="w-[100rpx] h-[100rpx] rounded-[28rpx] bg-primary/10 center flex-shrink-0 mt-[8rpx]">
            <Icon name="mdi-emoticon-happy-outline" size={48} color="primary" />
          </View>
        </View>
      </View>

      {/* ====== 功能入口：占位卡片横排（内容待填充） ====== */}
      <View className="px-[32rpx] pt-[16rpx] pb-[4rpx]">
        <View className="flex gap-[20rpx]">
          {[
            { icon: 'mdi-account-child-outline', label: '子女管理', color: '#8B5CF6' },
            { icon: 'mdi-calendar-clock-outline', label: '课程查看', color: '#3B82F6' },
            { icon: 'mdi-card-account-details-outline', label: '卡包课消', color: '#F59E0B' },
          ].map((item) => (
            <View
              key={item.label}
              className="flex-1 flex flex-col items-center py-[24rpx] rounded-[20rpx] bg-card shadow-card"
            >
              <View
                className="w-[80rpx] h-[80rpx] rounded-[18rpx] center mb-[12rpx]"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <Icon name={item.icon} size={36} color={item.color as any} />
              </View>
              <Text className="text-[24rpx] font-medium text-foreground text-center leading-tight">
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ====== 内容区（占位） ====== */}
      <ScrollView scrollY className="flex-1 mt-[24rpx]" showScrollbar={false}>
        <View className="px-[32rpx] pt-[8rpx] pb-[24rpx]">
          <View className="bg-card rounded-[28rpx] p-[48rpx] shadow-card flex flex-col items-center">
            <View className="w-[96rpx] h-[96rpx] rounded-[28rpx] bg-primary/10 center">
              <Icon name="mdi-help-circle-outline" size={48} color="primary" />
            </View>
            <Text className="mt-[24rpx] text-[30rpx] font-bold text-foreground">帮助内容整理中</Text>
            <Text className="mt-[12rpx] text-[26rpx] text-muted-foreground leading-relaxed text-center">
              家长端使用帮助正在努力编写，{'\n'}敬请期待更详细的图文指引。
            </Text>
          </View>

          {/* 保留「还有疑问」提示 */}
          <View className="mt-[40rpx] flex flex-col items-center gap-[12rpx]">
            <Text className="text-[24rpx] text-muted-foreground leading-relaxed text-center whitespace-pre-line">
              还有疑问？可联系你的门店，{'\n'}或到「我的 → 学员信箱」留言反馈
            </Text>
            <View className="flex items-center gap-[8rpx] press-scale" onClick={handleFeedback}>
              <Icon name="mdi-message-plus-outline" size={28} color="primary" />
              <Text className="text-[28rpx] font-medium text-primary">去反馈</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ====== 底部：联系客服 + 去反馈 双按钮 ====== */}
      <View className="px-[32rpx] pb-[calc(32rpx+env(safe-area-inset-bottom))] pt-[20rpx]">
        <View className="flex gap-[24rpx]">
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] border border-primary/30 bg-white center flex items-center justify-center gap-[10rpx] press-scale"
            onClick={() => setServiceVisible(true)}
          >
            <Icon name="mdi-headset" size={28} color="primary" />
            <Text className="text-[28rpx] font-medium text-primary">电话客服</Text>
          </View>
          <View
            className="flex-1 h-[88rpx] rounded-[24rpx] bg-primary center flex items-center justify-center gap-[10rpx] press-scale"
            onClick={handleFeedback}
          >
            <Icon name="mdi-message-plus-outline" size={28} color="#ffffff" />
            <Text className="text-[28rpx] font-semibold text-white">去反馈</Text>
          </View>
        </View>
      </View>

      {/* ====== 客服微信号弹框 ====== */}
      <Dialog visible={serviceVisible} onClose={() => setServiceVisible(false)} maskClosable>
        <View className="bg-card rounded-[32rpx] w-[560rpx] px-[40rpx] py-[44rpx] flex flex-col items-center">
          <Text className="text-[32rpx] font-bold text-foreground">联系客服</Text>
          <Text className="mt-[24rpx] text-[26rpx] text-muted-foreground leading-relaxed text-center">
            请添加客服微信，备注你的问题即可获得帮助
          </Text>
          <View
            className="mt-[32rpx] w-full bg-background rounded-[20rpx] py-[28rpx] flex items-center justify-center gap-[16rpx] press-scale"
            onClick={handleCopyWechat}
          >
            <Text className="text-[36rpx] font-bold text-primary tracking-wide">
              {CUSTOMER_WECHAT}
            </Text>
            <Icon name="mdi-content-copy" size={32} color="primary" />
          </View>
          <Text className="mt-[20rpx] text-[22rpx] text-muted-foreground">点击上方微信号即可复制</Text>
        </View>
      </Dialog>
    </View>
  );
};

export default Help;
