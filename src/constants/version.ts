/**
 * 应用版本�? *
 * �?package.json �?version 字段为唯一数据源，通过构建�?defineConstants 注入�? * 禁止在组件内硬编码版本号�? */
export const APP_VERSION = process.env.TARO_APP_VERSION ?? '0.0.0';
