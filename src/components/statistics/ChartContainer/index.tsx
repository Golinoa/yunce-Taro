/**
 * ChartContainer - 纵向柱状图组件
 * 使用微信小程序 Canvas API 手动绘制柱状图
 * 绘制完成后转为图片显示，避免原生 Canvas 滚动时浮出容器
 *
 * 支持不同页面展示不同数据：
 * - 运营页：课时消耗趋势（蓝色柱）
 * - 财务页：收入趋势（紫色柱）
 */
import { View, Text, Canvas, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';
import { hexColors } from '@/theme';

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

// 主题色映射
const THEME_MAP: Record<ChartTheme, { bar: string; barLight: string; barFill: string }> = {
  primary: {
    bar: hexColors.primary,
    barLight: hexColors.primaryLight,
    barFill: 'rgba(59, 110, 245, 0.85)',
  },
  accent: {
    bar: hexColors.accent,
    barLight: hexColors.accentLight,
    barFill: 'rgba(139, 92, 246, 0.85)',
  },
  success: {
    bar: hexColors.success,
    barLight: '#34d399',
    barFill: 'rgba(16, 185, 129, 0.85)',
  },
};

const GRID_COLOR = hexColors.border;
const LABEL_COLOR = hexColors.mutedForeground;

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

function drawBarChart(
  canvasId: string,
  data: ChartDataItem[],
  _unit: string,
  theme: ChartTheme,
  onDrawComplete: (tempFilePath: string) => void,
) {
  const instance = Taro.getCurrentInstance();
  const page = instance?.page as unknown as Parameters<typeof Taro.canvasToTempFilePath>[1];
  const ctx = Taro.createCanvasContext(canvasId, page);
  if (!ctx) return;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const colors = THEME_MAP[theme];

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 绘制Y轴网格线 + 标签
  const ySteps = [0, 0.25, 0.5, 0.75, 1];
  ySteps.forEach((step) => {
    const y = PAD_TOP + CHART_H - step * CHART_H;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, y);
    ctx.lineTo(PAD_LEFT + CHART_W, y);
    ctx.setStrokeStyle(GRID_COLOR);
    ctx.setLineDash(step === 0 || step === 1 ? [] : [3, 3], 0);
    ctx.setLineWidth(1);
    ctx.stroke();
    ctx.setLineDash([], 0);

    const val = Math.round(maxVal * step);
    ctx.setFillStyle(LABEL_COLOR);
    ctx.font = '10px sans-serif';
    ctx.setTextAlign('right');
    ctx.setTextBaseline('middle');
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

    // 绘制圆角柱子（用矩形+圆角顶部模拟）
    ctx.beginPath();
    ctx.moveTo(x, y + barRadius);
    ctx.arcTo(x, y, x + barRadius, y, barRadius);
    ctx.arcTo(x + barWidth, y, x + barWidth, y + barRadius, barRadius);
    ctx.lineTo(x + barWidth, PAD_TOP + CHART_H);
    ctx.lineTo(x, PAD_TOP + CHART_H);
    ctx.closePath();

    // 渐变填充
    const gradient = ctx.createLinearGradient(x, y, x, PAD_TOP + CHART_H);
    gradient.addColorStop(0, colors.barFill);
    gradient.addColorStop(1, colors.bar);
    ctx.setFillStyle(gradient);
    ctx.fill();

    // X轴标签
    ctx.setFillStyle(LABEL_COLOR);
    ctx.font = '10px sans-serif';
    ctx.setTextAlign('center');
    ctx.setTextBaseline('top');
    ctx.fillText(item.label, x + barWidth / 2, CANVAS_H - 18);
  });

  ctx.draw(false, () => {
    setTimeout(() => {
      Taro.canvasToTempFilePath(
        {
          canvasId,
          success: (res) => {
            if (res.tempFilePath) onDrawComplete(res.tempFilePath);
          },
          fail: (err) => {
            console.warn('ChartContainer: canvasToTempFilePath failed', err);
          },
        },
        page,
      );
    }, 200);
  });
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  data,
  unit = '',
  theme = 'primary',
}) => {
  const canvasIdRef = useRef(`bc-${Math.random().toString(36).slice(2, 9)}`);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (!data || data.length === 0) return;
    setImageUrl('');
    setTimeout(() => {
      drawBarChart(canvasIdRef.current, data, unit, theme, (tempFilePath) =>
        setImageUrl(tempFilePath),
      );
    }, 300);
  }, [data, unit, theme]);

  if (!data || data.length === 0) {
    return (
      <View className="bg-white rounded-2xl p-4 shadow-soft mb-5">
        <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>
        <View className="flex items-center justify-center h-50">
          <Text className="text-base text-muted-foreground">暂无数据</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-4 shadow-soft mb-5">
      {title && <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>}
      <View className="flex justify-center">
        <Canvas
          canvasId={canvasIdRef.current}
          style={{
            width: `${CANVAS_W}px`,
            height: `${CANVAS_H}px`,
            position: 'fixed',
            left: '-9999px',
            top: '-9999px',
          }}
        />
        {imageUrl ? (
          <Image src={imageUrl} mode="widthFix" style={{ width: `${CANVAS_W}px` }} />
        ) : (
          <View style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }} />
        )}
      </View>
    </View>
  );
};

export default ChartContainer;
