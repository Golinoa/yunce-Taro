/**
 * ChartContainer - 折线图容器组件
 * 使用微信小程序 Canvas API 手动绘制折线图
 * 绘制完成后转为图片显示，避免原生 Canvas 滚动时浮出容器
 */
import { View, Text, Canvas, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useRef, useState } from 'react';

export interface ChartDataItem {
  label: string;
  value: number;
  unit?: string;
}

interface ChartContainerProps {
  title: string;
  data: ChartDataItem[];
  unit?: string;
}

const CANVAS_W = 320;
const CANVAS_H = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 24;
const PAD_TOP = 10;
const PAD_BOTTOM = 32;
const PAD_INNER = 20;
const CHART_W = CANVAS_W - PAD_LEFT - PAD_RIGHT;
const CHART_H = CANVAS_H - PAD_TOP - PAD_BOTTOM;

const LINE_COLOR = '#5EC8A8';
const GRID_COLOR = '#e2e8f0';
const LABEL_COLOR = '#94a3b8';
const VALUE_COLOR = '#64748b';
const FILL_COLOR = 'rgba(94, 200, 168, 0.12)';

function drawChart(
  canvasId: string,
  data: ChartDataItem[],
  unit: string,
  onDrawComplete: (tempFilePath: string) => void,
) {
  const instance = Taro.getCurrentInstance();
  const page = instance?.page as unknown as Parameters<typeof Taro.canvasToTempFilePath>[1];
  const ctx = Taro.createCanvasContext(canvasId, page);
  if (!ctx) return;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

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
    ctx.fillText(`${val}${unit}`, PAD_LEFT - 6, y);
  });

  const points = data.map((item, i) => ({
    x:
      PAD_LEFT +
      PAD_INNER +
      (data.length > 1
        ? (i / (data.length - 1)) * (CHART_W - 2 * PAD_INNER)
        : (CHART_W - 2 * PAD_INNER) / 2),
    y: PAD_TOP + CHART_H - (item.value / maxVal) * CHART_H,
    label: item.label,
    value: item.value,
  }));

  if (points.length > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p, i) => {
      if (i > 0) ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(points[points.length - 1].x, PAD_TOP + CHART_H);
    ctx.lineTo(points[0].x, PAD_TOP + CHART_H);
    ctx.closePath();
    ctx.setFillStyle(FILL_COLOR);
    ctx.fill();
  }

  if (points.length > 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p, i) => {
      if (i > 0) ctx.lineTo(p.x, p.y);
    });
    ctx.setStrokeStyle(LINE_COLOR);
    ctx.setLineWidth(2.5);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');
    ctx.stroke();
  }

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    ctx.setFillStyle('#ffffff');
    ctx.fill();
    ctx.setStrokeStyle(LINE_COLOR);
    ctx.setLineWidth(2.5);
    ctx.stroke();
  });

  points.forEach((p) => {
    ctx.setFillStyle(VALUE_COLOR);
    ctx.font = '10px sans-serif';
    ctx.setTextAlign('center');
    ctx.setTextBaseline('top');
    ctx.fillText(p.label, p.x, CANVAS_H - 18);
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

const ChartContainer: React.FC<ChartContainerProps> = ({ title, data, unit = '' }) => {
  const canvasIdRef = useRef(`lc-${Math.random().toString(36).slice(2, 9)}`);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (!data || data.length === 0) return;
    setImageUrl('');
    setTimeout(() => {
      drawChart(canvasIdRef.current, data, unit, (tempFilePath) => setImageUrl(tempFilePath));
    }, 300);
  }, [data, unit]);

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
      <Text className="text-lg font-semibold text-foreground block mb-4">{title}</Text>
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
