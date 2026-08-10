/**
 * 应用版本号
 *
 * 以 package.json 的 version 字段为唯一数据源，通过构建时 defineConstants 注入，
 * 禁止在组件内硬编码版本号。
 */
export const APP_VERSION = process.env.TARO_APP_VERSION ?? '0.0.0';
