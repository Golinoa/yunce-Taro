/**
 * QrCanvas - 小程�?Canvas 二维码（前端自生成）
 */
import { Canvas, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import cn from 'classnames';
import React, { useCallback, useEffect, useId, useState } from 'react';
import UQRCode from 'uqrcodejs';

export interface QrCanvasProps {
  /** 二维码编码内�?*/
  value: string;
  /** 边长（px�?*/
  size?: number;
  /** 指定 canvasId（用于导出图片，需唯一�?*/
  canvasId?: string;
  className?: string;
}

const QrCanvas: React.FC<QrCanvasProps> = ({ value, size = 200, canvasId: canvasIdProp, className }) => {
  const reactId = useId();
  const canvasId = canvasIdProp || `qr-${reactId.replace(/:/g, '')}`;
  const [ready, setReady] = useState(false);

  const drawQr = useCallback(() => {
    if (!value.trim()) return;

    try {
      const qr = new UQRCode();
      qr.data = value;
      qr.size = size;
      qr.make();

      const canvasContext = Taro.createCanvasContext(canvasId);
      qr.canvasContext = canvasContext;
      qr.drawCanvas();
      setReady(true);
    } catch {
      setReady(false);
    }
  }, [canvasId, size, value]);

  useEffect(() => {
    const timer = setTimeout(drawQr, 80);
    return () => clearTimeout(timer);
  }, [drawQr]);

  return (
    <View className={cn('relative', className)} style={{ width: size, height: size }}>
      <Canvas
        canvasId={canvasId}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="block"
      />
      {!ready && (
        <View
          className="absolute inset-0 center bg-muted rounded-[16rpx]"
          style={{ width: size, height: size }}
        >
          <View className="text-[24rpx] text-muted-foreground">生成�?..</View>
        </View>
      )}
    </View>
  );
};

export default QrCanvas;
