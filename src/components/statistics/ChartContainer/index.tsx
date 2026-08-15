/**
 * ChartContainer - 纵向柱状图组件
 * 使用 Canvas 2D 同层渲染柱状图，减少旧版 canvas -> 图片 的转换开销
 *
 * 支持不同页面展示不同数据：
 * - 运营页：课时消耗趋势（蓝色柱）
 * - 财务页：收入趋势（紫色柱）
 */
import { View, Text, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useMemo, useRef } from 'react';
import { useThemeStore } from '@/stores/theme';
import { getThemeHexColors } from '@/theme';

export interface ChartDataItem {
  label: string;
  value: number;
  unit?: string;
}

/** 柱状图主题色预设 */
export type ChartTheme = 'primary' | 'accent' | 'success';

interface ChartContainerProps {
  /** 卡片标题 */
  title: string;
  /** 图表数据 */
  data: ChartDataItem[];
  /** 数值单位 */
  unit?: string;
  /** 主题色：primary=蓝(运营) accent=紫(财务) success=绿 */
  theme?: ChartTheme;
}

const CANVAS_W = 340;
const CANVAS_H = 220;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 36;
const CHART_W = CANVAS_W - PAD_LEFT - PAD_RIGHT;
const CHART_H = CANVAS_H - PAD_TOP - PAD_BOTTOM;

function getThemeChartColors(theme: ChartTheme, hex: ReturnType<typeof getThemeHexColors>) {
  switch (theme) {
    case 'accent':
      return { bar: hex.accent, barLight: hex.accentLight, barFillOpacity: 0.85 };
    case 'success':
      return { bar: hex.success, barLight: hex.successLight, barFillOpacity: 0.85 };
    case 'primary':
    default:
      return { bar: hex.primary, barLight: hex.primaryLight, barFillOpacity: 0.85 };
  }
}

interface Canvas2DNode {
  width: number;
  height: number;
  getContext: (contextId: '2d') => CanvasRenderingContext2D | null;
}

interface CanvasNodeQueryResult {
  node?: Canvas2DNode;
}

/**
 * 格式化Y轴数值：长数字截断
 */
function formatAxisValue(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  const w = n / 10000;
  return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`;
}

function drawRoundedTopBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  bottomY: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, bottomY);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, bottomY);
  ctx.closePath();
}

interface ChartDrawColors {
  bar: string;
  barLight: string;
  barFillOpacity: number;
  grid: string;
  label: string;
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  data: ChartDataItem[],
  colors: ChartDrawColors,
) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const bottomY = PAD_TOP + CHART_H;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();

  // 绘制Y轴网格线 + 标签
  const ySteps = [0, 0.25, 0.5, 0.75, 1];
  ySteps.forEach((step) => {
    const y = PAD_TOP + CHART_H - step * CHART_H;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(PAD_LEFT + CHART_W, y);
    ctx.strokeStyle = colors.grid;
    ctx.setLineDash(step === 0 || step === 1 ? [] : [3, 3]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    const val = Math.round(maxVal * step);
    ctx.fillStyle = colors.label;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatAxisValue(val), PAD_LEFT - 6, y);
  });

  // 计算柱子参数
  const barCount = data.length;
  const groupWidth = CHART_W / barCount;
  const barWidth = Math.min(groupWidth * 0.55, 28);
  const barRadius = Math.min(barWidth / 4, 4);

  data.forEach((item, i) => {
    const barH = Math.max((item.value / maxVal) * CHART_H, 2);
    const x = PAD_LEFT + groupWidth * i + (groupWidth - barWidth) / 2;
    const y = PAD_TOP + CHART_H - barH;

    // 绘制顶部圆角柱子，底部与坐标轴贴合
    drawRoundedTopBar(ctx, x, y, barWidth, bottomY, barRadius);

    // 渐变填充
    const gradient = ctx.createLinearGradient(x, y, x, bottomY);
    gradient.addColorStop(0, colors.barLight);
    gradient.addColorStop(1, colors.bar);
    ctx.globalAlpha = colors.barFillOpacity;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.globalAlpha = 1;

    // X轴标签
    ctx.fillStyle = colors.label;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.label, x + barWidth / 2, CANVAS_H - 18);
  });
  ctx.restore();
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  data,
  unit = '',
  theme = 'primary',
}) => {
  const canvasIdRef = useRef(`bc-${Math.random().toString(36).slice(2, 9)}`);
  const { activeTheme } = useThemeStore();
  const colors = useMemo(() => {
    const hex = getThemeHexColors(activeTheme);
    const themeColors = getThemeChartColors(theme, hex);
    return {
      ...themeColors,
      grid: hex.border,
      label: hex.mutedForeground,
    };
  }, [activeTheme, theme]);

  useEffect(() => {
    if (!data || data.length === 0) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const query = Taro.createSelectorQuery();
      query
        .select(`#${canvasIdRef.current}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (cancelled) {
            return;
          }

          const target = res?.[0] as CanvasNodeQueryResult | undefined;
          const canvas = target?.node;
          if (!canvas) {
            console.warn('ChartContainer: Canvas 2D 节点未找到');
            return;
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('ChartContainer: Canvas 2D 上下文获取失败');
            return;
          }

          const dpr = Taro.getWindowInfo().pixelRatio || 1;
          canvas.width = CANVAS_W * dpr;
          canvas.height = CANVAS_H * dpr;
          if (typeof ctx.setTransform === 'function') {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.scale(dpr, dpr);

          drawBarChart(ctx, data, colors);
        });
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, unit, theme, colors]);

  if (!data || data.length === 0) {
    return (
      <View className="bg-card rounded-2xl p-4 shadow-soft mb-5">
        <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>
        <View className="flex items-center justify-center h-50">
          <Text className="text-base text-muted-foreground">暂无数据</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-card rounded-2xl p-4 shadow-soft mb-5">
      {title && <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>}
      <View className="flex justify-center">
        <Canvas
          id={canvasIdRef.current}
          type="2d"
          style={{
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
          }}
        />
      </View>
    </View>
  );
};

export default ChartContainer;
