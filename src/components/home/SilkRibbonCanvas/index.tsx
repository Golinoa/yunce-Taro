import { Canvas, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import React, { useEffect, useRef } from 'react';

/**
 * 丝绸飘带Canvas组件
 * 直接复刻设计稿 homepages.html 中 SVG silk-ribbon-svg 的3条飘带路径
 * 微信小程序不支持内联SVG，使用Canvas 2D绘制替代
 */

/** 设计稿SVG路径数据 */
const RIBBON_PATHS = [
  {
    // 路径1: 左上→右中→左下的大S形，silkGrad1(white 55%→25%→0%)
    points: [
      [-20, 20],
      [80, 60],
      [150, 40],
      [220, 20],
      [280, 80],
      [340, 140],
      [400, 100],
      [460, 60],
      [450, 180],
      [440, 280],
      [350, 260],
      [260, 240],
      [200, 280],
      [140, 320],
      [60, 280],
      [-20, 240],
      [-20, 180],
    ],
    gradient: {
      x1: 0,
      y1: 0,
      x2: 430,
      y2: 340,
      stops: [
        [0, 0.55],
        [0.5, 0.25],
        [1, 0],
      ],
    },
  },
  {
    // 路径2: 中上→右→回中的环形，silkGrad2(white 45%→18%→0%)
    points: [
      [200, -20],
      [280, 40],
      [350, 20],
      [420, 0],
      [450, 60],
      [480, 120],
      [420, 160],
      [360, 200],
      [300, 160],
      [240, 120],
      [200, 160],
      [160, 200],
      [180, 120],
      [200, 40],
      [200, -20],
    ],
    gradient: {
      x1: 430,
      y1: 0,
      x2: 0,
      y2: 340,
      stops: [
        [0, 0.45],
        [0.4, 0.18],
        [1, 0],
      ],
    },
  },
  {
    // 路径3: 左中→右→左下的大弧，silkGrad3(white 40%→12%→0%)
    points: [
      [-20, 150],
      [100, 120],
      [200, 160],
      [300, 200],
      [400, 150],
      [460, 120],
      [450, 200],
      [440, 280],
      [350, 250],
      [260, 220],
      [150, 260],
      [40, 300],
      [-20, 250],
    ],
    gradient: {
      x1: 215,
      y1: 0,
      x2: 215,
      y2: 340,
      stops: [
        [0, 0.4],
        [0.6, 0.12],
        [1, 0],
      ],
    },
  },
];

/** 将设计稿坐标点转为Canvas二次贝塞尔曲线路径 */
function drawSmoothPath(ctx: CanvasRenderingContext2D, points: number[][]) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i][0] + points[i + 1][0]) / 2;
    const yc = (points[i][1] + points[i + 1][1]) / 2;
    ctx.quadraticCurveTo(points[i][0], points[i][1], xc, yc);
  }

  const last = points[points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.closePath();
}

const CANVAS_ID = 'silkRibbon';

const SilkRibbonCanvas: React.FC = () => {
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (hasDrawn.current) return;

    // 延迟执行确保Canvas节点已挂载
    setTimeout(() => {
      const query = Taro.createSelectorQuery();
      query
        .select(`#${CANVAS_ID}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res?.[0]?.node) {
            console.warn('[SilkRibbonCanvas] Canvas节点未找到');
            return;
          }

          const canvas = res[0].node as unknown as {
            getContext: (type: string) => CanvasRenderingContext2D;
            width: number;
            height: number;
          };
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
          // 使用新版 getWindowInfo 替代已弃用的 getSystemInfoSync
          const dpr = Taro.getWindowInfo().pixelRatio;

          // 设计稿尺寸 430x340
          const designW = 430;
          const designH = 340;
          canvas.width = designW * dpr;
          canvas.height = designH * dpr;
          ctx.scale(dpr, dpr);

          // 全局透明度 0.35（对齐设计稿 .silk-ribbon-svg opacity）
          ctx.globalAlpha = 0.35;

          // 模拟 feGaussianBlur(stdDeviation=12)
          ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
          ctx.shadowBlur = 24;

          RIBBON_PATHS.forEach((ribbon) => {
            const grad = ctx.createLinearGradient(
              ribbon.gradient.x1,
              ribbon.gradient.y1,
              ribbon.gradient.x2,
              ribbon.gradient.y2,
            );
            ribbon.gradient.stops.forEach(([offset, alpha]) => {
              grad.addColorStop(offset, `rgba(255, 255, 255, ${alpha})`);
            });

            drawSmoothPath(ctx, ribbon.points);
            ctx.fillStyle = grad;
            ctx.fill();
          });

          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          hasDrawn.current = true;
        });
    }, 300);
  }, []);

  return (
    <View className="silk-ribbon-canvas-wrapper">
      <Canvas
        id={CANVAS_ID}
        type="2d"
        className="silk-ribbon-canvas"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
};

export default SilkRibbonCanvas;
