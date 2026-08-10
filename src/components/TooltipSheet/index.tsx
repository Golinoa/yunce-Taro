/**
 * TooltipSheet - 统一说明提示弹窗
 *
 * 用于页面中点击问号图标后展示字段/功能说明，采用底部弹窗形式，
 * 适合较长文案，支持多行文本与确定按钮。
 *
 * 使用方式：
 *   const [visible, setVisible] = useState(false);
 *   <TooltipSheet
 *     visible={visible}
 *     title="单价说明"
 *     content="该课程的单次约课收费价格..."
 *     onClose={() => setVisible(false)}
 *   />
 */
import { View, Text } from '@tarojs/components';
import React from 'react';
import BottomSheet from '@/components/BottomSheet';

export interface TooltipSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 说明内容 */
  content: string;
  /** 关闭回调 */
  onClose: () => void;
}

const TooltipSheet: React.FC<TooltipSheetProps> = ({ visible, title, content, onClose }) => (
  <BottomSheet visible={visible} title={title} onClose={onClose} height="auto" scrollable={false}>
    <View className="px-[32rpx] pb-[48rpx] pt-[8rpx]">
      <Text className="text-[28rpx] text-foreground leading-relaxed">{content}</Text>
      <View
        className="mt-[40rpx] w-full py-[24rpx] rounded-full bg-primary flex items-center justify-center press-scale"
        onClick={onClose}
      >
        <Text className="text-[30rpx] font-semibold text-white">我知道了</Text>
      </View>
    </View>
  </BottomSheet>
);

export default TooltipSheet;
