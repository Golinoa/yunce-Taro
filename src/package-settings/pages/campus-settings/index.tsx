/**
 * 校区设置首页 pages/campus-settings/index
 *
 * 顶部主校区卡片（含统计、地址、电话、运营数据入口）
 * + 通知管理分组 + 校区管理分组
 * 使用原生导航栏，不覆盖小程序头部
 *
 * 对齐设计稿 campus-settings.html：
 * - 卡片：margin:16px + border:1px + 圆角20px + padding:22px
 * - icon：48px/圆角14px/字号24px
 * - 统计行：grid 3列 / 值22px 800 / 标签11px / 上下排列
 * - 地址/电话：12px + svg icon
 * - 运营数据：左对齐 + chart icon + 右箭头
 */
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import BottomSheet from '@/components/BottomSheet';
import Empty from '@/components/Empty';
import FormInput from '@/components/FormInput';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { useCampusStore } from '@/stores/campus';
import type { CampusUIModel } from '@/types/campus';

/** 设置项配置 */
interface SettingItem {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  route: string;
}

/** 通知管理组 */
const NOTIFY_ITEMS: SettingItem[] = [
  {
    icon: 'mdi-bell-outline',
    iconBg: 'bg-purple-bg',
    iconColor: 'purple',
    title: '通知设置',
    desc: '学员与教师消息推送',
    route: '/package-settings/pages/campus-settings/notify',
  },
];

/** 校区管理组 */
const CAMPUS_ITEMS: SettingItem[] = [
  {
    icon: 'mdi-office-building-cog',
    iconBg: 'bg-success-bg',
    iconColor: 'success',
    title: '机构名称',
    desc: '设置机构名称',
    route: '__org_name__',
  },
  {
    icon: 'mdi-office-building',
    iconBg: 'bg-primary-bg',
    iconColor: 'primary',
    title: '分校区管理',
    desc: '管理自营校区与合作机构',
    route: '/package-settings/pages/campus-settings/sub-campus',
  },
  {
    icon: 'mdi-cash',
    iconBg: 'bg-info-bg',
    iconColor: 'info',
    title: '发薪日设置',
    desc: '每月15日发薪',
    route: '/package-settings/pages/campus-settings/pay-day',
  },
  {
    icon: 'mdi-book-open-variant',
    iconBg: 'bg-accent-bg',
    iconColor: 'accent',
    title: '校区科目',
    desc: '钢琴、舞蹈、美术等',
    route: '/package-settings/pages/campus-settings/subjects',
  },
  {
    icon: 'mdi-calendar-clock',
    iconBg: 'bg-amber-10',
    iconColor: 'amber',
    title: '节假日设置',
    desc: '法定节假日与自定义休息日',
    route: '/package-settings/pages/campus-settings/holidays',
  },
];

/** 格式化营收金额 */
const formatRevenue = (revenue: number, unit?: string): { val: string; unit: string } => {
  if (unit) return { val: String(revenue), unit };
  if (revenue >= 10000) {
    const wan = revenue / 10000;
    return { val: wan >= 10 ? wan.toFixed(0) : wan.toFixed(1), unit: '万' };
  }
  return { val: String(revenue), unit: '' };
};

const CampusSettings: React.FC = () => {
  const { campuses, orgName, setOrgName, fetchCampuses, loading, error } = useCampusStore();
  const [showCampusPicker, setShowCampusPicker] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState('');
  const [showOrgNameSheet, setShowOrgNameSheet] = useState(false);
  const [editOrgName, setEditOrgName] = useState('');
  const [savingOrgName, setSavingOrgName] = useState(false);

  // 页面显示时加载数据
  const reload = useCallback(async () => {
    await fetchCampuses();
  }, [fetchCampuses]);

  Taro.useDidShow(() => {
    void reload();
  });

  // 当前选中的校区（默认主校区）
  const currentCampus = useMemo(
    () =>
      campuses.find((c) => c.id === selectedCampusId) ||
      campuses.find((c) => c.isMain) ||
      campuses[0] ||
      null,
    [campuses, selectedCampusId],
  );

  // 营收格式化
  const revenueDisplay = useMemo(() => {
    if (!currentCampus) return { val: '0', unit: '' };
    return formatRevenue(currentCampus.stats.revenue, currentCampus.stats.revenueUnit);
  }, [currentCampus]);

  const handleSelectCampus = useCallback((id: string) => {
    setSelectedCampusId(id);
    setShowCampusPicker(false);
  }, []);

  const handleNavigate = useCallback(
    (route: string) => {
      if (route === '__org_name__') {
        setEditOrgName(orgName);
        setShowOrgNameSheet(true);
        return;
      }
      if (!route) {
        Taro.showToast({ title: '页面入口未配置', icon: 'none' });
        return;
      }
      Taro.navigateTo({ url: route });
    },
    [orgName],
  );

  const handleCampusData = useCallback(() => {
    if (!currentCampus) {
      Taro.showToast({ title: '未找到校区信息', icon: 'none' });
      return;
    }
    Taro.navigateTo({
      url: `/package-settings/pages/campus-settings/campus-data/index?id=${currentCampus.id}&name=${encodeURIComponent(currentCampus.name)}`,
    });
  }, [currentCampus]);

  const handleSaveOrgName = useCallback(() => {
    if (savingOrgName) return;
    if (!editOrgName.trim()) {
      Taro.showToast({ title: '请输入机构名称', icon: 'none' });
      return;
    }

    setSavingOrgName(true);
    try {
      setOrgName(editOrgName.trim());
      setShowOrgNameSheet(false);
      Taro.showToast({ title: '保存成功', icon: 'success' });
    } finally {
      setSavingOrgName(false);
    }
  }, [editOrgName, savingOrgName, setOrgName]);

  /** 渲染设置项 — 设计稿：.card-e / border-radius:14px / padding:12px 14px / gap:10px */
  const renderSettingItem = (item: SettingItem) => {
    const desc = item.route === '__org_name__' ? orgName : item.desc;
    return (
      <View
        key={item.title}
        className="flex flex-row items-center bg-white rounded-[28rpx] shadow-soft px-[28rpx] py-[24rpx] mb-[20rpx] press-bg"
        onClick={() => handleNavigate(item.route)}
      >
        {/* 图标 — 设计稿：.icon-sm / 38px/圆角11px/svg 19px */}
        <View
          className={cn(
            'w-[76rpx] h-[76rpx] rounded-[22rpx] flex items-center justify-center mr-[20rpx] flex-shrink-0',
            item.iconBg,
          )}
        >
          <Icon name={item.icon} size={38} color={item.iconColor} />
        </View>
        {/* 文字 — 设计稿：.info / flex:1 / .name 14px/600 / .desc 11px/mt:2px 上下排列 */}
        <View className="flex-1 min-w-0 flex flex-col">
          <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
          <Text className="text-[22rpx] text-muted-foreground mt-[4rpx] truncate">{desc}</Text>
        </View>
        {/* 箭头 — 设计稿：.btn-arrow / 28px/圆角8px/primary-bg/svg 14px */}
        <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="mdi-chevron-right" size={28} color="primary" />
        </View>
      </View>
    );
  };

  if (loading && !campuses.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen bg-gradient-subtle flex items-center justify-center">
          <Loading text="加载校区设置中..." />
        </View>
      </PageContainer>
    );
  }

  if (error && !campuses.length) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen bg-gradient-subtle px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={error}
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  if (!currentCampus) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen bg-gradient-subtle px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-office-building-outline"
            description="暂无校区信息"
            actionText="重新加载"
            onAction={() => void reload()}
          />
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer safeBottom>
      {/* ============================================ */}
      {/* 主校区卡片 — 对齐设计稿 .campus-card */}
      {/* ============================================ */}
      <View className="mx-[32rpx] mt-[32rpx] bg-white rounded-[40rpx] shadow-soft p-[44rpx] relative overflow-hidden border-[2rpx] border-border">
        {/* 右上角三角装饰 + 小圆点 */}
        <View
          className="absolute top-0 right-0 w-[160rpx] h-[160rpx] rounded-br-[40rpx]"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, hsl(168 55% 58% / 0.08) 50%)',
          }}
        />
        <View className="absolute top-[24rpx] right-[24rpx] w-[16rpx] h-[16rpx] rounded-full bg-primary/40" />

        {/* Header：校区信息 + 切换按钮 */}
        <View className="flex flex-row items-center justify-between mb-[36rpx] relative z-1">
          <View className="flex flex-row items-center gap-[28rpx]">
            {/* 校区图标 — 设计稿：48px/圆角14px/字号24px */}
            <View
              className="w-[96rpx] h-[96rpx] rounded-[28rpx] flex items-center justify-center"
              style={{
                background: currentCampus.iconGradient,
                boxShadow: '0 8rpx 24rpx hsl(168 55% 58% / 0.3)',
              }}
            >
              <Text className="text-[48rpx] text-white">{currentCampus.icon}</Text>
            </View>
            {/* 名称+类型标签 */}
            <View>
              <Text className="text-[36rpx] font-bold text-foreground">{currentCampus.name}</Text>
              {/* 铭牌 — 主校区暗金色，其他主题色淡色 / 设计稿：.campus-type-tag */}
              <View className="flex flex-row items-center gap-[8rpx] mt-[6rpx]">
                <View
                  className={cn(
                    'flex flex-row items-center gap-[8rpx] px-[16rpx] py-[4rpx] rounded-[12rpx]',
                    currentCampus.isMain ? 'bg-amber-600/15' : 'bg-primary/15',
                  )}
                >
                  <View
                    className={cn(
                      'w-[10rpx] h-[10rpx] rounded-full',
                      currentCampus.isMain ? 'bg-amber-600' : 'bg-primary',
                    )}
                  />
                  <Text
                    className={cn(
                      'text-[20rpx] font-semibold',
                      currentCampus.isMain ? 'text-amber-700' : 'text-primary',
                    )}
                  >
                    {currentCampus.isMain
                      ? '主校区'
                      : currentCampus.type === 'self'
                        ? '自营校区'
                        : '合作机构'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {/* 切换校区按钮 — 设计稿：padding 9px 16px / 圆角12px */}
          {campuses.length > 1 && (
            <View
              className="bg-primary px-[32rpx] py-[18rpx] rounded-[24rpx]"
              style={{ boxShadow: '0 8rpx 24rpx hsl(168 55% 58% / 0.3)' }}
              onClick={() => setShowCampusPicker(true)}
            >
              <Text className="text-[26rpx] text-white font-semibold">切换校区</Text>
            </View>
          )}
        </View>

        {/* 统计行 — 设计稿：grid 3列 */}
        <View className="grid grid-cols-3 gap-[20rpx] mb-[32rpx]">
          <View className="bg-campus-card border-[2rpx] border-solid border-campus-card rounded-[24rpx] py-[28rpx] px-[20rpx] flex flex-col items-center">
            <Text className="text-[44rpx] font-extrabold text-foreground leading-tight">
              {currentCampus.stats.students}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">学生</Text>
          </View>
          <View className="bg-campus-card border-[2rpx] border-solid border-campus-card rounded-[24rpx] py-[28rpx] px-[20rpx] flex flex-col items-center">
            <Text className="text-[44rpx] font-extrabold text-foreground leading-tight">
              {currentCampus.stats.teachers}
            </Text>
            <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">教师</Text>
          </View>
          <View className="bg-campus-card border-[2rpx] border-solid border-campus-card rounded-[24rpx] py-[28rpx] px-[20rpx] flex flex-col items-center">
            <View className="flex flex-row items-baseline justify-center">
              <Text className="text-[44rpx] font-extrabold text-foreground leading-tight">
                {revenueDisplay.val}
              </Text>
              {revenueDisplay.unit && (
                <Text className="text-[24rpx] text-muted-foreground ml-[4rpx]">
                  {revenueDisplay.unit}
                </Text>
              )}
            </View>
            <Text className="text-[22rpx] text-muted-foreground mt-[8rpx]">月营收</Text>
          </View>
        </View>

        {/* 地址 — 设计稿：12px + svg icon 16px */}
        {currentCampus.address && (
          <View className="flex flex-row items-center gap-[12rpx] mt-[16rpx]">
            <Icon name="mdi-map-marker" size="sm" color="primary" />
            <Text className="text-[24rpx] text-muted-foreground flex-1">
              {currentCampus.address}
            </Text>
          </View>
        )}

        {/* 电话 — 设计稿：12px + phone svg icon 16px */}
        {currentCampus.phone && (
          <View className="flex flex-row items-center gap-[12rpx] mt-[16rpx]">
            <Icon name="mdi-phone" size="sm" color="primary" />
            <Text className="text-[24rpx] text-muted-foreground">{currentCampus.phone}</Text>
          </View>
        )}

        {/* 运营数据入口 — 设计稿：.campus-detail-row.link / margin-top:10px / padding-top:10px / border-top / gap:6px / font-size:12px / primary */}
        <View
          className="flex flex-row items-center gap-[12rpx] pt-[20rpx] mt-[20rpx] border-t-d5e8e0"
          onClick={handleCampusData}
        >
          <Icon name="mdi-chart-bar" size="sm" color="primary" />
          <Text className="text-[24rpx] text-primary">查看运营数据</Text>
          <View className="ml-auto">
            <Icon name="mdi-chevron-right" size={28} color="muted" />
          </View>
        </View>
      </View>

      {/* ============================================ */}
      {/* 通知管理分组 */}
      {/* ============================================ */}
      <View className="px-[32rpx] mt-[36rpx]">
        <Text className="text-[24rpx] font-semibold text-muted-foreground uppercase tracking-wide ml-[8rpx] mb-[16rpx]">
          通知管理
        </Text>
        {NOTIFY_ITEMS.map(renderSettingItem)}
      </View>

      {/* ============================================ */}
      {/* 校区管理分组 */}
      {/* ============================================ */}
      <View className="px-[32rpx] mt-[36rpx]">
        <Text className="text-[24rpx] font-semibold text-muted-foreground uppercase tracking-wide ml-[8rpx] mb-[16rpx]">
          校区管理
        </Text>
        {CAMPUS_ITEMS.map(renderSettingItem)}
      </View>

      {/* ============================================ */}
      {/* 校区选择弹窗 */}
      {/* ============================================ */}
      <BottomSheet
        visible={showCampusPicker}
        title="选择校区"
        onClose={() => setShowCampusPicker(false)}
      >
        {campuses.map((campus) => (
          <CampusPickerItem
            key={campus.id}
            campus={campus}
            active={campus.id === (currentCampus?.id || '')}
            onSelect={handleSelectCampus}
          />
        ))}
      </BottomSheet>

      {/* 机构名称编辑弹窗 */}
      <BottomSheet
        visible={showOrgNameSheet}
        title="机构名称"
        onClose={() => setShowOrgNameSheet(false)}
      >
        <View className="px-[32rpx] py-[32rpx]">
          <FormInput
            label="机构名称"
            placeholder="请输入机构名称"
            value={editOrgName}
            onInput={(e) => setEditOrgName(e.detail.value)}
          />
          <Text className="text-[22rpx] text-muted-foreground mt-[16rpx] block">
            机构名称将显示在校区名称前缀、分享卡片等位置
          </Text>
          <View
            className={`rounded-[48rpx] py-[28rpx] flex items-center justify-center mt-[32rpx] ${savingOrgName ? 'bg-muted' : 'bg-primary press-scale'}`}
            onClick={savingOrgName ? undefined : handleSaveOrgName}
          >
            <Text
              className={`text-[30rpx] font-semibold ${savingOrgName ? 'text-muted-foreground' : 'text-white'}`}
            >
              {savingOrgName ? '保存中...' : '保存'}
            </Text>
          </View>
        </View>
      </BottomSheet>
    </PageContainer>
  );
};

/** 校区选择项 — 对齐设计稿：方形勾选框+彩色图标 */
interface CampusPickerItemProps {
  campus: CampusUIModel;
  active: boolean;
  onSelect: (id: string) => void;
}

const CampusPickerItem: React.FC<CampusPickerItemProps> = ({ campus, active, onSelect }) => (
  <View
    className={cn(
      'flex flex-row items-center mx-4 my-2 p-[28rpx] rounded-[28rpx] border-[2rpx]',
      active ? 'border-primary bg-primary/5' : 'border-border bg-white',
    )}
    onClick={() => onSelect(campus.id)}
  >
    {/* 彩色图标 — 设计稿：38px/圆角10px */}
    <View
      className="w-[76rpx] h-[76rpx] rounded-[20rpx] flex items-center justify-center mr-[28rpx]"
      style={{ background: campus.iconGradient }}
    >
      <Text className="text-[36rpx]">{campus.icon}</Text>
    </View>
    {/* 信息 */}
    <View className="flex-1">
      <Text className="text-[28rpx] font-semibold text-foreground">{campus.name}</Text>
      <Text className="text-[22rpx] text-muted-foreground mt-[4rpx]">
        {campus.stats.students}学生 ·{' '}
        {campus.isMain ? '主校区' : campus.type === 'self' ? '分校区' : '合作机构'}
      </Text>
    </View>
    {/* 方形勾选框 — 设计稿：20px/圆角6px */}
    <View
      className={cn(
        'w-[40rpx] h-[40rpx] rounded-[12rpx] flex items-center justify-center border-[3rpx]',
        active ? 'bg-primary border-primary' : 'border-border',
      )}
    >
      {active && <Icon name="mdi-check" size={28} color="white" />}
    </View>
  </View>
);

export default CampusSettings;
