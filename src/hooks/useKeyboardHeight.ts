/**
 * 监听微信小程序键盘高度变化。
 *
 * 使用场景：底部弹窗/就近弹框在输入时需整体上移，避免被键盘遮挡。
 */
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';

export function useKeyboardHeight(active = true): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!active) {
      setKeyboardHeight(0);
      return;
    }

    const handleChange: Taro.onKeyboardHeightChange.Callback = (res) => {
      setKeyboardHeight(res.height ?? 0);
    };

    Taro.onKeyboardHeightChange(handleChange);
    return () => {
      Taro.offKeyboardHeightChange(handleChange);
    };
  }, [active]);

  return keyboardHeight;
}
