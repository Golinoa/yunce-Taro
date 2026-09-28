/**
 * 构建期注入的环境变量（Webpack defineConstants 在编译时替换为字面量）
 *
 * 默认生产模式：API 指向线上；测环境包注入 TARO_API_BASE_URL=dev.chancore.cn。
 * 运行时 Mock 分支已拆除；请用 build:weapp:dev / build:weapp:prod。
 *
 * 注意：小程序运行时通常没有 Node `process`。不要用
 * `typeof process !== 'undefined'` 包住 env 读取——否则 define 后的字面量
 * 永远进不了分支。
 */
export const PROD_API_BASE_URL = 'https://api.chancore.cn/api/app/v1';

/**
 * @deprecated Phase F：始终返回 false。运行时不再走 Mock；残留调用方应删除本检查。
 */
export function isUseMock(): boolean {
  return false;
}

/** webpack 将 process.env.TARO_API_BASE_URL 替换为 API 基址字面量 */
export function getApiBaseUrl(): string {
  return process.env.TARO_API_BASE_URL || PROD_API_BASE_URL;
}

/**
 * 邀约 H5 落地页的网址前缀。
 *
 * 由构建期变量 `TARO_H5_LANDING_BASE_URL` 注入（**换域名只改这一个变量**，不必动代码）；
 * 未配置时回落到站点根（从 API 基址推导），行为与加变量前一致。
 */
export function getLandingBaseUrl(): string {
  const configured = process.env.TARO_H5_LANDING_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return getSiteOrigin();
}

/**
 * 站点根地址（由 API 基址去掉 `/api/...` 后缀得到，作为落地页前缀的兜底）。
 * `https://dev.chancore.cn/api/app/v1` → `https://dev.chancore.cn`。
 */
export function getSiteOrigin(): string {
  const base = getApiBaseUrl();
  const apiIndex = base.indexOf('/api/');
  const origin = apiIndex > 0 ? base.slice(0, apiIndex) : base;
  return origin.replace(/\/+$/, '');
}

/** 测环境包：基址指向 dev.chancore.cn（或显式 TARO_ENABLE_LOCAL_DEBUG） */
export function isDevApiEnv(): boolean {
  if (process.env.TARO_ENABLE_LOCAL_DEBUG === 'true') return true;
  const base = getApiBaseUrl();
  return (
    base.includes('dev.chancore.cn') || base.includes('127.0.0.1') || base.includes('localhost')
  );
}

/** @deprecated 使用 getApiBaseUrl()；保留别名供逐步迁移 */
export const API_BASE_URL = getApiBaseUrl();
