import { View, Text, ScrollView, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/Card';
import Icon from '@/components/Icon';
import SegmentedControl from '@/components/SegmentedControl';
import type { FinanceDetailType, RevenueTrendItem } from '@/types/data-center';
import { dataCenterService } from '@/services/data-center';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';
import { useThemedNavigationBar } from '@/utils/navigation-bar';
import { withRouteGuard } from '@/utils/route-guard';

const CHART_CANVAS_W = 340;
const CHART_CANVAS_H = 260;
const CHART_PAD_LEFT = 48;
const CHART_PAD_RIGHT = 16;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 36;
const CHART_AREA_W = CHART_CANVAS_W - CHART_PAD_LEFT - CHART_PAD_RIGHT;
const CHART_AREA_H = CHART_CANVAS_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;

/** 格式化 Y 轴数值 */
function formatYAxisValue(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const w = n / 10000;
  return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`;
}

/**
 * 财务数据详情页
 *
 * 展示财务详细数据，包含：
 * - 顶部主题色渐变头部：场馆选择 + 日期选择 + 日/月/年切换
 * - KPI 概览卡片：收入/支出/浮盈/纯利 2x2 布局
 * - 收支趋势图：带 XY 轴线的折线图（收入+支出两条线）
 * - 数据明细卡片：按日期分类的收支明细
 * - 右下角"记一笔"悬浮按钮
 */
const FinanceData: React.FC = () => {
  const { activeTheme } = useThemeStore();
  const [data, setData] = useState<FinanceDetailType | null>(null);
  const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
  const canvasIdRef = useRef(`fc-${Math.random().toString(36).slice(2, 9)}`);

  // 导航栏背景色与渐变顶部一致
  useThemedNavigationBar((themeHex) => ({
    backgroundColor: themeHex.primarySoftBg,
    frontColor: '#000000',
  }));

  const hexColors = useMemo(() => getThemeHexColors(activeTheme), [activeTheme]);

  /** 加载数据 */
  const loadData = useCallback(async () => {
    try {
      const result = await dataCenterService.getFinanceDetail({ periodType: period });
      setData(result);
    } catch {
      // ignore
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** 切换周期 */
  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value as 'day' | 'month' | 'year');
  }, []);

  /** 跳转记一笔 */
  const goRecordTransaction = useCallback(() => {
    Taro.navigateTo({ url: '/package-statistics/pages/record-transaction/index' });
  }, []);

  /** 格式化金额 */
  const formatMoney = (value: number): string => {
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString();
  };

  /** 获取当前周期的日期显示文本 */
  const periodDateText = useMemo(() => {
    if (period === 'day') return '2026年08月15日';
    if (period === 'month') return '2025年8月';
    return '2025年';
  }, [period]);

  /** 绘制折线图 */
  const drawLineChart = useCallback(() => {
    if (!data || data.incomeTrendData.length === 0) return;

    const incomeData = data.incomeTrendData;
    const expenseData = data.expenseTrendData;
    const allValues = [...incomeData.map((d) => d.value), ...expenseData.map((d) => d.value)];
    const maxVal = Math.max(...allValues, 1);

    const query = Taro.createSelectorQuery();
    query
      .select(`#${canvasIdRef.current}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const target = res?.[0] as
          | { node?: HTMLCanvasElement; size?: { width: number; height: number } }
          | undefined;
        const canvas = target?.node;
        if (!canvas) return;

        const ctx = (canvas as CanvasRenderingContext2D['canvas']).getContext('2d');
        if (!ctx) return;

        const dpr = Taro.getWindowInfo().pixelRatio || 1;
        canvas.width = CHART_CANVAS_W * dpr;
        canvas.height = CHART_CANVAS_H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, CHART_CANVAS_W, CHART_CANVAS_H);

        const bottomY = CHART_PAD_TOP + CHART_AREA_H;
        const gridColor = hexColors.border;
        const labelColor = hexColors.mutedForeground;
        const incomeColor = hexColors.primary;
        const expenseColor = hexColors.success;

        // 计算点位置
        const getX = (index: number, total: number) => {
          if (total <= 1) return CHART_PAD_LEFT + CHART_AREA_W / 2;
          return CHART_PAD_LEFT + (index / (total - 1)) * CHART_AREA_W;
        };
        const getY = (value: number) => {
          return bottomY - (value / maxVal) * CHART_AREA_H;
        };

        // 绘制 Y 轴网格线 + 标签（虚线）
        const ySteps = [0, 0.25, 0.5, 0.75, 1];
        ySteps.forEach((step) => {
          const y = CHART_PAD_TOP + CHART_AREA_H - step * CHART_AREA_H;
          ctx.beginPath();
          ctx.moveTo(CHART_PAD_LEFT, y);
          ctx.lineTo(CHART_PAD_LEFT + CHART_AREA_W, y);
          ctx.strokeStyle = gridColor;
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);

          const val = Math.round(maxVal * step);
          ctx.fillStyle = labelColor;
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(formatYAxisValue(val), CHART_PAD_LEFT - 6, y);
        });

        // 绘制 Y 轴竖线（实线）
        ctx.beginPath();
        ctx.moveTo(CHART_PAD_LEFT, CHART_PAD_TOP);
        ctx.lineTo(CHART_PAD_LEFT, bottomY);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 绘制 X 轴横线（实线）
        ctx.beginPath();
        ctx.moveTo(CHART_PAD_LEFT, bottomY);
        ctx.lineTo(CHART_PAD_LEFT + CHART_AREA_W, bottomY);
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 贝塞尔平滑曲线
        const drawSmoothLine = (dataArr: RevenueTrendItem[], color: string) => {
          if (dataArr.length === 0) return;

          const points = dataArr.map((item, index) => ({
            x: getX(index, dataArr.length),
            y: getY(item.value),
          }));

          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (points.length === 1) {
            ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
            ctx.stroke();
          } else if (points.length === 2) {
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
          } else {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[i - 1] || points[i];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = points[i + 2] || p2;

              // 控制点计算（Catmull-Rom 转贝塞尔）
              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
            ctx.stroke();
          }

          // 绘制数据点（实心圆 + 白色描边）
          points.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        };

        drawSmoothLine(expenseData, expenseColor);
        drawSmoothLine(incomeData, incomeColor);

        // X 轴标签（只显示首尾和中间几个）
        const len = incomeData.length;
        const labelIndices: number[] = [];
        if (len <= 7) {
          for (let i = 0; i < len; i++) labelIndices.push(i);
        } else {
          labelIndices.push(0);
          const step = Math.floor(len / 3);
          for (let i = step; i < len - 1; i += step) {
            labelIndices.push(i);
          }
          labelIndices.push(len - 1);
        }

        ctx.fillStyle = labelColor;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        labelIndices.forEach((idx) => {
          const x = getX(idx, len);
          ctx.fillText(incomeData[idx].label, x, CHART_CANVAS_H - 18);
        });
      });
  }, [data, hexColors]);

  // 数据或主题变化时重绘图表
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => drawLineChart(), 100);
    return () => clearTimeout(timer);
  }, [data, drawLineChart, activeTheme]);

  return (
    <View className={cn(`theme-${activeTheme}`, 'min-h-screen bg-background')}>
      {/* 顶部渐变头部 */}
      <View className="bg-gradient-diffuse-top pb-[48rpx] px-[32rpx] pt-[24rpx] relative overflow-hidden">
        {/* 场馆名称（左侧） */}
        <View className="mb-[24rpx] relative z-10">
          <Text className="text-[32rpx] font-bold text-foreground">云策健身</Text>
        </View>

        {/* 日期选择 + 周期切换 */}
        <View className="flex items-center justify-between relative z-10">
          <View className="flex items-center gap-[8rpx]">
            <Text className="text-[44rpx] font-bold text-foreground">{periodDateText}</Text>
            <Icon name="mdi-chevron-down" size={24} color="muted" />
          </View>
          <View className="w-[240rpx]">
            <SegmentedControl
              options={[
                { label: '日', value: 'day' },
                { label: '月', value: 'month' },
                { label: '年', value: 'year' },
              ]}
              value={period}
              onChange={handlePeriodChange}
            />
          </View>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="bg-background" scrollY style={{ marginTop: '-20rpx' }}>
        <View className="px-[24rpx] pb-[120rpx]">
          {/* KPI 概览卡片 */}
          <Card>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[20rpx]">
              KPI 概览
            </Text>
            <View className="grid grid-cols-2 gap-[16rpx]">
              <View className="bg-primary-5 rounded-[20rpx] p-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">收入</Text>
                <Text className="text-[40rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.income) : '0'}
                </Text>
              </View>
              <View className="bg-destructive-10 rounded-[20rpx] p-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">支出</Text>
                <Text className="text-[40rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.expense) : '0'}
                </Text>
              </View>
              <View className="bg-warning-bg rounded-[20rpx] p-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">浮盈</Text>
                <Text className="text-[40rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.float) : '0'}
                </Text>
              </View>
              <View className="bg-success-bg rounded-[20rpx] p-[24rpx]">
                <Text className="text-[24rpx] text-muted-foreground block mb-[8rpx]">纯利</Text>
                <Text className="text-[40rpx] font-bold text-foreground">
                  ¥{data ? formatMoney(data.profit) : '0'}
                </Text>
              </View>
            </View>
          </Card>

          {/* 收支趋势卡片 */}
          <Card>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[8rpx]">收支趋势</Text>
            <Text className="text-[24rpx] text-muted-foreground block mb-[16rpx]">
              {period === 'day'
                ? '近7日收支趋势'
                : period === 'month'
                  ? '近30日收支趋势'
                  : '全年收支趋势'}
            </Text>
            <View className="flex justify-center">
              <Canvas
                id={canvasIdRef.current}
                type="2d"
                style={{
                  width: `${CHART_CANVAS_W}px`,
                  height: `${CHART_CANVAS_H}px`,
                }}
              />
            </View>
            {/* 图例 */}
            <View className="flex items-center justify-center gap-[32rpx] mt-[16rpx]">
              <View className="flex items-center gap-[8rpx]">
                <View className="w-[24rpx] h-[4rpx] bg-primary rounded-full" />
                <Text className="text-[22rpx] text-muted-foreground">收入</Text>
              </View>
              <View className="flex items-center gap-[8rpx]">
                <View className="w-[24rpx] h-[4rpx] bg-success rounded-full" />
                <Text className="text-[22rpx] text-muted-foreground">支出</Text>
              </View>
            </View>
          </Card>

          {/* 数据明细卡片 */}
          <Card marginBottom={false}>
            <Text className="text-[30rpx] font-bold text-foreground block mb-[20rpx]">
              数据明细
            </Text>
            <View className="flex flex-col gap-[16rpx]">
              {data?.detailList.map((item, index) => (
                <View
                  key={index}
                  className="flex items-center justify-between py-[16rpx] border-b-[2rpx] border-border last:border-b-0"
                >
                  <View className="flex items-center gap-[16rpx]">
                    <View
                      className={`w-[56rpx] h-[56rpx] rounded-[16rpx] flex items-center justify-center ${
                        item.type === 'income' ? 'bg-success-bg' : 'bg-destructive-10'
                      }`}
                    >
                      <Icon
                        name={item.type === 'income' ? 'mdi-trending-up' : 'mdi-trending-down'}
                        size={28}
                        color={item.type === 'income' ? 'success' : 'destructive'}
                      />
                    </View>
                    <View>
                      <Text className="text-[28rpx] font-medium text-foreground block">
                        {item.category}
                      </Text>
                      <Text className="text-[22rpx] text-muted-foreground block mt-[4rpx]">
                        {item.date} {item.remark}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={`text-[30rpx] font-bold ${
                      item.type === 'income' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}¥{item.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* 记一笔悬浮按钮 */}
      <View
        className="fixed right-[32rpx] bottom-[48rpx] z-50 flex items-center gap-[8rpx] bg-gradient-primary px-[32rpx] py-[20rpx] rounded-full shadow-lg press-scale"
        onClick={goRecordTransaction}
      >
        <Icon name="mdi-pencil" size={24} color="white" />
        <Text className="text-[28rpx] font-medium text-white">记一笔</Text>
      </View>
    </View>
  );
};

export default withRouteGuard(FinanceData);
