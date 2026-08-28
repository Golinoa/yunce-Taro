/**
 * 构建期注入的环境变量（Webpack defineConstants 在编译时替换为字面量）
 *
 * 默认生产模式：Mock 关、API 指向线上。
 * 显式 VITE_USE_MOCK=true 才启用 Mock（dev:weapp:mock / build:weapp:mock）。
 *
 * 注意：小程序运行时通常没有 Node `process`。不要用
 * `typeof process !== 'undefined'` 包住 env 读取——否则 define 后的字面量
 * 永远进不了分支，mock 包也会误走生产 API（表现为登录成线上演示号 1589…）。
 */
export const PROD_API_BASE_URL = 'https://api.chancore.cn/api/app/v1';

/** webpack 将 process.env.VITE_USE_MOCK 替换为 '"true"' | '"false"' 字面量 */
export function isUseMock(): boolean {
  return process.env.VITE_USE_MOCK === 'true';
}

/** webpack 将 process.env.TARO_API_BASE_URL 替换为 API 基址字面量 */
export function getApiBaseUrl(): string {
  return process.env.TARO_API_BASE_URL || PROD_API_BASE_URL;
}

/** @deprecated 使用 getApiBaseUrl()；保留别名供逐步迁移 */
export const API_BASE_URL = getApiBaseUrl();
