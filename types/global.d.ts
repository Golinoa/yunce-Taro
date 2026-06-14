/// <reference types="@tarojs/taro" />

// Taro 4.x 新增 API 类型补充（官方类型定义暂未覆盖）
// 使用 interface 合并而非 declare module 覆盖，避免丢失原有类型导出
declare namespace Taro {
  interface TaroStatic {
    /** 设置页面样式（Taro 4.x 新增，用于运行时主题切换） */
    setPageStyle?(options: { style: Record<string, string> }): Promise<void>;
  }
}

// 小程序 page 元素类型补充
interface PageElement extends Element {
  style: CSSStyleDeclaration;
}

// 微信小程序 wx 全局对象（简易类型声明）
declare const wx: {
  getStorageSync(key: string): string;
  setStorageSync(key: string, data: unknown): void;
  removeStorageSync(key: string): void;
  getSystemInfoSync(): { windowHeight: number; windowWidth: number; statusBarHeight: number };
  showToast(options: { title: string; icon?: string; duration?: number }): void;
  navigateTo(options: { url: string }): void;
  navigateBack(options?: { delta?: number }): void;
};

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'quickapp' | 'qq' | 'jd'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
  }
}
