/**
 * 运营数据详情页 pages/campus-settings/campus-data
 *
 * 对齐设计稿 campusDataPage：
 * - 时间维度切换（本月/季度/年度/全部）
 * - 概览4宫格（学员/营收/课时/教师）
 * - 学员分析、财务概览、营收趋势、课时与教室、科目排行、教师概况
 * - 无数据时展示空数据页面
 */
import { View, Text } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import cn from 'classnames';
import { useState, useMemo, useCallback } from 'react';
import Empty from '@/components/Empty';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import PageContainer from '@/components/PageContainer';
import { campusDataService } from '@/services/campus';
import { useCampusStore } from '@/stores/campus';
import type { DataPeriod, PeriodData, CampusOperationalData, CampusUIModel } from '@/types/campus';

/** 时间维度标签 */
const PERIOD_TABS: { value: DataPeriod; label: string }[] = [
  { value: 'month', label: '本月' },
  { value: 'quarter', label: '季度' },
  { value: 'year', label: '年度' },
  { value: 'all', label: '全部' },
];

/** 时间维度对应文案 */
const PERIOD_LABEL_MAP: Record<DataPeriod, string> = {
  month: '本月',
  quarter: '本季度',
  year: '本年度',
  all: '累计',
};

/** 月份标签 */
const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

/** 格式化金额（元→万元，1位小数） */
function formatWan(yuan: number): string {
  if (yuan >= 10000) {
    return (yuan / 10000).toFixed(1);
  }
  return yuan.toString();
}

/** 格式化金额（元→万元，2位小数） */
function formatWan2(yuan: number): string {
  return (yuan / 10000).toFixed(2);
}

/** 续费率颜色 — 设计稿：≥85 accent / ≥75 amber / <75 danger */
function renewalColor(rate: number): string {
  if (rate >= 85) return 'text-accent';
  if (rate >= 75) return 'text-amber';
  return 'text-danger';
}

/** 续费率进度条颜色 */
function renewalBarColor(rate: number): string {
  if (rate >= 85) return 'bg-accent';
  if (rate >= 75) return 'bg-amber';
  return 'bg-danger';
}

/** 出勤率颜色 */
function attendColor(rate: number): string {
  if (rate >= 90) return 'text-accent';
  if (rate >= 80) return 'text-amber';
  return 'text-danger';
}

/** 利用率颜色 */
function utilColor(rate: number): string {
  if (rate >= 80) return 'text-accent';
  return 'text-amber';
}

/** 利用率进度条颜色 */
function utilBarColor(rate: number): string {
  if (rate >= 80) return 'bg-accent';
  return 'bg-amber';
}

/** 排名样式 — 设计稿：top1 金色 / top2 银色 / top3 铜色 / 其他灰色 */
function rankStyle(idx: number): string {
  if (idx === 0) return 'bg-class-amber text-white';
  if (idx === 1) return 'bg-gray-400 text-white';
  if (idx === 2) return 'bg-amber-700 text-white';
  return 'bg-muted text-muted-foreground';
}

export default function CampusDataPage() {
  const [currentCampusId, setCurrentCampusId] = useState('');
  const [period, setPeriod] = useState<DataPeriod>('month');
  const [data, setData] = useState<CampusOperationalData | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { campuses, fetchCampuses } = useCampusStore();

  /** 校区选项列表：全部校区 + 各校区 */
  const campusOptions = useMemo(() => {
    const all: { id: string; name: string } = { id: 'all', name: '全部校区' };
    return [all, ...campuses.map((c: CampusUIModel) => ({ id: c.id, name: c.name }))];
  }, [campuses]);

  /** 当前选中校区名称 */
  const currentCampusName = useMemo(() => {
    const opt = campusOptions.find((c) => c.id === currentCampusId);
    return opt?.name ?? '';
  }, [campusOptions, currentCampusId]);

  /** 加载运营数据 */
  const loadData = useCallback(async (campusId: string) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await campusDataService.get(campusId);
      setData(result);
    } catch {
      setLoadError('运营数据加载失败，请稍后重试');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useLoad((options) => {
    const id = (options as Record<string, string>)?.id ?? 'all';
    setCurrentCampusId(id);
    void fetchCampuses();
    void loadData(id);
  });

  /** 切换校区 */
  const handleSwitchCampus = useCallback(
    (id: string) => {
      setCurrentCampusId(id);
      loadData(id);
      setShowPicker(false);
    },
    [loadData],
  );

  /** 当前时间维度数据 */
  const currentData: PeriodData | null = useMemo(() => {
    if (!data) return null;
    return data[period];
  }, [data, period]);

  /** 营收趋势柱状图数据 */
  const chartData = useMemo(() => {
    if (!data) return [];
    if (period === 'month')
      return data.monthlyRevenue.slice(6).map((v, i) => ({ value: v, label: MONTH_LABELS[6 + i] }));
    if (period === 'quarter')
      return data.monthlyRevenue.slice(9).map((v, i) => ({ value: v, label: MONTH_LABELS[9 + i] }));
    return data.monthlyRevenue.map((v, i) => ({ value: v, label: MONTH_LABELS[i] }));
  }, [data, period]);

  const chartMax = useMemo(() => Math.max(...chartData.map((d) => d.value), 1), [chartData]);

  const handleSwitchTab = useCallback((tab: DataPeriod) => {
    setPeriod(tab);
  }, []);

  // ===== 空数据页面 =====
  if (loading) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen flex items-center justify-center">
          <Loading text="加载运营数据中..." />
        </View>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer safeBottom>
        <View className="min-h-screen px-[32rpx] flex items-center justify-center">
          <Empty
            icon="mdi-alert-circle"
            description={loadError}
            actionText="重新加载"
            onAction={() => void loadData(currentCampusId || 'all')}
          />
        </View>
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <PageContainer safeBottom>
        <View className="px-[32rpx] pt-[200rpx]">
          <Empty
            icon="mdi-chart-box-outline"
            description="该校区尚未产生运营数据，开始排课后数据将自动生成"
            actionText="返回上一页"
            onAction={() => void fetchCampuses()}
          />
        </View>
      </PageContainer>
    );
  }

  if (!currentData) return null;

  const stu = currentData.students;
  const fin = currentData.finance;
  const cou = currentData.courses;
  const tea = currentData.teachers;
  const room = currentData.rooms;
  const periodLabel = PERIOD_LABEL_MAP[period];
  const netChange = stu.newThis - stu.leftThis;

  return (
    <PageContainer safeBottom>
      {/* 校区选择器 — 下拉切换校区 */}
      <View className="px-[32rpx] pt-[16rpx] pb-[8rpx] relative">
        <View
          className="flex flex-row items-center gap-[12rpx] press-bg py-[8rpx] px-[16rpx] rounded-[16rpx] self-start"
          onClick={() => setShowPicker((prev) => !prev)}
        >
          <Icon name="mdi-office-building" size="sm" color="primary" />
          <Text className="text-[30rpx] font-semibold text-foreground">{currentCampusName}</Text>
          <Icon name={showPicker ? 'mdi-chevron-up' : 'mdi-chevron-down'} size="sm" color="muted" />
        </View>

        {/* 下拉选项 */}
        {showPicker && (
          <>
            <View
              className="fixed inset-0 z-40"
              style={{ background: 'transparent' }}
              onClick={() => setShowPicker(false)}
            />
            <View className="absolute left-[32rpx] top-[80rpx] z-50 bg-white rounded-[16rpx] shadow-card min-w-[280rpx] overflow-hidden">
              {campusOptions.map((opt) => (
                <View
                  key={opt.id}
                  className={cn(
                    'flex flex-row items-center px-[28rpx] py-[20rpx] press-bg',
                    opt.id === currentCampusId && 'bg-primary-bg',
                  )}
                  onClick={() => handleSwitchCampus(opt.id)}
                >
                  {opt.id === currentCampusId && (
                    <Icon name="mdi-check" size="sm" color="primary" className="mr-[8rpx]" />
                  )}
                  <Text
                    className={cn(
                      'text-[28rpx]',
                      opt.id === currentCampusId ? 'text-primary font-semibold' : 'text-foreground',
                    )}
                  >
                    {opt.name}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>

      {/* 时间维度切换 — 设计稿：.data-tabs / border / 圆角8px */}
      <View className="mx-[32rpx] my-[16rpx] flex flex-row border border-border rounded-[16rpx] overflow-hidden">
        {PERIOD_TABS.map((tab) => (
          <View
            key={tab.value}
            className={cn(
              'flex-1 py-[16rpx] flex items-center justify-center',
              period === tab.value ? 'bg-primary' : 'bg-transparent',
            )}
            onClick={() => handleSwitchTab(tab.value)}
          >
            <Text
              className={cn(
                'text-[26rpx] font-medium',
                period === tab.value ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {tab.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ===== 概览4宫格 — 设计稿：.data-overview / grid 4列 / gap 8px ===== */}
      <View className="grid grid-cols-4 gap-[16rpx] px-[32rpx] mb-[24rpx]">
        {/* 在读学员 — highlight 边框 */}
        <View className="bg-card rounded-[24rpx] py-[20rpx] px-[8rpx] flex flex-col items-center shadow-card border border-primary/30">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-primary/10 flex items-center justify-center mb-[8rpx]">
            <Text className="text-[28rpx]">👥</Text>
          </View>
          <Text className="text-[20rpx] text-muted-foreground mb-[4rpx]">在读学员</Text>
          <Text className="text-[36rpx] font-bold text-foreground leading-tight">
            {stu.total}
            <Text className="text-[20rpx] font-normal text-muted-foreground">人</Text>
          </Text>
          <Text className={cn('text-[20rpx]', netChange >= 0 ? 'text-accent' : 'text-danger')}>
            {netChange >= 0 ? '+' : ''}
            {netChange}
          </Text>
        </View>
        {/* 营收 — 设计稿：amber-bg icon */}
        <View className="bg-card rounded-[24rpx] py-[20rpx] px-[8rpx] flex flex-col items-center shadow-card">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-amber-10 flex items-center justify-center mb-[8rpx]">
            <Text className="text-[28rpx]">💰</Text>
          </View>
          <Text className="text-[20rpx] text-muted-foreground mb-[4rpx]">{periodLabel}营收</Text>
          <Text className="text-[36rpx] font-bold text-foreground leading-tight">
            {formatWan(fin.revenue)}
            <Text className="text-[20rpx] font-normal text-muted-foreground">万</Text>
          </Text>
          <Text className="text-[20rpx] text-accent">净{formatWan(fin.netIncome)}万</Text>
        </View>
        {/* 课时 — 设计稿：info-bg icon */}
        <View className="bg-card rounded-[24rpx] py-[20rpx] px-[8rpx] flex flex-col items-center shadow-card">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-info/10 flex items-center justify-center mb-[8rpx]">
            <Text className="text-[28rpx]">📚</Text>
          </View>
          <Text className="text-[20rpx] text-muted-foreground mb-[4rpx]">{periodLabel}课时</Text>
          <Text className="text-[36rpx] font-bold text-foreground leading-tight">
            {cou.totalHours}
            <Text className="text-[20rpx] font-normal text-muted-foreground">节</Text>
          </Text>
          <Text className="text-[20rpx] text-accent">出勤{cou.attendanceRate}%</Text>
        </View>
        {/* 教师 — 设计稿：accent-bg icon */}
        <View className="bg-card rounded-[24rpx] py-[20rpx] px-[8rpx] flex flex-col items-center shadow-card">
          <View className="w-[56rpx] h-[56rpx] rounded-[16rpx] bg-accent/10 flex items-center justify-center mb-[8rpx]">
            <Text className="text-[28rpx]">👨‍🏫</Text>
          </View>
          <Text className="text-[20rpx] text-muted-foreground mb-[4rpx]">教师</Text>
          <Text className="text-[36rpx] font-bold text-foreground leading-tight">
            {tea?.total ?? '-'}
          </Text>
          {tea && (
            <Text className="text-[20rpx] text-muted-foreground">
              全{tea.fullTime}/兼{tea.partTime}
            </Text>
          )}
        </View>
      </View>

      {/* ===== 学员分析 — 设计稿：.data-section ===== */}
      <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
        <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
          <Text className="text-[28rpx]">👥</Text>
          <Text className="text-[28rpx] font-semibold text-foreground">学员分析</Text>
        </View>
        <View className="grid grid-cols-2 gap-0">
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">在读学员</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">{stu.total} 人</Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">{periodLabel}新增</Text>
            <Text className="text-[28rpx] font-semibold text-accent">+{stu.newThis}</Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">{periodLabel}流失</Text>
            <Text className="text-[28rpx] font-semibold text-danger">-{stu.leftThis}</Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">净增</Text>
            <Text
              className={cn(
                'text-[28rpx] font-semibold',
                netChange >= 0 ? 'text-accent' : 'text-danger',
              )}
            >
              {netChange >= 0 ? '+' : ''}
              {netChange}
            </Text>
          </View>
        </View>
        <View className="flex flex-row justify-between items-center mt-[8rpx]">
          <Text className="text-[24rpx] text-muted-foreground">续费率</Text>
          <Text className={cn('text-[26rpx] font-semibold', renewalColor(stu.renewalRate))}>
            {stu.renewalRate}%
          </Text>
        </View>
        <View className="h-[8rpx] bg-muted rounded-full mt-[8rpx]">
          <View
            className={cn('h-full rounded-full transition-all', renewalBarColor(stu.renewalRate))}
            style={{ width: `${stu.renewalRate}%` }}
          />
        </View>
      </View>

      {/* ===== 财务概览 — 设计稿：.data-section / 净收入 border-top primary ===== */}
      <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
        <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
          <Text className="text-[28rpx]">💰</Text>
          <Text className="text-[28rpx] font-semibold text-foreground">财务概览</Text>
        </View>
        <View className="grid grid-cols-2 gap-0">
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">{periodLabel}营收</Text>
            <Text className="text-[28rpx] font-semibold text-accent">
              {formatWan2(fin.revenue)} 万
            </Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">{periodLabel}支出</Text>
            <Text className="text-[28rpx] font-semibold text-danger">
              {formatWan2(fin.expense)} 万
            </Text>
          </View>
        </View>
        <View className="flex flex-row justify-between items-center mt-[8rpx]">
          <Text className="text-[24rpx] text-muted-foreground">课时费</Text>
          <View className="flex flex-row items-center">
            <Text className="text-[26rpx] font-semibold text-foreground">
              {formatWan2(fin.courseFee)} 万
            </Text>
            <Text className="text-[22rpx] text-muted-foreground ml-[8rpx]">
              {((fin.courseFee / fin.revenue) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
        <View className="flex flex-row justify-between items-center">
          <Text className="text-[24rpx] text-muted-foreground">教材费</Text>
          <View className="flex flex-row items-center">
            <Text className="text-[26rpx] font-semibold text-foreground">
              {formatWan2(fin.materialFee)} 万
            </Text>
            <Text className="text-[22rpx] text-muted-foreground ml-[8rpx]">
              {((fin.materialFee / fin.revenue) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
        <View className="flex flex-row justify-between items-center">
          <Text className="text-[24rpx] text-muted-foreground">其他收入</Text>
          <View className="flex flex-row items-center">
            <Text className="text-[26rpx] font-semibold text-foreground">
              {formatWan2(fin.otherFee)} 万
            </Text>
            <Text className="text-[22rpx] text-muted-foreground ml-[8rpx]">
              {((fin.otherFee / fin.revenue) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
        {/* 净收入 — 设计稿：border-top primary / 加粗 / accent 色 */}
        <View className="flex flex-row justify-between items-center border-t-2 border-primary mt-[8rpx] pt-[16rpx]">
          <Text className="text-[26rpx] font-semibold text-foreground">净收入</Text>
          <View className="flex flex-row items-center">
            <Text className="text-[30rpx] font-bold text-accent">
              {formatWan2(fin.netIncome)} 万
            </Text>
            <Text className="text-[22rpx] text-accent font-semibold ml-[8rpx]">
              {((fin.netIncome / fin.revenue) * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* ===== 营收趋势（柱状图） — 设计稿：.mini-chart ===== */}
      {chartData.length > 0 && (
        <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
          <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
            <Text className="text-[28rpx]">📈</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">营收趋势</Text>
          </View>
          {/* 设计稿：.mini-chart / height 64px / gap 4px / bar max-width 24px */}
          <View className="flex flex-row items-end gap-[8rpx] h-[128rpx] py-[8rpx]">
            {chartData.map((d, i) => {
              const height = Math.max(8, (d.value / chartMax) * 96);
              const isLast = i === chartData.length - 1;
              return (
                <View key={i} className="flex-1 flex flex-col items-center gap-[4rpx]">
                  <View
                    className={cn(
                      'w-full max-w-[48rpx] rounded-t-[6rpx] min-h-[8rpx]',
                      isLast ? 'bg-primary' : 'bg-primary-glow',
                    )}
                    style={{ height: `${height}rpx` }}
                  />
                  <Text className="text-[18rpx] text-muted-foreground">{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ===== 课时与教室 — 设计稿：.data-section ===== */}
      <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
        <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
          <Text className="text-[28rpx]">⏰</Text>
          <Text className="text-[28rpx] font-semibold text-foreground">课时与教室</Text>
        </View>
        <View className="grid grid-cols-2 gap-0">
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">{periodLabel}总课时</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">{cou.totalHours} 节</Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">平均班容</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">
              {cou.avgClassSize} 人
            </Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">出勤率</Text>
            <Text className={cn('text-[28rpx] font-semibold', attendColor(cou.attendanceRate))}>
              {cou.attendanceRate}%
            </Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">补课率</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">{cou.makeupRate}%</Text>
          </View>
        </View>
        {room && (
          <>
            <View className="flex flex-row justify-between items-center mt-[8rpx]">
              <Text className="text-[24rpx] text-muted-foreground">教室数</Text>
              <Text className="text-[26rpx] font-semibold text-foreground">{room.total} 间</Text>
            </View>
            <View className="flex flex-row justify-between items-center">
              <Text className="text-[24rpx] text-muted-foreground">教室利用率</Text>
              <Text className={cn('text-[26rpx] font-semibold', utilColor(room.utilization))}>
                {room.utilization}%
              </Text>
            </View>
            <View className="h-[8rpx] bg-muted rounded-full mt-[8rpx]">
              <View
                className={cn('h-full rounded-full transition-all', utilBarColor(room.utilization))}
                style={{ width: `${room.utilization}%` }}
              />
            </View>
          </>
        )}
      </View>

      {/* ===== 科目排行 — 设计稿：.data-section / rank-item ===== */}
      {data.subjectRank.length > 0 && (
        <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
          <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
            <Text className="text-[28rpx]">🏆</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">科目排行</Text>
          </View>
          {data.subjectRank.map((s, i) => (
            <View
              key={s.name}
              className={cn(
                'flex flex-row items-center gap-[16rpx] py-[12rpx]',
                i < data.subjectRank.length - 1 ? 'border-b border-border' : '',
              )}
            >
              {/* 排名徽章 — 设计稿：top1 金色 / top2 银色 / top3 铜色 */}
              <View
                className={cn(
                  'w-[40rpx] h-[40rpx] rounded-full flex items-center justify-center text-[22rpx] font-bold',
                  rankStyle(i),
                )}
              >
                {i + 1}
              </View>
              <Text className="text-[32rpx]">{s.icon}</Text>
              <View className="flex-1">
                <Text className="text-[26rpx] font-medium text-foreground">{s.name}</Text>
                <Text className="text-[20rpx] text-muted-foreground">{s.students} 名学员</Text>
              </View>
              <Text className="text-[26rpx] font-semibold text-primary">
                {formatWan(s.revenue)}万
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ===== 教师概况 — 设计稿：.data-section ===== */}
      <View className="mx-[32rpx] mb-[24rpx] bg-card rounded-[24rpx] p-[24rpx] shadow-card">
        <View className="flex flex-row items-center gap-[12rpx] mb-[16rpx]">
          <Text className="text-[28rpx]">👨‍🏫</Text>
          <Text className="text-[28rpx] font-semibold text-foreground">教师概况</Text>
        </View>
        <View className="grid grid-cols-2 gap-0">
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">教师总数</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">
              {tea ? `${tea.total} 人` : '-'}
            </Text>
          </View>
          <View className="py-[12rpx] border-b border-border">
            <Text className="text-[22rpx] text-muted-foreground">人均课时</Text>
            <Text className="text-[28rpx] font-semibold text-foreground">
              {tea
                ? period === 'month'
                  ? tea.avgHours
                  : Math.round(cou.totalHours / tea.total)
                : '-'}{' '}
              节
            </Text>
          </View>
          {period === 'month' && tea && (
            <>
              <View className="py-[12rpx] border-b border-border">
                <Text className="text-[22rpx] text-muted-foreground">全职</Text>
                <Text className="text-[28rpx] font-semibold text-foreground">
                  {tea.fullTime} 人
                </Text>
              </View>
              <View className="py-[12rpx] border-b border-border">
                <Text className="text-[22rpx] text-muted-foreground">兼职</Text>
                <Text className="text-[28rpx] font-semibold text-foreground">
                  {tea.partTime} 人
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* 底部安全间距 */}
      <View className="h-[32rpx]" />
    </PageContainer>
  );
}
