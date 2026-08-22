/**
 * 带输入框的确认弹窗（微信 showModal editable 的 Taro 类型补齐）
 *
 * 使用场景：需要用户输入一段文本的轻量弹窗（如新建角色名称、配置阈值），
 * 避免为单字段输入引入完整表单组件。
 */
import Taro from '@tarojs/taro';

export interface InputModalResult {
  confirm: boolean;
  content?: string;
}

export interface InputModalOptions {
  title: string;
  content?: string;
  placeholderText?: string;
  confirmColor?: string;
  success?: (res: InputModalResult) => void;
}

export function showInputModal(options: InputModalOptions): void {
  Taro.showModal({
    title: options.title,
    content: options.content,
    confirmColor: options.confirmColor,
    editable: true,
    placeholderText: options.placeholderText,
    success: (res) => {
      const raw = res as unknown as { confirm: boolean; content?: string };
      options.success?.({ confirm: raw.confirm, content: raw.content });
    },
  } as unknown as Parameters<typeof Taro.showModal>[0]);
}
